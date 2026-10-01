/** Wegwerpserver om het werkblad los van de app te testen. */
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";

const ROOT = path.resolve("content/klantdocumenten");
const PORT = Number(process.argv[2] || 4321);

createServer(async (req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  const file = path.resolve(ROOT, "." + rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("nope");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(body);
  } catch {
    res.writeHead(404).end("niet gevonden");
  }
}).listen(PORT, () => console.log(`klantdocumenten op http://localhost:${PORT}`));
