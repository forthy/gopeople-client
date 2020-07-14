import { GenericContainer, StartedTestContainer } from 'testcontainers';
import * as pg from 'pg';
import { goPeopleHostOf, goPeopleAPIKeyOf } from '../functions/config/configProvider';
import { right, left } from 'fp-ts/lib/Either';
import { Task, task } from 'fp-ts/lib/Task';
import { Do } from 'fp-ts-contrib/lib/Do';
import {
  userNameOf,
  passwordOf,
  hostOf,
  portOf,
  dbOf,
  PostgreSQLConfigProvider,
} from '../functions/config/PostgreSQLConfigProvider';

let tc: StartedTestContainer;
let postgreSQLPort: number;

const createTableStr = `
     DROP TABLE IF EXISTS "public"."carrier_providers" CASCADE;

     -- Sequence and defined type
     CREATE SEQUENCE IF NOT EXISTS carrier_providers_id_seq;
     -- Table Definition
      CREATE TABLE "public"."carrier_providers" (
          "id" int4 NOT NULL DEFAULT nextval('carrier_providers_id_seq'::regclass),
          "name" text NOT NULL,
          "location" text NOT NULL,
          "priority" int2 NOT NULL,
          "min_time_to_order" int4 NOT NULL,
          "time_to_expire" int4,
          "meta" jsonb NOT NULL,
          "created_at" timestamptz NOT NULL DEFAULT timezone('UTC'::text, now()),
          "updated_at" timestamptz NOT NULL DEFAULT timezone('UTC'::text, now()),
          PRIMARY KEY ("id")
      );`;

const connectDBTask: (client: pg.Client) => Task<void> = (client: pg.Client) => () => client.connect();
const clientEndTask: (client: pg.Client) => Task<void> = (client: pg.Client) => () => client.end();
const createTableTask: (client: pg.Client) => Task<pg.QueryResult> = (client: pg.Client) => () =>
  client.query(createTableStr);

beforeAll(async () => {
  jest.setTimeout(30000);

  tc = await new GenericContainer('postgres', '9.6')
    .withExposedPorts(5432)
    .withEnv('POSTGRES_PASSWORD', 'dev')
    .withEnv('POSTGRES_DB', 'test_template')
    .withCmd(['-c', 'fsync=off', '-c', 'full_page_writes=off', '-c', 'checkpoint_timeout=86400'])
    .withDefaultLogDriver()
    // .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
    .start();

  postgreSQLPort = tc.getMappedPort(5432);
});

afterAll(async () => {
  try {
    await tc.stop();
  } catch (e) {
    console.log(`Test container closing error: ${JSON.stringify(e)}`);
  }
});

test('Should successfully return GoPeople configuration stored in PostgreSQL', async () => {
  const insertConfigStr = `INSERT INTO "public"."carrier_providers" (name, location, priority, min_time_to_order, meta) 
                           VALUES ('gopeople', 'au', '2', '60', '{"host":"http://localhost:8080","key":"this-api-key"}')`;

  const client = new pg.Client(`postgresql://postgres:dev@localhost:${postgreSQLPort}/test_template`);

  try {
    const insertConfigTask: (client: pg.Client) => Task<pg.QueryResult> = (client: pg.Client) => () =>
      client.query(insertConfigStr);

    await Do(task)
      .bind('x', connectDBTask(client))
      .bind('y', createTableTask(client))
      .bind('i', insertConfigTask(client))
      .bind('z', clientEndTask(client))
      .return((context) => {
        console.log(`Create table result: ${JSON.stringify(context.y)}`);
        console.log(`Insert record result: ${JSON.stringify(context.i)}`);
      })();
  } catch (e) {
    console.log(`SQL access error: ${JSON.stringify(e)}`);
  }

  const configProvider = new PostgreSQLConfigProvider(
    userNameOf('postgres'),
    passwordOf('dev'),
    hostOf('localhost'),
    portOf(postgreSQLPort),
    dbOf('test_template'),
  );

  expect(await configProvider.host()()).toStrictEqual(right(goPeopleHostOf('http://localhost:8080')));
  expect(await configProvider.key()()).toStrictEqual(right(goPeopleAPIKeyOf('this-api-key')));
});

test('Should respond correct exception message if no config was set', async () => {
  const client = new pg.Client(`postgresql://postgres:dev@localhost:${postgreSQLPort}/test_template`);

  try {
    await Do(task)
      .bind('x', connectDBTask(client))
      .bind('y', createTableTask(client))
      .bind('z', clientEndTask(client))
      .return((context) => {
        console.log(`Create table result: ${JSON.stringify(context.y)}`);
      })();
  } catch (e) {
    console.log(`SQL access error: ${JSON.stringify(e)}`);
  }

  const configProvider = new PostgreSQLConfigProvider(
    userNameOf('postgres'),
    passwordOf('dev'),
    hostOf('localhost'),
    portOf(postgreSQLPort),
    dbOf('test_template'),
  );

  expect(await configProvider.host()()).toStrictEqual(left(new Error('No GoPeopleHost nor GoPeopleAPIKey configured')));
  expect(await configProvider.key()()).toStrictEqual(left(new Error('No GoPeopleHost nor GoPeopleAPIKey configured')));
});
