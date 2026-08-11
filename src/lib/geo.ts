/**
 * Afstand en omhullende rechthoeken.
 *
 * Stond in tweevoud in `osm.ts` en `detection.ts`, en de straalfilter op de
 * leadlijst had er een derde kopie bij gekregen. Eén plek, met tests, want een
 * fout in deze formule is niet zichtbaar aan het resultaat — je krijgt gewoon
 * de verkeerde zaken te bellen.
 */

const EARTH_RADIUS_KM = 6371;

export type Point = { lat: number; lng: number };

/** Hemelsbrede afstand tussen twee punten, in kilometer. */
export function haversineKm(a: Point, b: Point): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(x));
}

/**
 * Rechthoek van `radiusKm` rond een punt, als [zuid, west, noord, oost].
 *
 * De lengtegraden worden gecorrigeerd voor de breedtegraad: op 51° noord is een
 * graad lengte nog maar zo'n 70 km in plaats van 111. Zonder die correctie is
 * de rechthoek in België ruim anderhalf keer te breed.
 */
export function boxAround(
  lat: number,
  lng: number,
  radiusKm: number
): [number, number, number, number] {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
}

/**
 * Prisma-filter op de omhullende rechthoek.
 *
 * Bedoeld als grove voorselectie in de database, waarna `haversineKm` de hoeken
 * eraf haalt. De rechthoek is altijd ruimer dan de cirkel, dus dit laat nooit
 * iets weg dat binnen de straal ligt — het verfijnen erna kan alleen maar
 * afvallen.
 */
export function boundingBoxFilter(centre: Point, radiusKm: number) {
  const [south, west, north, east] = boxAround(centre.lat, centre.lng, radiusKm);
  return {
    lat: { gte: south, lte: north },
    lng: { gte: west, lte: east },
  };
}

/** Ligt dit punt echt binnen de straal? */
export function withinRadius(
  centre: Point,
  at: { lat: number | null; lng: number | null },
  radiusKm: number
): boolean {
  if (at.lat == null || at.lng == null) return false;
  return haversineKm(centre, { lat: at.lat, lng: at.lng }) <= radiusKm;
}
