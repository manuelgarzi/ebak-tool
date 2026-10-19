/*
 * Baut das Formular aus der Vorlage auf. Ohne Erweiterung (Studierenden-Seite) sind die weissen
 * Bereiche bearbeitbar und die grauen Bereiche nur sichtbar. Die eBAK-Seite übergibt eine Erweiterung,
 * welche die grauen Bereiche bearbeitbar macht; die Studierenden-Inhalte sind dann schreibgeschützt.
 */
(function (KT) {
  'use strict';

  var el = KT.ui.el;
  var D = KT.delta;

  function abschnittLabel(a) {
    return (a.nr ? a.nr + '. ' : '') + a.titel;
  }

  function auswahlText(key, wert) {
    var o = KT.vorlage.auswahlen[key].optionen.filter(function (x) { return x.wert === wert; })[0];
    return o ? o.text : '';
  }

  /*
   * Zeigt das Formular im Container an.
   * beiAenderung(): wird nach jeder Eingabe aufgerufen (Autosave, Umfangsanzeige).
   * erweiterung: optional, nur auf der eBAK-Seite vorhanden.
   */
  function anzeigen(container, daten, beiAenderung, erweiterung) {
    var v = KT.vorlage;
    var ext = erweiterung || null;
    var istStud = !ext;
    var zaehler = {};

    function geaendert() { beiAenderung(); }

    function zaehlerSetzen(feld) {
      if (!zaehler[feld]) return;
      var n = feld === 'zeitplan'
        ? daten.studierende.zeitplan.reduce(function (s, r) { return s + (r.zeitpunkt + r.schritt).replace(/\n/g, '').length; }, 0)
        : D.zeichen(daten.studierende[feld]);
      zaehler[feld].textContent = KT.ui.zahl(n) + ' Zeichen';
    }

    // ---------- Bausteine ----------

    function lesetext(delta) {
      var d = el('div', { class: 'lesetext' });
      d.appendChild(D.zuDom(delta));
      return d;
    }

    function textEditor(delta, label, platzhalter, speichern) {
      return KT.editor.erstellen({
        delta: delta,
        label: label,
        platzhalter: platzhalter,
        beiAenderung: function (neu) { speichern(neu); geaendert(); }
      }).element;
    }

    function verlaufFuer(feldId) {
      var eintraege = daten.verlauf.slice().reverse().filter(function (h) { return !D.istLeer(h.ebak[feldId]); });
      if (!eintraege.length) return null;
      return el('div', { class: 'verlauf' }, eintraege.map(function (h, i) {
        var det = el('details', { class: 'verlauf-eintrag', open: i === 0 }, [
          el('summary', { text: 'Rückmeldung zu Versuch ' + h.versuch + (h.abgeschlossen ? ' (' + KT.ui.datumKurz(h.abgeschlossen) + ')' : '') })
        ]);
        det.appendChild(lesetext(h.ebak[feldId]));
        return det;
      }));
    }

    // Nur Anzeige; bearbeitbar wird die Auswahl durch die eBAK-Erweiterung
    function auswahlFeld(key, ziel) {
      if (ext) return ext.auswahlFeld(key, ziel, werkzeuge);
      var a = v.auswahlen[key];
      var fs = el('fieldset', { class: 'auswahl' }, [el('legend', { text: a.label })]);
      a.optionen.forEach(function (o) {
        var input = el('input', { type: 'radio', name: 'auswahl-' + key, value: o.wert, disabled: true });
        input.checked = ziel[key] === o.wert;
        fs.appendChild(el('label', { class: 'auswahl-option' }, [input, el('span', { text: o.text })]));
      });
      return fs;
    }

    function kriterienListe(kriterien) {
      var box = el('div', { class: 'kriterien' }, [el('h3', { text: 'Kriterien' })]);
      var ul = el('ul');
      kriterien.forEach(function (k) {
        if (typeof k === 'string') ul.appendChild(el('li', { text: k }));
        else if (k.fussnote) ul.appendChild(el('li', { class: 'fussnote', text: k.fussnote }));
        else if (k.auswahl) ul.appendChild(el('li', { class: 'mit-auswahl' }, [auswahlFeld(k.auswahl, daten.ebak)]));
      });
      box.appendChild(ul);
      return box;
    }

    function rueckmeldungBox(feldId, titel) {
      var box = el('div', { class: 'rueckmeldung' }, [el('h3', { text: 'Rückmeldungen' })]);
      box.appendChild(ext ? ext.rueckmeldung(feldId, titel, werkzeuge)
        : el('p', { class: 'platzhalter', text: 'Wird von der eBAK ausgefüllt.' }));
      var verlauf = verlaufFuer(feldId);
      if (verlauf) box.appendChild(verlauf);
      return box;
    }

    // Bausteine, welche die eBAK-Erweiterung mitbenutzt
    var werkzeuge = { el: el, D: D, daten: daten, geaendert: geaendert, textEditor: textEditor, lesetext: lesetext };

    function raster(kriterien, feldId, titel) {
      return el('div', { class: 'raster' }, [kriterienListe(kriterien), rueckmeldungBox(feldId, titel)]);
    }

    function karte(titel, untertitel, kinder, klasse) {
      var h = el('h2', { class: 'karten-titel' }, [titel, untertitel ? el('span', { class: 'untertitel', text: untertitel }) : null]);
      return el('section', { class: 'karte ' + (klasse || '') }, [h].concat(kinder));
    }

    // ---------- Zeitplan ----------

    function zeitplanBearbeiten(a) {
      var tbody = el('tbody');
      var tabelle = el('table', { class: 'zeitplan' }, [
        el('thead', null, el('tr', null, [
          el('th', { scope: 'col', text: a.spalten[0] }),
          el('th', { scope: 'col', text: a.spalten[1] }),
          el('th', { scope: 'col', class: 'aktionen' }, el('span', { class: 'sr-only', text: 'Aktionen' }))
        ])),
        tbody
      ]);
      var zeilen = daten.studierende.zeitplan;

      function anpassen(ta) {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 2 + 'px';
      }

      function zeichnen(fokusIndex) {
        var fokus = null;
        KT.ui.leeren(tbody);
        zeilen.forEach(function (z, i) {
          var nr = i + 1;
          var inp = el('input', { type: 'text', 'aria-label': a.spalten[0] + ', Zeile ' + nr, placeholder: 'z.B. KW 18 bis 20' });
          inp.value = z.zeitpunkt;
          inp.addEventListener('input', function () { z.zeitpunkt = inp.value; zaehlerSetzen('zeitplan'); geaendert(); });
          var ta = el('textarea', { rows: '1', 'aria-label': a.spalten[1] + ', Zeile ' + nr, placeholder: 'Arbeitsschritt oder Meilenstein' });
          ta.value = z.schritt;
          ta.addEventListener('input', function () { z.schritt = ta.value; anpassen(ta); zaehlerSetzen('zeitplan'); geaendert(); });
          var aktionen = el('td', { class: 'aktionen' }, el('div', { class: 'aktion-knoepfe' }, [
            el('button', { type: 'button', class: 'icon-knopf', title: 'Nach oben', 'aria-label': 'Zeile ' + nr + ' nach oben', disabled: i === 0, text: '↑',
              onclick: function () { zeilen.splice(i - 1, 0, zeilen.splice(i, 1)[0]); zeichnen(i - 1); geaendert(); } }),
            el('button', { type: 'button', class: 'icon-knopf', title: 'Nach unten', 'aria-label': 'Zeile ' + nr + ' nach unten', disabled: i === zeilen.length - 1, text: '↓',
              onclick: function () { zeilen.splice(i + 1, 0, zeilen.splice(i, 1)[0]); zeichnen(i + 1); geaendert(); } }),
            el('button', { type: 'button', class: 'icon-knopf loeschen', title: 'Zeile löschen', 'aria-label': 'Zeile ' + nr + ' löschen', text: '×',
              onclick: function () {
                if (zeilen.length > 1) zeilen.splice(i, 1); else zeilen[0] = { zeitpunkt: '', schritt: '' };
                zeichnen(Math.max(0, i - 1)); zaehlerSetzen('zeitplan'); geaendert();
              } })
          ]));
          tbody.appendChild(el('tr', null, [el('td', null, inp), el('td', null, ta), aktionen]));
          requestAnimationFrame(function () { anpassen(ta); });
          if (fokusIndex === i) fokus = inp;
        });
        if (fokus) fokus.focus();
      }
      zeichnen();

      var neu = el('button', {
        type: 'button', class: 'knopf sekundaer klein', text: '+ Zeile hinzufügen',
        onclick: function () { zeilen.push({ zeitpunkt: '', schritt: '' }); zeichnen(zeilen.length - 1); geaendert(); }
      });
      return el('div', { class: 'zeitplan-huelle' }, [tabelle, neu]);
    }

    function zeitplanLesen(a) {
      var zeilen = daten.studierende.zeitplan.filter(function (z) { return z.zeitpunkt.trim() || z.schritt.trim(); });
      if (!zeilen.length) return el('p', { class: 'leer-hinweis', text: 'Keine Angaben' });
      return el('table', { class: 'zeitplan nur-lesen' }, [
        el('thead', null, el('tr', null, [el('th', { scope: 'col', text: a.spalten[0] }), el('th', { scope: 'col', text: a.spalten[1] })])),
        el('tbody', null, zeilen.map(function (z) {
          return el('tr', null, [el('td', { text: z.zeitpunkt }), el('td', { text: z.schritt })]);
        }))
      ]);
    }

    // ---------- Aufbau ----------

    KT.ui.leeren(container);

    container.appendChild(el('section', { class: 'kopfbereich' }, [
      el('p', { class: 'vorlage-id', text: v.id }),
      el('h1', { text: v.titel }),
      el('p', { class: 'einleitung', text: v.einleitung })
    ]));

    // Zusammenfassung früherer Beurteilungen
    if (daten.verlauf.length) {
      var zusammenfassung = daten.verlauf.slice().reverse().map(function (h) {
        var teile = [el('h3', { text: 'Versuch ' + h.versuch + (h.abgeschlossen ? ', beurteilt am ' + KT.ui.datumKurz(h.abgeschlossen) : '') })];
        if (h.ebak.entscheid) teile.push(el('p', { class: 'entscheid entscheid-' + h.ebak.entscheid, text: 'Entscheid ' + auswahlText('entscheid', h.ebak.entscheid) }));
        if (!D.istLeer(h.ebak.bemerkungen)) teile.push(lesetext(h.ebak.bemerkungen));
        return el('div', { class: 'verlauf-zusammenfassung' }, teile);
      });
      container.appendChild(karte('Rückmeldungen früherer Versuche',
        ext ? ext.verlaufUntertitel : 'Die Rückmeldungen je Abschnitt finden Sie jeweils im grauen Bereich.',
        zusammenfassung, 'verlauf-karte'));
    }

    // Allgemeine Angaben
    var angaben = el('div', { class: 'angaben' });
    v.allgemein.felder.forEach(function (f) {
      var id = 'feld-' + f.id;
      var wert = daten.studierende[f.id] || '';
      var eingabe;
      if (!istStud) {
        eingabe = el('p', { class: 'wert', id: id, text: wert || 'Keine Angabe' });
      } else if (f.typ === 'text') {
        eingabe = el('textarea', { id: id, rows: '2', maxlength: '500', placeholder: 'Arbeitstitel eingeben' });
        eingabe.value = wert;
        eingabe.addEventListener('input', function () { daten.studierende[f.id] = eingabe.value; geaendert(); });
      } else {
        var optionen = v[f.optionen].slice();
        if (wert && optionen.indexOf(wert) < 0) optionen.push(wert);
        eingabe = el('select', { id: id }, [el('option', { value: '', text: 'Bitte auswählen' })].concat(optionen.map(function (o) {
          return el('option', { value: o, text: o });
        })));
        eingabe.value = wert;
        eingabe.addEventListener('change', function () { daten.studierende[f.id] = eingabe.value; geaendert(); });
      }
      angaben.appendChild(el('div', { class: 'angabe' }, [el('label', { for: id, text: f.label }), eingabe]));
    });
    container.appendChild(karte(v.allgemein.titel, null, [angaben], 'angaben-karte'));

    // Abschnitte 1 bis 6 und Literatur
    v.abschnitte.forEach(function (a) {
      var titel = abschnittLabel(a);
      var kinder = [];
      if (a.leitfragen) {
        kinder.push(el('ul', { class: 'leitfragen' + (a.leitfragenNummeriert ? ' ohne-punkte' : '') },
          a.leitfragen.map(function (q) { return el('li', { text: q }); })));
      }
      if (a.hinweis) kinder.push(el('p', { class: 'hinweis', text: a.hinweis }));

      var stud = el('div', { class: 'stud-bereich' });
      if (a.typ === 'zeitplan') {
        stud.appendChild(istStud ? zeitplanBearbeiten(a) : zeitplanLesen(a));
      } else if (istStud) {
        stud.appendChild(textEditor(daten.studierende[a.feld], titel, 'Inhalt des Abschnitts «' + titel + '» hier schreiben oder aus Word einfügen.',
          function (neu) { daten.studierende[a.feld] = neu; zaehlerSetzen(a.feld); }));
      } else {
        stud.appendChild(lesetext(daten.studierende[a.feld]));
      }
      kinder.push(stud);
      zaehler[a.feld] = el('p', { class: 'zaehler', 'aria-live': 'polite' });
      kinder.push(zaehler[a.feld]);
      zaehlerSetzen(a.feld);
      kinder.push(raster(a.kriterien, a.rueckmeldung, titel));
      container.appendChild(karte((a.nr ? a.nr + '. ' : '') + a.titel, a.untertitel, kinder, 'abschnitt'));
    });

    // Nur von der eBAK beurteilte Blöcke
    v.ebakBloecke.forEach(function (b) {
      container.appendChild(karte(b.titel, null, [raster(b.kriterien, b.rueckmeldung, b.titel)], 'abschnitt ebak-block'));
    });

    // Abschluss
    var abschluss = ext ? ext.abschluss(werkzeuge)
      : [el('p', { class: 'platzhalter', text: 'Abschliessende Bemerkungen, Entscheid sowie Ort und Datum werden von der eBAK ausgefüllt.' })];
    container.appendChild(karte('Abschluss eBAK', null, abschluss, 'abschluss-karte'));

    return {
      zaehlerAktualisieren: function () { Object.keys(zaehler).forEach(zaehlerSetzen); }
    };
  }

  KT.formular = { anzeigen: anzeigen, auswahlText: auswahlText, abschnittLabel: abschnittLabel };
})(window.KT = window.KT || {});
