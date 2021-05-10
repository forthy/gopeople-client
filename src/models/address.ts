import { Option, none, fold, isSome } from 'fp-ts/lib/Option';

export {
  Unit,
  unitOf,
  Address1,
  address1Of,
  Suburb,
  suburbOf,
  State,
  stateOf,
  Postcode,
  postcodeOf,
  ContactName,
  contactNameOf,
  ContactNumber,
  contactNumberOf,
  ContactEmail,
  contactEmailOf,
  CompanyName,
  companyNameOf,
  Address,
  IAddress,
  toJson,
};

/**
 * An address unit type
 */
class Unit {
  /**
   *
   * @param u - a string that prepresents an address unit, such as room 1
   */
  constructor(readonly u: string) { }
}

/**
 * An easy constructor of Unit type
 * @param u - a string that prepresents an address unit, such as room 1
 */
function unitOf(u: string): Unit {
  return new Unit(u);
}

/**
 * The main Address type
 */
class Address1 {
  /**
   * The main address
   * @param a - the main address
   */
  constructor(readonly a: string) { }
}

/**
 * An easy constructor of Address1 type
 * @param a - the main address
 */
function address1Of(a: string): Address1 {
  return new Address1(a);
}

class Suburb {
  constructor(readonly s: string) { }
}

function suburbOf(s: string): Suburb {
  return new Suburb(s);
}

class State {
  constructor(readonly s: string) { }
}

function stateOf(s: string): State {
  return new State(s);
}

class Postcode {
  constructor(readonly p: string) { }
}

function postcodeOf(p: string) {
  return new Postcode(p);
}

class ContactName {
  constructor(readonly name: string) { }
}

function contactNameOf(name: string) {
  return new ContactName(name);
}

class ContactNumber {
  constructor(readonly num: string) { }
}

function contactNumberOf(num: string): ContactNumber {
  return new ContactNumber(num);
}

class ContactEmail {
  constructor(readonly mail: string) { }
}

function contactEmailOf(mail: string): ContactEmail {
  return new ContactEmail(mail);
}

class CompanyName {
  constructor(readonly name: string) { }
}

function companyNameOf(name: string): CompanyName {
  return new CompanyName(name);
}

class Address {
  constructor(
    readonly address1: Address1,
    readonly suburb: Suburb,
    readonly state: State,
    readonly postcode: Postcode,
    readonly sendUpdateSMS: boolean = false,
    readonly contactName: Option<ContactName> = none,
    readonly contactNumber: Option<ContactNumber> = none,
    readonly contactEmail: Option<ContactEmail> = none,
    readonly companyName: Option<CompanyName> = none,
    readonly unit: Option<Unit> = none,
  ) { }
}

interface IAddress {
  address1: string;
  suburb: string;
  state: string;
  postcode: string;
  isCommercial: boolean;
  unit?: string;
  contactName?: string;
  contactNumber?: string;
  sendUpdateSMS?: boolean;
  contactEmail?: string;
  companyName?: string;
}

function toJson(a: Address): IAddress {
  return {
    address1: a.address1.a,
    suburb: a.suburb.s,
    state: a.state.s,
    postcode: a.postcode.p,
    isCommercial: isSome(a.companyName),
    unit: fold<Unit, string | undefined>(
      () => undefined,
      (v) => v.u,
    )(a.unit),
    contactName: fold<ContactName, string | undefined>(
      () => undefined,
      (v) => v.name,
    )(a.contactName),
    contactNumber: fold<ContactNumber, string | undefined>(
      () => undefined,
      (v) => v.num,
    )(a.contactNumber),
    sendUpdateSMS: a.sendUpdateSMS,
    contactEmail: fold<ContactEmail, string | undefined>(
      () => undefined,
      (v) => v.mail,
    )(a.contactEmail),
    companyName: fold<CompanyName, string | undefined>(
      () => undefined,
      (v) => v.name,
    )(a.companyName),
  };
}
