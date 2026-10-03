/**
 * Wraps a hand-written plain-text mail in MATO's house style.
 *
 * Mail from MATO OS used to leave as `contentType: "Text"`, so a carefully
 * written message arrived as naked plain text. This renders the same words in
 * the matoautomaat.be look without changing them: paragraphs stay paragraphs,
 * line breaks stay line breaks, and nothing is reworded or added.
 *
 * Mail clients are hostile to ordinary CSS, so the rules here are deliberate:
 *
 * - Table-based layout. Outlook on Windows uses Word to render, which ignores
 *   float, flex and grid.
 * - Styles inline on every element. Gmail strips a <style> block in some
 *   views, which would leave an unstyled mail.
 * - The wordmark is text, not an image. An image can be blocked by the client,
 *   fail to load, or render at the wrong size — exactly the "glitched logo"
 *   problem the printed templates had. Text always renders.
 * - Webfonts are requested but never relied on. Outlook falls back to Segoe UI
 *   and the mail still looks right.
 * - Colours are explicit, including the background, so a client in dark mode
 *   cannot invert the text to something unreadable.
 */

// Dezelfde waarden als content/klantdocumenten (--ink, --paper, --gold, ...),
// hier letterlijk omdat een mail geen CSS-variabelen kan gebruiken.
const INK = "#1c1812";
const MUTED = "#6b6253";
const PAPER = "#faf7f1";
const SOFT = "#f2ece0";
const SURFACE = "#ffffff";
const GOLD = "#a97a1f";
const GOLD_DEEP = "#8a6117";

const BODY_FONT = "'Inter','Segoe UI',Helvetica,Arial,sans-serif";
const DISPLAY_FONT = "'Space Grotesk','Segoe UI',Helvetica,Arial,sans-serif";

export const MATO_CONTACT = {
  name: "MATO",
  tagline: "automatenshop",
  city: "Diksmuide",
  phone: "+32 486 15 92 09",
  email: "info@matoautomaat.be",
  site: "www.matoautomaat.be",
};

/** Escapes text so it cannot inject markup into the rendered mail. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Eén doorloop voor links en mailadressen samen. Twee aparte doorlopen zouden
// elkaars resultaat kunnen raken — een adres binnen een href bijvoorbeeld.
const LINKABLE = /(https?:\/\/[^\s<]+)|([\w.+-]+@[\w-]+\.[\w.-]*\w)/g;

function linkify(escaped: string): string {
  return escaped.replace(LINKABLE, (match, url, mail) => {
    const style = `color:${GOLD_DEEP};text-decoration:underline;`;
    if (url) {
      // Leestekens die aan het eind van een zin tegen de link plakken horen
      // niet bij de link zelf.
      const clean = url.replace(/[.,;:!?)\]]+$/, "");
      const tail = url.slice(clean.length);
      return `<a href="${clean}" style="${style}">${clean}</a>${tail}`;
    }
    return `<a href="mailto:${mail}" style="${style}">${mail}</a>`;
  });
}

function isBullet(line: string): boolean {
  return /^\s*[-*•]\s+/.test(line);
}

function bulletText(line: string): string {
  return line.replace(/^\s*[-*•]\s+/, "");
}

/**
 * Turns the plain-text body into styled blocks.
 *
 * A blank line starts a new paragraph, a single newline stays a line break, and
 * a run of lines starting with "-", "*" or "•" becomes a list. Nothing else is
 * interpreted — what the writer typed is what is shown.
 */
export function renderBodyBlocks(body: string): string {
  const paragraphStyle = `margin:0 0 16px;font-family:${BODY_FONT};font-size:16px;line-height:1.65;color:${INK};`;
  const blocks: string[] = [];

  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").filter((line) => line.trim().length > 0);
    if (!lines.length) continue;

    if (lines.every(isBullet)) {
      const items = lines
        .map(
          (line) =>
            `<li style="margin:0 0 8px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:${INK};">${linkify(
              escapeHtml(bulletText(line))
            )}</li>`
        )
        .join("");
      blocks.push(`<ul style="margin:0 0 16px;padding-left:22px;">${items}</ul>`);
      continue;
    }

    const text = lines.map((line) => linkify(escapeHtml(line))).join("<br />");
    blocks.push(`<p style="${paragraphStyle}">${text}</p>`);
  }

  return blocks.join("");
}

/**
 * Renders the full mail. `body` is the plain text the sender wrote and read
 * back; it is styled, never rewritten.
 */
export function renderMatoMail({
  body,
  senderName,
}: {
  body: string;
  senderName?: string | null;
}): string {
  const signature = senderName?.trim()
    ? `<p style="margin:0;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:${INK};">${escapeHtml(
        senderName.trim()
      )}</p>`
    : "";

  const footerLine = `${MATO_CONTACT.city} &nbsp;·&nbsp; <a href="tel:${MATO_CONTACT.phone.replace(
    /\s/g,
    ""
  )}" style="color:${MUTED};text-decoration:none;">${MATO_CONTACT.phone}</a> &nbsp;·&nbsp; <a href="mailto:${
    MATO_CONTACT.email
  }" style="color:${MUTED};text-decoration:none;">${MATO_CONTACT.email}</a>`;

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${MATO_CONTACT.name}</title>
<!--[if mso]><style>body,table,td,p,a,li{font-family:'Segoe UI',Arial,sans-serif !important;}</style><![endif]-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap');
  /* Telefoons: laat de kaart de volle breedte nemen. */
  @media only screen and (max-width:620px){
    .mato-card{width:100% !important;}
    .mato-pad{padding-left:22px !important;padding-right:22px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAPER};-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAPER};">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" class="mato-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${SURFACE};border:1px solid ${SOFT};">

        <tr><td style="height:4px;background-color:${GOLD};font-size:0;line-height:0;">&nbsp;</td></tr>

        <tr>
          <td class="mato-pad" style="padding:30px 36px 22px;border-bottom:1px solid ${SOFT};">
            <span style="font-family:${DISPLAY_FONT};font-size:26px;font-weight:700;letter-spacing:0.14em;color:${INK};text-transform:uppercase;">${
              MATO_CONTACT.name
            }</span>
            <span style="font-family:${BODY_FONT};font-size:13px;color:${GOLD_DEEP};letter-spacing:0.04em;">&nbsp;${
              MATO_CONTACT.tagline
            }</span>
          </td>
        </tr>

        <tr>
          <td class="mato-pad" style="padding:30px 36px 10px;">
            ${renderBodyBlocks(body)}
            ${signature}
          </td>
        </tr>

        <tr>
          <td class="mato-pad" style="padding:22px 36px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="height:1px;background-color:${SOFT};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
            <p style="margin:16px 0 0;font-family:${BODY_FONT};font-size:12px;line-height:1.7;color:${MUTED};">
              ${footerLine}<br />
              <a href="https://${MATO_CONTACT.site}" style="color:${GOLD_DEEP};text-decoration:none;">${
                MATO_CONTACT.site
              }</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
