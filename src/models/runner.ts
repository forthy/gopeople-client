import { Option, fold } from 'fp-ts/lib/Option';

export {
  Name,
  nameOf,
  Phone,
  phoneOf,
  Thumbnail,
  thumbnailOf,
  Image,
  imageOf,
  Location,
  Latitude,
  latitudeOf,
  Longitude,
  longitudeOf,
  Runner,
  IRunner,
  toJson,
};

class Name {
  constructor(readonly n: string) {}
}

function nameOf(name: string) {
  return new Name(name);
}

class Phone {
  constructor(readonly phoneNum: string) {}
}

function phoneOf(phoneNum: string) {
  return new Phone(phoneNum);
}

class Thumbnail {
  constructor(readonly t: string) {}
}

function thumbnailOf(thumbnail: string) {
  return new Thumbnail(thumbnail);
}

class Image {
  constructor(readonly i: string) {}
}

function imageOf(image: string) {
  return new Image(image);
}

class Latitude {
  constructor(readonly l: number) {}
}

function latitudeOf(lat: number) {
  return new Latitude(lat);
}

class Longitude {
  constructor(readonly lg: number) {}
}

function longitudeOf(lng: number) {
  return new Longitude(lng);
}

class Location {
  constructor(readonly lat: Latitude, readonly lng: Longitude) {}
}

class Runner {
  /**
   * Constructor of a `Runner`
   *
   * @param name - Runner’s name
   * @param phone - Runner’s mobile number (__only available before the job is closed__)
   * @param thumbnail - Runner’s photo
   * @param image - Runner’s photo
   * @param location - Runner’s geo location, update every 5 minutes. (__only available before the job is complete__)
   */
  constructor(
    readonly name: Name,
    readonly phone: Option<Phone>,
    readonly thumbnail: Thumbnail,
    readonly image: Image,
    readonly location: Option<Location>,
  ) {}
}

interface IRunner {
  /**
   * Runner’s name
   */
  name: string;
  /**
   * Runner’s mobile number (__only available before the job is closed__)
   */
  phone?: string;
  avatar: {
    thumbnail: string;
    image: string;
  };
  location?: {
    lat: number;
    lng: number;
  };
}

function toJson(runner: Runner): IRunner {
  return {
    name: runner.name.n,
    phone: fold<Phone, string | undefined>(
      () => undefined,
      (p) => p.phoneNum,
    )(runner.phone),
    avatar: {
      thumbnail: runner.thumbnail.t,
      image: runner.image.i,
    },
    location: fold<Location, { lat: number; lng: number } | undefined>(
      () => undefined,
      (l) => {
        return { lat: l.lat.l, lng: l.lng.lg };
      },
    )(runner.location),
  };
}
