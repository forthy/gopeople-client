import { Option, none, fold } from 'fp-ts/lib/Option';
import * as _ from 'lodash';

export { Type, ProductId, Sku, Name, ParcelNumber, Width, Height, Length, Weight, Dimension, Parcel, IParcel, toJson };

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
  constructor(readonly id: string) {}
}

// required for Shopping Cart endpoint
class Sku {
  constructor(readonly s: string) {}
}

class Name {
  constructor(readonly n: string) {}
}

// number of parcels
class ParcelNumber {
  constructor(readonly num: number) {}
}

// required when type is custom (cm)
class Width {
  constructor(readonly w: number) {}
}

// required when type is custom (cm)
class Height {
  constructor(readonly h: number) {}
}

// required when type is custom (cm)
class Length {
  constructor(readonly l: number) {}
}

// required when type is custom (kg)
class Weight {
  constructor(readonly wt: number) {}
}

class Dimension {
  constructor(readonly width: Width, readonly height: Height, readonly length: Length, readonly weight: Weight) {}
}

class Parcel {
  constructor(
    readonly type: Type,
    readonly parcelNumber: ParcelNumber,
    readonly productId: Option<ProductId> = none,
    readonly sku: Option<Sku> = none,
    readonly name: Option<Name> = none,
    readonly dimension: Option<Dimension> = none,
  ) {}
}

interface IParcel {
  readonly type: string;
  readonly number: number;
  readonly productId?: string | null;
  readonly sku?: string | null;
  readonly name?: string | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly length?: number | null;
  readonly weight?: number | null;
}

function toJson(p: Parcel): IParcel {
  return {
    type: p.type,
    number: p.parcelNumber.num,
    productId: fold<ProductId, string | null>(
      () => null,
      (v) => v.id,
    )(p.productId),
    sku: fold<Sku, string | null>(
      () => null,
      (v) => v.s,
    )(p.sku),
    name: fold<Name, string | null>(
      () => null,
      (v) => v.n,
    )(p.name),
    width: fold<Dimension, number | null>(
      () => null,
      (v) => (p.type !== Type.Custom ? null : v.width.w),
    )(p.dimension),
    height: fold<Dimension, number | null>(
      () => null,
      (v) => (p.type !== Type.Custom ? null : v.height.h),
    )(p.dimension),
    length: fold<Dimension, number | null>(
      () => null,
      (v) => (p.type !== Type.Custom ? null : v.length.l),
    )(p.dimension),
    weight: fold<Dimension, number | null>(
      () => null,
      (v) => (p.type !== Type.Custom ? null : v.weight.wt),
    )(p.dimension),
  };
}