/*
 * Texteditor auf Basis von Quill mit eingeschränkten Formaten.
 * Beim Einfügen aus Word bleiben fett, kursiv, unterstrichen, Listen und Titel erhalten,
 * alles andere (Farben, Schriften, Bilder, Links, Tabellen) wird entfernt.
 */
(function (KT) {
  'use strict';

  var FORMATE = ['bold', 'italic', 'underline', 'header', 'list', 'indent'];

  var KNOEPFE = [
    [['ql-bold', null, 'Fett (Ctrl/Cmd+B)'], ['ql-italic', null, 'Kursiv (Ctrl/Cmd+I)'], ['ql-underline', null, 'Unterstrichen (Ctrl/Cmd+U)']],
    [['ql-header', '3', 'Zwischentitel']],
    [['ql-list', 'bullet', 'Aufzählung'], ['ql-list', 'ordered', 'Nummerierte Liste'], ['ql-indent', '-1', 'Einzug verkleinern'], ['ql-indent', '+1', 'Einzug vergrössern']],
    [['ql-clean', null, 'Formatierung entfernen']]
  ];

  function werkzeugleiste() {
    var leiste = document.createElement('div');
    KNOEPFE.forEach(function (gruppe) {
      var span = document.createElement('span');
      span.className = 'ql-formats';
      gruppe.forEach(function (k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = k[0];
        if (k[1]) b.value = k[1];
        b.title = k[2];
        b.setAttribute('aria-label', k[2]);
        span.appendChild(b);
      });
      leiste.appendChild(span);
    });
    return leiste;
  }

  /*
   * optionen: { delta, label, platzhalter, beiAenderung(delta) }
   * Rückgabe: { element, quill, zeichen() }
   */
  function erstellen(optionen) {
    var huelle = document.createElement('div');
    huelle.className = 'editor';
    var leiste = werkzeugleiste();
    var flaeche = document.createElement('div');
    huelle.appendChild(leiste);
    huelle.appendChild(flaeche);

    var quill = new window.Quill(flaeche, {
      theme: 'snow',
      formats: FORMATE,
      placeholder: optionen.platzhalter || '',
      modules: {
        toolbar: leiste,
        clipboard: {},
        history: { delay: 800, maxStack: 200, userOnly: true }
      }
    });

    // Alle Titelebenen beim Einfügen auf den einen erlaubten Zwischentitel abbilden
    quill.clipboard.addMatcher(Node.ELEMENT_NODE, function (node, delta) {
      delta.ops.forEach(function (op) {
        if (op.attributes && op.attributes.header) op.attributes.header = 3;
      });
      return delta;
    });

    quill.setContents(KT.delta.bereinigen(optionen.delta), 'silent');
    quill.history.clear();
    quill.root.setAttribute('aria-label', optionen.label || 'Textfeld');
    quill.root.setAttribute('spellcheck', 'true');
    quill.root.setAttribute('lang', 'de-CH');

    quill.on('text-change', function () {
      if (optionen.beiAenderung) optionen.beiAenderung({ ops: JSON.parse(JSON.stringify(quill.getContents().ops)) });
    });

    return {
      element: huelle,
      quill: quill,
      zeichen: function () { return Math.max(0, quill.getText().replace(/\n/g, '').length); }
    };
  }

  KT.editor = { erstellen: erstellen, FORMATE: FORMATE };
})(window.KT = window.KT || {});
