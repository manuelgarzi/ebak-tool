/*
 * Automatisches Speichern im Browser (localStorage).
 * Nur eine Bequemlichkeit: Der Browser-Speicher kann jederzeit leer sein.
 * Die verbindliche Sicherung ist immer die exportierte PDF.
 */
(function (KT) {
  'use strict';

  var INDEX = 'kt:index';
  var DOK = 'kt:dok:';
  var ORT = 'kt:ort';

  function lesen(schluessel) {
    try {
      var s = window.localStorage.getItem(schluessel);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  function schreiben(schluessel, wert) {
    try {
      window.localStorage.setItem(schluessel, JSON.stringify(wert));
      return true;
    } catch (e) {
      return false;
    }
  }

  function entfernen(schluessel) {
    try { window.localStorage.removeItem(schluessel); } catch (e) { /* nicht verfügbar */ }
  }

  function index() {
    var i = lesen(INDEX);
    return i && typeof i === 'object' ? i : {};
  }

  function verfuegbar() {
    try {
      var t = 'kt:test';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  }

  function schluesselFuer(rolle, daten) {
    return rolle + ':' + daten.dokumentId;
  }

  function liste(rolle) {
    var i = index();
    return Object.keys(i).map(function (k) { return i[k]; })
      .filter(function (e) { return e && e.rolle === rolle; })
      .sort(function (a, b) { return String(b.gespeichert).localeCompare(String(a.gespeichert)); });
  }

  function eintrag(schluessel) {
    return index()[schluessel] || null;
  }

  function laden(schluessel) {
    return lesen(DOK + schluessel);
  }

  // Liefert false, wenn der Browser nicht speichern kann (privates Fenster, Speicher voll).
  function speichern(rolle, daten, dateiname) {
    var k = schluesselFuer(rolle, daten);
    if (!schreiben(DOK + k, daten)) return false;
    var i = index();
    i[k] = {
      schluessel: k,
      rolle: rolle,
      titel: KT.modell.anzeigeTitel(daten),
      status: daten.status,
      versuch: daten.versuch,
      gespeichert: daten.meta.gespeichert,
      dateiname: dateiname || (i[k] && i[k].dateiname) || ''
    };
    return schreiben(INDEX, i);
  }

  function loeschen(schluessel) {
    var i = index();
    delete i[schluessel];
    schreiben(INDEX, i);
    entfernen(DOK + schluessel);
  }

  // Entfernt alle Einträge dieses Tools (Präfix «kt:»), auch gemerkte Anmeldungen
  function allesLoeschen() {
    var schluessel = [];
    try {
      for (var n = 0; n < window.localStorage.length; n++) schluessel.push(window.localStorage.key(n));
    } catch (e) { /* nicht verfügbar */ }
    schluessel.filter(function (k) { return k && k.indexOf('kt:') === 0; }).forEach(entfernen);
    try { window.sessionStorage.clear(); } catch (e) { /* nicht verfügbar */ }
  }

  KT.speicher = {
    verfuegbar: verfuegbar,
    schluesselFuer: schluesselFuer,
    liste: liste,
    eintrag: eintrag,
    laden: laden,
    speichern: speichern,
    loeschen: loeschen,
    allesLoeschen: allesLoeschen,
    ort: function (wert) {
      if (wert === undefined) return lesen(ORT) || '';
      schreiben(ORT, wert);
    }
  };
})(window.KT = window.KT || {});
