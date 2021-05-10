import * as a from "../models/address";
import * as p from "../models/parcel";
import { some, none, fold as optFold } from "fp-ts/lib/Option";
import { left, right, fold } from "fp-ts/lib/Either";
import { map as arrayMap, filter as arrayFilter } from "fp-ts/lib/Array";
import { chain } from "fp-ts/lib/TaskEither";
import { range } from "fp-ts/lib/Array";
import { DateTime } from "luxon";
import { JobInfo, JobId, jobIdOf, trackingCodeOf } from "../models/jobInfo";
import { instantGoShift, descriptionOf } from "../functions/instantGoShift";
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
} from "../functions/bookShifts";
import { cancelJob } from "../functions/cancelJob";
import { DotEnvConfigProvider } from "../functions/config/dotEnvConfigProvider";
import { fetchJobStatus, Status } from "../functions/fetchJobStatus";
import {
  getQuote,
  GoNOW,
  GoSAMEDAY,
  QuoteInfo,
  Quote,
} from "../functions/getQuote";
import {
  bookJob,
  quoteIdOf,
  descriptionOf as bjDescriptionOf,
} from "../functions/bookJob";
import * as mh from "mockttp";
import * as _ from "lodash";
import { toNumber } from "lodash";

let mockserver: mh.Mockttp;
const configProvider = new DotEnvConfigProvider();

beforeAll(() => {
  mockserver = mh.getLocal();
  mockserver.start(8080);
});
afterAll(() => mockserver.stop());
afterEach(() => mockserver.reset());

test("Should successfully book a GoShift", async () => {
  mockserver.post("/book/instant").withHeaders(
    { Authorization: "bearer this-api-key" },
  ).thenReply(
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
    a.address1Of("85-93 Commonwealth St"),
    a.suburbOf("Surry Hills"),
    a.stateOf("NSW"),
    a.postcodeOf("2010"),
    false,
    none,
    none,
    none,
    some(new a.CompanyName("Nomad")),
    none,
  );

  const addressTo = new a.Address(
    a.address1Of("100 Pitt St"),
    a.suburbOf("Sydney"),
    a.stateOf("NSW"),
    a.postcodeOf("2000"),
  );
  const aParcel = new p.Parcel(p.Type.Grocery, new p.ParcelNumber(2));
  const resp = await instantGoShift(
    addressFrom,
    addressTo,
    [aParcel],
    DateTime.local().setZone("utc"),
    descriptionOf("Sushi set"),
  )(configProvider)();

  fold<Error, JobInfo, void>(
    (e) => console.log(`Error: ${e.message}`),
    (ji) => console.log(`JobInfo: ${JSON.stringify(ji)}`),
  )(resp);

  expect(resp).toStrictEqual(
    right(
      new JobInfo(
        jobIdOf("894c0a10-fdb9-fb27-8ddb-d81c94a6e46c"),
        trackingCodeOf("7OSPD3"),
      ),
    ),
  );
});

test("validateShift function should function properly", () => {
  const now1 = DateTime.utc().toFormat("yyyy-MM-dd");
  const correctShift = shiftOf(now1);

  expect(validateShift(correctShift)).toStrictEqual(right(correctShift));

  const incorrectShift = shiftOf("baddate");

  expect(validateShift(incorrectShift)).toStrictEqual(
    left(new Error("unparsable")),
  );

  const shiftExceeding30Days = shiftOf(
    DateTime.utc().plus({ days: 31 }).toFormat("yyyy-MM-dd"),
  );

  expect(validateShift(shiftExceeding30Days)).toStrictEqual(
    left(new Error("Given date is after 30 days later; or is before now.")),
  );

  const shiftBeforeToday = shiftOf(
    DateTime.utc().minus({ days: 1 }).toFormat("yyyy-MM-dd"),
  );

  expect(validateShift(shiftBeforeToday)).toStrictEqual(
    left(new Error("Given date is after 30 days later; or is before now.")),
  );
});

test("validateTime function should function properly", () => {
  const emptyTimeStr = timeOf("");

  expect(validateTime(emptyTimeStr)).toStrictEqual(
    left(new Error("Time cannot be an empty string")),
  );

  const correctMorning = timeOf("00:00 AM");

  expect(validateTime(correctMorning)).toStrictEqual(right(correctMorning));

  const correctAfternoon = timeOf("11:40 PM");

  expect(validateTime(correctAfternoon)).toStrictEqual(right(correctAfternoon));

  const incorrectMorning = timeOf("13:30 AM");

  expect(validateTime(incorrectMorning)).toStrictEqual(
    left(new Error("[Malformation] please check the hours and minutes")),
  );

  const incorrectMinutes = timeOf("02:60 PM");

  expect(validateTime(incorrectMinutes)).toStrictEqual(
    left(new Error("[Malformation] please check the hours and minutes")),
  );

  const noAMOrPM = timeOf("01:15");

  expect(validateTime(noAMOrPM)).toStrictEqual(
    left(new Error("Invalid time string format; should be '00:00 AM/PM'")),
  );

  const incorrectAMOrPM = timeOf("02:45 pm");

  expect(validateTime(incorrectAMOrPM)).toStrictEqual(
    left(new Error("Invalid time string format; should be '00:00 AM/PM'")),
  );
});

function generateShifts(): Shift[] {
  return range(15, 17).map((v, i, a) =>
    shiftOf(DateTime.utc().plus({ days: v }).toFormat("yyyy-MM-dd"))
  );
}

test("Malformed shift/time/hours should be reported by shift booking API", async () => {
  const goodShift = shiftOf(DateTime.utc().toFormat("yyyy-MM-dd"));
  const badShift = shiftOf(
    DateTime.utc().plus({ day: 45 }).toFormat("yyyy-MM-dd"),
  );
  const goodTime = timeOf("10:00 AM");
  const badTime = timeOf("13:00 AM");
  const goodHours = hoursOf(3);
  const badHours = hoursOf(2);

  const nomadAddress = new a.Address(
    a.address1Of("85-93 Commonwealth St"),
    a.suburbOf("Surry Hills"),
    a.stateOf("NSW"),
    a.postcodeOf("2010"),
    false,
    none,
    none,
    none,
    some(new a.CompanyName("Nomad")),
    none,
  );

  const badShiftResult = bookShifts(
    nomadAddress,
    p.Type.Grocery,
    [goodShift, badShift],
    goodTime,
    goodHours,
    runnerNumberOf(1),
    Vehicle.Sedan,
    [equipmentOf("trolley")],
    noteOf("Be on time"),
  )(configProvider);

  expect(await badShiftResult()).toStrictEqual(
    left(new Error("Given date is after 30 days later; or is before now.")),
  );

  const badTimeResult = bookShifts(
    nomadAddress,
    p.Type.Grocery,
    [goodShift],
    badTime,
    goodHours,
    runnerNumberOf(1),
    Vehicle.Sedan,
    [equipmentOf("trolley")],
    noteOf("Be on time"),
  )(configProvider);

  expect(await badTimeResult()).toStrictEqual(
    left(new Error("[Malformation] please check the hours and minutes")),
  );

  const badHoursResult = bookShifts(
    nomadAddress,
    p.Type.Grocery,
    [goodShift],
    goodTime,
    badHours,
    runnerNumberOf(1),
    Vehicle.Sedan,
    [equipmentOf("trolley")],
    noteOf("Be on time"),
  )(configProvider);

  expect(await badHoursResult()).toStrictEqual(
    left(new Error("Hours must > 3")),
  );
});

test("Should successfully book shifts", async () => {
  mockserver.post("/shift").withHeaders(
    { Authorization: "bearer this-api-key" },
  ).thenReply(
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
    a.address1Of("85-93 Commonwealth St"),
    a.suburbOf("Surry Hills"),
    a.stateOf("NSW"),
    a.postcodeOf("2010"),
    false,
    some(a.contactNameOf("Richard Chuo")),
    some(a.contactNumberOf("02 8072 4146")),
    none,
    some(a.companyNameOf("Nomad")),
    none,
  );

  // use our own runner, thus runner number is '0'
  const bs = await bookShifts(
    pickUpAddress,
    p.Type.Grocery,
    generateShifts(),
    timeOf("10:00 AM"),
    hoursOf(3),
    runnerNumberOf(0),
    Vehicle.Sedan,
    [equipmentOf("trolley")],
    noteOf("Be on time"),
  )(configProvider)();

  expect(bs).toStrictEqual(
    right([
      new ShiftInfo(
        shiftIdOf("b3d1c5cc-27a3-4683-3c81-6ed6561fe9f3"),
        shiftTimeOf("2020-07-19 10:00:00+1000"),
      ),
      new ShiftInfo(
        shiftIdOf("6c25d135-0f2b-f330-9f6f-ba7bead1ab81"),
        shiftTimeOf("2020-07-20 10:00:00+1000"),
      ),
      new ShiftInfo(
        shiftIdOf("2e1761ac-dbee-7555-4107-b65aca24db4f"),
        shiftTimeOf("2020-07-21 10:00:00+1000"),
      ),
    ]),
  );
});

test("A job booking in an existing shift should creating a job instantly", async () => {
  mockserver.post("/book/instant").withHeaders(
    { Authorization: "bearer this-api-key" },
  ).twice().thenReply(
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

  mockserver.post("/shift").withHeaders(
    { Authorization: "bearer this-api-key" },
  ).twice().thenReply(
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
    a.address1Of("580 Darling Street"),
    a.suburbOf("Rozelle"),
    a.stateOf("NSW"),
    a.postcodeOf("2039"),
    false,
    none,
    none,
    none,
    some(a.companyNameOf("Fourth Fish Cafe - Rozelle")),
    none,
  );

  const addressTo = new a.Address(
    a.address1Of("100 Pitt St"),
    a.suburbOf("Sydney"),
    a.stateOf("NSW"),
    a.postcodeOf("2000"),
  );
  const dt = DateTime.local().setZone("Australia/Sydney").plus({ days: 2 });
  const nomadShifts = bookShifts(
    nomadAddress,
    p.Type.Grocery,
    [shiftOf(dt.toFormat("yyyy-MM-dd"))],
    timeOf("11:00 AM"),
    hoursOf(3),
    runnerNumberOf(1),
    Vehicle.Sedan,
    [equipmentOf("trolley")],
    noteOf("Be on time"),
  )(configProvider);

  const aParcel = new p.Parcel(p.Type.Grocery, new p.ParcelNumber(2));
  const resp = instantGoShift(
    nomadAddress,
    addressTo,
    [aParcel],
    dt.set({ hour: 11, minute: 0, second: 0 }),
    descriptionOf("Sushi set"),
  )(configProvider);

  const firstBatch = chain((s) => resp)(nomadShifts);

  const haidilaoAddress = new a.Address(
    a.address1Of("8-1 Anderson St"),
    a.suburbOf("Chatswood"),
    a.stateOf("NSW"),
    a.postcodeOf("2067"),
    false,
    none,
    none,
    none,
    some(new a.CompanyName("Haidilao")),
    none,
  );

  const haidilaoshift = bookShifts(
    haidilaoAddress,
    p.Type.Grocery,
    [shiftOf(dt.toFormat("yyyy-MM-dd"))],
    timeOf("12:00 PM"),
    hoursOf(3),
    runnerNumberOf(1),
    Vehicle.Van,
    [equipmentOf("trolley")],
    noteOf("Be on time"),
  )(configProvider);

  const hResponse = instantGoShift(
    haidilaoAddress,
    addressTo,
    [aParcel],
    dt.set({ hour: 12, minute: 0, second: 0 }),
    descriptionOf("Hot pot"),
  )(configProvider);

  const secondBatch = chain((x) => hResponse)(haidilaoshift);

  const result = await chain((x) => secondBatch)(firstBatch)();

  expect(result).toStrictEqual(
    right(
      new JobInfo(
        jobIdOf("894c0a10-fdb9-fb27-8ddb-d81c94a6e46c"),
        trackingCodeOf("7OSPD3"),
      ),
    ),
  );
});

test("Cancel a job", async () => {
  mockserver.post("/book/instant").withHeaders(
    { Authorization: "bearer this-api-key" },
  ).thenReply(
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

  mockserver
    .delete("/job")
    .withHeaders({ Authorization: "bearer this-api-key" })
    .withQuery({ id: "894c0a10-fdb9-fb27-8ddb-d81c94a6e46c" })
    .thenReply(
      200,
      `{"errorCode":0,"message":"","title":"","debug":"","result":{"jobId":"894c0a10-fdb9-fb27-8ddb-d81c94a6e46c"}}`,
    );

  const dt = DateTime.local().setZone("Australia/Sydney").plus({ days: 2 });

  const haidilaoAddress = new a.Address(
    a.address1Of("8-1 Anderson St"),
    a.suburbOf("Chatswood"),
    a.stateOf("NSW"),
    a.postcodeOf("2067"),
    false,
    none,
    none,
    none,
    some(new a.CompanyName("Haidilao")),
    none,
  );

  const addressTo = new a.Address(
    a.address1Of("100 Pitt St"),
    a.suburbOf("Sydney"),
    a.stateOf("NSW"),
    a.postcodeOf("2000"),
  );

  const aParcel = new p.Parcel(p.Type.Grocery, new p.ParcelNumber(2));

  const hResponse = instantGoShift(
    haidilaoAddress,
    addressTo,
    [aParcel],
    dt.set({ hour: 11, minute: 0, second: 0 }),
    descriptionOf("Hot pot"),
  )(configProvider);

  const cancelJobResult = await chain<Error, JobInfo, JobId>((info) =>
    cancelJob(info.id)(configProvider)
  )(hResponse)();

  expect(cancelJobResult).toStrictEqual(
    right(jobIdOf("894c0a10-fdb9-fb27-8ddb-d81c94a6e46c")),
  );
});

test("Should successfully fetch job info", async () => {
  const dt = DateTime.local().setZone("Australia/Sydney").plus({ day: 1 });

  mockserver
    .get("/job/status")
    .withHeaders({ Authorization: "bearer this-api-key" })
    .withQuery({ date: dt.toFormat("yyyy-MM-dd") })
    .thenReply(
      200,
      `{
          "errorCode":0,
          "message":"",
          "title":"",
          "debug":"",
          "result":[
             {
                "jobId":"179d1763-76ac-e2ae-d19a-4d99130b19d0",
                "ref":"",
                "status":"delivering"
             },
             {
                "jobId":"c96af157-4805-c968-9c33-8b93d1b94ce4",
                "ref":"",
                "status":"cancelled"
             },
             {
                "jobId":"a85889f8-943d-37fb-5094-a0011a69a2d5",
                "ref":"",
                "status":"booked_in"
             }
          ]
      }`,
    );

  const jobsStatus = fetchJobStatus(dt)(configProvider);

  expect(await jobsStatus()).toStrictEqual(
    right([
      {
        jobId: jobIdOf("179d1763-76ac-e2ae-d19a-4d99130b19d0"),
        ref: "",
        status: Status.Delivering,
      },
      {
        jobId: jobIdOf("c96af157-4805-c968-9c33-8b93d1b94ce4"),
        ref: "",
        status: Status.Cancelled,
      },
      {
        jobId: jobIdOf("a85889f8-943d-37fb-5094-a0011a69a2d5"),
        ref: "",
        status: Status.BookedIn,
      },
    ]),
  );
});

test("Should successfully get a quote", async () => {
  const dt = DateTime.local().setZone("Australia/Sydney").plus({ day: 1 });

  const fromAddress = new a.Address(
    a.address1Of("1 Anderson St"),
    a.suburbOf("Chatswood"),
    a.stateOf("NSW"),
    a.postcodeOf("2067"),
    false,
    some(a.contactNameOf("John Doe")),
    some(a.contactNumberOf("02 8072 4146")),
    none,
    none,
    some(a.unitOf("Shop 607")),
  );

  const fromAddJson = a.toJson(fromAddress);

  const toAddress = new a.Address(
    a.address1Of("Ross St"),
    a.suburbOf("Naremburn"),
    a.stateOf("NSW"),
    a.postcodeOf("2065"),
    false,
    some(a.contactNameOf("John Doe")),
    some(a.contactNumberOf("02 8072 4146")),
    none,
    none,
    none,
  );

  const toAddJson = a.toJson(toAddress);
  const testParcels = [new p.Parcel(p.Type.Grocery, p.parcelNumberOf(1))];
  const testParcelsJson = arrayMap<p.Parcel, object>((pl) => p.toJson(pl))(testParcels);
  const testPickup = dt.set({ hour: 19, minute: 50 });
  const testPickupStr = testPickup.toFormat("yyyy-MM-dd HH:mm:ssZZZ");

  const testGoNowBody = {
    addressFrom: fromAddJson,
    addressTo: toAddJson,
    parcels: testParcelsJson,
    pickUpAfter: testPickupStr,
    onDemand: true,
    setRun: false,
  };

  // DEBUG
  console.log(`test GoNOW body: ${JSON.stringify(testGoNowBody)}`)

  const testGoSameDayBody = {
    addressFrom: fromAddJson,
    addressTo: toAddJson,
    parcels: testParcelsJson,
    pickUpAfter: testPickupStr,
    onDemand: false,
    setRun: true,
  };

  // DEBUG
  console.log(`test GoSAMEDAY body: ${JSON.stringify(testGoSameDayBody)}`)

  mockserver
    .post("/quote")
    .withJsonBodyIncluding({ onDemand: true, setRun: false })
    .withHeaders(
      {
        Authorization: "bearer this-api-key",
        "Content-Type": "application/json",
      },
    )
    .thenReply(
      200,
      `{
          "errorCode":0,
          "message":"",
          "title":"",
          "debug":"",
          "result":{
             "distance":12.45,
             "expiredAt":"2020-07-13 16:05:01+1000",
             "onDemandPriceList":[
                {
                   "serviceName":"fast delivery",
                   "objectId":"ced344d1-d337-e141-fa54-fbb5dcfa6926",
                   "amount":28.6,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-14 11:35:00+1000",
                   "dropOffBy":"2020-07-14 15:00:00+1000"
                },
                {
                   "serviceName":"faster delivery",
                   "objectId":"fbcf7cfb-978c-34f8-5851-2bf9cfa16efe",
                   "amount":34.1,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-14 11:35:00+1000",
                   "dropOffBy":"2020-07-14 14:00:00+1000"
                },
                {
                   "serviceName":"fastest delivery",
                   "objectId":"7e325699-6244-ebd1-e47d-4e7ddf02cdf1",
                   "amount":56.1,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-14 11:35:00+1000",
                   "dropOffBy":"2020-07-14 13:00:00+1000"
                },
                {
                   "serviceName":"standard delivery",
                   "objectId":"ed1fe2f5-6745-5182-cbe7-770046959eb2",
                   "amount":23.1,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-14 11:35:00+1000",
                   "dropOffBy":"2020-07-14 17:00:00+1000"
                },
                {
                   "serviceName":"custom delivery",
                   "objectId":"42a6a193-0f9f-ffee-30ed-4dc95b59d0c2",
                   "amount":56.1,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-14 11:35:00+1000",
                   "dropOffBy":"2020-07-14 14:00:00+1000"
                }
             ],
             "setRunPriceList":[
             
             ],
             "shiftList":[
                {
                   "serviceName":"Surry Hills tomorrow 11:00 AM 3 - 4 hours",
                   "objectId":"0287b65b-cbac-0bf1-3d67-c7265b7fcdec",
                   "amount":0,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-14 11:00:00+1000",
                   "dropOffBy":"2020-07-14 15:30:00+1000"
                },
                {
                   "serviceName":"Surry Hills 25/07 10:00 AM 3 - 4 hours",
                   "objectId":"d01dc13f-e0e8-9e89-3b94-d21eccc9283a",
                   "amount":0,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-25 10:00:00+1000",
                   "dropOffBy":"2020-07-25 14:30:00+1000"
                },
                {
                   "serviceName":"Surry Hills 26/07 10:00 AM 3 - 4 hours",
                   "objectId":"ee61a99a-6664-d52e-de4b-277fef60457c",
                   "amount":0,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-26 10:00:00+1000",
                   "dropOffBy":"2020-07-26 14:30:00+1000"
                },
                {
                   "serviceName":"Surry Hills 27/07 10:00 AM 3 - 4 hours",
                   "objectId":"fdfc3c00-7a1d-52b9-012b-edffc9bb1005",
                   "amount":0,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-27 10:00:00+1000",
                   "dropOffBy":"2020-07-27 14:30:00+1000"
                }
             ]
          }
        }`,
    );

  mockserver
    .post("/quote")
    .withJsonBodyIncluding({ onDemand: false, setRun: true })
    .withHeaders(
      {
        Authorization: "bearer this-api-key",
        "Content-Type": "application/json",
      },
    )
    .thenReply(
      200,
      `{
          "errorCode":0,
          "message":"",
          "title":"",
          "debug":"",
          "result":{
             "distance":12.45,
             "expiredAt":"2020-07-13 16:05:02+1000",
             "onDemandPriceList":[

             ],
             "setRunPriceList":[
                {
                   "serviceName":"pick up after 12:00 PM on 14/07",
                   "objectId":"f84e87a0-4f72-1dea-409f-c24541952cbe",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-14 12:00:00+1000",
                   "dropOffBy":"2020-07-14 16:00:00+1000"
                },
                {
                   "serviceName":"pick up after 01:00 PM on 14/07",
                   "objectId":"124026b0-91ed-1159-3660-536db21c27e3",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-14 13:00:00+1000",
                   "dropOffBy":"2020-07-14 17:00:00+1000"
                },
                {
                   "serviceName":"pick up after 10:00 AM on 15/07",
                   "objectId":"ef83874c-726e-5dc5-6c67-2bd05f7c6113",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-15 10:00:00+1000",
                   "dropOffBy":"2020-07-15 14:00:00+1000"
                },
                {
                   "serviceName":"pick up after 11:00 AM on 15/07",
                   "objectId":"581516c0-e43f-f3f5-ccfe-87874f75c9c7",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-15 11:00:00+1000",
                   "dropOffBy":"2020-07-15 15:00:00+1000"
                },
                {
                   "serviceName":"pick up after 12:00 PM on 15/07",
                   "objectId":"037bc881-ec84-7fbd-e1ae-d7c95acb6eeb",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-15 12:00:00+1000",
                   "dropOffBy":"2020-07-15 16:00:00+1000"
                },
                {
                   "serviceName":"pick up after 01:00 PM on 15/07",
                   "objectId":"f12b4881-4b14-e7c7-ea01-a7e2755b8a46",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-15 13:00:00+1000",
                   "dropOffBy":"2020-07-15 17:00:00+1000"
                },
                {
                   "serviceName":"pick up after 10:00 AM on 16/07",
                   "objectId":"967efa04-ed86-ac8e-670e-76f48f380b6d",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-16 10:00:00+1000",
                   "dropOffBy":"2020-07-16 14:00:00+1000"
                },
                {
                   "serviceName":"pick up after 11:00 AM on 16/07",
                   "objectId":"85f85f11-e1a3-4655-3a3c-144355811868",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-16 11:00:00+1000",
                   "dropOffBy":"2020-07-16 15:00:00+1000"
                },
                {
                   "serviceName":"pick up after 12:00 PM on 16/07",
                   "objectId":"c2ddcba5-01cb-8a55-413e-c7ed5956e01e",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-16 12:00:00+1000",
                   "dropOffBy":"2020-07-16 16:00:00+1000"
                },
                {
                   "serviceName":"pick up after 01:00 PM on 16/07",
                   "objectId":"91ba5f11-87e7-c706-df58-0fbd9eab7c51",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-16 13:00:00+1000",
                   "dropOffBy":"2020-07-16 17:00:00+1000"
                },
                {
                   "serviceName":"pick up after 10:00 AM on 17/07",
                   "objectId":"0d0d9c01-0b13-d253-ec4f-e43f11e3267c",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-17 10:00:00+1000",
                   "dropOffBy":"2020-07-17 14:00:00+1000"
                },
                {
                   "serviceName":"pick up after 11:00 AM on 17/07",
                   "objectId":"657d439d-1671-4a40-7f8e-11b267711214",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-17 11:00:00+1000",
                   "dropOffBy":"2020-07-17 15:00:00+1000"
                },
                {
                   "serviceName":"pick up after 12:00 PM on 17/07",
                   "objectId":"4b85a2c1-9986-0bb7-9104-33cecca84862",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-17 12:00:00+1000",
                   "dropOffBy":"2020-07-17 16:00:00+1000"
                },
                {
                   "serviceName":"pick up after 01:00 PM on 17/07",
                   "objectId":"ec6e9d4a-526b-4982-e7cc-951256771cd0",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-17 13:00:00+1000",
                   "dropOffBy":"2020-07-17 17:00:00+1000"
                },
                {
                   "serviceName":"pick up after 11:00 AM on 18/07",
                   "objectId":"a83ca393-cd34-42e1-42e7-9d004327161b",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-18 11:00:00+1000",
                   "dropOffBy":"2020-07-18 15:00:00+1000"
                },
                {
                   "serviceName":"pick up after 10:00 AM on 20/07",
                   "objectId":"cb80b036-25fe-99c2-5572-f885a00c8910",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-20 10:00:00+1000",
                   "dropOffBy":"2020-07-20 14:00:00+1000"
                },
                {
                   "serviceName":"pick up after 11:00 AM on 20/07",
                   "objectId":"da98b3ce-2596-cdb0-734c-b39c9178c5b8",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-20 11:00:00+1000",
                   "dropOffBy":"2020-07-20 15:00:00+1000"
                },
                {
                   "serviceName":"pick up after 12:00 PM on 20/07",
                   "objectId":"9bf875b5-de27-04f1-c551-7cb154deda01",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-20 12:00:00+1000",
                   "dropOffBy":"2020-07-20 16:00:00+1000"
                },
                {
                   "serviceName":"pick up after 01:00 PM on 20/07",
                   "objectId":"b536118e-7058-f93b-5fdd-bc3fd34fb6b6",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-20 13:00:00+1000",
                   "dropOffBy":"2020-07-20 17:00:00+1000"
                },
                {
                   "serviceName":"pick up after 10:00 AM on 21/07",
                   "objectId":"01acc4eb-59c1-01b4-d10b-6b5dde86324d",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-21 10:00:00+1000",
                   "dropOffBy":"2020-07-21 14:00:00+1000"
                },
                {
                   "serviceName":"pick up after 11:00 AM on 21/07",
                   "objectId":"026633ad-1b41-2d00-875e-6dde79367b52",
                   "amount":17.95,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-21 11:00:00+1000",
                   "dropOffBy":"2020-07-21 15:00:00+1000"
                }
             ],
             "shiftList":[
                {
                   "serviceName":"Surry Hills tomorrow 11:00 AM 3 - 4 hours",
                   "objectId":"c98452dd-ff8d-60ee-f9cc-0a7ae22a22bd",
                   "amount":0,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-14 11:00:00+1000",
                   "dropOffBy":"2020-07-14 15:30:00+1000"
                },
                {
                   "serviceName":"Surry Hills 25/07 10:00 AM 3 - 4 hours",
                   "objectId":"62986d0a-ab7c-63c2-aa0a-6abb483e7ce0",
                   "amount":0,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-25 10:00:00+1000",
                   "dropOffBy":"2020-07-25 14:30:00+1000"
                },
                {
                   "serviceName":"Surry Hills 26/07 10:00 AM 3 - 4 hours",
                   "objectId":"2fced0a4-0e85-ae91-dd6c-5543be739764",
                   "amount":0,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-26 10:00:00+1000",
                   "dropOffBy":"2020-07-26 14:30:00+1000"
                },
                {
                   "serviceName":"Surry Hills 27/07 10:00 AM 3 - 4 hours",
                   "objectId":"447b0810-5329-ffa1-d41e-f0c34b364c8e",
                   "amount":0,
                   "currency":"AUD",
                   "pickupAfter":"2020-07-27 10:00:00+1000",
                   "dropOffBy":"2020-07-27 14:30:00+1000"
                }
             ]
          }
        }`,
    );

  const goNowResult = getQuote({
    addressFrom: fromAddress,
    addressTo: toAddress,
    parcels: testParcels,
    shiftType: GoNOW,
    pickUpAfter: some(testPickup),
    dropOffBy: some(testPickup.plus({ minutes: 30 })),
  });

  fold<Error, QuoteInfo, void>(
    (e) => fail(`Failed to get any quote, reason: ${e.message}`),
    (q) => {
      expect(q.distance).toBe(12.45);
      expect(
        q.expiredAt.setZone("Australia/Sydney").toFormat(
          "yyyy-MM-dd HH:mm:ssZZZ",
        ),
      ).toBe(
        "2020-07-13 16:05:01+1000",
      );
      optFold<Quote[], void>(
        () => fail("No GoNOW quote returned"),
        (quotes) => {
          expect(arrayMap<Quote, number>((qx) => qx.amount)(quotes))
            .toStrictEqual([28.6, 34.1, 56.1, 23.1, 56.1]);
        },
      )(q.goNowQuotes);
    },
  )(await goNowResult(configProvider)());

  const goSameDayResult = getQuote({
    addressFrom: fromAddress,
    addressTo: toAddress,
    parcels: testParcels,
    shiftType: GoSAMEDAY,
    pickUpAfter: some(testPickup),
    dropOffBy: some(testPickup.plus({ minutes: 30 })),
  });

  fold<Error, QuoteInfo, void>(
    (e) => fail(`Failed to get any quote, reason: ${e.message}`),
    (q) => {
      expect(q.distance).toBe(12.45);
      expect(
        q.expiredAt.setZone("Australia/Sydney").toFormat(
          "yyyy-MM-dd HH:mm:ssZZZ",
        ),
      ).toBe(
        "2020-07-13 16:05:02+1000",
      );
      optFold<Quote[], void>(
        () => fail("No GoSAMEDAY quote returned"),
        (quotes) => {
          expect(
            arrayFilter<Quote>((q) => {
              return q.amount !== 17.95;
            })(quotes).length,
          ).toBe(0);
        },
      )(q.goSameDayQuotes);
    },
  )(await goSameDayResult(configProvider)());
});

test("Should successfully get a quote and book a job", async () => {
  mockserver
    .post("/book")
    .withJsonBodyIncluding(
      {
        quoteId: "7e325699-6244-ebd1-e47d-4e7ddf02cdf1",
        description: "a testing description",
      },
    )
    .withHeaders(
      {
        Authorization: "bearer this-api-key",
        "Content-Type": "application/json",
      },
    )
    .thenReply(
      200,
      `{
          "errorCode":0,
          "message":"",
          "title":"",
          "debug":"",
          "result":{
             "jobId":"b48fad73-b7c9-1fbb-a422-24ffe9489971",
             "number":"1054231-7300",
             "ref":"",
             "ref2":"",
             "zone":"",
             "zonerun":null,
             "category":"gonow",
             "barcodes":[
                {
                   "text":"1054231-7300-10"
                }
             ],
             "trackingCode":"VQSR2L",
             "description":"#5036F, Meet up",
             "note":"",
             "status":"booked_in",
             "partiallyPickedUp":false,
             "pickUpAfter":"2020-07-17 13:45:00+1000",
             "dropOffBy":"2020-07-17 17:30:00+1000",
             "estimatedPickupTime":null,
             "estimatedDropOffTime":null,
             "actualPickupTime":null,
             "actualDropOffTime":null,
             "createdTime":"2020-07-17 13:35:02+1000",
             "addressFrom":{
                "unit":"",
                "address1":"580 Darling Street",
                "suburb":"Rozelle",
                "state":"NSW",
                "postcode":"2039",
                "companyName":"Fourth Fish Cafe - Rozelle",
                "contactName":"",
                "contactNumber":"",
                "contactEmail":null,
                "sendUpdateSMS":false,
                "isCommercial":true
             },
             "addressTo":{
                "unit":"",
                "address1":"82 Archer St",
                "suburb":"Chatswood",
                "state":"NSW",
                "postcode":"2067",
                "companyName":"Residential",
                "contactName":"Jungle",
                "contactNumber":"0478123742",
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

  const result = await bookJob({
    quoteId: quoteIdOf("7e325699-6244-ebd1-e47d-4e7ddf02cdf1"),
    description: bjDescriptionOf("a testing description"),
  })(configProvider)();

  fold<Error, JobInfo, void>(
    (e) => fail(`Failed to book a GoNOW job: ${e.message}`),
    (ji) => {
      expect(ji.id.id).toBe("b48fad73-b7c9-1fbb-a422-24ffe9489971");
      expect(ji.code.code).toBe("VQSR2L");
    },
  )(result);
});
