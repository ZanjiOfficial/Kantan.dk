# Kantan.dk
Hjemmeside til firma

## Artikler

Artikler skrives som Markdown i `content/artikler/` og bygges til HTML med:

```
npm install   # kun første gang
npm run build
```

Buildet kører også automatisk ved deploy, men kør det lokalt for at se resultatet, og commit de genererede filer (`artikler/`, `index.html`).

Artiklerne er kulturstof om Japan, der skal føre læseren videre til en ydelse: slut med et link til den relevante pakke (fx `[Rejseplan + booking](kontakt.html?pakke=booking)`) og vælg `cta:` efter målgruppe.

Ny artikel = ny fil, fx `content/artikler/mit-emne.md` (filnavnet bliver adressen):

```
---
title: Overskrift
description: Ét-to sætninger, vises på kortet og i søgeresultater.
date: 2026-09-19
featured: true          # valgfri: vis på forsiden (de 3 nyeste)
cta: rejseplan          # valgfri: hvilken ydelse bunden peger på, rejseplan (standard) eller wh
image: images/gallery/kyoto-6068-large.jpg   # valgfri: billede på kortet
hero: images/gallery/kyoto-6165-large.jpg    # valgfri: billede bag titlen (bruges også som delingsbillede)
---

Brødtekst i Markdown. Brug ## til overskrifter (titlen er allerede h1).
```

Links: `[tekst](anden-artikel.md)` til en anden artikel (buildet fejler, hvis den ikke findes), og `[tekst](kontakt.html)` eller `![alt](images/x.jpg)` for resten af sitet. Fulde `https://`-links virker som normalt.

`style.css`-versionen (`?v=…`) i alle sider opdateres automatisk af buildet.
