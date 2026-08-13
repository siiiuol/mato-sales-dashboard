import { maskSecret } from "@/lib/secrets";

/**
 * Een invoerveld voor een sleutel of geheim.
 *
 * Toont nooit de bewaarde waarde — die zou dan in de paginabron staan, waar een
 * schermdeling of een gecachte pagina hem meeneemt. In plaats daarvan een
 * gemaskeerde weergave ernaast, genoeg om te herkennen welke sleutel er staat.
 *
 * Leeg laten betekent laten staan; wissen gaat via het vakje. Zie
 * `settings-fields.ts` voor de kant die dat uitleest.
 */
export function SecretField({
  name,
  label,
  stored,
  hint,
  masked,
  placeholder,
}: {
  name: string;
  label: string;
  /** De opgeslagen waarde, alleen om te bepalen óf er iets staat. */
  stored?: string | null;
  hint?: string;
  /** Al gemaskeerde weergave, voor waarden die versleuteld opgeslagen zijn. */
  masked?: string;
  placeholder?: string;
}) {
  const isSet = Boolean(stored) || Boolean(masked);
  const preview = masked ?? (stored ? maskSecret(stored) : "");

  return (
    <div>
      <label className="label block mb-1" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="input mono"
        type="password"
        autoComplete="off"
        placeholder={
          placeholder ?? (isSet ? "Ingevuld — leeg laten om te behouden" : "Nog niet ingevuld")
        }
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
        {isSet ? (
          <span className="text-xs mono text-[var(--text-dim)]">{preview}</span>
        ) : (
          <span className="text-xs text-[var(--text-dim)]">Nog niets bewaard</span>
        )}
        {isSet && (
          <label className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
            <input type="checkbox" name={`${name}_clear`} />
            Wissen
          </label>
        )}
      </div>
      {hint && <p className="text-xs text-[var(--text-dim)] mt-1">{hint}</p>}
    </div>
  );
}
