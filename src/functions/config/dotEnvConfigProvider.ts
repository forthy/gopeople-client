import { ConfigProvider, GoPeopleHost, GoPeopleAPIKey, goPeopleHostOf, goPeopleAPIKeyOf } from './configProvider';
import { TaskEither, right, left } from 'fp-ts/lib/TaskEither';
import { pipe } from 'fp-ts/lib/pipeable';
import * as dotenv from 'dotenv';
import * as _ from 'lodash';

export { DotEnvConfigProvider };

class DotEnvConfigProvider implements ConfigProvider {
  constructor() {
    dotenv.config();
  }

  host(): TaskEither<Error, GoPeopleHost> {
    return pipe(process.env.GOPEOPLE_HOST, (h) =>
      _.isUndefined(h)
        ? left(new Error("No env variable 'GOPEOPLE_HOST' available"))
        : right(goPeopleHostOf(h as string)),
    );
  }
  key(): TaskEither<Error, GoPeopleAPIKey> {
    return pipe(process.env.GOPEOPLE_KEY, (k) =>
      _.isUndefined(k)
        ? left(new Error("No env variable 'GOPEOPLE_KEY' available"))
        : right(goPeopleAPIKeyOf(k as string)),
    );
  }
}
