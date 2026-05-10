import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDocumentHtml(doc, meta) {
  const sectionsHtml = (doc.sections || [])
    .map(
      (section) => `
        <section class="card">
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.body).replace(/\n/g, "<br/>")}</p>
        </section>
      `,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(doc.title)} - ${escapeHtml(meta.app_name)}</title>
    <style>
      :root {
        --bg: #050505;
        --card: rgba(255, 255, 255, 0.06);
        --text: rgba(255, 255, 255, 0.92);
        --muted: rgba(255, 255, 255, 0.68);
        --accent: #d2f45c;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica,
          Arial, sans-serif;
      }
      .wrap {
        max-width: 860px;
        margin: 0 auto;
        padding: 28px 18px 44px;
      }
      header {
        margin-bottom: 18px;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 28px;
        letter-spacing: -0.2px;
      }
      .subtitle {
        margin: 0 0 10px;
        color: var(--muted);
        line-height: 1.55;
        font-size: 15px;
      }
      .meta {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      .pill {
        border: 1px solid rgba(210, 244, 92, 0.25);
        background: rgba(210, 244, 92, 0.12);
        color: rgba(244, 255, 208, 0.95);
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 13px;
      }
      .card {
        background: var(--card);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        padding: 18px;
        margin: 14px 0;
      }
      h2 {
        margin: 0 0 10px;
        font-size: 18px;
      }
      p {
        margin: 0;
        color: rgba(255, 255, 255, 0.78);
        line-height: 1.7;
        font-size: 14.5px;
      }
      a { color: var(--accent); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <h1>${escapeHtml(doc.title)}</h1>
        <p class="subtitle">${escapeHtml(doc.subtitle)}</p>
        <div class="meta">
          <div class="pill">Effective date: ${escapeHtml(meta.effective_date)}</div>
          <div class="pill">Contact: ${escapeHtml(meta.contact_email)}</div>
          <div class="pill">Publisher: ${escapeHtml(meta.publisher_name)}</div>
        </div>
      </header>
      ${sectionsHtml}
    </div>
  </body>
</html>`;
}

function renderAppReviewNotesMarkdown(legal) {
  const items = (legal.app_review?.items || [])
    .map((item) => `- ${item}`)
    .join("\n");

  return `# ${legal.app_review.title}

## Summary

${legal.app_review.summary}

## Review Notes

${items}

## Hosted Legal URLs

- Terms: ${legal.meta.hosting.terms_url}
- Privacy: ${legal.meta.hosting.privacy_url}

## Contact

- Publisher: ${legal.meta.publisher_name}
- Email: ${legal.meta.contact_email}
`;
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const inputPath = path.join(projectRoot, "data", "legal", "legal.json");
  const outDir = path.join(projectRoot, "dist", "legal");

  const raw = fs.readFileSync(inputPath, "utf8");
  const legal = JSON.parse(raw);

  fs.mkdirSync(outDir, { recursive: true });

  const termsHtml = renderDocumentHtml(legal.terms, legal.meta);
  const privacyHtml = renderDocumentHtml(legal.privacy, legal.meta);
  const appReviewNotes = renderAppReviewNotesMarkdown(legal);

  fs.writeFileSync(path.join(outDir, "terms.html"), termsHtml, "utf8");
  fs.writeFileSync(path.join(outDir, "privacy.html"), privacyHtml, "utf8");
  fs.writeFileSync(
    path.join(projectRoot, ".trae", "documents", "App Review Notes.md"),
    appReviewNotes,
    "utf8",
  );

  const manifest = {
    generated_at: new Date().toISOString(),
    source: "data/legal/legal.json",
    outputs: {
      terms: "dist/legal/terms.html",
      privacy: "dist/legal/privacy.html",
      app_review_notes: ".trae/documents/App Review Notes.md",
    },
    hosting_paths: legal.meta?.hosting ?? null,
  };
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );

  process.stdout.write(
    `Generated:\n- ${manifest.outputs.terms}\n- ${manifest.outputs.privacy}\n- ${manifest.outputs.app_review_notes}\n`,
  );
}

main();
