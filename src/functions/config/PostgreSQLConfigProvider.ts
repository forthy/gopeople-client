import { ConfigProvider, GoPeopleHost, GoPeopleAPIKey, goPeopleHostOf, goPeopleAPIKeyOf } from './configProvider';
import { left, right } from 'fp-ts/lib/Either';
import { Option, some, none, fold as optFold } from 'fp-ts/lib/Option';
import { TaskEither, left as teLeft, right as teRight, fromEither, taskEither, map } from 'fp-ts/lib/TaskEither';
import { head } from 'fp-ts/lib/Array';
import { Do } from 'fp-ts-contrib/lib/Do';
import * as pg from 'pg';

export { userNameOf, passwordOf, hostOf, portOf, dbOf, PostgreSQLConfigProvider };

class PgUserName {
  constructor(readonly un: string) {}
}

function userNameOf(un: string): PgUserName {
  return new PgUserName(un);
}

class PgPassword {
  constructor(readonly pwd: string) {}
}

function passwordOf(pwd: string): PgPassword {
  return new PgPassword(pwd);
}

class PgHost {
  constructor(readonly h: string) {}
}

function hostOf(h: string): PgHost {
  return new PgHost(h);
}

class PgPort {
  constructor(readonly p: number) {}
}

function portOf(p: number): PgPort {
  return new PgPort(p);
}

class PgDatabase {
  constructor(readonly db: string) {}
}

function dbOf(db: string): PgDatabase {
  return new PgDatabase(db);
}

/**
 * `PostgreSQLConfigProvider` provides the feature that retrieving GoPeople API access information from PostgreSQL.
 */
class PostgreSQLConfigProvider implements ConfigProvider {
  private queryStr: string = `SELECT meta FROM "public"."carrier_providers" WHERE name = 'gopeople'`;
  private configCache: Option<[GoPeopleHost, GoPeopleAPIKey]> = none;

  private conn: (client: pg.Client) => TaskEither<Error, void> = (client) => async () => {
    return client
      .connect()
      .then((r) => {
        return right(r);
      })
      .catch((e) => {
        return left(new Error(`Failed to connect to PostgreSQL, reason: ${JSON.stringify(e)}`));
      });
  };

  private findConfig: (client: pg.Client) => TaskEither<Error, pg.QueryResult> = (client) => async () => {
    return client
      .query(this.queryStr)
      .then((r) => {
        return right(r);
      })
      .catch((e) => {
        return left(new Error(`Failed to find meta from table 'carrier_providers', reason: ${JSON.stringify(e)}`));
      });
  };

  private close: (client: pg.Client) => TaskEither<Error, void> = (client) => async () => {
    return client
      .end()
      .then((r) => {
        return right(r);
      })
      .catch((e) => {
        return left(new Error(`Failed to close Pg client, reason: ${JSON.stringify(e)}`));
      });
  };

  constructor(
    readonly userName: PgUserName,
    readonly password: PgPassword,
    readonly pgHost: PgHost,
    readonly port: PgPort,
    readonly database: PgDatabase,
  ) {}

  private fetchConfigFromDB(): TaskEither<Error, [GoPeopleHost, GoPeopleAPIKey]> {
    interface Config {
      host: string;
      key: string;
    }

    interface ConfigMeta {
      meta: Config;
    }

    const client: pg.Client = new pg.Client(
      `postgresql://${this.userName.un}:${this.password.pwd}@${this.pgHost.h}:${this.port.p}/${this.database.db}`,
    );

    return Do(taskEither)
      .bind('c', this.conn(client))
      .bind('r', this.findConfig(client))
      .bind('e', this.close(client))
      .bindL('row', (context) => {
        return optFold<ConfigMeta, TaskEither<Error, [GoPeopleHost, GoPeopleAPIKey]>>(
          () => {
            return teLeft(new Error('No GoPeopleHost nor GoPeopleAPIKey configured'));
          },
          (c) => {
            return teRight([goPeopleHostOf(c.meta.host), goPeopleAPIKeyOf(c.meta.key)]);
          },
        )(head<ConfigMeta>(context.r.rows));
      })
      .return((context) => {
        this.configCache = some(context.row);

        return context.row;
      });
  }

  host(): TaskEither<Error, GoPeopleHost> {
    return optFold<[GoPeopleHost, GoPeopleAPIKey], TaskEither<Error, GoPeopleHost>>(
      () => {
        return map<[GoPeopleHost, GoPeopleAPIKey], GoPeopleHost>((x) => x[0])(this.fetchConfigFromDB());
      },
      (x) => {
        return teRight(x[0]);
      },
    )(this.configCache);
  }

  key(): TaskEither<Error, GoPeopleAPIKey> {
    return optFold<[GoPeopleHost, GoPeopleAPIKey], TaskEither<Error, GoPeopleAPIKey>>(
      () => {
        return map<[GoPeopleHost, GoPeopleAPIKey], GoPeopleAPIKey>((x) => x[1])(this.fetchConfigFromDB());
      },
      (x) => {
        return teRight(x[1]);
      },
    )(this.configCache);
  }
}
