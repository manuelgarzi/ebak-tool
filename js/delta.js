/*
 * Hilfsfunktionen für Langtexte im Quill-Delta-Format ({ ops: [...] }).
 * Erlaubt sind nur: fett, kursiv, unterstrichen, Zwischentitel, Listen (mit Einzug).
 */
(function (KT) {
  'use strict';

  var MAX_EINZUG = 4;

  function leer() {
    return { ops: [{ insert: '\n' }] };
  }

  function inlineAttribute(a) {
    var r = {};
    if (!a) return r;
    if (a.bold === true) r.bold = true;
    if (a.italic === true) r.italic = true;
    if (a.underline === true) r.underline = true;
    return r;
  }

  function blockAttribute(a) {
    var r = {};
    if (!a) return r;
    if (a.list === 'ordered' || a.list === 'bullet') r.list = a.list;
    if (a.header) r.header = 3;
    var einzug = parseInt(a.indent, 10);
    if (einzug > 0) r.indent = Math.min(einzug, MAX_EINZUG);
    return r;
  }

  // Bereinigt ein Delta aus unsicherer Quelle (Import) auf die erlaubten Formate.
  function bereinigen(roh) {
    if (!roh || !Array.isArray(roh.ops)) return leer();
    var ops = [];
    roh.ops.forEach(function (op) {
      if (!op || typeof op.insert !== 'string' || op.insert === '') return;
      var text = op.insert.replace(/\r\n?/g, '\n');
      var attr = op.insert.indexOf('\n') >= 0 && text.replace(/\n/g, '') === ''
        ? blockAttribute(op.attributes)
        : inlineAttribute(op.attributes);
      var neu = { insert: text };
      if (Object.keys(attr).length) neu.attributes = attr;
      ops.push(neu);
    });
    if (!ops.length) return leer();
    var letzte = ops[ops.length - 1];
    if (letzte.insert.charAt(letzte.insert.length - 1) !== '\n') ops.push({ insert: '\n' });
    return { ops: ops };
  }

  // Zerlegt ein Delta in Zeilen mit Inline-Abschnitten und Blockformat.
  function zeilen(delta) {
    var ergebnis = [];
    var runs = [];
    var ops = (delta && delta.ops) || [];
    ops.forEach(function (op) {
      if (typeof op.insert !== 'string') return;
      var teile = op.insert.split('\n');
      var inline = inlineAttribute(op.attributes);
      teile.forEach(function (teil, i) {
        if (teil) runs.push({ text: teil, bold: !!inline.bold, italic: !!inline.italic, underline: !!inline.underline });
        if (i < teile.length - 1) {
          ergebnis.push({ runs: runs, block: blockAttribute(op.attributes) });
          runs = [];
        }
      });
    });
    if (runs.length) ergebnis.push({ runs: runs, block: {} });
    while (ergebnis.length && !ergebnis[ergebnis.length - 1].runs.length && !ergebnis[ergebnis.length - 1].block.list) ergebnis.pop();
    return ergebnis;
  }

  /*
   * Gruppiert Zeilen in Blöcke:
   *   { typ: 'absatz' | 'titel', runs }
   *   { typ: 'liste', art: 'ordered' | 'bullet', eintraege: [ { runs } | liste ] }
   */
  function bloecke(delta) {
    var z = zeilen(delta);
    var out = [];
    var i = 0;
    while (i < z.length) {
      if (z[i].block.list) {
        var r = liste(z, i, z[i].block.indent || 0);
        out.push(r.knoten);
        i = r.weiter;
      } else {
        out.push({ typ: z[i].block.header ? 'titel' : 'absatz', runs: z[i].runs });
        i++;
      }
    }
    return out;
  }

  function liste(z, start, ebene) {
    var art = z[start].block.list;
    var eintraege = [];
    var i = start;
    while (i < z.length && z[i].block.list) {
      var einzug = z[i].block.indent || 0;
      if (einzug < ebene) break;
      if (einzug > ebene) {
        var r = liste(z, i, einzug);
        eintraege.push(r.knoten);
        i = r.weiter;
        continue;
      }
      if (z[i].block.list !== art) break;
      eintraege.push({ runs: z[i].runs });
      i++;
    }
    return { knoten: { typ: 'liste', art: art, eintraege: eintraege }, weiter: i };
  }

  function text(delta) {
    return zeilen(delta).map(function (z) {
      return z.runs.map(function (r) { return r.text; }).join('');
    }).join('\n');
  }

  // Zeichen inkl. Leerzeichen, ohne Zeilenumbrüche
  function zeichen(delta) {
    return text(delta).replace(/\n/g, '').length;
  }

  function istLeer(delta) {
    return text(delta).trim() === '';
  }

  // Delta aus reinem Text (z.B. für Fallbacks)
  function ausText(s) {
    s = String(s || '').replace(/\r\n?/g, '\n');
    if (!s) return leer();
    return { ops: [{ insert: s.charAt(s.length - 1) === '\n' ? s : s + '\n' }] };
  }

  // Schreibgeschützte Darstellung als DOM (ohne innerHTML)
  function zuDom(delta) {
    var frag = document.createDocumentFragment();
    var bl = bloecke(delta);
    if (!bl.length || istLeer(delta)) {
      var p = document.createElement('p');
      p.className = 'leer-hinweis';
      p.textContent = 'Keine Angaben';
      frag.appendChild(p);
      return frag;
    }
    bl.forEach(function (b) { frag.appendChild(blockZuDom(b)); });
    return frag;
  }

  function runsZuDom(runs, ziel) {
    runs.forEach(function (r) {
      var knoten = document.createTextNode(r.text);
      if (r.underline) { var u = document.createElement('u'); u.appendChild(knoten); knoten = u; }
      if (r.italic) { var em = document.createElement('em'); em.appendChild(knoten); knoten = em; }
      if (r.bold) { var st = document.createElement('strong'); st.appendChild(knoten); knoten = st; }
      ziel.appendChild(knoten);
    });
    if (!runs.length) ziel.appendChild(document.createElement('br'));
    return ziel;
  }

  function blockZuDom(b) {
    if (b.typ === 'liste') {
      var l = document.createElement(b.art === 'ordered' ? 'ol' : 'ul');
      b.eintraege.forEach(function (e) {
        if (e.typ === 'liste') {
          var letzter = l.lastElementChild || l.appendChild(document.createElement('li'));
          letzter.appendChild(blockZuDom(e));
        } else {
          l.appendChild(runsZuDom(e.runs, document.createElement('li')));
        }
      });
      return l;
    }
    return runsZuDom(b.runs, document.createElement(b.typ === 'titel' ? 'h4' : 'p'));
  }

  KT.delta = {
    leer: leer,
    bereinigen: bereinigen,
    zeilen: zeilen,
    bloecke: bloecke,
    text: text,
    zeichen: zeichen,
    istLeer: istLeer,
    ausText: ausText,
    zuDom: zuDom
  };
})(window.KT = window.KT || {});
