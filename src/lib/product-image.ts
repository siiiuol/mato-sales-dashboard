/**
 * Markdown-afbeelding voor factuur/koopdocument, of een spatie zonder foto
 * (zodat {{product_afbeelding}} niet zichtbaar blijft).
 */
export function productImageMarkdown(
  name: string,
  imageUrl: string | null | undefined
): string {
  if (!imageUrl?.trim()) return " ";
  const safeAlt = name.replace(/[\[\]]/g, "").trim() || "Product";
  return `![${safeAlt}](${imageUrl.trim()})`;
}
