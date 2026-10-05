import { initialPassengerPhotos, initialTrips } from "../data/site";
import type { PassengerPhoto, Trip } from "../types";

const tripsKey = "stg-trips";
const passengerPhotosKey = "stg-passenger-photos";

export function getStoredTrips(): Trip[] {
  const stored = localStorage.getItem(tripsKey);
  if (!stored) return initialTrips;

  try {
    return JSON.parse(stored) as Trip[];
  } catch {
    return initialTrips;
  }
}

export function saveStoredTrips(trips: Trip[]) {
  localStorage.setItem(tripsKey, JSON.stringify(trips));
}

export function getStoredPassengerPhotos(): PassengerPhoto[] {
  const stored = localStorage.getItem(passengerPhotosKey);
  if (!stored) return initialPassengerPhotos;

  try {
    return JSON.parse(stored) as PassengerPhoto[];
  } catch {
    return initialPassengerPhotos;
  }
}

export function saveStoredPassengerPhotos(photos: PassengerPhoto[]) {
  localStorage.setItem(passengerPhotosKey, JSON.stringify(photos));
}
