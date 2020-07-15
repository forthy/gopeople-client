import { ConfigProvider, GoPeopleHost, GoPeopleAPIKey } from '../functions/config/configProvider';
import { left, right, Either } from 'fp-ts/lib/Either';
import { TaskEither, chain, taskEither, right as teRight, left as teLeft } from 'fp-ts/lib/TaskEither';
import { Option, some, none, fold as optFold } from 'fp-ts/lib/Option';
import { Do } from 'fp-ts-contrib/lib/Do';
import { map } from 'fp-ts/lib/Array';
import { Address, toJson as toAddressJson } from '../models/address';
import { Parcel, toJson as toParcelJson } from '../models/parcel';
import { DateTime } from 'luxon';
import * as _ from 'lodash';
import * as requestPromise from 'request-promise-native';
import { isNull } from 'lodash';

export { getQuote, QuoteOptions, ShiftType, GoNOW, GoSAMEDAY, QuoteInfo, Quote };

const GoNOW = { type: 'GoNOW' };
const GoSAMEDAY = { type: 'GoSAMEDAY' };

type ShiftType = typeof GoNOW | typeof GoSAMEDAY;

interface QuoteOptions {
  /**
   * required (set run is only enabled for jobs from store addresses that setup in your account)
   */
  addressFrom: Address;
  addressTo: Address;
  parcels: Parcel[];
  shiftType: ShiftType;
  /**
   * If the `pickUpAfter` field has a value (e.g. 2018-02-14 00:00:00 as the Sender only knows the date but not the time),
   * the Full Day Shift time window will be returned in the same day (2018-02-14 00:00:00 to 2018-02-14 17:00:00).<br/><br/>
   * If the `pickUpAfter` field is blank (the Sender does not know the date or time), the Full Day Shift time window will be returned on 2099-01-01.
   */
  pickUpAfter: Option<DateTime>;
  dropOffBy: Option<DateTime>;
  selfManagement?: boolean;
}

interface Quote {
  serviceName: string;
  objectId: string;
  amount: number;
  pickupAfter: DateTime;
  dropOffBy: DateTime;
}

interface QuoteInfo {
  distance: number;
  expiredAt: DateTime;
  goNowQuotes: Option<Quote[]>;
  goSameDayQuotes: Option<Quote[]>;
}

/**
 * Get shift quote from GoPeople
 *
 * @param options the function options for operation
 */
function getQuote(options: QuoteOptions): (configProvider: ConfigProvider) => TaskEither<Error, QuoteInfo> {
  interface Config {
    host: GoPeopleHost;
    key: GoPeopleAPIKey;
  }
  interface IBody {
    addressFrom: object;
    addressTo: object;
    parcels: object[];
    pickUpAfter: string | null;
    dropOffBy: string | null;
    onDemand: boolean;
    setRun: boolean;
    selfManagement?: boolean;
  }

  const b: IBody = {
    addressFrom: _.omitBy(toAddressJson(options.addressFrom), isNull),
    addressTo: _.omitBy(toAddressJson(options.addressTo), isNull),
    parcels: options.parcels.map((v, i, a) => _.omitBy(toParcelJson(v), _.isNull)),
    pickUpAfter: optFold<DateTime, string | null>(
      () => null,
      (d) => d.toFormat('yyyy-MM-dd HH:mm:ssZZZ'),
    )(options.pickUpAfter),
    dropOffBy: optFold<DateTime, string | null>(
      () => null,
      (d) => d.toFormat('yyyy-MM-dd HH:mm:ssZZZ'),
    )(options.dropOffBy),
    onDemand: options.shiftType.type === 'GoNOW' ? true : false,
    setRun: options.shiftType.type === 'GoSAMEDAY' ? true : false,
  };

  return (c) => {
    return chain<Error, Config, QuoteInfo>((config) => {
      return () =>
        requestPromise
          .post({
            method: 'POST',
            uri: `${config.host.h}/quote`,
            headers: {
              Authorization: `bearer ${config.key.key}`,
            },
            body: b,
            json: true,
          })
          .then((resp) => {
            return parseResponse(resp);
          })
          .catch((e) => {
            return left(new Error(`Error occurred when getting a shift quote, reason: ${JSON.stringify(e)}`));
          });
    })(
      Do(taskEither)
        .bind('h', c.host())
        .bind('k', c.key())
        .return((context) => {
          return { host: context.h, key: context.k };
        }),
    );
  };
}

function parseResponse(resp: object): Either<Error, QuoteInfo> {
  interface IQuote {
    serviceName: string;
    objectId: string;
    amount: number;
    currency: string;
    pickupAfter: string;
    dropOffBy: string;
  }

  let result: Either<Error, QuoteInfo>;

  if (_.has(resp, 'errorCode') && _.get(resp, 'errorCode') !== 0) {
    const errorCode = _.get(resp, 'errorCode', -1);
    const errorMsg = _.get(resp, 'message', 'Unhandled exception');
    const errorResult = JSON.stringify(_.get(resp, 'result', {}));
    const errorStr = `Error code: ${errorCode}, message: ${errorMsg}, result: ${errorResult}`;

    result = left(new Error(errorStr));
  } else {
    if (_.has(resp, 'result')) {
      const r: object = _.get(resp, 'result');

      if (_.has(r, 'distance') && _.has(r, 'expiredAt')) {
        let onDemandPriceList: Quote[];
        let setRunPriceList: Quote[];

        const distance = _.get(r, 'distance');
        const expiry = _.get(r, 'expiredAt');

        if (
          _.has(r, 'onDemandPriceList') &&
          _.isArray(_.get(r, 'onDemandPriceList')) &&
          !_.isEmpty(_.get(r, 'onDemandPriceList'))
        ) {
          onDemandPriceList = map<IQuote, Quote>((q) => {
            return {
              serviceName: q.serviceName,
              objectId: q.objectId,
              amount: q.amount,
              pickupAfter: DateTime.fromFormat(q.pickupAfter, 'yyyy-MM-dd HH:mm:ssZZZ'),
              dropOffBy: DateTime.fromFormat(q.dropOffBy, 'yyyy-MM-dd HH:mm:ssZZZ'),
            };
          })(_.get(r, 'onDemandPriceList') as IQuote[]);

          result = right({
            distance: distance as number,
            expiredAt: DateTime.fromFormat(expiry, 'yyyy-MM-dd HH:mm:ssZZZ'),
            goNowQuotes: some(onDemandPriceList),
            goSameDayQuotes: none,
          });
        } else if (
          _.has(r, 'setRunPriceList') &&
          _.isArray(_.get(r, 'setRunPriceList')) &&
          !_.isEmpty(_.get(r, 'setRunPriceList'))
        ) {
          setRunPriceList = map<IQuote, Quote>((q) => {
            return {
              serviceName: q.serviceName,
              objectId: q.objectId,
              amount: q.amount,
              pickupAfter: DateTime.fromFormat(q.pickupAfter, 'yyyy-MM-dd HH:mm:ssZZZ'),
              dropOffBy: DateTime.fromFormat(q.dropOffBy, 'yyyy-MM-dd HH:mm:ssZZZ'),
            };
          })(_.get(r, 'setRunPriceList') as IQuote[]);

          result = right({
            distance: distance as number,
            expiredAt: DateTime.fromFormat(expiry, 'yyyy-MM-dd HH:mm:ssZZZ'),
            goNowQuotes: none,
            goSameDayQuotes: some(setRunPriceList),
          });
        } else {
          result = left(new Error('No price list returned'));
        }
      } else {
        result = left(new Error('No distance or expiry'));
      }
    } else {
      result = left(new Error('No GoSHIFT result'));
    }
  }

  return result;
}
