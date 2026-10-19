/*
 * Steuerung: Startseite, Öffnen und Importieren, automatisches Speichern, Export.
 * Die Seite legt ihre Rolle fest (<body data-rolle>). Auf der eBAK-Seite liefert KT.ebak
 * die zusätzlichen Funktionen; die Studierenden-Seite enthält dieses Modul nicht.
 */
(function (KT) {
  'use strict';

  var ui = KT.ui;
  var el = ui.el;
  var rolle = 'stud';
  var ebak = null;

  var zustand = {
    daten: null,
    dateiname: '',
    formular: null,
    timer: null,
    speicherOk: true,
    seitExportGeaendert: false
  };

  var $ = function (id) { return document.getElementById(id); };

  // ---------- Startseite ----------

  function startAnzeigen() {
    zustand.daten = null;
    document.body.classList.remove('arbeitet');
    $('arbeit').hidden = true;
    $('start').hidden = false;
    $('werkzeugleiste').hidden = true;
    document.title = (ebak ? 'Konzepte beurteilen' : 'Konzept erfassen') + ' · eBAK Konzept-Tool';
    listeAnzeigen();
    window.scrollTo(0, 0);
  }

  function listeAnzeigen() {
    var box = $('lokale-liste');
    ui.leeren(box);
    var eintraege = KT.speicher.liste(rolle);
    $('lokal-bereich').hidden = !eintraege.length;
    eintraege.forEach(function (e) {
      box.appendChild(el('li', { class: 'lokal-eintrag' }, [
        el('div', { class: 'lokal-info' }, [
          el('strong', { text: e.titel }),
          el('span', { class: 'lokal-meta', text: [
            KT.modell.STATUS[e.status] || '',
            'Versuch ' + e.versuch,
            e.dateiname || null,
            'zuletzt ' + ui.datumKurz(e.gespeichert) + ', ' + ui.zeitKurz(e.gespeichert)
          ].filter(Boolean).join(' · ') })
        ]),
        el('div', { class: 'lokal-aktionen' }, [
          el('button', { type: 'button', class: 'knopf primaer klein', text: 'Weiterarbeiten', onclick: function () { lokalOeffnen(e); } }),
          el('button', { type: 'button', class: 'knopf sekundaer klein', text: 'Entfernen', onclick: function () { lokalEntfernen(e); } })
        ])
      ]));
    });
  }

  function lokalOeffnen(e) {
    var roh = KT.speicher.laden(e.schluessel);
    try {
      var r = KT.modell.normalisieren(roh);
      oeffnen(r.daten, e.dateiname, []);
    } catch (err) {
      ui.meldung('Diese lokale Bearbeitung ist beschädigt und kann nicht geöffnet werden.', 'fehler');
    }
  }

  function lokalEntfernen(e) {
    ui.dialog('Lokale Bearbeitung entfernen?',
      '«' + e.titel + '» wird von diesem Gerät entfernt. Exportierte PDF-Dateien sind davon nicht betroffen.',
      [{ text: 'Abbrechen', wert: false }, { text: 'Entfernen', wert: true, art: 'primaer' }]
    ).then(function (ja) {
      if (!ja) return;
      KT.speicher.loeschen(e.schluessel);
      listeAnzeigen();
    });
  }

  function neuesKonzept() {
    oeffnen(KT.modell.neu(), '', []);
    lokalSpeichern();
  }

  function dateiGewaehlt(datei) {
    if (!datei) return;
    var zone = $('ablage');
    zone.classList.add('laedt');
    KT.import.datei(datei, rolle).then(function (r) {
      // Die eBAK-Seite kann nach dem Import noch nachfragen (z.B. Versuch bei Word-Dateien)
      return ebak && ebak.nachImport ? ebak.nachImport(r, datei.name) : r;
    }).then(function (r) {
      if (!r) return null;
      return fassungWaehlen(r).then(function (wahl) {
        if (wahl === 'lokal') return;
        r.daten.meta.gespeichert = new Date().toISOString();
        oeffnen(r.daten, datei.name, r.hinweise);
        lokalSpeichern();
      });
    }).catch(function (err) {
      ui.dialog('Datei kann nicht geöffnet werden', err.importFehler ? err.message : 'Beim Lesen der Datei ist ein Fehler aufgetreten. ' + (err.message || ''),
        [{ text: 'OK', wert: true, art: 'primaer' }]);
    }).then(function () {
      zone.classList.remove('laedt');
      $('datei-eingabe').value = '';
    });
  }

  // Gibt es auf diesem Gerät eine neuere Bearbeitung desselben Konzepts, fragen wir nach.
  function fassungWaehlen(r) {
    var schluessel = KT.speicher.schluesselFuer(rolle, r.daten);
    var e = KT.speicher.eintrag(schluessel);
    if (!e || !e.gespeichert || !r.daten.meta.gespeichert || e.gespeichert <= r.daten.meta.gespeichert || r.quelle !== 'pdf') {
      return Promise.resolve('datei');
    }
    return ui.dialog('Neuere Bearbeitung auf diesem Gerät',
      'Für dieses Konzept gibt es auf diesem Gerät eine Bearbeitung vom ' + ui.datumKurz(e.gespeichert) + ', ' + ui.zeitKurz(e.gespeichert) +
      ' Uhr. Sie ist neuer als die gewählte Datei. Welche Fassung möchten Sie öffnen?',
      [{ text: 'Gewählte Datei', wert: 'datei' }, { text: 'Neuere Fassung auf diesem Gerät', wert: 'lokal', art: 'primaer' }]
    ).then(function (wahl) {
      if (wahl === 'lokal') lokalOeffnen(e);
      return wahl || 'lokal';
    });
  }

  // ---------- Bearbeiten ----------

  function oeffnen(daten, dateiname, hinweise) {
    zustand.daten = daten;
    zustand.dateiname = dateiname || '';
    zustand.seitExportGeaendert = false;
    if (ebak) ebak.beimOeffnen(daten);
    $('start').hidden = true;
    $('arbeit').hidden = false;
    $('werkzeugleiste').hidden = false;
    document.body.classList.add('arbeitet');
    document.title = KT.modell.anzeigeTitel(daten) + ' · eBAK Konzept-Tool';

    var hinweisBox = $('hinweise');
    ui.leeren(hinweisBox);
    hinweise.forEach(function (h) { hinweisBox.appendChild(el('p', { class: 'hinweis-box', text: h })); });
    hinweisBox.hidden = !hinweise.length;

    zustand.formular = KT.formular.anzeigen($('formular'), daten, geaendert, ebak && ebak.formular);
    statusAnzeigen();
    window.scrollTo(0, 0);
  }

  function geaendert() {
    var d = zustand.daten;
    if (!d) return;
    if (ebak) ebak.nachAenderung(d);
    else if (d.status === 'eingereicht') d.status = 'entwurf';
    d.meta.gespeichert = new Date().toISOString();
    zustand.seitExportGeaendert = true;
    document.title = KT.modell.anzeigeTitel(d) + ' · eBAK Konzept-Tool';
    statusAnzeigen();
    clearTimeout(zustand.timer);
    zustand.timer = setTimeout(lokalSpeichern, 600);
  }

  function lokalSpeichern() {
    clearTimeout(zustand.timer);
    if (!zustand.daten) return;
    zustand.speicherOk = KT.speicher.speichern(rolle, zustand.daten, zustand.dateiname);
    var info = $('speicher-info');
    if (zustand.speicherOk) {
      info.textContent = 'Auf diesem Gerät gespeichert, ' + ui.zeitKurz(zustand.daten.meta.gespeichert);
      info.className = 'speicher-info';
    } else {
      info.textContent = 'Automatisches Speichern nicht möglich. Bitte regelmässig «Zwischenstand speichern».';
      info.className = 'speicher-info warnung';
    }
  }

  function statusAnzeigen() {
    var d = zustand.daten;
    if (!d) return;
    $('status-chip').textContent = 'Versuch ' + d.versuch + ' · ' + KT.modell.STATUS[d.status];
    $('status-chip').className = 'chip status-' + d.status;
    var u = KT.modell.umfang(d);
    var umfang = $('umfang');
    umfang.textContent = 'Umfang: ' + ui.zahl(u.zeichen) + ' Zeichen, ca. ' + u.seiten.toFixed(1).replace('.', ',') + ' Seiten';
    umfang.className = 'umfang umfang-' + u.stufe;
    umfang.title = 'Richtwert: ' + KT.vorlage.umfang.minSeiten + ' bis ' + KT.vorlage.umfang.maxSeiten + ' Seiten, ohne Literaturverzeichnis (gerechnet mit ' +
      ui.zahl(KT.vorlage.umfang.zeichenProSeite) + ' Zeichen pro Seite)';
    if (zustand.formular) zustand.formular.zaehlerAktualisieren();
  }

  // ---------- Export ----------

  function heute() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function exportieren(dateiname, knopf) {
    var d = zustand.daten;
    var alterText = knopf ? knopf.textContent : '';
    if (knopf) { knopf.disabled = true; knopf.textContent = 'PDF wird erstellt …'; }
    d.meta.gespeichert = new Date().toISOString();
    return KT.pdf.erstellen(d).then(function (bytes) {
      KT.pdf.herunterladen(bytes, dateiname);
      zustand.seitExportGeaendert = false;
      lokalSpeichern();
      statusAnzeigen();
      return true;
    }).catch(function (err) {
      ui.dialog('PDF konnte nicht erstellt werden', 'Beim Erstellen der PDF ist ein Fehler aufgetreten: ' + (err && err.message ? err.message : err),
        [{ text: 'OK', wert: true, art: 'primaer' }]);
      return false;
    }).then(function (ok) {
      if (knopf) { knopf.disabled = false; knopf.textContent = alterText; }
      return ok;
    });
  }

  function zwischenstand(ev) {
    var d = zustand.daten;
    var name;
    if (ebak) {
      name = ebak.zwischenstand(d);
    } else {
      d.status = 'entwurf';
      name = 'BA-Konzept_Zwischenstand_' + heute() + '.pdf';
    }
    exportieren(name, ev.currentTarget).then(function (ok) {
      if (ok) ui.meldung('Zwischenstand gespeichert: ' + name + '. Sie können diese Datei später hier wieder öffnen.', 'erfolg');
    });
  }

  function pruefungsInhalt(ergebnis, zusatz) {
    var box = el('div');
    if (ergebnis.fehler.length) {
      box.appendChild(el('p', { text: 'Bitte ergänzen Sie zuerst:' }));
      box.appendChild(ui.liste(ergebnis.fehler, 'fehler-liste'));
    }
    if (ergebnis.warnungen.length) {
      box.appendChild(el('p', { text: 'Bitte prüfen:' }));
      box.appendChild(ui.liste(ergebnis.warnungen, 'warn-liste'));
    }
    (zusatz || []).forEach(function (z) { box.appendChild(z); });
    return box;
  }

  function einreichen(ev) {
    var knopf = ev.currentTarget;
    var d = zustand.daten;
    var p = KT.modell.pruefeEinreichung(d);
    if (p.fehler.length) {
      ui.dialog('Konzept noch nicht vollständig', pruefungsInhalt(p), [{ text: 'Zurück zum Formular', wert: true, art: 'primaer' }]);
      return;
    }
    var bestaetigung = el('input', { type: 'checkbox', id: 'anonym-ok' });
    var fehlerText = el('p', { class: 'dialog-fehler', hidden: true, text: 'Bitte bestätigen Sie die Anonymität.' });
    var inhalt = pruefungsInhalt(p, [
      el('label', { class: 'bestaetigung', for: 'anonym-ok' }, [bestaetigung,
        el('span', { text: 'Ich bestätige, dass im Konzept weder mein Name noch der Name meiner Betreuungsperson vorkommt.' })]),
      fehlerText,
      el('p', { class: 'klein', text: 'Die PDF wird auf Ihr Gerät heruntergeladen. Laden Sie sie danach im Forms zur Einreichung hoch. ' +
        'Bearbeiten Sie die Datei nicht in einem anderen Programm. Für Änderungen öffnen Sie sie wieder hier im Tool.' })
    ]);
    ui.dialog('Konzept einreichen', inhalt,
      [{ text: 'Abbrechen', wert: false }, { text: 'PDF für die Einreichung erstellen', wert: true, art: 'primaer' }],
      function (wert) {
        if (wert && !bestaetigung.checked) { fehlerText.hidden = false; return false; }
        return true;
      }
    ).then(function (ja) {
      if (!ja) return;
      d.status = 'eingereicht';
      d.meta.eingereicht = new Date().toISOString();
      var name = 'BA-Konzept_Einreichung_Versuch-' + d.versuch + '.pdf';
      exportieren(name, knopf).then(function (ok) {
        if (!ok) { d.status = 'entwurf'; return; }
        ui.dialog('PDF erstellt', el('div', null, [
          el('p', { text: 'Die Datei «' + name + '» wurde heruntergeladen.' }),
          el('p', { text: 'Nächster Schritt: Laden Sie diese PDF im Forms für die Einreichung des Bachelorarbeitskonzepts hoch.' }),
          el('p', { class: 'klein', text: 'Sie erhalten die Rückmeldung der eBAK per E-Mail als PDF. Diese können Sie hier wieder öffnen, um Ihr Konzept zu überarbeiten.' })
        ]), [{ text: 'OK', wert: true, art: 'primaer' }]);
      });
    });
  }

  function schliessen() {
    lokalSpeichern();
    startAnzeigen();
  }

  // ---------- Start ----------

  function alleLoeschen() {
    ui.dialog('Alle lokalen Daten löschen?',
      'Alle im Browser gespeicherten Bearbeitungen dieses Tools werden von diesem Gerät gelöscht. Exportierte PDF-Dateien bleiben erhalten. ' +
      'Empfohlen auf gemeinsam genutzten Computern.',
      [{ text: 'Abbrechen', wert: false }, { text: 'Alles löschen', wert: true, art: 'primaer' }]
    ).then(function (ja) {
      if (!ja) return;
      KT.speicher.allesLoeschen();
      listeAnzeigen();
      ui.meldung('Alle lokalen Daten wurden gelöscht.', 'erfolg');
    });
  }

  function ablageEinrichten() {
    var zone = $('ablage');
    var eingabe = $('datei-eingabe');
    eingabe.addEventListener('change', function () { dateiGewaehlt(eingabe.files[0]); });
    ['dragenter', 'dragover'].forEach(function (t) {
      zone.addEventListener(t, function (ev) { ev.preventDefault(); zone.classList.add('aktiv'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      zone.addEventListener(t, function () { zone.classList.remove('aktiv'); });
    });
    zone.addEventListener('drop', function (ev) {
      ev.preventDefault();
      if (ev.dataTransfer.files.length) dateiGewaehlt(ev.dataTransfer.files[0]);
    });
    // Dateien ausserhalb der Ablage nicht vom Browser öffnen lassen
    window.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    window.addEventListener('drop', function (ev) { ev.preventDefault(); });
  }

  function init() {
    rolle = document.body.getAttribute('data-rolle') === 'ebak' ? 'ebak' : 'stud';
    ebak = rolle === 'ebak' ? KT.ebak || null : null;
    KT.app.rolle = rolle;
    document.body.classList.add('rolle-' + rolle);
    if (rolle === 'ebak' && !ebak) {
      ui.meldung('Die eBAK-Ansicht konnte nicht geladen werden.', 'fehler');
      return;
    }

    if (!window.pdfMake || !window.PDFLib || !window.Quill || !KT.pdfAssets) {
      ui.meldung('Das Tool konnte nicht vollständig geladen werden. Bitte die Seite neu laden.', 'fehler');
    }
    if (!KT.speicher.verfuegbar()) {
      $('speicher-warnung').hidden = false;
    }

    if ($('neu')) $('neu').addEventListener('click', neuesKonzept);
    if ($('knopf-einreichen')) $('knopf-einreichen').addEventListener('click', einreichen);
    $('alle-loeschen').addEventListener('click', alleLoeschen);
    $('knopf-zwischenstand').addEventListener('click', zwischenstand);
    $('knopf-schliessen').addEventListener('click', schliessen);
    ablageEinrichten();
    if (ebak) ebak.init(KT.app);

    window.addEventListener('beforeunload', function (ev) {
      if (zustand.daten && zustand.seitExportGeaendert && !zustand.speicherOk) {
        ev.preventDefault();
        ev.returnValue = '';
      }
    });
    window.addEventListener('pagehide', function () { if (zustand.daten) lokalSpeichern(); });

    startAnzeigen();
  }

  KT.app = {
    init: init,
    rolle: rolle,
    zustand: zustand,
    oeffnen: oeffnen,
    exportieren: exportieren,
    pruefungsInhalt: pruefungsInhalt
  };
  // Auf der eBAK-Seite wird das Skript erst nach dem Entschlüsseln geladen
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.KT = window.KT || {});
