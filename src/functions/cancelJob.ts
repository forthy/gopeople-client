import { TaskEither, chain, taskEither } from 'fp-ts/lib/TaskEither';
import { Either, right, left } from 'fp-ts/lib/Either';
import { Do } from 'fp-ts-contrib/lib/Do';
import { JobId, jobIdOf } from '../models/jobInfo';
import * as requestPromise from 'request-promise-native';
import * as _ from 'lodash';
import { ConfigProvider, GoPeopleHost, GoPeopleAPIKey } from './config/configProvider';

export { cancelJob };

type Config = { host: GoPeopleHost; key: GoPeopleAPIKey };
/**
 * Cancel an existing job.
 *
 * @param jobId - a `JobId` object which has the job ID used for cancelling an existing job
 */
function cancelJob(jobId: JobId): (configProvider: ConfigProvider) => TaskEither<Error, JobId> {
  return (c) => {
    return chain<Error, Config, JobId>((config) => {
      return async () =>
        requestPromise
          .delete({
            method: 'DELETE',
            uri: `${config.host.h}/job?id=${jobId.id}`,
            headers: {
              Authorization: `bearer ${config.key.key}`,
            },
            json: true,
          })
          .then((resp) => {
            return parseResponse(resp);
          })
          .catch((err) => {
            return left(new Error(`Failed to cancel a job - ${JSON.stringify(err)}`));
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

function parseResponse(resp: object): Either<Error, JobId> {
  let result: Either<Error, JobId>;

  if (_.has(resp, 'errorCode') && _.get(resp, 'errorCode') !== 0) {
    const errorCode = _.get(resp, 'errorCode', -1);
    const errorMsg = _.get(resp, 'message', 'Unhandled exception');
    const errorResult = JSON.stringify(_.get(resp, 'result', {}));
    const errorStr = `Error code: ${errorCode}, message: ${errorMsg}, result: ${errorResult}`;

    result = left(new Error(errorStr));
  } else {
    if (_.has(resp, 'result')) {
      const r: object = _.get(resp, 'result');

      if (_.has(r, 'jobId')) {
        result = right(jobIdOf(_.get(r, 'jobId')));
      } else {
        result = left(new Error('No cancelled job ID returned'));
      }
    } else {
      result = left(new Error('No cancel job result'));
    }
  }

  return result;
}
