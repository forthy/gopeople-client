import { Option, none, fold } from 'fp-ts/lib/Option';
import * as _ from 'lodash';

export {
  Type,
  ProductId,
  Sku,
  Name,
  ParcelNumber,
  Width,
  Height,
  Length,
  Weight,
  Dimension,
  Parcel,
  IParcel,
  toJson,
  productIdOf,
  skuOf,
  nameOf,
  parcelNumberOf,
  widthOf,
  heightOf,
  lengthOf,
  weightOf,
};

enum Type {
  Document = 'document', // weight less then 1kg
  Flowers = 'flowers', // flower bouquets or flower arrangements with a height less than 50cm
  Satchel = 'satchel', // satchel or bag weight less than 5kg
  Standard = 'standard', // boxes weight less than 5kg and size not exceed than 50cm x 30cm x 20cm
  Grocery = 'grocery', // food and/or beverages weight less than 5kg
  Donuts = 'donuts', // donuts in boxes, weight less than 5kg and size not exceed than 50cm x 30cm x 20cm
  Cake = 'cake', // cake in boxes, weight less than 5kg and size not exceed than 50cm x 30cm x 20cm
  Custom = 'custom', // calculated based on parcel size
}

class ProductId {
  constructor(readonly id: string) { }
}

function productIdOf(id: string): ProductId {
  return new ProductId(id);
}

// required for Shopping Cart endpoint
class Sku {
  constructor(readonly s: string) { }
}

function skuOf(s: string): Sku {
  return new Sku(s);
}

class Name {
  constructor(readonly n: string) { }
}

function nameOf(n: string): Name {
  return new Name(n);
}

// number of parcels
class ParcelNumber {
  constructor(readonly num: number) { }
}

function parcelNumberOf(num: number): ParcelNumber {
  return new ParcelNumber(num);
}

// required when type is custom (cm)
class Width {
  constructor(readonly w: number) { }
}

function widthOf(w: number): Width {
  return new Width(w);
}

// required when type is custom (cm)
class Height {
  constructor(readonly h: number) { }
}

function heightOf(h: number): Height {
  return new Height(h);
}
// required when type is custom (cm)
class Length {
  constructor(readonly l: number) { }
}

function lengthOf(l: number): Length {
  return new Length(l);
}

// required when type is custom (kg)
class Weight {
  constructor(readonly wt: number) { }
}

function weightOf(wl: number): Weight {
  return new Weight(wl);
}

class Dimension {
  constructor(readonly width: Width, readonly height: Height, readonly length: Length, readonly weight: Weight) { }
}

class Parcel {
  constructor(
    readonly type: Type,
    readonly parcelNumber: ParcelNumber,
    readonly productId: Option<ProductId> = none,
    readonly sku: Option<Sku> = none,
    readonly name: Option<Name> = none,
    readonly dimension: Option<Dimension> = none,
  ) { }
}

interface IParcel {
  readonly type: string;
  readonly number: number;
  readonly productId?: string;
  readonly sku?: string;
  readonly name?: string;
  readonly width?: number;
  readonly height?: number;
  readonly length?: number;
  readonly weight?: number;
}

function toJson(p: Parcel): IParcel {
  return {
    type: p.type,
    number: p.parcelNumber.num,
    productId: fold<ProductId, string | undefined>(
      () => undefined,
      (v) => v.id,
    )(p.productId),
    sku: fold<Sku, string | undefined>(
      () => undefined,
      (v) => v.s,
    )(p.sku),
    name: fold<Name, string | undefined>(
      () => undefined,
      (v) => v.n,
    )(p.name),
    width: fold<Dimension, number | undefined>(
      () => undefined,
      (v) => (p.type !== Type.Custom ? undefined : v.width.w),
    )(p.dimension),
    height: fold<Dimension, number | undefined>(
      () => undefined,
      (v) => (p.type !== Type.Custom ? undefined : v.height.h),
    )(p.dimension),
    length: fold<Dimension, number | undefined>(
      () => undefined,
      (v) => (p.type !== Type.Custom ? undefined : v.length.l),
    )(p.dimension),
    weight: fold<Dimension, number | undefined>(
      () => undefined,
      (v) => (p.type !== Type.Custom ? undefined : v.weight.wt),
    )(p.dimension),
  };
}
