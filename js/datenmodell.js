/*
 * Datenmodell eines Konzepts: Aufbau, Bereinigung importierter Daten,
 * Statuswechsel für Studierende und Prüfung vor der Einreichung.
 * Das Modell enthält bewusst keine Namen oder Benutzerkennungen.
 */
(function (KT) {
  'use strict';

  var D = KT.delta;
  var FORMAT = 'ebak-konzept';
  var FORMAT_VERSION = 1;
  var TOOL_VERSION = '1.0.0';

  var STATUS = {
    'entwurf': 'Entwurf',
    'eingereicht': 'Eingereicht',
    'in-beurteilung': 'In Beurteilung',
    'beurteilt': 'Beurteilt'
  };

  function vorlage() { return KT.vorlage; }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }

  function textFelder() {
    return vorlage().abschnitte.filter(function (a) { return a.typ !== 'zeitplan'; }).map(function (a) { return a.feld; });
  }

  function leereStudierende() {
    var s = { arbeitstitel: '', institut: '', studienbereich: '', typ: '', zeitplan: [{ zeitpunkt: '', schritt: '' }] };
    textFelder().forEach(function (f) { s[f] = D.leer(); });
    return s;
  }

  function leereEbak() {
    var e = { bemerkungen: D.leer(), ortDatum: '' };
    vorlage().rueckmeldeFelder().forEach(function (f) { e[f.id] = D.leer(); });
    Object.keys(vorlage().auswahlen).forEach(function (k) { e[k] = ''; });
    return e;
  }

  function neu() {
    var jetzt = new Date().toISOString();
    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      vorlage: vorlage().id,
      dokumentId: uuid(),
      status: 'entwurf',
      versuch: 1,
      studierende: leereStudierende(),
      ebak: leereEbak(),
      verlauf: [],
      meta: { toolVersion: TOOL_VERSION, erstellt: jetzt, gespeichert: jetzt, eingereicht: null, beurteilt: null }
    };
  }

  function str(v, max) {
    return typeof v === 'string' ? v.slice(0, max || 2000) : '';
  }

  function datum(v) {
    return typeof v === 'string' && !isNaN(Date.parse(v)) ? v : null;
  }

  function ebakBereinigen(roh) {
    var e = leereEbak();
    roh = roh && typeof roh === 'object' ? roh : {};
    vorlage().rueckmeldeFelder().forEach(function (f) { e[f.id] = D.bereinigen(roh[f.id]); });
    e.bemerkungen = D.bereinigen(roh.bemerkungen);
    e.ortDatum = str(roh.ortDatum, 200);
    Object.keys(vorlage().auswahlen).forEach(function (k) {
      var erlaubt = vorlage().auswahlen[k].optionen.map(function (o) { return o.wert; });
      e[k] = erlaubt.indexOf(roh[k]) >= 0 ? roh[k] : '';
    });
    return e;
  }

  // Übernimmt nur bekannte Felder mit gültigen Typen (Importe gelten als unsicher).
  function normalisieren(roh) {
    if (!roh || typeof roh !== 'object' || roh.format !== FORMAT) {
      throw new Error('Die Datei enthält keine gültigen Daten des Konzept-Tools.');
    }
    var hinweise = [];
    if (roh.formatVersion > FORMAT_VERSION) {
      hinweise.push('Die Datei wurde mit einer neueren Version des Tools erstellt. Einzelne Angaben werden eventuell nicht angezeigt.');
    }
    if (roh.vorlage && roh.vorlage !== vorlage().id) {
      hinweise.push('Die Datei basiert auf der Vorlage ' + str(roh.vorlage, 40) + '. Das Tool verwendet die Vorlage ' + vorlage().id + '.');
    }
    var d = neu();
    d.dokumentId = str(roh.dokumentId, 64) || d.dokumentId;
    d.status = STATUS[roh.status] ? roh.status : 'entwurf';
    d.versuch = Math.max(1, Math.min(20, parseInt(roh.versuch, 10) || 1));

    var s = roh.studierende || {};
    d.studierende.arbeitstitel = str(s.arbeitstitel, 500);
    d.studierende.institut = str(s.institut, 200);
    d.studierende.studienbereich = str(s.studienbereich, 200);
    d.studierende.typ = str(s.typ, 200);
    textFelder().forEach(function (f) { d.studierende[f] = D.bereinigen(s[f]); });
    if (Array.isArray(s.zeitplan) && s.zeitplan.length) {
      d.studierende.zeitplan = s.zeitplan.slice(0, 200).map(function (z) {
        return { zeitpunkt: str(z && z.zeitpunkt, 500), schritt: str(z && z.schritt, 5000) };
      });
    }

    d.ebak = ebakBereinigen(roh.ebak);
    d.verlauf = Array.isArray(roh.verlauf) ? roh.verlauf.slice(0, 20).map(function (v) {
      return {
        versuch: Math.max(1, parseInt(v && v.versuch, 10) || 1),
        ebak: ebakBereinigen(v && v.ebak),
        abgeschlossen: datum(v && v.abgeschlossen),
        quelle: v && v.quelle === 'word' ? 'word' : 'tool'
      };
    }) : [];

    var m = roh.meta || {};
    d.meta.erstellt = datum(m.erstellt) || d.meta.erstellt;
    d.meta.gespeichert = datum(m.gespeichert) || d.meta.gespeichert;
    d.meta.eingereicht = datum(m.eingereicht);
    d.meta.beurteilt = datum(m.beurteilt);
    return { daten: d, hinweise: hinweise };
  }

  function ebakHatInhalt(e) {
    if (!e) return false;
    var felder = vorlage().rueckmeldeFelder().map(function (f) { return f.id; }).concat(['bemerkungen']);
    return felder.some(function (f) { return !D.istLeer(e[f]); }) ||
      Object.keys(vorlage().auswahlen).some(function (k) { return !!e[k]; });
  }

  // Studierende öffnen eine Datei: eine beurteilte Fassung startet den nächsten Versuch.
  function fuerStudierendeOeffnen(d) {
    var hinweise = [];
    if (d.status === 'beurteilt') {
      d.verlauf.push({ versuch: d.versuch, ebak: d.ebak, abgeschlossen: d.meta.beurteilt, quelle: 'tool' });
      hinweise.push('Die Rückmeldung zu Versuch ' + d.versuch + ' wurde übernommen und ist bei jedem Abschnitt sichtbar. Sie bearbeiten jetzt Versuch ' + (d.versuch + 1) + '.');
      d.versuch += 1;
      d.meta.eingereicht = null;
      d.meta.beurteilt = null;
    } else if (d.status === 'in-beurteilung') {
      hinweise.push('Diese Datei war noch in Beurteilung. Unfertige Rückmeldungen werden nicht angezeigt.');
    } else if (d.status === 'eingereicht') {
      hinweise.push('Sie haben die eingereichte Fassung geöffnet. Wenn Sie etwas ändern, müssen Sie das Konzept erneut einreichen.');
    }
    d.ebak = leereEbak();
    d.status = 'entwurf';
    return hinweise;
  }

  function umfang(d) {
    var u = vorlage().umfang;
    var z = 0;
    u.felder.forEach(function (f) {
      if (f === 'zeitplan') {
        d.studierende.zeitplan.forEach(function (r) { z += (r.zeitpunkt + r.schritt).replace(/\n/g, '').length; });
      } else {
        z += D.zeichen(d.studierende[f]);
      }
    });
    var seiten = z / u.zeichenProSeite;
    var stufe = seiten < u.minSeiten ? 'zuwenig' : seiten > u.maxSeiten ? 'zuviel' : 'ok';
    return { zeichen: z, seiten: seiten, stufe: stufe, min: u.minSeiten * u.zeichenProSeite, max: u.maxSeiten * u.zeichenProSeite };
  }

  function abschnittName(a) {
    return '«' + (a.nr ? a.nr + '. ' : '') + a.titel + '»';
  }

  function zeitplanGefuellt(d) {
    return d.studierende.zeitplan.filter(function (r) { return r.zeitpunkt.trim() || r.schritt.trim(); });
  }

  function pruefeEinreichung(d) {
    var fehler = [];
    var warnungen = [];
    vorlage().allgemein.felder.forEach(function (f) {
      if (!String(d.studierende[f.id] || '').trim()) fehler.push(f.label + ' fehlt.');
    });
    vorlage().abschnitte.forEach(function (a) {
      if (a.typ === 'zeitplan') {
        var zeilen = zeitplanGefuellt(d);
        if (!zeilen.length) fehler.push('Der Zeitplan ist leer.');
        else if (zeilen.some(function (r) { return !r.zeitpunkt.trim() || !r.schritt.trim(); })) {
          warnungen.push('Im Zeitplan fehlt in einzelnen Zeilen das Datum oder der Arbeitsschritt.');
        }
      } else if (D.istLeer(d.studierende[a.feld])) {
        fehler.push('Abschnitt ' + abschnittName(a) + ' ist leer.');
      }
    });
    var u = umfang(d);
    if (u.stufe !== 'ok') {
      warnungen.push('Der Umfang liegt mit rund ' + u.seiten.toFixed(1).replace('.', ',') + ' Seiten ausserhalb des Richtwerts von ' +
        vorlage().umfang.minSeiten + ' bis ' + vorlage().umfang.maxSeiten + ' Seiten (ohne Literaturverzeichnis).');
    }
    return { fehler: fehler, warnungen: warnungen };
  }

  function anzeigeTitel(d) {
    var t = (d.studierende.arbeitstitel || '').trim();
    return t || 'Konzept ohne Titel';
  }

  KT.modell = {
    FORMAT: FORMAT,
    FORMAT_VERSION: FORMAT_VERSION,
    TOOL_VERSION: TOOL_VERSION,
    STATUS: STATUS,
    neu: neu,
    leereEbak: leereEbak,
    normalisieren: normalisieren,
    ebakHatInhalt: ebakHatInhalt,
    fuerStudierendeOeffnen: fuerStudierendeOeffnen,
    umfang: umfang,
    pruefeEinreichung: pruefeEinreichung,
    anzeigeTitel: anzeigeTitel
  };
})(window.KT = window.KT || {});
