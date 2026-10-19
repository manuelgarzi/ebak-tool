# eBAK Konzept-Tool

Web-Tool zum Erfassen von Bachelorarbeitskonzepten im Studiengang Kindergarten- und Primarstufe der Pädagogischen Hochschule St.Gallen.

Das Konzept wird im Browser ausgefüllt und als PDF exportiert. Die PDF enthält die Formulardaten und lässt sich jederzeit wieder ins Tool laden, auch für einen weiteren Versuch nach der Rückmeldung.

Die Beurteilung durch die eBAK erfolgt über einen separaten, passwortgeschützten Zugang.

## Datenschutz

Das Tool läuft vollständig im Browser. Es gibt keinen Server, keine Datenbank und keine Anmeldung. Eingaben werden nur lokal im Browser zwischengespeichert und nie übertragen. Die exportierten PDFs enthalten keine Namen, auch nicht in den Dateieigenschaften.

## Bibliotheken und Lizenzen

| Bibliothek | Version | Lizenz |
|---|---|---|
| Quill | 2.0.3 | BSD-3-Clause |
| pdfmake | 0.3.11 | MIT |
| pdf-lib | 1.17.1 | MIT |
| JSZip | 3.10.1 | MIT |
| Albert Sans | Google Fonts | SIL Open Font License 1.1 |

Die Lizenztexte liegen bei den Bibliotheken in `vendor/` und bei der Schrift in `assets/fonts/`. Das PHSG-Logo ist eine geschützte Marke der Pädagogischen Hochschule St.Gallen.
