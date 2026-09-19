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
const jsHash = createHash('sha256').update(readFileSync('clean-urls.js')).digest('hex').slice(0, 8);

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
        <meta property="og:image" content="${SITE}/${image ?? 'images/hero-hiroshima.jpg'}">
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

// Sociale medier: bruges i sidefoden og under hver artikel.
const SOCIALE = `<div class="social-links">
  <a href="https://www.tiktok.com/@officialkantan" target="_blank" rel="noopener noreferrer" aria-label="TikTok" title="TikTok"><svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/></svg></a>
  <a href="https://www.facebook.com/KantanOfficial/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook"><svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951"/></svg></a>
  <a href="https://www.linkedin.com/company/kantanofficial" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn"><svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z"/></svg></a>
  <a href="https://www.instagram.com/kantanofficial" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram"><svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334"/></svg></a>
</div>`;

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
                ${SOCIALE}
              </div>
              <div class="col-md-4">
                <h4>Genveje</h4>
                <ul class="list-unstyled">
                  <li class="mb-2"><a href="../index.html#saadan">Sådan fungerer det</a></li>
                  <li class="mb-2"><a href="../index.html#inkluderet">Hvad du får</a></li>
                  <li class="mb-2"><a href="../index.html#om-mig">Om mig</a></li>
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

        <script src="../clean-urls.js?v=${jsHash}"></script>
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
                <a class="article-card" href="${dir}${a.slug}.html">${a.image ?? a.hero ? `
                  <img src="${up}${esc(a.image ?? a.hero)}" alt="" loading="lazy" decoding="async">` : ''}
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
    title: a.title, description: a.description, url: `${OUT}/${a.slug}`, image: a.image ?? a.hero, prefix: '../', type: 'article',
  }) + nav(false) + `
        <section class="hero-simple${a.hero ? ' has-image' : ''}"${a.hero ? ` style="background-image:url('../${esc(a.hero)}')"` : ''}>
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
                <div class="article-follow">
                  <p>Følg Kantan for mere om Japan</p>
                  ${SOCIALE}
                </div>
                <p class="mt-4"><a href="index.html">&larr; Alle artikler</a></p>
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
        <section class="hero-simple has-image" style="background-image:url('../images/gallery/kyoto-6110-large.jpg')">
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

// Hold ?v=-hashen på style.css og clean-urls.js i de håndskrevne sider opdateret, så ændringer altid slår igennem hos Cloudflare.
for (const f of readdirSync('.').filter((f) => f.endsWith('.html'))) {
  const s = readFileSync(f, 'utf8');
  const n = s
    .replace(/style\.css\?v=[0-9a-f]+/g, `style.css?v=${cssHash}`)
    .replace(/clean-urls\.js(\?v=[0-9a-f]+)?/g, `clean-urls.js?v=${jsHash}`);
  if (n !== s) writeFileSync(f, n);
}

console.log(`${artikler.length} artikler bygget, ${fremhaevet.length} på forsiden, css ?v=${cssHash}`);
