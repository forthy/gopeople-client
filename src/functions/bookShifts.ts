import { DateTime, Interval } from 'luxon';
import { Either, right, left, either, fold as eitherFold } from 'fp-ts/lib/Either';
import { fromNullable, fold, Option, none } from 'fp-ts/lib/Option';
import { traverse as arrayTraverse } from 'fp-ts/lib/Array';
import { pipe } from 'fp-ts/lib/pipeable';
import { Do } from 'fp-ts-contrib/lib/Do';
import { TaskEither, tryCatch, fromEither, chain, left as teLeft } from 'fp-ts/lib/TaskEither';
import * as _ from 'lodash';
import { Address, toJson as addressToJson } from '../models/address';
import { Type } from '../models/parcel';
import * as requestPromise from 'request-promise-native';
import * as env from '../gopeople.config';

export {
  Shift,
  shiftOf,
  validateShift,
  Vehicle,
  Equipment,
  equipmentOf,
  Note,
  noteOf,
  RunnerNumber,
  runnerNumberOf,
  Hours,
  hoursOf,
  Time,
  timeOf,
  validateTime,
  bookShifts,
  shiftIdOf,
  shiftTimeOf,
  ShiftInfo,
};

/**
 * A shift
 */
class Shift {
  /**
   *
   * @param s - a string represents date of a shift in format 'yyyy-MM-dd'
   */
  constructor(readonly s: string) {}
}

/**
 * A easy constructor of Shift type
 * @param s - a string represents date of a shift in format 'yyyy-MM-dd'
 */
function shiftOf(s: string): Shift {
  return new Shift(s);
}

/**
 * A vehicle type, either 'sedan' or 'van'
 */
enum Vehicle {
  Sedan = 'sedan',
  Van = 'van',
}

/**
 * An equipment required for completing a job
 */
class Equipment {
  /**
   * An equipment required for completing a job
   * @param e - the name of equipment
   */
  constructor(readonly e: string) {}
}

function equipmentOf(e: string): Equipment {
  return new Equipment(e);
}

class Note {
  constructor(readonly txt: string) {}
}

function noteOf(txt: string): Note {
  return new Note(txt);
}

class RunnerNumber {
  constructor(readonly num: number) {}
}

function runnerNumberOf(num: number): RunnerNumber {
  return new RunnerNumber(num);
}

class Hours {
  constructor(readonly h: number) {}
}

function hoursOf(h: number): Hours {
  return new Hours(h);
}

/**
 * A start time of a shift in format `00:00 (AM | PM)`
 */
class Time {
  constructor(readonly t: string) {}
}

/**
 * An easy constructor of class `Time`
 *
 * @param t - time in format `00:00 (AM | PM)`
 */
function timeOf(t: string): Time {
  return new Time(t);
}

class ShiftId {
  constructor(readonly id: string) {}
}

function shiftIdOf(id: string): ShiftId {
  return new ShiftId(id);
}

class ShiftTime {
  constructor(readonly st: string) {}
}

function shiftTimeOf(st: string): ShiftTime {
  return new ShiftTime(st);
}

class ShiftInfo {
  constructor(readonly id: ShiftId, readonly time: ShiftTime) {}
}

function validateHours(h: Hours): Either<Error, Hours> {
  if (h.h < 3) {
    return left(new Error('Hours must > 3'));
  } else return right(h);
}

function validateShift(s: Shift): Either<Error, Shift> {
  let result: Either<Error, Shift>;

  const dt = DateTime.fromFormat(s.s, 'yyyy-MM-dd', { zone: 'utc' });

  if (dt.isValid) {
    const now = DateTime.utc();
    const interval = Interval.fromDateTimes(
      { year: now.year, month: now.month, day: now.day },
      { year: dt.year, month: dt.month, day: dt.day },
    ).length('days');

    if (interval >= 0 && interval <= 30) {
      result = right(s);
    } else {
      result = left(new Error('Given date is after 30 days later; or is before now.'));
    }
  } else {
    result = left(
      new Error(
        fold<string, string>(
          () => {
            return 'Unknown error';
          },
          (reason) => {
            return reason;
          },
        )(fromNullable(dt.invalidReason)),
      ),
    );
  }

  return result;
}

function validateTime(t: Time): Either<Error, Time> {
  const re = /^(\d{1,2}):(\d{2})(:00)? ([AP]M)?$/;

  if (t.t !== '') {
    return fold<RegExpMatchArray, Either<Error, Time>>(
      () => {
        return left(new Error("Invalid time string format; should be '00:00 AM/PM'"));
      },
      (a) => {
        let result: Either<Error, Time>;

        // 12-hour time format with AM/PM
        if (
          (a[4] === 'AM' && (parseInt(a[1], 10) < 0 || parseInt(a[1], 10) > 11)) ||
          (a[4] === 'PM' && (parseInt(a[1], 10) < 1 || parseInt(a[1], 10) > 12)) ||
          parseInt(a[2], 10) > 59
        ) {
          result = left(new Error(`[Malformation] please check the hours and minutes`));
        } else {
          result = right(t);
        }

        return result;
      },
    )(fromNullable(t.t.match(re)));
  } else {
    return left(new Error('Time cannot be an empty string'));
  }
}

/**
 * Book shifts for an existing store registered in GoPeople account
 *
 * [GoPeople's API doc](https://docs.gopeople.com.au/#book-shifts)
 *
 * Sample:
 *
 * ```typescript
 * import * as a from '../models/address';
 * import * as p from '../models/parcel';
 *
 * const nomadAddress = new a.Address(
 *   a.address1Of('85-93 Commonwealth St'),
 *   a.suburbOf('Surry Hills'),
 *   a.stateOf('NSW'),
 *   a.postcodeOf('2010'),
 *   false,
 *   none,
 *   none,
 *   none,
 *   some(new a.CompanyName('Nomad')),
 *   none,
 * );
 *
 * const addressto = new a.Address(
 *   a.address1Of('100 Pitt St'),
 *   a.suburbOf('Sydney'),
 *   a.stateOf('NSW'),
 *   a.postcodeOf('2000'),
 * );
 * const dt = DateTime.local().setZone('Australia/Sydney').plus({ days: 2 });
 *
 * const nomadShift = await bookShifts(
 *   nomadAddress,
 *   p.Type.Grocery,
 *   [shiftOf(dt.toFormat('yyyy-MM-dd'))],
 *   timeOf('10:00 AM'),
 *   hoursOf(3),
 *   runnerNumberOf(1),
 *   Vehicle.Sedan,
 *   [equipmentOf('trolley')],
 *   noteOf('Be on time'),
 * )();
 *
 * expect(nomadShift).toStrictEqual(
 *   right([new ShiftInfo(shiftIdOf('3e2dd173-6fd5-5d18-8046-055b6b339e30'),
 *                        shiftTimeOf('2020-07-06 10:00:00+1000'))]),
 * );
 * ```
 * The return type of function bookShifts is `TaskEither<Error, ShiftInfo[]>`.
 * `TaskEither` is from project [fp-ts](https://gcanti.github.io/fp-ts/modules/TaskEither.ts.html).<br/><br/>
 * `TaskEither` type basically a type that wraps `Promise<Either<ErrorType, ResultType>>`.
 * <br/>
 * The reason why we need `TaskEither` here is because it gives us combinator fuctions, such as `map` and `bind`,
 * so we can join multiple `TaskEither`s work together without realising a Promise till the end to complete a feature.<br/>
 * After all TaskEithers are joined, we can call `apply()` function of the final TaskEither to run the composed Promise and have the result `Either<ErrorType, ResultType>`.<br/>
 * For example,<br/>
 * ```typescript
 * const finalTaskEither: TaskEither<ErrorType, ResultType> = chain(x => anotherTaskEither)(aTaskEither)
 * const resultPromise: Either<ErrorType, ResultType> = finalTaskEither()
 * ```
 * __How to retrieve values from an Either?__
 *
 * You can use `Either`'s [`fold` function](https://gcanti.github.io/fp-ts/modules/Either.ts.html#fold) to retrieve either an error value or an expected result value.<br/>
 * For example:
 * ```typescript
 * import { fold } from 'fp-ts/lib/Either'
 *
 * const aResultEither: Either<Error, string> = await finalTaskEither()
 * const result: string = fold((e) => e.message, (r) => r)
 * ````
 * Or you can chose to use Either's `getOrElse` function, the result is the same if you do not need to deal with the right-sided value.
 * For example:
 * ```typescript
 * import { getOrElse } from 'fp-ts/lib/Either'
 *
 * const aResultEither: Either<Error, string> = await finalTaskEither()
 * const result: string = getOrElse((e) => e.message)(aResultEither)
 * ```
 *
 * @param pickupAddress - the pickup address (usually the store address)
 * @param parcelType - parcle type, such as grocery, flower
 * @param dates - an array of shift dates following 'yyyy-MM-dd' format
 * @param time - the starting time of the shift in format `00:00 (AM | PM)`
 * @param hours - the duration of a shift, should be > 3 hours
 * @param runners - the number of runners, 0 if self-owned a runner
 * @param vehicle - the type of a vehicle, either 'sedan' or 'van'
 * @param equipments - an array of required equipments, for example, 'trolley'
 * @param note - note to this shift
 * @param cbd - central business district (?)
 * @param returnAddress - the optional return address of a runner
 */
function bookShifts(
  pickupAddress: Address,
  theParcelType: Type,
  dates: Shift[],
  time: Time,
  hours: Hours,
  runners: RunnerNumber,
  theVehicle: Vehicle,
  equipments: Equipment[],
  note: Note,
  isCBD: boolean = false,
  returnAddress: Option<Address> = none,
): TaskEither<Error, ShiftInfo[]> {
  return eitherFold<Error, object, TaskEither<Error, ShiftInfo[]>>(
    (e) => {
      return teLeft<Error, ShiftInfo[]>(e);
    },
    (b) =>
      chain(fromEither)(
        tryCatch(
          async () => {
            return requestPromise
              .post({
                method: 'POST',
                uri: `${env.goPeopleHost}/shift`,
                headers: {
                  Authorization: `bearer ${env.goPeopleKey}`,
                },
                body: b,
                json: true,
              })
              .then((resp) => {
                return parseResponse(resp);
              })
              .catch((err) => {
                return left(new Error(`'/shift' HTTP request error: ${JSON.stringify(err)}`));
              });
          },
          (err) => new Error(`'/shift' HTTP request error: ${JSON.stringify(err)}`),
        ),
      ),
  )(
    Do(either)
      .bind(
        'es',
        arrayTraverse(either)<Shift, Error, Shift>((s) => validateShift(s))(dates),
      )
      .bind('eh', validateHours(hours))
      .bind('et', validateTime(time))
      .return(({ es, eh, et }) => {
        return _.omitBy(
          {
            pickupAddress: addressToJson(pickupAddress),
            returnAddress: fold<Address, object | null>(
              () => null,
              (a) => _.omitBy(addressToJson(a), _.isNull),
            )(returnAddress),
            parcelType: theParcelType,
            dates: es.map((v, i, a) => v.s),
            time: et.t,
            hours: eh.h,
            runners: runners.num,
            vehicle: theVehicle,
            equipments: equipments.map((v, i, a) => v.e),
            note: note.txt,
            cbd: isCBD,
          },
          _.isNull,
        );
      }),
  );
}

function parseResponse(resp: object): Either<Error, ShiftInfo[]> {
  let result: Either<Error, ShiftInfo[]>;

  if (_.has(resp, 'errorCode') && _.get(resp, 'errorCode') !== 0) {
    const errorCode = _.get(resp, 'errorCode', -1);
    const errorMsg = _.get(resp, 'message', 'Unhandled exception');
    const errorResult = JSON.stringify(_.get(resp, 'result', {}));
    const errorStr = `Error code: ${errorCode}, message: ${errorMsg}, result: ${errorResult}`;

    result = left(new Error(errorStr));
  } else {
    result = pipe(_.get(resp, 'result', none), (o) => {
      if (_.isArray(o)) {
        return arrayTraverse(either)<object, Error, ShiftInfo>((obj) => {
          let si: Either<Error, ShiftInfo>;

          if (_.has(obj, 'guid') && _.has(obj, 'dateTime')) {
            si = right(new ShiftInfo(shiftIdOf(_.get(obj, 'guid')), shiftTimeOf(_.get(obj, 'dateTime'))));
          } else {
            si = left(new Error('No GUID or DateTime returned'));
          }

          return si;
        })(o as object[]);
      } else {
        return left(new Error('[Malformation] should be an object array'));
      }
    });
  }

  return result;
}
