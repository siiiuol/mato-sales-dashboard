import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { put } from "@vercel/blob";

/**
 * Opslag van geüploade bestanden — nu alleen medewerkersfoto's, straks ook
 * ondertekende documenten.
 *
 * Achter één functie gezet omdat de bestemming verandert bij het live zetten:
 * lokaal is de schijf prima, op Vercel is het bestandssysteem alleen-lezen en
 * wordt alles bij elke deploy weggegooid. Productie schrijft naar Vercel Blob.
 */

const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export class UploadError extends Error {}

/**
 * Bewaart een afbeelding en geeft het pad terug waarop ze te tonen is.
 *
 * Het bestandstype wordt aan de inhoud getoetst en niet aan de bestandsnaam:
 * een `.png` in de naam zegt niets over wat er werkelijk in zit.
 */
export async function storeImage(file: File, prefix: string): Promise<string> {
  if (!file.size) throw new UploadError("Leeg bestand");
  if (file.size > MAX_BYTES) {
    throw new UploadError("De afbeelding mag hoogstens 2 MB zijn");
  }

  const extension = ALLOWED.get(file.type);
  if (!extension) {
    throw new UploadError("Alleen JPG, PNG of WebP");
  }

  const name = `${prefix}-${randomUUID()}.${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  if (process.env.NODE_ENV === "production" && !process.env.MATO_ALLOW_LOCAL_UPLOADS) {
    // Liever hier stoppen dan een pad teruggeven naar een bestand dat na de
    // volgende deploy verdwenen is en een gebroken afbeelding achterlaat.
    throw new UploadError(
      "Uploads naar de lokale schijf werken niet in productie. Stel objectopslag in."
    );
  }

  const directory = join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name), Buffer.from(await file.arrayBuffer()));

  return `/uploads/${name}`;
}
