/* Quick Cerebro · ronda 3 · menú de la barra lateral en celular y tableta (abre con el botón, cierra con Esc,
   tocando fuera o al elegir una pantalla). Lo demás de las maquetas es estático. ES2017, sin innerHTML. */
(function () {
  'use strict';
  var app = document.querySelector('[data-app]');
  var scrim = document.querySelector('[data-scrim]');
  var btn = document.querySelector('[data-menu]');
  if (!app || !btn) return;
  function set(open) {
    app.classList.toggle('menu-open', open);
    scrim.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) { var cur = app.querySelector('.ui-side a'); if (cur) cur.focus(); } else btn.focus();
  }
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', function () { set(!app.classList.contains('menu-open')); });
  scrim.addEventListener('click', function () { set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && app.classList.contains('menu-open')) set(false); });
})();
