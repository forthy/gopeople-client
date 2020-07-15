import { JobInfo, jobIdOf, trackingCodeOf } from "../models/jobInfo";
import {
  ConfigProvider,
  GoPeopleHost,
  GoPeopleAPIKey,
} from "../functions/config/configProvider";
import { TaskEither, taskEither, chain } from "fp-ts/lib/TaskEither";
import { Either, left, right } from "fp-ts/lib/Either";
import { Do } from "fp-ts-contrib/lib/Do";
import * as requestPromise from "request-promise-native";
import * as _ from "lodash";

export { quoteIdOf, descriptionOf, JobBookingReq, bookJob };

class QuoteId {
  constructor(readonly id: string) {}
}

function quoteIdOf(id: string) {
  return new QuoteId(id);
}

class Description {
  constructor(readonly txt: string) {}
}

function descriptionOf(txt: string) {
  return new Description(txt);
}

/**
 * A request data structure for booking a job
 */
interface JobBookingReq {
  /**
   * The quote ID acquired from the quotation flow
   */
  quoteId: QuoteId;

  /**
   * A description about this job
   */
  description: Description;
}

type Config = { host: GoPeopleHost; key: GoPeopleAPIKey };

/**
 * Book a GoNow or GoSAMEDAY job with an acquired quote ID from the quotation workflow
 *
 * @returns A `TaskEither<Error, JobInfo>`, A `JobInfo` contains job ID and tracking code for job tracking
 */
function bookJob(
  req: JobBookingReq,
): (configProvider: ConfigProvider) => TaskEither<Error, JobInfo> {
  const b = {
    quoteId: req.quoteId.id,
    description: req.description.txt,
  };

  return (c) => {
    return chain<Error, Config, JobInfo>((config) => {
      return async () => {
        return requestPromise
          .post({
            method: "POST",
            uri: `${config.host.h}/book`,
            headers: {
              Authorization: `bearer ${config.key.key}`,
            },
            body: b,
            json: true,
          })
          .then((resp) => {
            return parseResponse(resp);
          })
          .catch((err) => {
            return left<Error, JobInfo>(
              new Error(`'/book' API request error: ${JSON.stringify(err)}`),
            );
          });
      };
    })(
      Do(taskEither)
        .bind("h", c.host())
        .bind("k", c.key())
        .return(({ h, k }) => {
          return { host: h, key: k };
        }),
    );
  };
}

function parseResponse(resp: object): Either<Error, JobInfo> {
  let result: Either<Error, JobInfo>;

  if (_.has(resp, "errorCode") && _.get(resp, "errorCode") !== 0) {
    const errorCode = _.get(resp, "errorCode", -1);
    const errorMsg = _.get(resp, "message", "Unhandled exception");
    const errorResult = JSON.stringify(_.get(resp, "result", {}));
    const errorStr =
      `Error code: ${errorCode}, message: ${errorMsg}, result: ${errorResult}`;

    result = left(new Error(errorStr));
  } else {
    if (_.has(resp, "jobId") && _.has(resp, "trackingCode")) {
      result = right(
        new JobInfo(
          jobIdOf(_.get(resp, "jobId")),
          trackingCodeOf(
            _.get(resp, "trackingCode"),
          ),
        ),
      );
    } else {
      result = left(new Error("No 'jobId' or 'trackingCode' returned"));
    }
  }

  return result;
}
