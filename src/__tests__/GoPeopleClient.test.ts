import * as a from '../models/address';
import * as p from '../models/parcel';
import { some, none } from 'fp-ts/lib/Option';
import { left, right } from 'fp-ts/lib/Either';
import { chain } from 'fp-ts/lib/TaskEither';
import { range } from 'fp-ts/lib/Array';
import { DateTime } from 'luxon';
import { instantGoShift, descriptionOf, JobInfo, jobIdOf, trackingCodeOf } from '../functions/instantGoShfit';
import {
  Shift,
  validateShift,
  validateTime,
  shiftOf,
  timeOf,
  hoursOf,
  runnerNumberOf,
  Vehicle,
  equipmentOf,
  noteOf,
  bookShifts,
  ShiftInfo,
  shiftIdOf,
  shiftTimeOf,
} from '../functions/bookShifts';
import * as mh from 'mockttp';

let mockserver: mh.Mockttp;

beforeAll(() => {
  mockserver = mh.getLocal();
  mockserver.start(8080);
});
afterAll(() => mockserver.stop());
afterEach(() => mockserver.reset());

test('Should successfully book a GoShift', async () => {
  mockserver.post('/book/instant').withHeaders({ Authorization: 'bearer this-api-key' }).thenReply(
    200,
    `{
        "errorCode":0,
        "message":"",
        "title":"",
        "debug":"",
        "result":{
           "jobId":"894c0a10-fdb9-fb27-8ddb-d81c94a6e46c",
           "number":"1054231-6187",
           "ref":"",
           "ref2":"",
           "zone":"",
           "zonerun":null,
           "category":"goshift",
           "barcodes":[
              {
                 "text":"1054231-6187-1"
              },
              {
                 "text":"1054231-6187-2"
              }
           ],
           "trackingCode":"7OSPD3",
           "description":"Hot pot",
           "note":"",
           "status":"booked_in",
           "partiallyPickedUp":false,
           "pickUpAfter":"2020-07-06 11:00:00+1000",
           "dropOffBy":"2020-07-06 15:30:00+1000",
           "estimatedPickupTime":null,
           "estimatedDropOffTime":null,
           "actualPickupTime":null,
           "actualDropOffTime":null,
           "createdTime":"2020-07-04 16:20:04+1000",
           "addressFrom":{
              "unit":"",
              "address1":"8-1 Anderson St",
              "suburb":"Chatswood",
              "state":"NSW",
              "postcode":"2067",
              "companyName":"Haidilao",
              "contactName":"Richard Chuo",
              "contactNumber":"+61294102507",
              "contactEmail":null,
              "sendUpdateSMS":false,
              "isCommercial":true
           },
           "addressTo":{
              "unit":"",
              "address1":"100 Pitt St",
              "suburb":"Sydney",
              "state":"NSW",
              "postcode":"2000",
              "companyName":"Residential",
              "contactName":"",
              "contactNumber":"",
              "contactEmail":null,
              "sendUpdateSMS":false,
              "isCommercial":false
           },
           "atl":false,
           "runner":null,
           "signature":null
        }
      }`,
  );

  const addressFrom = new a.Address(
    a.address1Of('85-93 Commonwealth St'),
    a.suburbOf('Surry Hills'),
    a.stateOf('NSW'),
    a.postcodeOf('2010'),
    false,
    none,
    none,
    none,
    some(new a.CompanyName('Nomad')),
    none,
  );

  const addressto = new a.Address(
    a.address1Of('100 Pitt St'),
    a.suburbOf('Sydney'),
    a.stateOf('NSW'),
    a.postcodeOf('2000'),
  );
  const aParcel = new p.Parcel(p.Type.Grocery, new p.ParcelNumber(2));
  const resp = await instantGoShift(
    addressFrom,
    addressto,
    [aParcel],
    DateTime.local().setZone('utc'),
    descriptionOf('Sushi set'),
  )();

  expect(resp).toStrictEqual(
    right(new JobInfo(jobIdOf('894c0a10-fdb9-fb27-8ddb-d81c94a6e46c'), trackingCodeOf('7OSPD3'))),
  );
});

test('validateShift function should function properly', () => {
  const now1 = DateTime.utc().toFormat('yyyy-MM-dd');
  const correctShift = shiftOf(now1);

  expect(validateShift(correctShift)).toStrictEqual(right(correctShift));

  const incorrectShift = shiftOf('baddate');

  expect(validateShift(incorrectShift)).toStrictEqual(left(new Error('unparsable')));

  const shiftExceeding30Days = shiftOf(DateTime.utc().plus({ days: 31 }).toFormat('yyyy-MM-dd'));

  expect(validateShift(shiftExceeding30Days)).toStrictEqual(
    left(new Error('Given date is after 30 days later; or is before now.')),
  );

  const shiftBeforeToday = shiftOf(DateTime.utc().minus({ days: 1 }).toFormat('yyyy-MM-dd'));

  expect(validateShift(shiftBeforeToday)).toStrictEqual(
    left(new Error('Given date is after 30 days later; or is before now.')),
  );
});

test('validateTime function should function properly', () => {
  const emptyTimeStr = timeOf('');

  expect(validateTime(emptyTimeStr)).toStrictEqual(left(new Error('Time cannot be an empty string')));

  const correctMorning = timeOf('00:00 AM');

  expect(validateTime(correctMorning)).toStrictEqual(right(correctMorning));

  const correctAfternoon = timeOf('11:40 PM');

  expect(validateTime(correctAfternoon)).toStrictEqual(right(correctAfternoon));

  const incorrectMorning = timeOf('13:30 AM');

  expect(validateTime(incorrectMorning)).toStrictEqual(
    left(new Error('[Malformation] please check the hours and minutes')),
  );

  const incorrectMinutes = timeOf('02:60 PM');

  expect(validateTime(incorrectMinutes)).toStrictEqual(
    left(new Error('[Malformation] please check the hours and minutes')),
  );

  const noAMOrPM = timeOf('01:15');

  expect(validateTime(noAMOrPM)).toStrictEqual(left(new Error("Invalid time string format; should be '00:00 AM/PM'")));

  const incorrectAMOrPM = timeOf('02:45 pm');

  expect(validateTime(incorrectAMOrPM)).toStrictEqual(
    left(new Error("Invalid time string format; should be '00:00 AM/PM'")),
  );
});

function generateShifts(): Shift[] {
  return range(15, 17).map((v, i, a) => shiftOf(DateTime.utc().plus({ days: v }).toFormat('yyyy-MM-dd')));
}

test('Malforamtted shift/time/hours should be reported by shift booking API', async () => {
  const goodShift = shiftOf(DateTime.utc().toFormat('yyyy-MM-dd'));
  const badShift = shiftOf(DateTime.utc().plus({ day: 45 }).toFormat('yyyy-MM-dd'));
  const goodTime = timeOf('10:00 AM');
  const badTime = timeOf('13:00 AM');
  const goodHours = hoursOf(3);
  const badHours = hoursOf(2);

  const nomadAddress = new a.Address(
    a.address1Of('85-93 Commonwealth St'),
    a.suburbOf('Surry Hills'),
    a.stateOf('NSW'),
    a.postcodeOf('2010'),
    false,
    none,
    none,
    none,
    some(new a.CompanyName('Nomad')),
    none,
  );

  const addressto = new a.Address(
    a.address1Of('100 Pitt St'),
    a.suburbOf('Sydney'),
    a.stateOf('NSW'),
    a.postcodeOf('2000'),
  );

  const badShiftResult = bookShifts(
    nomadAddress,
    p.Type.Grocery,
    [goodShift, badShift],
    goodTime,
    goodHours,
    runnerNumberOf(1),
    Vehicle.Sedan,
    [equipmentOf('trolley')],
    noteOf('Be on time'),
  );

  expect(await badShiftResult()).toStrictEqual(left(new Error('Given date is after 30 days later; or is before now.')));

  const badTimeResult = bookShifts(
    nomadAddress,
    p.Type.Grocery,
    [goodShift],
    badTime,
    goodHours,
    runnerNumberOf(1),
    Vehicle.Sedan,
    [equipmentOf('trolley')],
    noteOf('Be on time'),
  );

  expect(await badTimeResult()).toStrictEqual(left(new Error('[Malformation] please check the hours and minutes')));

  const badHoursResult = bookShifts(
    nomadAddress,
    p.Type.Grocery,
    [goodShift],
    goodTime,
    badHours,
    runnerNumberOf(1),
    Vehicle.Sedan,
    [equipmentOf('trolley')],
    noteOf('Be on time'),
  );

  expect(await badHoursResult()).toStrictEqual(left(new Error('Hours must > 3')));
});

test('Should successfully book shifts', async () => {
  mockserver.post('/shift').withHeaders({ Authorization: 'bearer this-api-key' }).thenReply(
    200,
    `{
        "errorCode":0,
        "message":"",
        "title":"",
        "debug":"",
        "result":[
           {
              "guid":"b3d1c5cc-27a3-4683-3c81-6ed6561fe9f3",
              "dateTime":"2020-07-19 10:00:00+1000"
           },
           {
              "guid":"6c25d135-0f2b-f330-9f6f-ba7bead1ab81",
              "dateTime":"2020-07-20 10:00:00+1000"
           },
           {
              "guid":"2e1761ac-dbee-7555-4107-b65aca24db4f",
              "dateTime":"2020-07-21 10:00:00+1000"
           }
        ]
      }`,
  );

  const pickUpAddress = new a.Address(
    a.address1Of('85-93 Commonwealth St'),
    a.suburbOf('Surry Hills'),
    a.stateOf('NSW'),
    a.postcodeOf('2010'),
    false,
    some(a.contactNameOf('Richard Chuo')),
    some(a.contactNumberOf('02 8072 4146')),
    none,
    some(a.companyNameOf('Nomad')),
    none,
  );

  // use our own runner, thus runner number is '0'
  const bs = await bookShifts(
    pickUpAddress,
    p.Type.Grocery,
    generateShifts(),
    timeOf('10:00 AM'),
    hoursOf(3),
    runnerNumberOf(0),
    Vehicle.Sedan,
    [equipmentOf('trolley')],
    noteOf('Be on time'),
  )();

  expect(bs).toStrictEqual(
    right([
      new ShiftInfo(shiftIdOf('b3d1c5cc-27a3-4683-3c81-6ed6561fe9f3'), shiftTimeOf('2020-07-19 10:00:00+1000')),
      new ShiftInfo(shiftIdOf('6c25d135-0f2b-f330-9f6f-ba7bead1ab81'), shiftTimeOf('2020-07-20 10:00:00+1000')),
      new ShiftInfo(shiftIdOf('2e1761ac-dbee-7555-4107-b65aca24db4f'), shiftTimeOf('2020-07-21 10:00:00+1000')),
    ]),
  );
});

test('A job booking in an exisiting shift should creating a job instantly', async () => {
  mockserver.post('/book/instant').withHeaders({ Authorization: 'bearer this-api-key' }).thenReply(
    200,
    `{
        "errorCode":0,
        "message":"",
        "title":"",
        "debug":"",
        "result":{
           "jobId":"894c0a10-fdb9-fb27-8ddb-d81c94a6e46c",
           "number":"1054231-6187",
           "ref":"",
           "ref2":"",
           "zone":"",
           "zonerun":null,
           "category":"goshift",
           "barcodes":[
              {
                 "text":"1054231-6187-1"
              },
              {
                 "text":"1054231-6187-2"
              }
           ],
           "trackingCode":"7OSPD3",
           "description":"Hot pot",
           "note":"",
           "status":"booked_in",
           "partiallyPickedUp":false,
           "pickUpAfter":"2020-07-06 11:00:00+1000",
           "dropOffBy":"2020-07-06 15:30:00+1000",
           "estimatedPickupTime":null,
           "estimatedDropOffTime":null,
           "actualPickupTime":null,
           "actualDropOffTime":null,
           "createdTime":"2020-07-04 16:20:04+1000",
           "addressFrom":{
              "unit":"",
              "address1":"8-1 Anderson St",
              "suburb":"Chatswood",
              "state":"NSW",
              "postcode":"2067",
              "companyName":"Haidilao",
              "contactName":"Richard Chuo",
              "contactNumber":"+61294102507",
              "contactEmail":null,
              "sendUpdateSMS":false,
              "isCommercial":true
           },
           "addressTo":{
              "unit":"",
              "address1":"100 Pitt St",
              "suburb":"Sydney",
              "state":"NSW",
              "postcode":"2000",
              "companyName":"Residential",
              "contactName":"",
              "contactNumber":"",
              "contactEmail":null,
              "sendUpdateSMS":false,
              "isCommercial":false
           },
           "atl":false,
           "runner":null,
           "signature":null
        }
      }`,
  );

  mockserver.post('/shift').withHeaders({ Authorization: 'bearer this-api-key' }).thenReply(
    200,
    `{
        "errorCode":0,
        "message":"",
        "title":"",
        "debug":"",
        "result":[
           {
              "guid":"3e2dd173-6fd5-5d18-8046-055b6b339e30",
              "dateTime":"2020-07-06 10:00:00+1000"
           }
        ]
    }`,
  );

  const nomadAddress = new a.Address(
    a.address1Of('85-93 Commonwealth St'),
    a.suburbOf('Surry Hills'),
    a.stateOf('NSW'),
    a.postcodeOf('2010'),
    false,
    none,
    none,
    none,
    some(new a.CompanyName('Nomad')),
    none,
  );

  const addressto = new a.Address(
    a.address1Of('100 Pitt St'),
    a.suburbOf('Sydney'),
    a.stateOf('NSW'),
    a.postcodeOf('2000'),
  );
  const dt = DateTime.local().setZone('Australia/Sydney').plus({ days: 2 });
  const nomadShifts = bookShifts(
    nomadAddress,
    p.Type.Grocery,
    [shiftOf(dt.toFormat('yyyy-MM-dd'))],
    timeOf('10:00 AM'),
    hoursOf(3),
    runnerNumberOf(1),
    Vehicle.Sedan,
    [equipmentOf('trolley')],
    noteOf('Be on time'),
  );

  expect(await nomadShifts()).toStrictEqual(
    right([new ShiftInfo(shiftIdOf('3e2dd173-6fd5-5d18-8046-055b6b339e30'), shiftTimeOf('2020-07-06 10:00:00+1000'))]),
  );

  const aParcel = new p.Parcel(p.Type.Grocery, new p.ParcelNumber(2));
  const resp = instantGoShift(
    nomadAddress,
    addressto,
    [aParcel],
    dt.set({ hour: 10, minute: 0, second: 0 }),
    descriptionOf('Sushi set'),
  );

  const haidilaoAddress = new a.Address(
    a.address1Of('8-1 Anderson St'),
    a.suburbOf('Chatswood'),
    a.stateOf('NSW'),
    a.postcodeOf('2067'),
    false,
    none,
    none,
    none,
    some(new a.CompanyName('Haidilao')),
    none,
  );

  const haidilaoshift = bookShifts(
    haidilaoAddress,
    p.Type.Grocery,
    [shiftOf(dt.toFormat('yyyy-MM-dd'))],
    timeOf('11:00 AM'),
    hoursOf(3),
    runnerNumberOf(1),
    Vehicle.Van,
    [equipmentOf('trolley')],
    noteOf('Be on time'),
  );

  const hResponse = instantGoShift(
    haidilaoAddress,
    addressto,
    [aParcel],
    dt.set({ hour: 11, minute: 0, second: 0 }),
    descriptionOf('Hot pot'),
  );

  expect(await chain((x) => hResponse)(nomadShifts)()).toStrictEqual(
    right(new JobInfo(jobIdOf('894c0a10-fdb9-fb27-8ddb-d81c94a6e46c'), trackingCodeOf('7OSPD3'))),
  );
});
