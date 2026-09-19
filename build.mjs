// Bygger artikler: content/artikler/*.md -> artikler/*.html,
// og fylder "artikler"-sektionen på forsiden (mellem markørerne i index.html).
// Kør med `npm run build`. Se README.md for hvordan man skriver en artikel.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const SRC = 'content/artikler';
const OUT = 'artikler';
const SITE = 'https://kantan.dk';
const FORSIDE_MAX = 3;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dato = (d) => new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Afsluttende salgsbånd på artikelsider. En artikel vælger med `cta:` i front matter, hvilken ydelse den leder videre til.
const CTA = {
  rejseplan: { h: 'Skal jeg planlægge jeres Japan?', p: 'Skriv kort om turen, I drømmer om, så vender jeg tilbage med et forslag.', href: 'kontakt.html', knap: 'Fortæl mig om jeres tur' },
  wh: { h: 'Skal jeg hjælpe dig til Japan?', p: 'Skriv kort om dig selv og det år, du drømmer om, så vender jeg tilbage med et forslag.', href: 'kontakt.html?pakke=wh', knap: 'Fortæl mig om dit år' },
};

// Cache-busting af stylesheet (Cloudflare cacher style.css i timevis): hash af indholdet.
const cssHash = createHash('sha256').update(readFileSync('style.css')).digest('hex').slice(0, 8);

// --- Indlæs artikler ---------------------------------------------------------
function parse(file) {
  const raw = readFileSync(`${SRC}/${file}`, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: mangler front matter (--- ... ---) øverst`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^(["'])(.*)\1$/, '$2').trim();
  }
  for (const k of ['title', 'description', 'date']) {
    if (!meta[k]) throw new Error(`${file}: front matter mangler "${k}"`);
  }
  if (Number.isNaN(Date.parse(meta.date))) throw new Error(`${file}: "date" skal være ÅÅÅÅ-MM-DD`);
  meta.cta ??= 'rejseplan';
  if (!CTA[meta.cta]) throw new Error(`${file}: "cta" skal være en af ${Object.keys(CTA).join(', ')}`);
  return { ...meta, slug: file.replace(/\.md$/, ''), featured: meta.featured === 'true', body: m[2] };
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.md'));
const artikler = files.map(parse).sort((a, b) => b.date.localeCompare(a.date));
const slugs = new Set(artikler.map((a) => a.slug));

// --- Markdown: interne links ------------------------------------------------
// I markdown skriver man `[tekst](anden-artikel.md)` til andre artikler, og
// `[tekst](kontakt.html)` / `![](images/x.jpg)` for resten af sitet (fra rodmappen).
let aktuel = '';
marked.use({
  walkTokens(t) {
    if (t.type !== 'link' && t.type !== 'image') return;
    const h = t.href;
    if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(h)) return; // https:, mailto:, #anker, /absolut
    const md = h.match(/^([\w-]+)\.md(#.*)?$/);
    if (md) {
      if (!slugs.has(md[1])) throw new Error(`${aktuel}.md: linker til ukendt artikel "${h}"`);
      t.href = `${md[1]}.html${md[2] ?? ''}`;
    } else {
      t.href = `../${h}`;
    }
  },
});

// --- Skabeloner -------------------------------------------------------------
const head = ({ title, description, url, image, prefix, type = 'website' }) => `<!doctype html>
<html lang="da">
    <head>
        <title>${esc(title)}, Kantan</title>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="format-detection" content="telephone=no">
        <meta name="author" content="Kantan">
        <meta name="description" content="${esc(description)}">

        <meta property="og:type" content="${type}">
        <meta property="og:title" content="${esc(title)}, Kantan">
        <meta property="og:description" content="${esc(description)}">
        <meta property="og:image" content="${SITE}/${image ?? 'images/hero.jpg'}">
        <meta property="og:url" content="${SITE}/${url}">

        <link rel="icon" type="image/svg+xml" href="${prefix}favicon.svg">
        <link rel="icon" type="image/png" sizes="32x32" href="${prefix}favicon-32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="${prefix}favicon-16.png">
        <link rel="apple-touch-icon" sizes="180x180" href="${prefix}apple-touch-icon.png">

        <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
        rel="stylesheet"
        integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN"
        crossorigin="anonymous"
        />

        <link rel="stylesheet" href="${prefix}style.css?v=${cssHash}">

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Montserrat:wght@400;500;600;700&family=Shippori+Mincho:wght@500;700&display=swap" rel="stylesheet">
    </head>
`;

const nav = (aktivArtikler) => `
    <body>
        <header id="header" class="site-header">
          <nav class="navbar navbar-expand-xl">
            <div class="container-fluid px-3 px-lg-5 py-2">
              <a class="navbar-brand" href="../index.html">
                <span class="logo-mark" aria-hidden="true">簡単</span>
                Kantan
              </a>
              <button
              class="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarMain"
              aria-controls="navbarMain"
              aria-expanded="false"
              aria-label="Åbn menu">
                <span class="navbar-toggler-icon"></span>
              </button>
              <div class="collapse navbar-collapse justify-content-end" id="navbarMain">
                <ul class="navbar-nav gap-xl-2 align-items-xl-center mb-2 mb-xl-0">
                  <li class="nav-item"><a class="nav-link" href="../index.html#forside">Forside</a></li>
                  <li class="nav-item"><a class="nav-link" href="../index.html#saadan">Sådan fungerer det</a></li>
                  <li class="nav-item"><a class="nav-link" href="../index.html#inkluderet">Hvad du får</a></li>
                  <li class="nav-item"><a class="nav-link" href="../index.html#om-mig">Om mig</a></li>
                  <li class="nav-item"><a class="nav-link" href="../index.html#galleri">Galleri</a></li>
                  <li class="nav-item"><a class="nav-link" href="../index.html#priser">Priser</a></li>
                  <li class="nav-item"><a class="nav-link" href="../working-holiday.html">Working Holiday</a></li>
                  <li class="nav-item"><a class="nav-link${aktivArtikler ? ' active' : ''}" href="index.html">Artikler</a></li>
                  <li class="nav-item mt-2 mt-xl-0"><a class="nav-link nav-cta" href="../kontakt.html">Kontakt</a></li>
                </ul>
              </div>
            </div>
          </nav>
        </header>
`;

const foot = (c) => `
        <section class="cta-band">
          <div class="container">
            <span class="hanko" aria-hidden="true">旅</span>
            <h2>${c.h}</h2>
            <p>${c.p}</p>
            <a href="../${c.href}" class="btn btn-light mt-2">${c.knap}</a>
          </div>
        </section>

        <footer class="site-footer">
          <div class="container">
            <div class="row g-4">
              <div class="col-md-4">
                <a class="navbar-brand mb-3 d-inline-flex" href="../index.html">
                  <span class="logo-mark" aria-hidden="true">簡単</span>
                  Kantan
                </a>
                <p>Rejseplaner og working holiday i Japan fra en dansker, der har boet i landet.</p>
              </div>
              <div class="col-md-4">
                <h4>Genveje</h4>
                <ul class="list-unstyled">
                  <li class="mb-2"><a href="../index.html#saadan">Sådan fungerer det</a></li>
                  <li class="mb-2"><a href="../index.html#inkluderet">Hvad du får</a></li>
                  <li class="mb-2"><a href="../index.html#om-mig">Om mig</a></li>
                  <li class="mb-2"><a href="../index.html#galleri">Galleri</a></li>
                  <li class="mb-2"><a href="../index.html#priser">Priser</a></li>
                  <li class="mb-2"><a href="../working-holiday.html">Working Holiday</a></li>
                  <li class="mb-2"><a href="index.html">Artikler</a></li>
                  <li class="mb-2"><a href="../kontakt.html">Kontakt</a></li>
                </ul>
              </div>
              <div class="col-md-4">
                <h4>Kontakt</h4>
                <ul class="list-unstyled">
                  <li class="mb-2"><a href="mailto:kontakt@kantan.dk">E-mail: kontakt@kantan.dk</a></li>
                  <li class="mb-2">Svar typisk inden for en hverdag</li>
                </ul>
              </div>
            </div>
            <div class="footer-bottom text-center">
              © 2026 Kantan. Alle rettigheder forbeholdes.
            </div>
          </div>
        </footer>

        <script
            src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js"
            integrity="sha384-I7E8VVD/ismYTF4hNIPjVp/Zjvgyol6VFvRkX/vR+Vc4jQkC+hVqc2pM8ODewa9r"
            crossorigin="anonymous"
        ></script>
        <script
            src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.min.js"
            integrity="sha384-BBtl+eGJRgqQAUMxJ7pMwbEyER4l1g+O15P+16Ep7Q9Q+zqX6gSbd85u4mG4QzX+"
            crossorigin="anonymous"
        ></script>
    </body>
</html>
`;

// `dir` er stien fra den side, kortet står på, til artikel-mappen ('artikler/' fra forsiden, '' ellers).
// Billeder står som rod-relative stier i front matter, så de får `up` foran ('' fra forsiden, '../' ellers).
const card = (a, dir, up) => `
              <div class="col-md-6 col-lg-4">
                <a class="article-card" href="${dir}${a.slug}.html">${a.image ? `
                  <img src="${up}${esc(a.image)}" alt="" loading="lazy" decoding="async">` : ''}
                  <div class="article-card-body">
                    <span class="eyebrow">${dato(a.date)}</span>
                    <h3>${esc(a.title)}</h3>
                    <p>${esc(a.description)}</p>
                    <span class="article-card-more">Læs artiklen &rarr;</span>
                  </div>
                </a>
              </div>`;

// --- Skriv artikelsider -----------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

for (const a of artikler) {
  aktuel = a.slug;
  writeFileSync(`${OUT}/${a.slug}.html`, head({
    title: a.title, description: a.description, url: `${OUT}/${a.slug}.html`, image: a.image, prefix: '../', type: 'article',
  }) + nav(false) + `
        <section class="hero-simple">
          <div class="container">
            <div class="text-center text-center-narrow">
              <span class="hanko" aria-hidden="true">記</span>
              <span class="eyebrow">${dato(a.date)}</span>
              <h1>${esc(a.title)}</h1>
              <p class="lead-text">${esc(a.description)}</p>
            </div>
          </div>
        </section>

        <article class="section">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-8 prose">
${marked.parse(a.body)}
                <p class="mt-5"><a href="index.html">&larr; Alle artikler</a></p>
              </div>
            </div>
          </div>
        </article>
` + foot(CTA[a.cta]));
}

// --- Artikeloversigt --------------------------------------------------------
writeFileSync(`${OUT}/index.html`, head({
  title: 'Artikler om Japan', description: 'Artikler om at rejse til, bo og arbejde i Japan, skrevet af en dansker der har boet i landet.', url: `${OUT}/`, prefix: '../',
}) + nav(true) + `
        <section class="hero-simple">
          <div class="container">
            <div class="text-center text-center-narrow">
              <span class="hanko" aria-hidden="true">読</span>
              <span class="eyebrow">Artikler</span>
              <h1>Læs, før du rejser</h1>
              <p class="lead-text">Praktiske artikler om at rejse til, bo og arbejde i Japan.</p>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            <div class="row g-4">${artikler.map((a) => card(a, '', '../')).join('')}
            </div>
          </div>
        </section>
` + foot(CTA.rejseplan));

// --- Forsiden: fremhævede artikler + stylesheet-hash ------------------------
const fremhaevet = artikler.filter((a) => a.featured).slice(0, FORSIDE_MAX);
const sektion = fremhaevet.length ? `
        <section id="artikler" class="section bg-alt">
          <div class="container">
            <div class="section-head">
              <span class="hanko" aria-hidden="true">読</span>
              <div>
                <span class="eyebrow">Artikler</span>
                <h2>Læs, før du rejser</h2>
                <p class="lead-text">Praktisk viden om Japan, skrevet ud fra år i landet.</p>
              </div>
            </div>
            <div class="row g-4">${fremhaevet.map((a) => card(a, `${OUT}/`, '')).join('')}
            </div>
            <p class="text-center mt-5"><a href="${OUT}/index.html" class="btn btn-ghost">Alle artikler</a></p>
          </div>
        </section>
        ` : '';

const MARK = /<!-- artikler:start -->[\s\S]*?<!-- artikler:end -->/;
let forside = readFileSync('index.html', 'utf8');
if (!MARK.test(forside)) throw new Error('index.html mangler <!-- artikler:start --> ... <!-- artikler:end -->');
writeFileSync('index.html', forside.replace(MARK, () => `<!-- artikler:start -->${sektion}<!-- artikler:end -->`));

// Hold ?v=-hashen i de håndskrevne sider opdateret, så style.css-ændringer altid slår igennem hos Cloudflare.
for (const f of readdirSync('.').filter((f) => f.endsWith('.html'))) {
  const s = readFileSync(f, 'utf8');
  const n = s.replace(/style\.css\?v=[0-9a-f]+/g, `style.css?v=${cssHash}`);
  if (n !== s) writeFileSync(f, n);
}

console.log(`${artikler.length} artikler bygget, ${fremhaevet.length} på forsiden, css ?v=${cssHash}`);
