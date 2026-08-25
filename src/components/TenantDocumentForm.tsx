import { generateTenantDocument } from "@/lib/tenant-document-actions";

export function TenantDocumentForm({
  customerId,
  placements,
  templates,
}: {
  customerId: string;
  placements: Array<{ id: string; label: string }>;
  templates: Array<{ code: string; name: string }>;
}) {
  if (!placements.length || !templates.length) return null;
  return (
    <form action={generateTenantDocument} className="panel p-4 space-y-3">
      <h3 className="label text-[var(--accent)]">
        Partnerdocument vooraf invullen
      </h3>
      <input type="hidden" name="customerId" value={customerId} />
      <select name="placementId" className="select" required>
        {placements.map((placement) => (
          <option key={placement.id} value={placement.id}>
            {placement.label}
          </option>
        ))}
      </select>
      <select name="templateCode" className="select" required>
        {templates.map((template) => (
          <option key={template.code} value={template.code}>
            {template.name}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-primary">
        Document maken
      </button>
    </form>
  );
}
