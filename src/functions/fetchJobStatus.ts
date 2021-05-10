import { DateTime } from 'luxon';
import { TaskEither, chain, taskEither } from 'fp-ts/lib/TaskEither';
import { Either, left, right } from 'fp-ts/lib/Either';
import * as _ from 'lodash';
import { ConfigProvider, GoPeopleHost, GoPeopleAPIKey } from './config/configProvider';
import { JobId, jobIdOf } from '../models/jobInfo';
import * as requestPromise from 'request-promise-native';
import { Do } from 'fp-ts-contrib/lib/Do';

export { Status, Ref, JobStatus, fetchJobStatus };

const enum Status {
  /**
   * the job is on the way
   */
  Delivering = 'delivering',
  /**
   * the job has been created
   */
  BookedIn = 'booked_in',
  /**
   * the job has been assigned to a runner
   */
  PickingUp = 'picking_up',
  /**
   * the job is on the return way
   */
  Returning = 'returning',
  /**
   * the job is delivering to a new address
   */
  Redelivering = 'redelivering',
  /**
   * the job is delivering to a collect point
   */
  CPDelivering = 'cp_delivering',
  /**
   * the job has been delivered and signed
   */
  Complete = 'complete',
  /**
   * the job has been delivered to a collect point
   */
  CPDelivered = 'cp_delivered',
  /**
   * the job has been returned to sender
   */
  Returned = 'returned',
  /**
   * the job has been closed
   */
  Closed = 'closed',
  /**
   * the job has been cancelled
   */
  Cancelled = 'cancelled',
  /**
   * the job has been abandoned, a new delivery may be arranged
   */
  Abandoned = 'abandoned',
}

type Ref = string;

interface JobStatus {
  readonly jobId: JobId;
  readonly status: Status;
  readonly ref: Ref;
}

type Config = { host: GoPeopleHost; key: GoPeopleAPIKey };

function fetchJobStatus(dt: DateTime): (configProvider: ConfigProvider) => TaskEither<Error, JobStatus[]> {
  return (c) => {
    return chain<Error, Config, JobStatus[]>((config) => {
      return async () =>
        requestPromise
          .get({
            method: 'GET',
            uri: `${config.host.h}/job/status?date=${dt.toFormat('yyyy-MM-dd')}`,
            headers: {
              Authorization: `bearer ${config.key.key}`,
            },
            json: true,
          })
          .then((resp) => {
            return parseResponse(resp);
          })
          .catch((err) => {
            return left<Error, JobStatus[]>(new Error(`'/book/instant' API request error: ${JSON.stringify(err)}`));
          });
    })(
      Do(taskEither)
        .bind('h', c.host())
        .bind('k', c.key())
        .return(({ h, k }) => {
          return { host: h, key: k };
        }),
    );
  };
}

function parseResponse(resp: object): Either<Error, JobStatus[]> {
  let result: Either<Error, JobStatus[]>;

  if (_.has(resp, 'errorCode') && _.get(resp, 'errorCode') !== 0) {
    const errorCode = _.get(resp, 'errorCode', -1);
    const errorMsg = _.get(resp, 'message', 'Unhandled exception');
    const errorResult = JSON.stringify(_.get(resp, 'result', {}));
    const errorStr = `Error code: ${errorCode}, message: ${errorMsg}, result: ${errorResult}`;

    result = left(new Error(errorStr));
  } else {
    if (_.has(resp, 'result')) {
      const r: object = _.get(resp, 'result');

      if (_.isArray(r)) {
        result = right(
          r.map((o, i, a) => {
            return { jobId: jobIdOf(_.get(o, 'jobId')), ref: _.get(o, 'ref', ''), status: _.get(o, 'status') };
          }),
        );
      } else {
        result = left(new Error('No job ID nor tracking code'));
      }
    } else {
      result = left(new Error('No job status result'));
    }
  }

  return result;
}
