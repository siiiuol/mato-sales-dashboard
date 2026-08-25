export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | Date | null | undefined>>
) {
  return [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\r\n");
}

export function parseCsv(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    countOutsideQuotes(firstLine, ";") > countOutsideQuotes(firstLine, ",")
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("Ongeldige CSV: een aanhalingsteken is niet gesloten");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim()));
}

function countOutsideQuotes(value: string, needle: string) {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') {
      if (quoted && value[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && value[index] === needle) {
      count += 1;
    }
  }
  return count;
}

function escapeCell(value: string | number | boolean | Date | null | undefined) {
  let text =
    value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
