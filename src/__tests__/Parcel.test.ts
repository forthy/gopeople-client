import * as p from '../models/parcel';
import { some, none } from 'fp-ts/lib/Option';
import * as _ from 'lodash';

test('Parcel object should be properly created when type is not custom', () => {
  const parcel: p.Parcel = new p.Parcel(p.Type.Grocery, new p.ParcelNumber(1));

  expect(_.omitBy(p.toJson(parcel), _.isNull)).toStrictEqual({ type: 'grocery', number: 1 });

  console.log(`p: ${JSON.stringify(_.omitBy(p.toJson(parcel), _.isNull))}`);

  const parcel2: p.Parcel = new p.Parcel(
    p.Type.Grocery,
    new p.ParcelNumber(1),
    none,
    none,
    none,
    some(new p.Dimension(new p.Width(20), new p.Height(10), new p.Length(20), new p.Weight(1))),
  );

  expect(_.omitBy(p.toJson(parcel2), _.isNull)).toStrictEqual({ type: 'grocery', number: 1 });
});

test('Parcel object should be properly created when type is custom', () => {
  const parcel: p.Parcel = new p.Parcel(
    p.Type.Custom,
    new p.ParcelNumber(1),
    none,
    none,
    none,
    some(new p.Dimension(new p.Width(20), new p.Height(10), new p.Length(20), new p.Weight(1))),
  );

  expect(_.omitBy(p.toJson(parcel), _.isNull)).toStrictEqual({
    type: 'custom',
    number: 1,
    width: 20,
    height: 10,
    length: 20,
    weight: 1,
  });
});
