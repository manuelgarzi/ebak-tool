/*
 * Konzeptvorlage als Konfiguration.
 * Für einen neuen Jahrgang oder geänderte Kriterien muss nur diese Datei angepasst werden.
 * Feld-IDs (feld, rueckmeldung) nicht umbenennen: sie sind in bereits exportierten PDFs gespeichert.
 */
(function (KT) {
  'use strict';

  KT.vorlage = {
    id: 'KGPS-BA-26',
    titel: 'Bachelorarbeitskonzept und Kriterienraster eBAK',
    studiengang: 'Studiengang Kindergarten- und Primarstufe',
    stand: 'BAK, 1. November 2025',
    einleitung:
      'Dieses Formular dient der Beurteilung der Bachelorarbeits-Konzepte durch die eBAK. ' +
      'Die weissen Bereiche beinhalten die Inhalte des Bachelorarbeitskonzeptes und werden durch die Studierenden (STUD) ausgefüllt. ' +
      'Die grauen Bereiche beinhalten die Rückmeldungen entlang der Kriterien zum Inhalt des Bachelorarbeitskonzeptes und werden von der eBAK (eBAK) ausgefüllt. ' +
      'Die Beurteilung wird anonym durchgeführt.',

    institute: [
      'Institut Bewegung, Sport & Gesundheit',
      'Institut Digitale und Informatische Bildung',
      'Institut Frühe Bildung 0 bis 8',
      'Institut Gesellschaftswissenschaftliche Bildung',
      'Institut Kulturelle und Ästhetische Bildung',
      'Institut Mathematisch-Naturwissenschaftliche & Technische Bildung',
      'Institut Pädagogische Psychologie',
      'Institut Schule und Profession',
      'Institut Sprachliche Bildung'
    ],
    studienbereiche: [
      'Erziehungswissenschaften',
      'GMBS Bewegung und Sport',
      'GMBS Gestalten',
      'GMBS Musik',
      'Mathematik',
      'NMG',
      'Sprachen'
    ],
    typen: [
      'Literaturarbeit',
      'Produkt-/prozessorientierte Arbeit',
      'Empirische Arbeit (qualitativ)',
      'Empirische Arbeit (quantitativ)'
    ],

    // Richtwert «4 bis 6 Seiten (ohne Titelblatt und Literaturverzeichnis)». Umrechnung durch die BAK zu bestätigen.
    umfang: {
      zeichenProSeite: 3000,
      minSeiten: 4,
      maxSeiten: 6,
      felder: ['einfuehrung', 'theorie', 'fragestellung', 'methode', 'zeitplan', 'inhaltsverzeichnis']
    },

    allgemein: {
      titel: 'Allgemeine Angaben zur Bachelorarbeit',
      felder: [
        { id: 'arbeitstitel', label: 'Arbeitstitel der Bachelorarbeit', typ: 'text', wordTag: 'Arbeitstitel der Bachelorarbeit' },
        { id: 'institut', label: 'Institut', typ: 'auswahl', optionen: 'institute', wordTag: 'Institut' },
        { id: 'studienbereich', label: 'Studienbereich', typ: 'auswahl', optionen: 'studienbereiche', wordTag: 'Studienbereich' },
        { id: 'typ', label: 'Typ der Bachelorarbeit', typ: 'auswahl', optionen: 'typen', wordTag: 'Typ der Bacheloarbeit' }
      ]
    },

    abschnitte: [
      {
        id: 'einfuehrung',
        nr: '1',
        titel: 'Einführung',
        untertitel: 'Beantwortung der untenstehenden Fragen',
        leitfragen: [
          'Worum geht es? Was ist das Problem? (Problemlage)',
          'Was ist (mir) unbekannt? Was ist noch nicht da? Was fehlt? (Wissenslücke)',
          'Was wäre infolgedessen wünschenswert? Was sollte es geben? (Desiderat)',
          'Was soll diese Arbeit erreichen? Welches Ziel wird konkret verfolgt? Welches Produkt/welche Produkte ist/sind möglich und vorstellbar? (Ziel)'
        ],
        feld: 'einfuehrung',
        rueckmeldung: 'rm_einfuehrung',
        kriterien: [
          'Die Wahl des Themas ist begründet.',
          'Das gewählte Thema ist für den Lehrberuf relevant.',
          'Die Problemlage wird nachvollziehbar beschrieben.',
          'Bezüge zum aktuellen Forschungs- oder Diskussionsstand werden aufgezeigt.',
          'Eigene Sichtweisen und Meinungen werden angezweifelt.',
          'Es ist erkennbar, worin der erwünschte (subjektive) Ertrag der Bachelorarbeit liegen könnte.',
          'Es ist ersichtlich, welche(s) Ziel(e) erreicht werden soll(en).'
        ],
        wordTag: 'Abschnitt 1 Einführung',
        wordAnker: 'Einführung (Beantwortung',
        // wordAnker: Text der Titelzeile in der Word-Tabelle. Fehlt das Formularfeld, wird die Zeile darunter gelesen.
        // Ältere Vorlage (KGPS-BA-24) mit unterteilter Einführung
        wordTagsAlt: [
          { tag: 'Abschnitt 1.2 Wissenslücke', titel: '1.2 Wissenslücke' },
          { tag: 'Abschnitt 1.3 Desiderat', titel: '1.3 Desiderat' },
          { tag: 'Abschnitt 1.4 Zielsetzung', titel: '1.4 Zielsetzung' },
          { tag: 'Abschnitt 1.5 Forschungsleitende Fragestellung', titel: '1.5 Forschungsleitende Fragestellung' }
        ],
        wordTagRueckmeldung: 'Rückmeldungen Abschnitt 1 Einführung'
      },
      {
        id: 'theorie',
        nr: '2',
        titel: 'Theoretische Verortung',
        feld: 'theorie',
        rueckmeldung: 'rm_theorie',
        kriterien: [
          'Theoretische Bezüge werden dargelegt.',
          'Hinweise zum aktuellen Forschungs- oder Diskussionsstand werden aufgezeigt.'
        ],
        wordTag: 'Abschnitt 2 Theoretische Verortung',
        wordAnker: 'Theoretische Verortung',
        wordTagRueckmeldung: 'Rückmeldungen Abschnitt 2 Theoretische Verortung'
      },
      {
        id: 'fragestellung',
        nr: '3',
        titel: 'Fragestellung und Vermutungen',
        leitfragen: [
          '3.1 Forschungsleitende Fragestellung',
          '3.2 Konkrete Fragestellung(en), Unterfrage(n)',
          '3.3 Hypothese(n) oder These(n) oder forschungsleitende Annahme(n) zu 3.2'
        ],
        leitfragenNummeriert: true,
        feld: 'fragestellung',
        rueckmeldung: 'rm_fragestellung',
        kriterien: [
          'Eine nachvollziehbare forschungsleitende Fragestellung liegt vor.',
          'Abgeleitet von einer ersten forschungsleitenden Fragestellung werden weitere (Unter)Fragen, Hypothesen oder Thesen vorgelegt.'
        ],
        wordTag: 'Abschnitt 3 Fragestellung, Hypothese(n), These(n), forschungsleitende Annahmen',
        wordAnker: 'Fragestellung und Vermutungen',
        wordTagRueckmeldung: 'Rückmeldungen Abschnitt 3 Fragestellung, Hypothese(n), These(n), forschungsleitende Annahmen'
      },
      {
        id: 'methode',
        nr: '4',
        titel: 'Geplantes methodisches Vorgehen / Dokumentation des Prozesses',
        untertitel: 'inkl. forschungsethischer und urheberrechtlicher Aspekte',
        feld: 'methode',
        rueckmeldung: 'rm_methode',
        kriterien: [
          'Das vorgesehene methodische Vorgehen ist nachvollziehbar dargelegt.',
          { auswahl: 'datenschutz' },
          'Ethische Aspekte: Besonders beachtenswerte ethische Aspekte sind im geplanten Vorgehen berücksichtigt.',
          'Urheberrecht: Urheberrechtliche Aspekte sind berücksichtigt.',
          'Stichprobe: Max. 5 Schulklassen dürfen involviert sein.'
        ],
        wordTag: 'Abschnitt 4 Geplantes methodisches Vorgehen',
        wordAnker: 'Geplantes methodisches Vorgehen',
        wordTagRueckmeldung: 'Rückmeldungen Abschnitt 4 Geplantes methodischer Vorgehen'
      },
      {
        id: 'zeitplan',
        nr: '5',
        titel: 'Zeitplan',
        typ: 'zeitplan',
        hinweis: 'Name der Betreuungsperson nicht erwähnen!',
        spalten: ['Datum / KW', 'Arbeitsschritte / Meilensteine'],
        feld: 'zeitplan',
        rueckmeldung: 'rm_zeitplan',
        kriterien: ['Meilensteine sind dargelegt.'],
        wordTagZeitpunkte: 'Abschnitt 5 Zeitplan - Zeitpunkte',
        wordTagSchritte: 'Abschnitt 5 Zeitplan - Arbeitsschritte',
        wordTagRueckmeldung: 'Rückmeldungen Abschnitt 5 Zeitplan'
      },
      {
        id: 'inhaltsverzeichnis',
        nr: '6',
        titel: 'Provisorisches Inhaltsverzeichnis',
        feld: 'inhaltsverzeichnis',
        rueckmeldung: 'rm_inhaltsverzeichnis',
        kriterien: [
          'Gemäss Leitfaden liegen die folgenden Elemente* vor: 1. Einleitung, 2. Theorie, 3. Methode, 4. Ergebnisse, 5. Diskussion, 6. Fazit und Ausblick',
          { fussnote: '*Prozessorientierte Bachelorarbeiten: In begründeten Fällen kann die Reihenfolge verändert vorliegen.' }
        ],
        wordTag: 'Abschnitt 6 Provisorisches Inhaltsverzeichnis',
        wordAnker: 'Provisorisches Inhaltsverzeichnis',
        wordTagRueckmeldung: 'Rückmeldungen Abschnitt 6 Provisorisches Inhaltsverzeichnis'
      },
      {
        id: 'literatur',
        nr: '',
        titel: 'Literatur',
        hinweis: 'Zitation und Literaturverzeichnis gemäss Leitfaden PHSG nach APA oder MLA. Kursive Schrift ist hier möglich.',
        feld: 'literatur',
        rueckmeldung: 'rm_literatur',
        kriterien: ['Die Zitation und das Literaturverzeichnis entsprechen gemäss Leitfaden PHSG den Standards APA oder MLA.'],
        wordTag: 'Abschnitt Literatur',
        wordAnker: 'Literatur',
        wordTagRueckmeldung: 'Rückmeldungen Abschnitt Literatur'
      }
    ],

    // Blöcke, die nur die eBAK ausfüllt
    ebakBloecke: [
      {
        id: 'formales',
        titel: 'Formale Hinweise (Sprache, Zitation, Gliederung)',
        kriterien: ['Wortschatz, Satzbau, Zitation und Gliederung entsprechen Hochschulstandards.'],
        rueckmeldung: 'rm_formales',
        wordTagRueckmeldung: 'Rückmeldungen Abschnitt Formale Hinweise'
      },
      {
        id: 'umfang',
        titel: 'Vollständigkeit, Umfang',
        kriterien: [
          'Das Konzept hat den Umfang von 4-6 Seiten (ohne Titelblatt und Literaturverzeichnis).',
          { auswahl: 'vollstaendig' },
          { auswahl: 'umfangEingehalten' }
        ],
        rueckmeldung: 'rm_umfang',
        wordTagRueckmeldung: 'Rückmeldungen Abschnitt Vollständigkeit, Umfang'
      }
    ],

    // Gegenseitig ausschliessende Auswahlen (in der Word-Vorlage waren es lose Checkboxen)
    auswahlen: {
      datenschutz: {
        label: 'Datenschutz: Das Konzept …',
        optionen: [
          { wert: 'ja', text: '… erwähnt Aspekte des Datenschutzes', wordText: 'erwähnt Aspekte' },
          { wert: 'nein', text: '… erwähnt keine Aspekte des Datenschutzes', wordText: 'erwähnt keine' }
        ]
      },
      vollstaendig: {
        label: 'Vollständigkeit',
        optionen: [
          { wert: 'ja', text: 'Konzept vollständig vorliegend', wordText: 'Konzept vollständig' },
          { wert: 'nein', text: 'Konzept unvollständig vorliegend', wordText: 'Konzept unvollständig' }
        ]
      },
      umfangEingehalten: {
        label: 'Umfang',
        optionen: [
          { wert: 'ja', text: 'Max. Umfang eingehalten', wordText: 'Umfang eingehalten' },
          { wert: 'nein', text: 'Umfang nicht eingehalten', wordText: 'Umfang nicht eingehalten' }
        ]
      },
      entscheid: {
        label: 'Entscheid',
        optionen: [
          { wert: 'A', text: 'A: Angenommen', wordText: 'A: Angenommen' },
          { wert: 'B', text: 'B: Angenommen mit Änderungshinweisen', wordText: 'B: Angenommen mit' },
          { wert: 'C', text: 'C: Überarbeiten und nochmals einreichen', wordText: 'C: Überarbeiten' }
        ]
      }
    },

    bemerkungen: {
      titel: 'Abschliessende Bemerkungen eBAK',
      platzhalter: 'Ganze Sätze',
      wordTag: 'Abschliessende Bemerkungen eBAK'
    },
    ortDatum: { titel: 'Ort, Datum', wordTag: 'Ort und Datum' },

    quellen: [
      'Pädagogische Hochschule St. Gallen (2024). Leitfaden für das Erstellen einer Bachelorarbeit. Rorschach: Studiengang Kindergarten- und Primarstufe.',
      'Popper, K. (1959). The Logic of Scientific Discovery. London: Hutchinson.',
      'Roos, M. & Leutwyler, B. (2017). Wissenschaftliches Arbeiten im Lehramtsstudium. Recherchieren, schreiben, forschen. 2., überarbeitete Auflage. Bern: Hogrefe.'
    ]
  };

  // Alle Rückmeldefelder in Dokumentreihenfolge (für Verlauf, PDF und Word-Import)
  KT.vorlage.rueckmeldeFelder = function () {
    var v = KT.vorlage;
    return v.abschnitte
      .map(function (a) { return { id: a.rueckmeldung, titel: (a.nr ? a.nr + '. ' : '') + a.titel, wordTag: a.wordTagRueckmeldung }; })
      .concat(v.ebakBloecke.map(function (b) { return { id: b.rueckmeldung, titel: b.titel, wordTag: b.wordTagRueckmeldung }; }));
  };
})(window.KT = window.KT || {});
