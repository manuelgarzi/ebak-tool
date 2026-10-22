/*
 * Markierungen der eBAK in den Texten der Studierenden.
 *
 * Eine Markierung hängt als Format «markierung» ("<id>:<farbe>") direkt am markierten Text und
 * wandert deshalb beim Überarbeiten mit. Kommentar, Versuch und eingefrorene Nummer stehen in
 * daten.markierungen. Nur Markierungen mit Kommentar erhalten eine Nummer.
 *
 * Nummern sind stabil: Markierungen früherer Versuche behalten ihre Nummer, neue Markierungen
 * zählen ab der höchsten bisherigen Nummer weiter (in der Reihenfolge des Dokuments).
 * Dieses Modul zeigt Markierungen nur an; setzen und entfernen kann sie nur die eBAK-Seite.
 */
(function (KT) {
  'use strict';

  var FARBEN = [
    { id: 'gelb', name: 'Gelb', wert: '#FFE58A' },
    { id: 'gruen', name: 'Grün', wert: '#BDE5B5' },
    { id: 'blau', name: 'Blau', wert: '#BCE0F5' },
    { id: 'rosa', name: 'Rosa', wert: '#F7C4CC' }
  ];

  function farbwert(farbe) {
    var f = FARBEN.filter(function (x) { return x.id === farbe; })[0];
    return f ? f.wert : FARBEN[0].wert;
  }

  function idVon(wert) {
    return String(wert || '').split(':')[0];
  }

  function neueId() {
    return 'm' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
  }

  function textFelder() {
    return KT.vorlage.abschnitte.filter(function (a) { return a.typ !== 'zeitplan'; }).map(function (a) { return a.feld; });
  }

  function hatKommentar(m) {
    return !!(m && m.kommentar && m.kommentar.trim());
  }

  // Wo kommt jede Markierung im Text vor? { id: { feld, feldIndex, index, text } }
  function vorkommen(daten) {
    var r = {};
    textFelder().forEach(function (feld, fi) {
      var pos = 0;
      ((daten.studierende[feld] && daten.studierende[feld].ops) || []).forEach(function (op) {
        if (typeof op.insert !== 'string') return;
        var w = op.attributes && op.attributes.markierung;
        if (w) {
          var id = idVon(w);
          if (!r[id]) r[id] = { feld: feld, feldIndex: fi, index: pos, text: '' };
          r[id].text += op.insert;
        }
        pos += op.insert.length;
      });
    });
    return r;
  }

  function reihenfolge(daten, vk) {
    var felder = textFelder();
    return function (a, b) {
      var va = vk[a.id], vb = vk[b.id];
      var fa = va ? va.feldIndex : felder.indexOf(a.feld);
      var fb = vb ? vb.feldIndex : felder.indexOf(b.feld);
      if (fa !== fb) return fa - fb;
      var ia = va ? va.index : Infinity;
      var ib = vb ? vb.index : Infinity;
      if (ia !== ib) return ia < ib ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    };
  }

  // { id: Nummer } für alle Markierungen mit Kommentar
  function nummern(daten) {
    var map = {};
    // Höchste je festgeschriebene Nummer, auch wenn die Markierung inzwischen entfernt wurde
    var max = daten.markierungNrBasis || 0;
    var liste = daten.markierungen || [];
    liste.forEach(function (m) {
      if (m.versuch < daten.versuch && m.nr) {
        map[m.id] = m.nr;
        if (m.nr > max) max = m.nr;
      }
    });
    var vk = vorkommen(daten);
    liste.filter(function (m) { return m.versuch >= daten.versuch && hatKommentar(m); })
      .sort(reihenfolge(daten, vk))
      .forEach(function (m) { map[m.id] = ++max; });
    return map;
  }

  // Beim Abschluss eines Versuchs: Nummern der Markierungen dieses Versuchs festschreiben
  function einfrieren(daten) {
    var n = nummern(daten);
    (daten.markierungen || []).forEach(function (m) {
      if (m.versuch === daten.versuch) m.nr = n[m.id] || null;
      if (m.nr && m.nr > (daten.markierungNrBasis || 0)) daten.markierungNrBasis = m.nr;
    });
  }

  function auszug(text, max) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    max = max || 80;
    return t.length > max ? t.slice(0, max - 1).trim() + '…' : t;
  }

  /*
   * Markierungen eines Abschnitts für die Kommentarliste, sortiert nach Nummer bzw. Position.
   * Jeder Eintrag: { m, nr, auszug, entfernt, frueher }
   */
  function eintraege(daten, feld, nurMitKommentar) {
    var vk = vorkommen(daten);
    var n = nummern(daten);
    return (daten.markierungen || [])
      .filter(function (m) { return m.feld === feld && (!nurMitKommentar || n[m.id]); })
      .sort(reihenfolge(daten, vk))
      .map(function (m) {
        return {
          m: m,
          nr: n[m.id] || null,
          auszug: vk[m.id] ? auszug(vk[m.id].text) : '',
          entfernt: !vk[m.id],
          frueher: m.versuch < daten.versuch
        };
      });
  }

  // Schreibgeschützte Kommentarliste (Studierende); leer, wenn keine nummerierten Markierungen
  function listeLesen(daten, feld) {
    var el = KT.ui.el;
    var liste = eintraege(daten, feld, true);
    if (!liste.length) return null;
    return el('div', { class: 'kommentare' }, [
      el('h3', { text: 'Kommentare zu Markierungen' }),
      el('ol', { class: 'kommentar-liste' }, liste.map(function (e) {
        return el('li', { class: 'kommentar', 'data-mk': e.m.id }, [
          el('span', { class: 'kommentar-nr mk-' + e.m.farbe, text: String(e.nr) }),
          el('div', { class: 'kommentar-inhalt' }, [
            e.entfernt ? el('p', { class: 'kommentar-auszug', text: 'Markierte Textstelle wurde entfernt.' })
              : el('p', { class: 'kommentar-auszug', text: '«' + e.auszug + '»' }),
            el('p', { class: 'kommentar-text', text: e.m.kommentar }),
            e.frueher ? el('p', { class: 'kommentar-versuch', text: 'Versuch ' + e.m.versuch }) : null
          ])
        ]);
      }))
    ]);
  }

  // ---------- Darstellung im Texteditor der Studierenden (Quill) ----------

  var anzeigeNummern = {};

  function quillRegistrieren() {
    if (!window.Quill || quillRegistrieren.fertig) return;
    var Inline = window.Quill.import('blots/inline');
    class MarkierungBlot extends Inline {
      static create(wert) {
        var node = super.create();
        var t = String(wert).split(':');
        node.setAttribute('data-mk', t[0]);
        node.classList.add('mk-' + t[1]);
        if (anzeigeNummern[t[0]]) node.setAttribute('data-nr', anzeigeNummern[t[0]]);
        return node;
      }
      static formats(node) {
        var id = node.getAttribute('data-mk');
        var farbe = Array.prototype.filter.call(node.classList, function (c) { return /^mk-(gelb|gruen|blau|rosa)$/.test(c); })[0];
        return id && farbe ? id + ':' + farbe.slice(3) : undefined;
      }
    }
    MarkierungBlot.blotName = 'markierung';
    MarkierungBlot.tagName = 'MARK';
    MarkierungBlot.className = 'mk';
    window.Quill.register(MarkierungBlot, true);
    // Markierung als äusserstes Inline-Format, damit fett/kursiv sie nicht aufteilen
    if (Inline.order.indexOf('markierung') < 0) Inline.order.push('markierung');
    quillRegistrieren.fertig = true;
  }

  // Nummer nur hinter dem letzten Teilstück einer Markierung anzeigen
  function nummernBereinigen(wurzel) {
    var letzte = {};
    Array.prototype.forEach.call(wurzel.querySelectorAll('mark.mk[data-mk]'), function (m) {
      var id = m.getAttribute('data-mk');
      if (letzte[id]) letzte[id].classList.add('mk-ohne-nr');
      m.classList.remove('mk-ohne-nr');
      letzte[id] = m;
    });
  }

  KT.markierung = {
    FARBEN: FARBEN,
    farbwert: farbwert,
    idVon: idVon,
    neueId: neueId,
    textFelder: textFelder,
    hatKommentar: hatKommentar,
    vorkommen: vorkommen,
    nummern: nummern,
    einfrieren: einfrieren,
    auszug: auszug,
    eintraege: eintraege,
    listeLesen: listeLesen,
    quillRegistrieren: quillRegistrieren,
    nummernBereinigen: nummernBereinigen,
    anzeigeNummernSetzen: function (map) { anzeigeNummern = map || {}; }
  };
})(window.KT = window.KT || {});
