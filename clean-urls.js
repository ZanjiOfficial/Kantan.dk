// Skjuler ".html" og "index.html" i adresselinjen og i links, men kun på det rigtige domæne.
// Åbnet direkte fra disken (file://) bevares filstierne, så forhåndsvisning stadig virker.
if (/(^|\.)kantan\.dk$/.test(location.hostname)) {
  const clean = (href) => {
    const u = new URL(href);
    u.pathname = u.pathname.replace(/index\.html$/, '').replace(/\.html$/, '');
    return u.href;
  };
  document.querySelectorAll('a[href]').forEach((a) => {
    if (a.origin === location.origin) a.href = clean(a.href);
  });
  history.replaceState(null, '', clean(location.href));
}

// Rul til en sektion på samme side uden at skrive #anker i adresselinjen (også fra file://).
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="#"]');
  if (!a || !a.hash || a.pathname !== location.pathname) return;
  const mål = document.getElementById(decodeURIComponent(a.hash.slice(1)));
  if (!mål) return;
  e.preventDefault();
  mål.scrollIntoView(); // glidende rul kommer fra "scroll-behavior: smooth" i style.css
});

// Kommer man fra en anden side (fx en artikel) med #anker i linket, fjernes det, når browseren har scrollet.
if (location.hash) {
  addEventListener('load', () => history.replaceState(null, '', location.pathname + location.search));
}
