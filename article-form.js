// Spørgsmålsformularen nederst i hver artikel: sender til kontakt@kantan.dk via formsubmit.co,
// på samme måde som kontaktformularen. Uden JS sender formularen almindeligt og ender på tak.html.
document.querySelectorAll('.article-ask form').forEach((form) => {
  const box = form.closest('.article-ask');
  const btn = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.form-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    new FormData(form).forEach((v, key) => {
      if (v.trim() !== '' && key !== '_next') data[key] = v.trim();
    });
    const tak = () => {
      form.hidden = true;
      box.querySelector('.article-ask-intro').hidden = true;
      box.querySelector('.article-ask-thanks').hidden = false;
    };
    if (data._honey) return tak(); // spam-fælde: bots udfylder det skjulte felt
    data._replyto = data['E-mail'];
    data._subject = 'Spørgsmål til «' + data.Artikel + '» (' + data.Navn + ')';

    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sender …';
    status.hidden = true;

    try {
      const r = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (j.success !== true && j.success !== 'true') throw j;
      tak();
    } catch {
      // formsubmit.co afviser sider åbnet fra disken eller localhost, så en lokal forhåndsvisning kan ikke sende
      const lokal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      status.innerHTML = lokal
        ? 'Formularen kan kun sende fra den udgivne side på kantan.dk, ikke fra en lokal forhåndsvisning.'
        : 'Beskeden kunne ikke sendes. Prøv igen, eller skriv direkte til <a href="mailto:kontakt@kantan.dk">kontakt@kantan.dk</a>.';
      status.hidden = false;
      btn.disabled = false;
      btn.textContent = label;
    }
  });
});
