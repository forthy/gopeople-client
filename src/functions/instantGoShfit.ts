import * as a from '../models/address';
import * as p from '../models/parcel';
import { DateTime } from 'luxon';
import { Either, left, right } from 'fp-ts/lib/Either';
import { TaskEither, tryCatch, fromEither, chain } from 'fp-ts/lib/TaskEither';
import * as arr from 'fp-ts/lib/Array';
import * as requestPromise from 'request-promise-native';
import * as _ from 'lodash';
import * as env from '../gopeople.config';

export { Description, descriptionOf, JobId, jobIdOf, TrackingCode, trackingCodeOf, JobInfo, instantGoShift };

class Description {
  constructor(readonly txt: string) {}
}

function descriptionOf(txt: string) {
  return new Description(txt);
}

class JobId {
  constructor(readonly id: string) {}
}

function jobIdOf(id: string): JobId {
  return new JobId(id);
}

class TrackingCode {
  constructor(readonly code: string) {}
}

function trackingCodeOf(code: string): TrackingCode {
  return new TrackingCode(code);
}

class JobInfo {
  constructor(readonly id: JobId, readonly code: TrackingCode) {}
}

/**
 * Instantly book a GoSHIFT job
 *
 * [GoPeople's instant GoSHIFT job booking](https://docs.gopeople.com.au/#instant-book-a-goshift-job)
 *
 * Sample:
 *
 * ```typescript
 * import * as a from '../models/address';
 * import * as p from '../models/parcel';
 *
 * const addressFrom = new a.Address(
 *   a.address1Of('85-93 Commonwealth St'),
 *   a.suburbOf('Surry Hills'),
 *   a.stateOf('NSW'),
 *   a.postcodeOf('2010'),
 *   false,
 *   none,
 *   none,
 *   none,
 *   some(new a.CompanyName('Nomad')),
 *   none,
 * );
 *
 * const addressto = new a.Address(
 *   a.address1Of('100 Pitt St'),
 *   a.suburbOf('Sydney'),
 *   a.stateOf('NSW'),
 *   a.postcodeOf('2000'),
 * );
 * const aParcel = new p.Parcel(p.Type.Grocery, new p.ParcelNumber(2));
 * const resp = await instantGoShift(
 *   addressFrom,
 *   addressto,
 *   [aParcel],
 *   DateTime.local().setZone('utc'),
 *   descriptionOf('Sushi set'),
 * )();
 *
 * expect(resp).toStrictEqual(
 *   right(new JobInfo(jobIdOf('894c0a10-fdb9-fb27-8ddb-d81c94a6e46c'),
 *                     trackingCodeOf('7OSPD3'))),
 * );
 * ```
 * `instantGoShift` function returns a [TaskEither<ErrorType, ResultType>](https://gcanti.github.io/fp-ts/modules/TaskEither.ts.html).
 *
 * __Why TaskEither?__
 *
 * Please read the explantion in the function {@link bookShifts}.
 *
 * @param fromAddress
 * @param toAddress
 * @param parcels
 * @param pickUpDate
 * @param description
 */
function instantGoShift(
  fromAddress: a.Address,
  toAddress: a.Address,
  parcels: p.Parcel[],
  pickUpDate: DateTime,
  description: Description,
): TaskEither<Error, JobInfo> {
  const b = {
    addressFrom: _.omitBy(a.toJson(fromAddress), _.isNull),
    addressTo: _.omitBy(a.toJson(toAddress), _.isNull),
    parcels: arr.map<p.Parcel, object>((x) => _.omitBy(p.toJson(x), _.isNull))(parcels),
    pickUpDate: pickUpDate.toFormat('yyyy-MM-dd HH:mm:ssZZZ'),
    description: description.txt,
  };

  return chain(fromEither)(
    tryCatch(
      async () =>
        requestPromise
          .post({
            method: 'POST',
            uri: `${env.goPeopleHost}/book/instant`,
            headers: {
              Authorization: `bearer ${env.goPeopleKey}`,
            },
            body: b,
            json: true,
          })
          .then((resp) => {
            return parseResponse(resp);
          })
          .catch((err) => {
            return left<Error, JobInfo>(new Error(`'/book/instant' API request error: ${JSON.stringify(err)}`));
          }),
      (err) => new Error(`'/book/instant' API request error: ${JSON.stringify(err)}`),
    ),
  );
}

function parseResponse(resp: object): Either<Error, JobInfo> {
  let result: Either<Error, JobInfo>;

  if (_.has(resp, 'errorCode') && _.get(resp, 'errorCode') !== 0) {
    const errorCode = _.get(resp, 'errorCode', -1);
    const errorMsg = _.get(resp, 'message', 'Unhandled exception');
    const errorResult = JSON.stringify(_.get(resp, 'result', {}));
    const errorStr = `Error code: ${errorCode}, message: ${errorMsg}, result: ${errorResult}`;

    result = left(new Error(errorStr));
  } else {
    if (_.has(resp, 'result')) {
      const r: object = _.get(resp, 'result');

      if (_.has(r, 'jobId') && _.has(r, 'trackingCode')) {
        result = right(new JobInfo(jobIdOf(_.get(r, 'jobId')), trackingCodeOf(_.get(r, 'trackingCode'))));
      } else {
        result = left(new Error('No job ID nor tracking code'));
      }
    } else {
      result = left(new Error('No GoSHIFT result'));
    }
  }

  return result;
}
