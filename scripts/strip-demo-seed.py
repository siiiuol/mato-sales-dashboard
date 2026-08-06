from pathlib import Path

p = Path(__file__).resolve().parents[1] / "prisma" / "seed.ts"
s = p.read_text(encoding="utf-8")
start = s.index("  const demoLeads = [")
end = s.index('  console.log("MATO seed complete.");')
replacement = (
    "  // No demo leads or demo deals.\n"
    "  // Real queue data: KBO Open Data import + OpenStreetMap enrich/scan.\n\n"
)
p.write_text(s[:start] + replacement + s[end:], encoding="utf-8")
print("stripped demo seed from", p)
