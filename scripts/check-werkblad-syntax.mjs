/** Syntaxcontrole op de inline scriptblokken van het werkblad. */
import { readFileSync, writeFileSync, rmSync } from "fs";
import { execFileSync } from "child_process";

const src = readFileSync(process.argv[2], "utf8");
const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)];
console.log(`scriptblokken: ${blocks.length}`);

let bad = 0;
blocks.forEach((b, i) => {
  const tmp = `scripts/.werkblad-block-${i}.js`;
  writeFileSync(tmp, b[1], "utf8");
  try {
    execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
    console.log(`  blok ${i}: ok (${b[1].length} tekens)`);
  } catch (err) {
    bad++;
    console.error(`  blok ${i}: FOUT\n${err.stderr?.toString() ?? err.message}`);
  }
  rmSync(tmp);
});
process.exit(bad ? 1 : 0);
