# GoPeople Client

## Introduction

Provides a client to Australia's GoPeople service.

## Main feature functions

- [Book shifts](https://docs.gopeople.com.au/#book-shifts)
  - In order to book a GoSHIFT job, you need to book shifts for a certified/approved store in GoPeople member site.
  - [bookShifts](modules/_functions_bookshifts_.html#bookshifts) function [^1] 
- [Instant GoSHIFT booking](https://docs.gopeople.com.au/#instant-book-a-goshift-job)
  - After a store's shifts are booked beforehand, shifts information will be sent to GoPeople's runners. Runners can signed up for those shifts and report to the store before the shift starts. Jobs then can be created, and assigned to the reported runners.
  - [instantGoShift](modules/_functions_instantgoshift_.html#instantgoshift) function [^1]
- [Get Quotes](https://docs.gopeople.com.au/#get-a-quote)
  - The normal flow (GoNOW/GoSAMEDAY) of GoPeople is to acquire quotes for a run job. After acquiring quotes, book a job with a quote (quote ID)
  - [getQuotes](modules/_functions_getquote_.html#getquote) function [^1]
- [Book a job](https://docs.gopeople.com.au/#book-a-job)
  - A job can be booked according to a quote ID
  - [bookJob](modules/_functions_bookjob_.html#bookjob) function [^1]
- [Fetch job status](https://docs.gopeople.com.au/#fetch-job-status)
  - Return all the job status on a specific day.
  - [fetchJobStatus](modules/_functions_fetchjobstatus_.html#fetchjobstatus) function [^1]

## How to

- run tests: `npm test`
- test coverage information: `npm run test:coverage`, the coverage reports will be generated in directory `coverage/lcov-report/index.html`
- generate Doc: `npm run typedoc`, the API doc will be generated in the directory `docs/index.html`

## Project dependencies

### fp-ts

[fp-ts](https://gcanti.github.io/fp-ts/) provides functional programming support to TypeScript/JavaScript development by providing crucial
type classes, such as `Option` and `Either`.
GoPeople client uses mostly `Option` and `Either` to handle error cases and situation when an input or output is optional.

`Option` or `Either` provides a "container" that gives a developer consistent programming interfaces to compose programming logic. For example, `Monad` is one of those programming interfaces. `Monad` offers `map` and `chain` interface to modify and chain other programming logic in the same container. You can find examples in test cases, such as `GoPeopleClient.test.ts`.

The following client configuration is exactly an example of these monadic containers. Please read the following section to know more about these containers.

## Client Configuration

GoPeople client provides a `ConfigProvider` interface (functions/config/configProvider) and implementations (such as configuration from system environment variables).

```TypeScript
interface ConfigProvider {
  host: () => TaskEither<Error, GoPeopleHost>;
  key: () => TaskEither<Error, GoPeopleAPIKey>;
}
```

[TaskEither](https://gcanti.github.io/fp-ts/modules/TaskEither.ts.html) according to `fp-ts`'s official introduction:

```markdown
TaskEither<E, A> represents an asynchronous computation that either yields a value of type A or fails yielding an error of type E.
```

What does the above explanation say? It says `EitherTask` container is a combination of two containers: `Task` and `Either`.

`Task` is a wrapper of a asynchronous process, that is:

```TypeScript
() => Promise<T>
```

Thus you can chain many Tasks togther and execute the final `Promise`.

[Either](https://gcanti.github.io/fp-ts/modules/Either.ts.html) is a kind of container that has left of E (type) and right of T (type): `Either<E, T>` means the combination of either `Left<E>` or `Right<T>` (`type Either<E, A> = Left<E> | Right<A>`).
You can use `left<E>(e: E)` or `right<T>(v: T)` to construct a left or a right. `Either` is a good container for error handling because a developer has a formal way to deal with an error, usually it would be the left of an error, for example, `Left<Error>(e: Error)`.

GoPeople client's API's return type is `TaskEither`, for example, 

```typescript
function getQuote(options: QuoteOptions): (configProvider: ConfigProvider) => TaskEither<Error, QuoteInfo>
```

How do you use `TaskEither` and handle either the error or the value?

You can execute a `TaskEither`, then a `Promise<Either<Error, T>` would be return, await the returned promise, you will get the `Either`. You can use `fold` function or `getOrElse` function to acquire either an error or a expected value (please read [destructors](https://gcanti.github.io/fp-ts/modules/Either.ts.html#destructors)).

You can refer to test cases, such as `PostgreSQLConfigProvider.test.ts` for the exact use case of the composition of several [Task](https://gcanti.github.io/fp-ts/modules/Task.ts.html)s (another kind of `TaskEither`).

```typescript
const connectDBTask: (client: pg.Client) => Task<void> = (client: pg.Client) => () => client.connect();
const clientEndTask: (client: pg.Client) => Task<void> = (client: pg.Client) => () => client.end();
const createTableTask: (client: pg.Client) => Task<pg.QueryResult> = (client: pg.Client) => () =>
  client.query(createTableStr);
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
```

From the above code snippet, you can see that with `Task` effect type class, you can breakdown your code logic into several  smaller and focused functions and without worrying about compatibility. Small functions means less code in a function, less likely to introduce bugs to a smaller code block. At the same time, smaller code block would be easier to test against (higher test coverage). One of advantage of having a smaller function is this increases the re-usability of a function. For example, replacing that `insertConfigTask` with a `createTableTask`, the remaining function invocation flow stays the same. __You can apply the same technique to `TaskEither`, `Either` or `Option` as well__.

[Do](https://gcanti.github.io/fp-ts-contrib/modules/Do.ts.html) provides an easier way to do all nested `chain`s and flatten them with some utility functions, such as `bind` function. This is a very good [article](https://paulgray.net/do-syntax-in-typescript/) to get to know more `Do`.

[Road Map](ROADMAP.md)

[^1]: _(note: the link might not work for it is a link to generated TypeDoc)_

