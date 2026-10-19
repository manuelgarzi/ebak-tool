/*
 * Kleine DOM-Helfer, Dialoge und Meldungen. Texte werden nie als HTML eingesetzt.
 */
(function (KT) {
  'use strict';

  // el('div', { class: 'x', onclick: fn }, [kinder...])
  function el(tag, attr, kinder) {
    var e = document.createElement(tag);
    if (attr) {
      Object.keys(attr).forEach(function (k) {
        var v = attr[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, v);
      });
    }
    (Array.isArray(kinder) ? kinder : kinder ? [kinder] : []).forEach(function (k) {
      if (k === null || k === undefined || k === false) return;
      e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    });
    return e;
  }

  function leeren(knoten) {
    while (knoten.firstChild) knoten.removeChild(knoten.firstChild);
  }

  function datumKurz(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear();
  }

  function zeitKurz(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function zahl(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  }

  function meldung(text, art) {
    var box = document.getElementById('meldungen');
    if (!box) return;
    var m = el('div', { class: 'meldung ' + (art || 'info'), role: art === 'fehler' ? 'alert' : 'status', text: text });
    box.appendChild(m);
    setTimeout(function () { m.classList.add('weg'); }, art === 'fehler' ? 9000 : 5000);
    setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, art === 'fehler' ? 9600 : 5600);
  }

  /*
   * Modaler Dialog. knoepfe: [{ text, wert, art: 'primaer' | 'sekundaer' }]
   * inhalt: Text oder DOM-Knoten. Gibt ein Promise mit dem Wert des gedrückten Knopfs zurück.
   * pruefen(wert): optional, verhindert das Schliessen, wenn false zurückkommt.
   */
  function dialog(titel, inhalt, knoepfe, pruefen) {
    return new Promise(function (resolve) {
      var d = el('dialog', { class: 'dialog', 'aria-labelledby': 'dialog-titel' });
      var leiste = el('div', { class: 'dialog-knoepfe' });
      d.appendChild(el('h2', { id: 'dialog-titel', text: titel }));
      d.appendChild(typeof inhalt === 'string' ? el('p', { text: inhalt }) : inhalt);
      d.appendChild(leiste);
      function schliessen(wert) {
        d.close();
        d.remove();
        resolve(wert);
      }
      knoepfe.forEach(function (k) {
        leiste.appendChild(el('button', {
          type: 'button',
          class: 'knopf ' + (k.art || 'sekundaer'),
          text: k.text,
          onclick: function () {
            if (pruefen && pruefen(k.wert) === false) return;
            schliessen(k.wert);
          }
        }));
      });
      d.addEventListener('cancel', function (ev) { ev.preventDefault(); schliessen(null); });
      document.body.appendChild(d);
      d.showModal();
      var primaer = leiste.querySelector('.primaer');
      if (primaer) primaer.focus();
    });
  }

  function liste(eintraege, klasse) {
    return el('ul', { class: klasse || '' }, eintraege.map(function (t) { return el('li', { text: t }); }));
  }

  KT.ui = {
    el: el,
    leeren: leeren,
    datumKurz: datumKurz,
    zeitKurz: zeitKurz,
    zahl: zahl,
    meldung: meldung,
    dialog: dialog,
    liste: liste
  };
})(window.KT = window.KT || {});
