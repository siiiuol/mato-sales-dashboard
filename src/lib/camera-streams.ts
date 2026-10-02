/**
 * De deelbare livestreams, zoals ze bij Instellingen staan.
 *
 * Eén regel per camera, in de vorm `naam = url`. Een regel zonder `=` wordt
 * gelezen als enkel een url en krijgt de camera-uuid als naam — dan staat er
 * tenminste iets, in plaats van dat de regel stil verdwijnt.
 */
export type CameraStream = { name: string; url: string };

/** Alleen de deelpagina van UniFi; al de rest wordt geweigerd. */
const ALLOWED = /^https:\/\/monitor\.ui\.com\/[A-Za-z0-9-]+$/;

export function parseCameraStreams(raw: string | null | undefined): CameraStream[] {
  if (!raw) return [];
  const streams: CameraStream[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const split = trimmed.indexOf("=");
    const name = split === -1 ? "" : trimmed.slice(0, split).trim();
    const url = (split === -1 ? trimmed : trimmed.slice(split + 1)).trim();

    // Alleen monitor.ui.com inbedden. Een vrij invulbaar iframe-adres in een
    // instelling is een open deur: wie bij Instellingen kan, zou er anders een
    // willekeurige pagina in kunnen hangen die meekijkt met de sessie.
    if (!ALLOWED.test(url)) continue;

    streams.push({ name: name || url.split("/").pop() || "Camera", url });
  }
  return streams;
}
