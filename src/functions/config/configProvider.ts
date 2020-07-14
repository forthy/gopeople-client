import { TaskEither } from 'fp-ts/lib/TaskEither';

export { ConfigProvider, GoPeopleHost, goPeopleHostOf, GoPeopleAPIKey, goPeopleAPIKeyOf };

class GoPeopleHost {
  constructor(readonly h: string) {}
}

function goPeopleHostOf(h: string) {
  return new GoPeopleHost(h);
}

class GoPeopleAPIKey {
  constructor(readonly key: string) {}
}

function goPeopleAPIKeyOf(key: string) {
  return new GoPeopleAPIKey(key);
}

interface ConfigProvider {
  host: () => TaskEither<Error, GoPeopleHost>;
  key: () => TaskEither<Error, GoPeopleAPIKey>;
}
