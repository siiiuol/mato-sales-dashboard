"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, requireUser } from "./dal";
import { parseCsv } from "./csv";
import { prisma } from "./db";
import {
  normalizeBusinessName,
  normalizePhone,
  normalizeWebsite,
} from "./dedupe";

export async function importLeadsCsv(formData: FormData) {
  const user = await requireUser(["admin"]);
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) {
    throw new Error("Kies een CSV-bestand");
  }
  if (file.size > 750_000) {
    throw new Error("CSV is groter dan 750 KB");
  }
  const rows = parseCsv(await file.text());
  if (rows.length < 2) throw new Error("CSV bevat geen gegevensrijen");
  if (rows.length > 2001) throw new Error("Importeer maximaal 2.000 leads per keer");

  const headers = rows[0].map((header) =>
    header.replace(/^\uFEFF/, "").trim().toLowerCase()
  );
  const index = (aliases: string[]) =>
    aliases.map((alias) => headers.indexOf(alias)).find((value) => value >= 0) ??
    -1;
  const columns = {
    name: index(["name", "naam", "zaak"]),
    address: index(["address", "adres"]),
    city: index(["city", "gemeente", "stad"]),
    province: index(["province", "provincie"]),
    category: index(["category", "categorie"]),
    phone: index(["phone", "telefoon", "tel"]),
    email: index(["email", "e-mail"]),
    website: index(["website", "url"]),
    source: index(["source", "bron"]),
    notes: index(["notes", "notities", "nota"]),
  };
  if (columns.name < 0) {
    throw new Error("De kolom name of naam ontbreekt");
  }

  const existing = await prisma.lead.findMany({
    select: { name: true, city: true, phone: true, website: true },
  });
  const phoneKeys = new Set(existing.map((lead) => normalizePhone(lead.phone)).filter(Boolean));
  const webKeys = new Set(existing.map((lead) => normalizeWebsite(lead.website)).filter(Boolean));
  const nameCityKeys = new Set(
    existing.map((lead) => businessKey(lead.name, lead.city))
  );
  const created: Array<{
    name: string;
    address: string | null;
    city: string | null;
    province: string | null;
    category: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    source: string;
    notes: string | null;
    complianceStatus: string;
    status: string;
  }> = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const read = (position: number) =>
      position < 0 ? "" : cleanImportedCell(row[position] ?? "").trim();
    const name = read(columns.name).slice(0, 200);
    if (!name) {
      skipped += 1;
      continue;
    }
    const city = read(columns.city).slice(0, 100) || null;
    const phone = read(columns.phone).slice(0, 100) || null;
    const website = read(columns.website).slice(0, 500) || null;
    const phoneKey = normalizePhone(phone);
    const webKey = normalizeWebsite(website);
    const nameCityKey = businessKey(name, city);
    if (
      (phoneKey && phoneKeys.has(phoneKey)) ||
      (webKey && webKeys.has(webKey)) ||
      nameCityKeys.has(nameCityKey)
    ) {
      skipped += 1;
      continue;
    }
    if (phoneKey) phoneKeys.add(phoneKey);
    if (webKey) webKeys.add(webKey);
    nameCityKeys.add(nameCityKey);
    created.push({
      name,
      address: read(columns.address).slice(0, 250) || null,
      city,
      province: read(columns.province).slice(0, 100) || null,
      category: read(columns.category).slice(0, 100) || null,
      phone,
      email: read(columns.email).slice(0, 320) || null,
      website,
      source: read(columns.source).slice(0, 100) || "csv_import",
      notes: read(columns.notes).slice(0, 5000) || null,
      complianceStatus: "PENDING",
      status: "NEW",
    });
  }

  if (created.length) await prisma.lead.createMany({ data: created });
  await audit(user.id, "leads.csv_imported", "lead", "batch", {
    created: created.length,
    skipped,
    filename: file.name.slice(0, 200),
  });
  revalidatePath("/leads");
  redirect(
    `/settings/operations?imported=${created.length}&skipped=${skipped}`
  );
}

function businessKey(name: string, city: string | null) {
  return `${normalizeBusinessName(name)}|${normalizeBusinessName(city ?? "")}`;
}

function cleanImportedCell(value: string) {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}
