/**
 * Medewerkersfoto met initialen als terugval.
 *
 * Zonder terugval krijg je een gebroken-afbeeldingicoon zodra iemand nog geen
 * foto heeft — en dat is de normale toestand meteen na het aanmaken.
 */
export function Avatar({
  name,
  photoUrl,
  size = 48,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (photoUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element --
         Zelf geüploade bestanden van onbekende afmeting; next/image zou hier
         alleen een optimalisatiestap toevoegen zonder iets op te leveren. */
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-[var(--border)] shrink-0"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="rounded-full shrink-0 grid place-items-center border border-[var(--border)] bg-[var(--gold-wash)] text-[var(--accent)] font-semibold"
    >
      {initials || "?"}
    </span>
  );
}
