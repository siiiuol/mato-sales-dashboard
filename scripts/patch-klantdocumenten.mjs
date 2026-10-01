/**
 * Patcht het gegenereerde werkblad uit matodocumentensite.zip.
 *
 * Twee dingen die de bron niet doet:
 *  1. Documenten dragen geen verhuur/verkoop-onderscheid, terwijl dat bij MATO
 *     twee aparte trajecten zijn (Base Partner in onze shop versus een eigen
 *     automaat kopen).
 *  2. Alleen de productfiche volgde de modelkeuze. In de andere documenten zat
 *     "MATO M1" en de M1-prijs als platte tekst, dus S1 kiezen veranderde niets.
 *
 * Het script is idempotent: het stopt als de markering er al in staat.
 */
import { readFileSync, writeFileSync } from "fs";

const FILE = process.argv[2];
if (!FILE) {
  console.error("gebruik: node scripts/patch-klantdocumenten.mjs <werkblad.html>");
  process.exit(1);
}

let src = readFileSync(FILE, "utf8");
const MARK = "MATO_WERKBLAD_PATCH_V2";
if (src.includes(MARK)) {
  console.log("werkblad is al gepatcht, niets te doen");
  process.exit(0);
}

/** Grenzen van een `var NAAM=[...]` array-literal in de inline bundle. */
function span(name) {
  const decl = src.indexOf(`var ${name}=`);
  if (decl < 0) throw new Error(`${name} niet gevonden`);
  const from = src.indexOf("[", decl);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return { from, to: i + 1 };
    }
  }
  throw new Error(`${name} niet afgesloten`);
}

const docSpan = span("DOCS");
const DOCS = JSON.parse(src.slice(docSpan.from, docSpan.to));

/* ---------- 1. verhuur / verkoop ---------- */

/**
 * `huur`  = Base Partner: de partner zet zijn product in onze automaat in de shop.
 * `koop`  = de klant koopt een eigen automaat en plaatst die zelf.
 * `beide` = geldt in de twee trajecten.
 */
const USE = {
  partnerschapsvoorstel: "huur",
  projectvoorstel: "koop",
  tarievenblad: "beide",
  productfiche: "beide",
  samenwerkingsovereenkomst: "huur",
  "algemene-voorwaarden": "beide",
  factuur: "beide",
  intakeformulier: "koop",
  welkomstdocument: "huur",
  bedankdocument: "huur",
  leveringsgids: "huur",
  bedieningsgids: "koop",
  maandrapport: "huur",
  feedbackformulier: "huur",
};

/** "Verkoop" als fase botste met "verkoop" als traject. */
const GROUP = { Verkoop: "Voorstel" };

/* ---------- 2. modelafhankelijke tekst ---------- */

const S = (field, fallback) => `<span data-model="${field}">${fallback}</span>`;

/** Per document: [zoek, vervang, verwacht aantal]. */
const EDITS = {
  partnerschapsvoorstel: [
    [
      "één volledige MATO M1-verkoopautomaat",
      `één volledige ${S("label", "MATO M1")}-verkoopautomaat`,
      1,
    ],
  ],

  projectvoorstel: [
    [
      "<h2>MATO M1 voedingsautomaat</h2>",
      `<h2>${S("name", "MATO M1 · Maaltijdautomaat")}</h2>`,
      1,
    ],
    [
      "<li>Gekoelde M1-automaat, geschikt voor",
      `<li>Gekoelde ${S("code", "M1")}-automaat, geschikt voor`,
      1,
    ],
    [
      "<li>Zachte liftuitgifte, producten worden gecontroleerd naar het uitgiftevak gebracht</li>",
      `<li>Uitgifte via ${S(
        "system",
        "liftsysteem"
      )}, producten worden gecontroleerd naar het uitgiftevak gebracht</li>`,
      1,
    ],
    [
      "<li>Koeling van +2&deg;C tot +20&deg;C, instelbaar per producttype</li>",
      `<li>Koeling ${S("temp", "+2° tot 20°")}, instelbaar per producttype</li>`,
      1,
    ],
    [
      "<li>Tot 42 maaltijdboxen, of 24 grote en 12 kleine broden</li>",
      `<li>Capaciteit: ${S(
        "capacity",
        "42 maaltijdboxen of brood 24 groot / 12 klein"
      )}</li>`,
      1,
    ],
    [
      '<p class="fineprint">197 &times; 104 &times; 79 cm, circa 300 kg. Optioneel:',
      `<p class="fineprint">${S("dims", "197 × 104 × 79 cm")}, circa ${S(
        "weight",
        "300 kg"
      )}. Optioneel:`,
      1,
    ],
    [
      "<tr><td><strong>MATO M1 voedingsautomaat</strong></td><td>1</td><td>10.500,00</td><td>21 %</td><td>10.500,00</td></tr>",
      `<tr><td><strong>${S(
        "name",
        "MATO M1 · Maaltijdautomaat"
      )}</strong></td><td>1</td><td>${S(
        "price-decimal",
        "10.500,00"
      )}</td><td>21 %</td><td>${S("price-decimal", "10.500,00")}</td></tr>`,
      1,
    ],
    [
      '<tr><td colspan="4">Totaal excl. btw</td><td>11.900,00</td></tr>',
      `<tr><td colspan="4">Totaal excl. btw</td><td>${S(
        "basis-decimal",
        "11.900,00"
      )}</td></tr>`,
      1,
    ],
    [
      '<tr><td colspan="4">Btw 21 %</td><td>2.499,00</td></tr>',
      `<tr><td colspan="4">Btw 21 %</td><td>${S(
        "basis-btw-decimal",
        "2.499,00"
      )}</td></tr>`,
      1,
    ],
    [
      '<tr class="grand"><td colspan="4">Totale investering incl. btw</td><td>14.399,00</td></tr>',
      `<tr class="grand"><td colspan="4">Totale investering incl. btw</td><td>${S(
        "basis-total-decimal",
        "14.399,00"
      )}</td></tr>`,
      1,
    ],
  ],

  tarievenblad: [
    [
      '<tr><td><strong>MATO M1</strong></td><td class="desc">Compacte gekoelde voedingsautomaat, liftuitgifte, tot 42 boxen</td><td>&euro; 10.500</td></tr>',
      `<tr><td><strong>${S(
        "label",
        "MATO M1"
      )}</strong></td><td class="desc">${S(
        "short",
        "Compacte maaltijdautomaat voor maaltijden, dessert en brood."
      )}</td><td>${S("price-euro", "&euro; 10.500")}</td></tr>`,
      1,
    ],
    [
      '<tr class="grand"><td colspan="2">Basisconfiguratie M1 met terminal en telemetrie</td><td>&euro; 11.900</td></tr>',
      `<tr class="grand"><td colspan="2">Basisconfiguratie ${S(
        "code",
        "M1"
      )} met terminal en telemetrie</td><td>${S(
        "basis-euro",
        "&euro; 11.900"
      )}</td></tr>`,
      1,
    ],
    [
      "Vaste vergoeding voor het exclusieve gebruik van één volledige MATO M1.",
      `Vaste vergoeding voor het exclusieve gebruik van één volledige ${S(
        "label",
        "MATO M1"
      )}.`,
      1,
    ],
  ],

  samenwerkingsovereenkomst: [
    [
      "MATO M1-verkoopautomaat",
      `${S("label", "MATO M1")}-verkoopautomaat`,
      2,
    ],
  ],

  intakeformulier: [
    [
      "De MATO M1 meet 197 &times; 104 &times; 79 cm en weegt circa 300 kg.",
      `De ${S("label", "MATO M1")} meet ${S(
        "dims",
        "197 × 104 × 79 cm"
      )} en weegt circa ${S("weight", "300 kg")}.`,
      1,
    ],
  ],

  welkomstdocument: [
    ["<dd>MATO M1</dd>", `<dd>${S("label", "MATO M1")}</dd>`, 1],
  ],

  bedieningsgids: [
    [
      "<h1>Bedieningsgids MATO M1</h1>",
      `<h1>Bedieningsgids ${S("label", "MATO M1")}</h1>`,
      1,
    ],
    ["<dd>MATO M1</dd>", `<dd>${S("label", "MATO M1")}</dd>`, 1],
  ],
};

let problems = 0;
for (const doc of DOCS) {
  if (!USE[doc.slug]) {
    console.error(`! geen verhuur/verkoop bekend voor ${doc.slug}`);
    problems++;
  }
  doc.use = USE[doc.slug] || "beide";
  doc.group = GROUP[doc.group] || doc.group;

  for (const [find, replace, expected] of EDITS[doc.slug] || []) {
    const count = doc.html.split(find).length - 1;
    if (count !== expected) {
      console.error(
        `! ${doc.slug}: ${count}x gevonden, ${expected}x verwacht -> ${find.slice(0, 70)}`
      );
      problems++;
      continue;
    }
    doc.html = doc.html.split(find).join(replace);
  }
}
if (problems) {
  console.error(`\n${problems} probleem(en), niets weggeschreven`);
  process.exit(1);
}

/* ---------- DOCS terugschrijven ---------- */

// `</script>` in de data zou de inline bundle afbreken; `<\/` is in een JS-string
// hetzelfde teken, dus dit verandert de inhoud niet.
const encoded = JSON.stringify(DOCS).replace(/<\//g, "<\\/");
src = src.slice(0, docSpan.from) + encoded + src.slice(docSpan.to);

/* ---------- zijpaneel: filter ---------- */

const listHtml = '      <ul class="doclist" id="doclist"></ul>';
if (!src.includes(listHtml)) throw new Error("doclist niet gevonden");
src = src.replace(
  listHtml,
  `      <div class="usefilter" id="usefilter" role="group" aria-label="Soort traject">
        <button type="button" data-use="alles">Alles</button>
        <button type="button" data-use="huur">Verhuur</button>
        <button type="button" data-use="koop">Verkoop</button>
      </div>
${listHtml}`
);

const modelHint =
  '<span class="hint">Kies een model. De productfiche en de foto volgen mee.</span>';
if (!src.includes(modelHint)) throw new Error("modelhint niet gevonden");
src = src.replace(
  modelHint,
  '<span class="hint">Kies een model. Naam, specificaties, prijzen en foto volgen in elk document mee.</span>'
);

/* ---------- stijl ---------- */

const styleAnchor = ".side-foot{";
if (!src.includes(styleAnchor)) throw new Error("style-anker niet gevonden");
src = src.replace(
  styleAnchor,
  `/* ${MARK} */
.usefilter{ display:grid; grid-template-columns:repeat(3,1fr); gap:.25rem; margin:0 0 .8rem; }
.usefilter button{
  cursor:pointer; font-family:var(--font-mono); font-size:.63rem;
  letter-spacing:.06em; text-transform:uppercase; padding:.4rem .2rem;
  color:var(--app-dim); background:var(--app-bg);
  border:1px solid var(--app-line); border-radius:2px;
}
.usefilter button:hover{ color:var(--app-text); }
.usefilter button[aria-pressed="true"]{
  color:#1c1812; background:var(--app-gold); border-color:var(--app-gold);
}
.usefilter button:focus-visible{ outline:2px solid var(--app-gold); outline-offset:2px; }
.doclist .u{
  margin-left:auto; font-family:var(--font-mono); font-size:.56rem;
  letter-spacing:.08em; text-transform:uppercase; color:var(--app-gold);
  opacity:.85; flex:none;
}
/* laat zien welke tekst de modelkeuze volgt; niet mee afdrukken */
#sheet [data-model]{ box-shadow:inset 0 -1px 0 rgba(169,122,31,.45); }
@media print{ #sheet [data-model]{ box-shadow:none; } }

${styleAnchor}`
);

/* ---------- gedrag ---------- */

function patch(find, replace) {
  if (!src.includes(find)) throw new Error(`niet gevonden: ${find.slice(0, 80)}`);
  src = src.replace(find, replace);
}

// Oude opslag bevat documenten zonder de data-model-spans; die zouden voor
// altijd "MATO M1" blijven tonen. Nieuwe sleutel dus.
patch(
  "var LS = 'mato-studio-v1';",
  `var LS = 'mato-studio-v2'; /* ${MARK} */`
);

patch(
  "var store = { docs: {}, global: {}, model: 'automaat-beta', photo: null, photoMode: 'model', caption: '' };",
  "var store = { docs: {}, global: {}, model: 'automaat-beta', photo: null, photoMode: 'model', caption: '', use: 'alles' };"
);

patch(
  "          store.caption = typeof p.caption === 'string' ? p.caption : '';",
  `          store.caption = typeof p.caption === 'string' ? p.caption : '';
          store.use = p.use === 'huur' || p.use === 'koop' ? p.use : 'alles';`
);

// modelwaarden
patch(
  "  function esc(s) {",
  `  /* ---------- modelwaarden ---------- */
  var USE_LABEL = { huur: 'verhuur', koop: 'verkoop', beide: '' };
  var BASIS_EXTRA = 950 + 450; /* terminal + telemetrie */

  function priceOf(m) {
    var hit = String(m.price || '').match(/([\\d.]+)/);
    if (!hit) return null;
    var n = parseInt(hit[1].replace(/\\./g, ''), 10);
    return isNaN(n) ? null : n;
  }

  function num(n, decimals) {
    return n.toLocaleString('nl-BE', {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals
    });
  }

  function modelValue(m, field) {
    var p = priceOf(m);
    var basis = p == null ? null : p + BASIS_EXTRA;
    switch (field) {
      case 'label': return 'MATO ' + m.code;
      case 'code': return m.code;
      case 'name': return m.name;
      case 'subtitle': return m.subtitle;
      case 'kind': return m.kind;
      case 'short': return m.short;
      case 'dims': return m.dims;
      case 'weight': return m.weight;
      case 'temp': return m.temp;
      case 'system': return m.system;
      case 'capacity': return m.capacity;
      case 'price': return m.price;
      case 'price-euro': return p == null ? 'Op aanvraag' : '\\u20AC ' + num(p, 0);
      case 'price-decimal': return p == null ? '' : num(p, 2);
      case 'basis-euro': return basis == null ? 'Op aanvraag' : '\\u20AC ' + num(basis, 0);
      case 'basis-decimal': return basis == null ? '' : num(basis, 2);
      case 'basis-btw-decimal': return basis == null ? '' : num(basis * 0.21, 2);
      case 'basis-total-decimal': return basis == null ? '' : num(basis * 1.21, 2);
      default: return '';
    }
  }

  function esc(s) {`
);

patch(
  `    $$('[data-model-name]', sheet).forEach(function (el) {
      el.textContent = modelById(store.model).name;
    });
    $$('[data-model-price]', sheet).forEach(function (el) {
      el.textContent = modelById(store.model).price;
    });`,
  `    var m = modelById(store.model);
    $$('[data-model-name]', sheet).forEach(function (el) {
      el.textContent = m.name;
    });
    $$('[data-model-price]', sheet).forEach(function (el) {
      el.textContent = m.price;
    });
    // tekst die de modelkeuze volgt, ook in documenten die uit de opslag komen
    $$('[data-model]', sheet).forEach(function (el) {
      el.textContent = modelValue(m, el.dataset.model) || 'op aanvraag';
    });`
);

// documentenlijst met filter
patch(
  `  function buildSide() {
    var list = $('#doclist'), lastGroup = null;
    DOCS.forEach(function (d, i) {
      if (d.group !== lastGroup) {
        var g = document.createElement('li');
        g.className = 'grp';
        g.textContent = d.group;
        list.appendChild(g);
        lastGroup = d.group;
      }
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.slug = d.slug;
      b.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span>' +
        esc(d.title.replace(/^MATO /, '')) + '</span>';
      b.addEventListener('click', function () {
        current = d.slug;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      li.appendChild(b);
      list.appendChild(li);
    });
`,
  `  function inUse(d) {
    return store.use === 'alles' || d.use === 'beide' || d.use === store.use;
  }

  /* De nummers blijven die van de volledige reeks, ook als er gefilterd is:
     document 07 heet bij de klant altijd 07. */
  function buildDocList() {
    var list = $('#doclist'), lastGroup = null;
    list.innerHTML = '';
    DOCS.forEach(function (d, i) {
      if (!inUse(d)) return;
      if (d.group !== lastGroup) {
        var g = document.createElement('li');
        g.className = 'grp';
        g.textContent = d.group;
        list.appendChild(g);
        lastGroup = d.group;
      }
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.slug = d.slug;
      b.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span>' +
        esc(d.title.replace(/^MATO /, '')) + '</span>' +
        (USE_LABEL[d.use] ? '<span class="u">' + USE_LABEL[d.use] + '</span>' : '');
      b.addEventListener('click', function () {
        current = d.slug;
        render();
        syncPhotoToggle();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  function applyUse() {
    $$('#usefilter button').forEach(function (x) {
      x.setAttribute('aria-pressed', x.dataset.use === store.use ? 'true' : 'false');
    });
    buildDocList();
    // het open document kan buiten het filter vallen
    if (!inUse(docBySlug(current))) {
      for (var i = 0; i < DOCS.length; i++) {
        if (inUse(DOCS[i])) { current = DOCS[i].slug; break; }
      }
      render();
      syncPhotoToggle();
    }
    $$('#doclist button').forEach(function (b) {
      b.setAttribute('aria-current', b.dataset.slug === current ? 'true' : 'false');
    });
  }

  function buildSide() {
    $$('#usefilter button').forEach(function (x) {
      x.addEventListener('click', function () {
        store.use = x.dataset.use;
        save();
        applyUse();
      });
    });
    buildDocList();
`
);

patch(
  `    render();
    syncPhotoToggle();
    $('#doclist').addEventListener('click', syncPhotoToggle);`,
  `    render();
    applyUse();
    syncPhotoToggle();`
);

writeFileSync(FILE, src, "utf8");
console.log(`werkblad gepatcht: ${DOCS.length} documenten`);
for (const use of ["huur", "koop", "beide"]) {
  const names = DOCS.filter((d) => d.use === use).map((d) =>
    d.title.replace(/^MATO /, "")
  );
  console.log(`  ${use.padEnd(6)} (${names.length}) ${names.join(", ")}`);
}
