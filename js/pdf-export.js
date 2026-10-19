/*
 * PDF-Export: pdfmake erzeugt das lesbare Dokument im Layout der Vorlage,
 * pdf-lib setzt neutrale Metadaten (keine Namen) und bettet die Formulardaten als JSON-Anhang ein.
 */
(function (KT) {
  'use strict';

  var ANHANG = 'konzept-daten.json';

  var FARBE = {
    deep: '#1C3E37',      // PHSG Deep-Mint
    bright: '#1FC070',    // PHSG Bright-Grün
    text: '#383836',      // Grayscale-900
    textHell: '#6F7170',  // Grayscale-700
    grau: '#ECECEC',      // Grayscale-100: Bereiche der eBAK
    hell: '#F5F7F6',      // Grayscale-050: Leitfragen, Hinweise
    linie: '#C5C7C6',     // Grayscale-300
    warnung: '#BF4850'    // Dark-Rot
  };

  var RAND = [56, 92, 56, 54];

  var LAYOUT = {
    hLineWidth: function () { return 0.6; },
    vLineWidth: function () { return 0.6; },
    hLineColor: function () { return FARBE.linie; },
    vLineColor: function () { return FARBE.linie; },
    paddingLeft: function () { return 7; },
    paddingRight: function () { return 7; },
    paddingTop: function () { return 5; },
    paddingBottom: function () { return 6; }
  };

  // ---------- Text ----------

  function runs(rs) {
    return rs.map(function (r) {
      var t = { text: r.text.replace(/\t/g, '    ') };
      if (r.bold) t.bold = true;
      if (r.italic) t.italics = true;
      if (r.underline) t.decoration = 'underline';
      return t;
    });
  }

  function block(b) {
    if (b.typ === 'liste') {
      var eintraege = b.eintraege.map(function (e) {
        if (e.typ === 'liste') return block(e);
        var r = runs(e.runs);
        return { text: r.length ? r : ' ', margin: [0, 0, 0, 1.5] };
      });
      var liste = b.art === 'ordered' ? { ol: eintraege } : { ul: eintraege };
      liste.margin = [0, 0, 0, 3];
      return liste;
    }
    var r = runs(b.runs);
    if (b.typ === 'titel') return { text: r, bold: true, fontSize: 10.5, color: FARBE.deep, margin: [0, 5, 0, 2] };
    if (!r.length) return { text: ' ', fontSize: 4 };
    return { text: r, margin: [0, 0, 0, 3] };
  }

  function langtext(delta, leerText) {
    if (KT.delta.istLeer(delta)) return [platzhalter(leerText || 'Keine Angaben')];
    return KT.delta.bloecke(delta).map(block);
  }

  function platzhalter(text) {
    return { text: text, italics: true, color: FARBE.textHell };
  }

  function einfach(s) {
    return String(s || '').replace(/\t/g, '    ');
  }

  // ---------- Bausteine ----------

  function kaestchen(an, text) {
    var zeichnung = [{ type: 'rect', x: 0, y: 2, w: 7.5, h: 7.5, lineWidth: 0.7, lineColor: FARBE.text }];
    if (an) {
      zeichnung.push(
        { type: 'line', x1: 1.6, y1: 3.6, x2: 5.9, y2: 7.9, lineWidth: 1.2, lineColor: FARBE.deep },
        { type: 'line', x1: 5.9, y1: 3.6, x2: 1.6, y2: 7.9, lineWidth: 1.2, lineColor: FARBE.deep }
      );
    }
    return { columns: [{ width: 11, canvas: zeichnung }, { width: '*', text: text, bold: an }], columnGap: 3, margin: [0, 1, 0, 1], unbreakable: true };
  }

  function auswahl(key, wert, mitLabel) {
    var a = KT.vorlage.auswahlen[key];
    var teile = mitLabel ? [{ text: a.label, margin: [0, 0, 0, 1] }] : [];
    return { stack: teile.concat(a.optionen.map(function (o) { return kaestchen(wert === o.wert, o.text); })), margin: [0, 1, 0, 3], unbreakable: true };
  }

  function kriterien(liste, ebak) {
    return {
      ul: liste.map(function (k) {
        if (typeof k === 'string') return { text: k, margin: [0, 0, 0, 2] };
        if (k.fussnote) return { text: k.fussnote, italics: true, listType: 'none', margin: [0, 0, 0, 2] };
        return { stack: [auswahl(k.auswahl, ebak[k.auswahl], true)], listType: 'none' };
      }),
      fontSize: 8.5,
      markerColor: FARBE.deep
    };
  }

  function titelZelle(text, untertitel) {
    var t = [{ text: text, bold: true }];
    if (untertitel) t.push({ text: '   ' + untertitel, fontSize: 8.5, bold: false });
    return { text: t, colSpan: 2, fillColor: FARBE.deep, color: '#FFFFFF', fontSize: 11, margin: [0, 1, 0, 1] };
  }

  function tabelle(body, breiten) {
    return {
      table: { widths: breiten || ['*', '*'], headerRows: 1, keepWithHeaderRows: 1, body: body },
      layout: LAYOUT,
      margin: [0, 0, 0, 12]
    };
  }

  function rueckmeldung(daten, feldId) {
    var leer = KT.delta.istLeer(daten.ebak[feldId]);
    if (leer && (daten.status === 'entwurf' || daten.status === 'eingereicht')) return [platzhalter('Wird von der eBAK ausgefüllt.')];
    return langtext(daten.ebak[feldId], 'Keine Rückmeldung');
  }

  function zeitplan(daten, a) {
    var zeilen = daten.studierende.zeitplan.filter(function (z) { return z.zeitpunkt.trim() || z.schritt.trim(); });
    if (!zeilen.length) return platzhalter('Keine Angaben');
    return {
      table: {
        widths: [100, '*'],
        headerRows: 1,
        body: [[
          { text: a.spalten[0], bold: true, fillColor: FARBE.hell },
          { text: a.spalten[1], bold: true, fillColor: FARBE.hell }
        ]].concat(zeilen.map(function (z) { return [einfach(z.zeitpunkt), einfach(z.schritt)]; }))
      },
      layout: LAYOUT
    };
  }

  function abschnitt(daten, a) {
    var titel = (a.nr ? a.nr + '. ' : '') + a.titel;
    var body = [[titelZelle(titel, a.untertitel), {}]];
    if (a.leitfragen) {
      body.push([{
        colSpan: 2, fillColor: FARBE.hell, fontSize: 8.5, color: FARBE.textHell,
        stack: a.leitfragenNummeriert ? a.leitfragen.slice() : [{ ul: a.leitfragen.slice(), markerColor: FARBE.textHell }]
      }, {}]);
    }
    if (a.hinweis) body.push([{ text: a.hinweis, colSpan: 2, fillColor: FARBE.hell, fontSize: 8.5, italics: true, color: FARBE.textHell }, {}]);
    var inhalt = a.typ === 'zeitplan' ? [zeitplan(daten, a)] : langtext(daten.studierende[a.feld]);
    body.push([{ stack: inhalt, colSpan: 2 }, {}]);
    body.push(kopfzeileKriterien());
    body.push([
      { stack: [kriterien(a.kriterien, daten.ebak)], fillColor: FARBE.grau },
      { stack: rueckmeldung(daten, a.rueckmeldung), fillColor: FARBE.grau }
    ]);
    return tabelle(body);
  }

  function kopfzeileKriterien() {
    return [
      { text: 'Kriterien', bold: true, fillColor: FARBE.grau, fontSize: 8.5, color: FARBE.deep },
      { text: 'Rückmeldungen', bold: true, fillColor: FARBE.grau, fontSize: 8.5, color: FARBE.deep }
    ];
  }

  function ebakBlock(daten, b) {
    return tabelle([
      [titelZelle(b.titel), {}],
      kopfzeileKriterien(),
      [
        { stack: [kriterien(b.kriterien, daten.ebak)], fillColor: FARBE.grau },
        { stack: rueckmeldung(daten, b.rueckmeldung), fillColor: FARBE.grau }
      ]
    ]);
  }

  function abschluss(daten) {
    var v = KT.vorlage;
    var e = daten.ebak;
    var offen = daten.status === 'entwurf' || daten.status === 'eingereicht';
    return tabelle([
      [titelZelle(v.bemerkungen.titel), {}],
      [{ stack: offen && KT.delta.istLeer(e.bemerkungen) ? [platzhalter('Wird von der eBAK ausgefüllt.')] : langtext(e.bemerkungen, 'Keine Bemerkungen'), colSpan: 2, fillColor: FARBE.grau }, {}],
      [{ stack: [{ text: 'Entscheid', bold: true, margin: [0, 0, 0, 2] }, auswahl('entscheid', e.entscheid, false)], colSpan: 2, fillColor: FARBE.grau }, {}],
      [{ text: [{ text: v.ortDatum.titel + ': ', bold: true }, e.ortDatum || ''], colSpan: 2, fillColor: FARBE.grau }, {}]
    ]);
  }

  function allgemein(daten) {
    var v = KT.vorlage;
    var body = [[titelZelle(v.allgemein.titel), {}]];
    v.allgemein.felder.forEach(function (f) {
      var wert = daten.studierende[f.id];
      body.push([{ text: f.label, bold: true }, wert ? einfach(wert) : platzhalter('Keine Angabe')]);
    });
    return tabelle(body, [150, '*']);
  }

  function verlauf(daten) {
    if (!daten.verlauf.length) return [];
    var inhalt = [{ text: 'Anhang: Rückmeldungen früherer Versuche', fontSize: 14, bold: true, color: FARBE.deep, pageBreak: 'before', margin: [0, 0, 0, 10] }];
    daten.verlauf.forEach(function (h) {
      var body = [[titelZelle('Versuch ' + h.versuch + (h.abgeschlossen ? ', beurteilt am ' + KT.ui.datumKurz(h.abgeschlossen) : '')), {}]];
      body.push([{ text: 'Entscheid', bold: true }, auswahl('entscheid', h.ebak.entscheid, false)]);
      KT.vorlage.rueckmeldeFelder().forEach(function (f) {
        if (!KT.delta.istLeer(h.ebak[f.id])) body.push([{ text: f.titel, bold: true }, { stack: langtext(h.ebak[f.id]) }]);
      });
      ['datenschutz', 'vollstaendig', 'umfangEingehalten'].forEach(function (k) {
        if (h.ebak[k]) body.push([{ text: KT.vorlage.auswahlen[k].label.replace(/\s*…$/, ''), bold: true }, KT.formular.auswahlText(k, h.ebak[k])]);
      });
      if (!KT.delta.istLeer(h.ebak.bemerkungen)) body.push([{ text: KT.vorlage.bemerkungen.titel, bold: true }, { stack: langtext(h.ebak.bemerkungen) }]);
      inhalt.push(tabelle(body, [150, '*']));
    });
    return inhalt;
  }

  function statusText(daten) {
    var s = KT.modell.STATUS[daten.status];
    return 'Versuch ' + daten.versuch + ' · ' + s;
  }

  function dokument(daten) {
    var v = KT.vorlage;
    var entwurf = daten.status === 'entwurf' || daten.status === 'in-beurteilung';
    var inhalt = [
      { text: v.id, bold: true, color: FARBE.deep, fontSize: 10 },
      { text: v.titel, fontSize: 17, bold: true, color: FARBE.deep, margin: [0, 2, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 60, y2: 0, lineWidth: 2.5, lineColor: FARBE.bright }], margin: [0, 0, 0, 8] },
      { text: v.einleitung, fontSize: 8.5, color: FARBE.textHell, margin: [0, 0, 0, 12] },
      allgemein(daten)
    ];
    v.abschnitte.forEach(function (a) { inhalt.push(abschnitt(daten, a)); });
    v.ebakBloecke.forEach(function (b) { inhalt.push(ebakBlock(daten, b)); });
    inhalt.push(abschluss(daten));
    inhalt.push({ text: 'Literatur zur Vorlage', bold: true, fontSize: 8, color: FARBE.textHell, margin: [0, 4, 0, 2] });
    v.quellen.forEach(function (q) { inhalt.push({ text: q, fontSize: 7.5, color: FARBE.textHell, margin: [0, 0, 0, 1] }); });
    inhalt = inhalt.concat(verlauf(daten));

    return {
      pageSize: 'A4',
      pageMargins: RAND,
      info: {
        title: 'Bachelorarbeitskonzept ' + v.id,
        subject: v.titel,
        creator: 'eBAK Konzept-Tool',
        producer: 'eBAK Konzept-Tool'
      },
      images: { logo: KT.pdfAssets.logo },
      header: function () {
        return {
          margin: [RAND[0], 24, RAND[2], 0],
          columns: [
            { image: 'logo', width: 96 },
            {
              width: '*',
              stack: [
                { text: v.studiengang, alignment: 'right', fontSize: 8, color: FARBE.textHell },
                { text: entwurf ? statusText(daten).toUpperCase() : statusText(daten), alignment: 'right', fontSize: 8.5, bold: true,
                  color: entwurf ? FARBE.warnung : FARBE.deep, margin: [0, 3, 0, 0] }
              ]
            }
          ]
        };
      },
      footer: function (seite, total) {
        return {
          margin: [RAND[0], 18, RAND[2], 0],
          columns: [
            { text: v.id + ' · ' + v.stand, fontSize: 7.5, color: FARBE.textHell },
            { text: 'Seite ' + seite + ' von ' + total, alignment: 'right', fontSize: 7.5, color: FARBE.textHell }
          ]
        };
      },
      content: inhalt,
      defaultStyle: { font: 'AlbertSans', fontSize: 9.5, lineHeight: 1.25, color: FARBE.text }
    };
  }

  // Erzeugt die fertige PDF als Uint8Array.
  function erstellen(daten) {
    var dd = dokument(daten);
    return window.pdfMake.createPdf(dd).getBuffer().then(function (puffer) {
      return datenEinbetten(new Uint8Array(puffer), daten);
    });
  }

  // ---------- Datenträger in der PDF ----------
  // 1. Dateianhang konzept-daten.json (Standard).
  // 2. Ersatzkopie im Feld «Stichwörter» (gzip + Base64). Sie übersteht das Neuspeichern
  //    mit macOS Vorschau, das Dateianhänge entfernt.

  var ERSATZ_PRAEFIX = 'EBAKDATEN1:';

  function base64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function umwandeln(bytes, transform) {
    var strom = new Blob([bytes]).stream().pipeThrough(transform);
    return new Response(strom).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function ersatzkopie(json) {
    if (!window.CompressionStream) return Promise.resolve(ERSATZ_PRAEFIX + 'raw:' + base64(json));
    return umwandeln(json, new CompressionStream('gzip')).then(function (gz) { return ERSATZ_PRAEFIX + 'gz:' + base64(gz); });
  }

  function datenEinbetten(bytes, daten) {
    var L = window.PDFLib;
    var jetzt = new Date();
    var json = new TextEncoder().encode(JSON.stringify(daten));
    return Promise.all([L.PDFDocument.load(bytes, { updateMetadata: false }), ersatzkopie(json)]).then(function (r) {
      var pdf = r[0];
      pdf.setTitle('Bachelorarbeitskonzept ' + KT.vorlage.id);
      pdf.setSubject(KT.vorlage.titel);
      pdf.setCreator('eBAK Konzept-Tool');
      pdf.setProducer('eBAK Konzept-Tool ' + KT.modell.TOOL_VERSION);
      pdf.setCreationDate(jetzt);
      pdf.setModificationDate(jetzt);
      pdf.setLanguage('de-CH');
      // Base64 enthält keine Sonderzeichen und kann als einfacher PDF-String gespeichert werden
      pdf.getInfoDict().set(L.PDFName.of('Keywords'), L.PDFString.of(r[1]));
      return pdf.attach(json, ANHANG, {
        mimeType: 'application/json',
        description: 'Formulardaten des eBAK Konzept-Tools. Ermöglicht das erneute Öffnen im Tool.',
        creationDate: jetzt,
        modificationDate: jetzt
      }).then(function () { return pdf.save(); });
    });
  }

  function herunterladen(bytes, dateiname) {
    var blob = new Blob([bytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  KT.pdf = {
    ANHANG: ANHANG,
    ERSATZ_PRAEFIX: ERSATZ_PRAEFIX,
    erstellen: erstellen,
    herunterladen: herunterladen,
    dokument: dokument,
    datenEinbetten: datenEinbetten,
    umwandeln: umwandeln
  };
})(window.KT = window.KT || {});
