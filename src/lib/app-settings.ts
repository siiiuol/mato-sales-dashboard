import { cache } from "react";
import { prisma } from "./db";

const SETTINGS_ID = "default";

export const DEFAULT_SHOP_CAPACITY = 8;

/** Read-only settings lookup — no write on every page view. */
export const readAppSettings = cache(
  async <T extends Record<string, boolean>>(select: T) => {
    return prisma.appSettings.findUnique({
      where: { id: SETTINGS_ID },
      select,
    });
  }
);

export async function readShopCapacity() {
  const settings = await readAppSettings({ shopCapacity: true });
  return settings?.shopCapacity ?? DEFAULT_SHOP_CAPACITY;
}

export async function readEnabledZonesJson() {
  const settings = await readAppSettings({ enabledZones: true });
  return settings?.enabledZones ?? null;
}
