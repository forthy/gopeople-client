import { DotEnvConfigProvider } from '../functions/config/dotEnvConfigProvider';
import { goPeopleHostOf, goPeopleAPIKeyOf, GoPeopleHost } from '../functions/config/configProvider';
import { right, fold } from 'fp-ts/lib/Either';

test('DotEnvConfigProvider should successfully provide GoPeople configuration', async () => {
  const provider = new DotEnvConfigProvider();

  expect(await provider.host()()).toStrictEqual(right(goPeopleHostOf('http://localhost:8080')));
  expect(await provider.key()()).toStrictEqual(right(goPeopleAPIKeyOf('this-api-key')));
});
