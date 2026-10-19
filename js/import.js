/*
 * Import von Dateien:
 *  - PDF aus dem Konzept-Tool: liest den eingebetteten JSON-Anhang.
 *  - Word-Datei der alten Vorlage (Übergangsphase): liest die Inhaltssteuerelemente über ihre Tags.
 * Dateieigenschaften (Autor, zuletzt geändert von) werden nie übernommen.
 */
(function (KT) {
  'use strict';

  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';

  function ImportFehler(text) {
    var e = new Error(text);
    e.importFehler = true;
    return e;
  }

  function dateiLesen(datei) {
    if (datei.arrayBuffer) return datei.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(datei);
    });
  }

  function art(bytes) {
    var b = new Uint8Array(bytes.slice(0, 5));
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
    if (b[0] === 0x50 && b[1] === 0x4b) return 'docx';
    return null;
  }

  // ---------- PDF ----------

  function pdfLaden(bytes) {
    return window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
  }

  function anhaengeLesen(bytes) {
    return pdfLaden(bytes).then(anhaengeAus);
  }

  // Ersatzkopie aus dem Feld «Stichwörter» (siehe pdf-export.js)
  function ersatzAus(pdf) {
    var kw = '';
    try { kw = pdf.getKeywords() || ''; } catch (e) { return Promise.resolve(null); }
    var i = kw.indexOf(KT.pdf.ERSATZ_PRAEFIX);
    if (i < 0) return Promise.resolve(null);
    var m = kw.slice(i + KT.pdf.ERSATZ_PRAEFIX.length).match(/^(gz|raw):([A-Za-z0-9+/=]+)/);
    if (!m) return Promise.resolve(null);
    var bin = atob(m[2]);
    var bytes = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    if (m[1] === 'raw') return Promise.resolve(bytes);
    if (!window.DecompressionStream) return Promise.reject(ImportFehler('Dieser Browser kann die Ersatzkopie der Daten nicht lesen. Bitte einen aktuellen Browser verwenden.'));
    return KT.pdf.umwandeln(bytes, new DecompressionStream('gzip'));
  }

  function anhaengeAus(pdf) {
    var L = window.PDFLib;
    var gefunden = [];
    var names = pdf.catalog.lookupMaybe(L.PDFName.of('Names'), L.PDFDict);
    var ef = names && names.lookupMaybe(L.PDFName.of('EmbeddedFiles'), L.PDFDict);
    (function durchlaufen(knoten, tiefe) {
      if (!knoten || tiefe > 10) return;
      var arr = knoten.lookupMaybe(L.PDFName.of('Names'), L.PDFArray);
      if (arr) {
        for (var i = 0; i + 1 < arr.size(); i += 2) {
          var name = arr.lookup(i);
          var spec = arr.lookup(i + 1);
          if (spec instanceof L.PDFDict) gefunden.push({ name: name && name.decodeText ? name.decodeText() : '', spec: spec });
        }
      }
      var kinder = knoten.lookupMaybe(L.PDFName.of('Kids'), L.PDFArray);
      if (kinder) for (var k = 0; k < kinder.size(); k++) durchlaufen(kinder.lookup(k), tiefe + 1);
    })(ef, 0);
    return gefunden.map(function (g) {
      try {
        var efDict = g.spec.lookupMaybe(L.PDFName.of('EF'), L.PDFDict);
        var stream = efDict && (efDict.lookup(L.PDFName.of('F')) || efDict.lookup(L.PDFName.of('UF')));
        return stream ? { name: g.name, daten: L.decodePDFRawStream(stream).decode() } : null;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }

  function pdfImport(bytes) {
    var beschaedigt = 'Die PDF-Datei konnte nicht gelesen werden. Sie ist möglicherweise beschädigt.';
    return pdfLaden(bytes).catch(function () {
      throw ImportFehler(beschaedigt);
    }).then(function (pdf) {
      var anhaenge;
      try {
        anhaenge = anhaengeAus(pdf);
      } catch (e) {
        throw ImportFehler(beschaedigt);
      }
      var a = anhaenge.filter(function (x) { return x.name === KT.pdf.ANHANG; })[0];
      if (a) return { json: a.daten, ersatz: false };
      return ersatzAus(pdf).then(function (json) {
        if (!json) {
          throw ImportFehler('Diese PDF enthält keine Formulardaten des Konzept-Tools. ' +
            'Wird eine PDF z.B. über «Drucken als PDF» neu erstellt, gehen die Daten verloren. ' +
            'Bitte verwenden Sie die Originaldatei aus dem Tool.');
        }
        return { json: json, ersatz: true };
      });
    }).then(function (r) {
      var roh;
      try {
        roh = JSON.parse(new TextDecoder('utf-8').decode(r.json));
      } catch (e) {
        throw ImportFehler('Die Formulardaten in der PDF sind beschädigt.');
      }
      var ergebnis = KT.modell.normalisieren(roh);
      if (r.ersatz) {
        ergebnis.hinweise.unshift('Diese PDF wurde in einem anderen Programm neu gespeichert. Die Formulardaten wurden aus der Ersatzkopie wiederhergestellt. Bitte prüfen Sie die Inhalte.');
      }
      return ergebnis;
    });
  }

  // ---------- Word ----------

  function kinder(knoten, ns, name) {
    var r = [];
    for (var c = knoten.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && c.namespaceURI === ns && c.localName === name) r.push(c);
    }
    return r;
  }

  function kind(knoten, ns, name) {
    return kinder(knoten, ns, name)[0] || null;
  }

  function wVal(knoten) {
    return knoten ? knoten.getAttributeNS(W, 'val') : null;
  }

  function schalter(rPr, name) {
    var k = rPr && kind(rPr, W, name);
    if (!k) return false;
    var v = wVal(k);
    if (name === 'u') return v !== 'none';
    return v === null || v === '' || ['0', 'false', 'off'].indexOf(v) < 0;
  }

  function nummerierungLesen(xml) {
    var formate = {};
    if (!xml) return formate;
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var abstrakt = {};
    Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, 'abstractNum'), function (an) {
      var ebenen = {};
      kinder(an, W, 'lvl').forEach(function (lvl) {
        ebenen[lvl.getAttributeNS(W, 'ilvl')] = wVal(kind(lvl, W, 'numFmt')) || 'bullet';
      });
      abstrakt[an.getAttributeNS(W, 'abstractNumId')] = ebenen;
    });
    Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, 'num'), function (num) {
      formate[num.getAttributeNS(W, 'numId')] = abstrakt[wVal(kind(num, W, 'abstractNumId'))] || {};
    });
    return formate;
  }

  // Wandelt einen Absatz in Delta-Operationen um (Text mit Inline-Format, danach Zeilenumbruch mit Blockformat).
  function absatzZuOps(p, nummern) {
    var ops = [];
    function text(t, rPr) {
      if (!t) return;
      var a = {};
      if (schalter(rPr, 'b')) a.bold = true;
      if (schalter(rPr, 'i')) a.italic = true;
      if (schalter(rPr, 'u')) a.underline = true;
      ops.push(Object.keys(a).length ? { insert: t, attributes: a } : { insert: t });
    }
    (function durchlaufen(k) {
      for (var c = k.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        if (c.namespaceURI === W && (c.localName === 'del' || c.localName === 'pPr' || c.localName === 'instrText' || c.localName === 'moveFrom')) continue;
        if (c.namespaceURI === W && c.localName === 'r') {
          var rPr = kind(c, W, 'rPr');
          for (var t = c.firstChild; t; t = t.nextSibling) {
            if (t.nodeType !== 1 || t.namespaceURI !== W) continue;
            if (t.localName === 't') text(t.textContent, rPr);
            else if (t.localName === 'tab') text('\t', rPr);
            else if (t.localName === 'br' || t.localName === 'cr') ops.push({ insert: '\n' });
          }
          continue;
        }
        durchlaufen(c);
      }
    })(p);

    var block = {};
    var pPr = kind(p, W, 'pPr');
    if (pPr) {
      var numPr = kind(pPr, W, 'numPr');
      var numId = numPr && wVal(kind(numPr, W, 'numId'));
      if (numId && numId !== '0') {
        var ebene = parseInt(wVal(kind(numPr, W, 'ilvl')) || '0', 10);
        var fmt = (nummern[numId] || {})[String(ebene)] || 'bullet';
        block.list = fmt === 'bullet' || fmt === 'none' ? 'bullet' : 'ordered';
        if (ebene > 0) block.indent = ebene;
      }
      var stil = wVal(kind(pPr, W, 'pStyle')) || '';
      if (/^(heading|berschrift|überschrift)\s?\d/i.test(stil)) block.header = 3;
    }
    ops.push(Object.keys(block).length ? { insert: '\n', attributes: block } : { insert: '\n' });
    return ops;
  }

  function istPlatzhalter(sdtPr, text) {
    if (sdtPr && kind(sdtPr, W, 'showingPlcHdr')) return true;
    var t = text.trim();
    return /^(STUD|eBAK)\s*:/.test(t) || t === KT.vorlage.bemerkungen.platzhalter;
  }

  function sdtInhalt(sdt, nummern) {
    var inhalt = kind(sdt, W, 'sdtContent');
    if (!inhalt) return KT.delta.leer();
    var absaetze = Array.prototype.slice.call(inhalt.getElementsByTagNameNS(W, 'p'));
    var ops = [];
    if (absaetze.length) absaetze.forEach(function (p) { ops = ops.concat(absatzZuOps(p, nummern)); });
    else ops = absatzZuOps(inhalt, nummern);
    var delta = { ops: ops };
    if (istPlatzhalter(kind(sdt, W, 'sdtPr'), KT.delta.text(delta))) return KT.delta.leer();
    return trimmen(delta);
  }

  // Entfernt leere Zeilen am Anfang und Ende
  function trimmen(delta) {
    var ops = delta.ops.slice();
    while (ops.length && ops[0].insert === '\n' && !ops[0].attributes) ops.shift();
    return KT.delta.bereinigen({ ops: ops.length ? ops : [{ insert: '\n' }] });
  }

  function absatzText(p) {
    var s = '';
    Array.prototype.forEach.call(p.getElementsByTagNameNS(W, 't'), function (t) { s += t.textContent; });
    return s;
  }

  /*
   * Rückfall für beschädigte Dateien: Steht der Text ausserhalb des Formularfelds (Feld gelöscht
   * oder neben dem Platzhalter getippt), wird die Tabellenzeile unter der Titelzeile gelesen.
   */
  function zelleLesen(doc, anker, nummern) {
    if (!anker) return null;
    var tabelle = doc.getElementsByTagNameNS(W, 'tbl')[0];
    if (!tabelle) return null;
    var zeilen = kinder(tabelle, W, 'tr');
    for (var i = 0; i + 1 < zeilen.length; i++) {
      var zellen = kinder(zeilen[i], W, 'tc');
      if (zellen.length !== 1) continue;
      var t = absatzText(zellen[0]).trim().replace(/^\d+\.?\s*/, '');
      if (t.indexOf(anker) !== 0) continue;
      var ziel = kinder(zeilen[i + 1], W, 'tc');
      if (ziel.length !== 1) return null;
      var kopie = ziel[0].cloneNode(true);
      Array.prototype.slice.call(kopie.getElementsByTagNameNS(W, 'sdt')).forEach(function (sdt) {
        if (sdt.parentNode && istPlatzhalter(kind(sdt, W, 'sdtPr'), absatzText(sdt))) sdt.parentNode.removeChild(sdt);
      });
      var ops = [];
      Array.prototype.forEach.call(kopie.getElementsByTagNameNS(W, 'p'), function (p) { ops = ops.concat(absatzZuOps(p, nummern)); });
      return ops.length ? trimmen({ ops: ops }) : null;
    }
    return null;
  }

  function wordLesen(bytes) {
    if (!window.JSZip) throw ImportFehler('Der Word-Import ist nicht verfügbar.');
    return window.JSZip.loadAsync(bytes).catch(function () {
      throw ImportFehler('Die Word-Datei konnte nicht geöffnet werden. Sie ist möglicherweise beschädigt.');
    }).then(function (zip) {
      var docDatei = zip.file('word/document.xml');
      if (!docDatei) throw ImportFehler('Die Datei ist keine gültige Word-Datei (.docx).');
      var numDatei = zip.file('word/numbering.xml');
      return Promise.all([docDatei.async('string'), numDatei ? numDatei.async('string') : Promise.resolve(null)]);
    }).then(function (xml) {
      var doc = new DOMParser().parseFromString(xml[0], 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw ImportFehler('Der Inhalt der Word-Datei ist beschädigt und kann nicht gelesen werden.');
      var nummern = nummerierungLesen(xml[1]);
      var felder = {};
      var checkboxen = [];
      Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, 'sdt'), function (sdt) {
        var pr = kind(sdt, W, 'sdtPr');
        if (!pr) return;
        var cb = pr.getElementsByTagNameNS(W14, 'checkbox')[0];
        if (cb) {
          var checked = cb.getElementsByTagNameNS(W14, 'checked')[0];
          var p = sdt.parentNode;
          while (p && !(p.namespaceURI === W && p.localName === 'p')) p = p.parentNode;
          checkboxen.push({ an: !!checked && ['1', 'true'].indexOf(checked.getAttributeNS(W14, 'val')) >= 0, label: p ? absatzText(p) : '' });
          return;
        }
        var tag = wVal(kind(pr, W, 'tag'));
        if (!tag) return;
        var delta = sdtInhalt(sdt, nummern);
        if (!felder[tag] || (KT.delta.istLeer(felder[tag]) && !KT.delta.istLeer(delta))) felder[tag] = delta;
      });
      return { felder: felder, checkboxen: checkboxen, doc: doc, nummern: nummern };
    });
  }

  function zeitplanAusWord(zeitpunkte, schritte) {
    var linksZeilen = KT.delta.text(zeitpunkte).split('\n');
    var rechtsZeilen = KT.delta.text(schritte).split('\n');
    var links = linksZeilen.map(function (s) { return s.trim(); }).filter(Boolean);
    var rechts = rechtsZeilen.map(function (s) { return s.trim(); }).filter(Boolean);
    if (!links.length && !rechts.length) return { zeilen: [{ zeitpunkt: '', schritt: '' }], gepaart: true };
    if (links.length === rechts.length) {
      return { zeilen: links.map(function (l, i) { return { zeitpunkt: l, schritt: rechts[i] }; }), gepaart: true };
    }
    // Nicht eindeutig zuordenbar: als ein Block übernehmen, damit nichts verloren geht
    function kuerzen(z) {
      while (z.length && !z[0].trim()) z.shift();
      while (z.length && !z[z.length - 1].trim()) z.pop();
      return z.join('\n');
    }
    return { zeilen: [{ zeitpunkt: kuerzen(linksZeilen), schritt: kuerzen(rechtsZeilen) }], gepaart: false };
  }

  function wordImport(bytes, rolle) {
    return wordLesen(bytes).then(function (w) {
      var v = KT.vorlage;
      var f = w.felder;
      var bekannt = Object.keys(f).length;
      if (!f[v.abschnitte[0].wordTag] && !f[v.allgemein.felder[0].wordTag]) {
        throw ImportFehler('In dieser Word-Datei wurden keine Felder der Konzeptvorlage gefunden' + (bekannt ? '' : ' (keine Formularfelder vorhanden)') + '.');
      }
      var hinweise = ['Die Word-Datei wurde übernommen. Bitte prüfen Sie alle Abschnitte, insbesondere Formatierungen und Listen.'];
      var d = KT.modell.neu();
      var s = d.studierende;

      v.allgemein.felder.forEach(function (feld) {
        s[feld.id] = f[feld.wordTag] ? KT.delta.text(f[feld.wordTag]).replace(/\s+/g, ' ').trim() : '';
      });
      v.abschnitte.forEach(function (a) {
        if (a.typ === 'zeitplan') {
          var zp = zeitplanAusWord(f[a.wordTagZeitpunkte], f[a.wordTagSchritte]);
          s.zeitplan = zp.zeilen;
          if (!zp.gepaart) hinweise.push('Der Zeitplan liess sich nicht eindeutig in Zeilen aufteilen und wurde als ein Block übernommen. Bitte teilen Sie ihn in einzelne Zeilen auf.');
          return;
        }
        var delta = f[a.wordTag] || KT.delta.leer();
        if (KT.delta.istLeer(delta)) {
          var ausZelle = zelleLesen(w.doc, a.wordAnker, w.nummern);
          if (ausZelle && !KT.delta.istLeer(ausZelle)) {
            delta = ausZelle;
            hinweise.push('Der Abschnitt «' + KT.formular.abschnittLabel(a) + '» stand in der Word-Datei ausserhalb des Formularfelds und wurde aus der Tabelle übernommen. Bitte prüfen.');
          }
        }
        (a.wordTagsAlt || []).forEach(function (alt) {
          if (f[alt.tag] && !KT.delta.istLeer(f[alt.tag])) {
            var ops = delta.ops.concat([{ insert: alt.titel }, { insert: '\n', attributes: { header: 3 } }], f[alt.tag].ops);
            delta = KT.delta.bereinigen({ ops: ops });
          }
        });
        s[a.feld] = delta;
      });

      var e = KT.modell.leereEbak();
      v.rueckmeldeFelder().forEach(function (rf) { if (f[rf.wordTag]) e[rf.id] = f[rf.wordTag]; });
      if (f[v.bemerkungen.wordTag]) e.bemerkungen = f[v.bemerkungen.wordTag];
      if (f[v.ortDatum.wordTag]) e.ortDatum = KT.delta.text(f[v.ortDatum.wordTag]).trim();
      Object.keys(v.auswahlen).forEach(function (key) {
        v.auswahlen[key].optionen.forEach(function (o) {
          var cb = w.checkboxen.filter(function (c) { return c.label.indexOf(o.wordText) >= 0; })[0];
          if (cb && cb.an && !e[key]) e[key] = o.wert;
        });
      });

      var hatRueckmeldung = KT.modell.ebakHatInhalt(e);
      if (rolle === 'stud') {
        if (hatRueckmeldung) {
          d.verlauf.push({ versuch: 1, ebak: e, abgeschlossen: null, quelle: 'word' });
          d.versuch = 2;
          hinweise.push('Die Rückmeldungen der eBAK aus der Word-Datei sind bei jedem Abschnitt sichtbar.');
        }
        d.status = 'entwurf';
      } else {
        d.ebak = e;
        d.status = 'in-beurteilung';
      }
      return { daten: d, hinweise: hinweise };
    });
  }

  /*
   * Liest eine Datei und bereitet sie für die Rolle vor.
   * Rückgabe: Promise<{ daten, hinweise, quelle: 'pdf' | 'docx' }>
   */
  function datei(file, rolle) {
    return dateiLesen(file).then(function (bytes) {
      var typ = art(bytes);
      if (typ === 'pdf') {
        return pdfImport(bytes).then(function (r) {
          if (rolle !== 'stud' && !(KT.ebak && KT.ebak.oeffnen)) throw ImportFehler('Diese Ansicht kann keine Beurteilung öffnen.');
          var weitere = rolle === 'stud' ? KT.modell.fuerStudierendeOeffnen(r.daten) : KT.ebak.oeffnen(r.daten);
          return { daten: r.daten, hinweise: r.hinweise.concat(weitere), quelle: 'pdf' };
        });
      }
      if (typ === 'docx') {
        return wordImport(bytes, rolle).then(function (r) {
          return { daten: r.daten, hinweise: r.hinweise, quelle: 'docx' };
        });
      }
      if (/\.doc$/i.test(file.name)) throw ImportFehler('Alte Word-Dateien (.doc) werden nicht unterstützt. Bitte in Word als .docx speichern.');
      throw ImportFehler('Dieser Dateityp wird nicht unterstützt. Bitte eine PDF aus dem Konzept-Tool oder eine Word-Datei (.docx) der Konzeptvorlage wählen.');
    });
  }

  KT.import = { datei: datei, pdfImport: pdfImport, anhaengeLesen: anhaengeLesen, wordLesen: wordLesen, zeitplanAusWord: zeitplanAusWord };
})(window.KT = window.KT || {});
