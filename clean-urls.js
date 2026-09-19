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
