export type BusinessIdentity = {
  id?: string;
  name: string;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export function normalizeBusinessName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(?:bv|bvba|nv|vof|zaakvoerder)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizePhone(value: string | null | undefined) {
  if (!value) return "";
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0032")) {
    const local = digits.slice(4);
    digits = local.startsWith("0") ? local : `0${local}`;
  } else if (digits.startsWith("32")) {
    const local = digits.slice(2);
    digits = local.startsWith("0") ? local : `0${local}`;
  }
  return digits;
}

export function normalizeWebsite(value: string | null | undefined) {
  if (!value) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
}

function distanceMetres(a: BusinessIdentity, b: BusinessIdentity) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    return Number.POSITIVE_INFINITY;
  }
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function tokenSimilarity(a: string, b: string) {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const common = [...left].filter((token) => right.has(token)).length;
  return common / new Set([...left, ...right]).size;
}

export function duplicateScore(a: BusinessIdentity, b: BusinessIdentity) {
  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);
  if (phoneA && phoneA === phoneB) return 100;

  const websiteA = normalizeWebsite(a.website);
  const websiteB = normalizeWebsite(b.website);
  if (websiteA && websiteA === websiteB) return 95;

  const nameA = normalizeBusinessName(a.name);
  const nameB = normalizeBusinessName(b.name);
  const cityA = normalizeBusinessName(a.city ?? "");
  const cityB = normalizeBusinessName(b.city ?? "");
  const nearby = distanceMetres(a, b) <= 100;

  if (nameA && nameA === nameB && cityA && cityA === cityB) return 90;
  if (nameA && nameA === nameB && nearby) return 85;
  if (nearby && tokenSimilarity(nameA, nameB) >= 0.75) return 80;
  return 0;
}

export function isLikelyDuplicate(a: BusinessIdentity, b: BusinessIdentity) {
  return duplicateScore(a, b) >= 80;
}

export function potentialDuplicatePairs<T extends BusinessIdentity>(items: T[]) {
  const pairs: Array<{ first: T; second: T; score: number }> = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const score = duplicateScore(items[i], items[j]);
      if (score >= 80) pairs.push({ first: items[i], second: items[j], score });
    }
  }
  return pairs.sort((a, b) => b.score - a.score);
}
