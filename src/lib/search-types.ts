export type SearchHit = {
  type: "lead" | "buyer" | "tenant" | "document" | "machine" | "task" | "deal";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export function searchTypeLabel(type: SearchHit["type"]) {
  switch (type) {
    case "lead":
      return "Lead";
    case "buyer":
      return "Klant";
    case "tenant":
      return "Huurder";
    case "document":
      return "Document";
    case "machine":
      return "Automaat";
    case "task":
      return "Taak";
    case "deal":
      return "Deal";
  }
}
