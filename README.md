# GoPeople Client

## Introduction

Provides a client to Australia's GoPeople service.

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

GoPeople client's API's return type is `TaskEither`, for example, `function getQuote(options: QuoteOptions): (configProvider: ConfigProvider) => TaskEither<Error, QuoteInfo>`. How do you use `TaskEither` and handle either the error or the value?

You can execute a `TaskEither`, then a `Promise<Either<Error, T>` would be return, await the returned promise, you will get the `Either`. You can use `fold` function or `getOrElse` function to acquire either an error or a expected value (please read [destructors](https://gcanti.github.io/fp-ts/modules/Either.ts.html#destructors)).

[Road Map](ROADMAP.md)