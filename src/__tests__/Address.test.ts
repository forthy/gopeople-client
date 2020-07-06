import * as a from '../models/address';
import { some, none } from 'fp-ts/lib/Option';
import * as faker from 'faker';
import * as _ from 'lodash';

test('Address object should be properly created', () => {
  const address1Str = faker.address.streetAddress();
  const suburbStr = faker.address.secondaryAddress();
  const stateStr = faker.address.state();
  const zipCodeStr = faker.address.zipCode();

  const address = new a.Address(
    a.address1Of(address1Str),
    a.suburbOf(suburbStr),
    a.stateOf(stateStr),
    a.postcodeOf(zipCodeStr),
  );

  expect(_.omitBy(a.toJson(address), _.isNull)).toStrictEqual({
    address1: address1Str,
    suburb: suburbStr,
    state: stateStr,
    postcode: zipCodeStr,
    isCommercial: false,
    sendUpdateSMS: false,
  });

  const companyNameStr = faker.company.companyName();

  const commercialAdd = new a.Address(
    a.address1Of(address1Str),
    a.suburbOf(suburbStr),
    a.stateOf(stateStr),
    a.postcodeOf(zipCodeStr),
    false,
    none,
    none,
    none,
    some(a.companyNameOf(companyNameStr)),
    none,
  );

  expect(_.omitBy(a.toJson(commercialAdd), _.isNull)).toStrictEqual({
    address1: address1Str,
    suburb: suburbStr,
    state: stateStr,
    postcode: zipCodeStr,
    isCommercial: true,
    companyName: companyNameStr,
    sendUpdateSMS: false,
  });
});
