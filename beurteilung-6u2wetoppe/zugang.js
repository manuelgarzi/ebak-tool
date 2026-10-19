/*
 * Zugang zur eBAK-Seite (veröffentlicht als <eBAK-Ordner>/zugang.js).
 * Die eBAK-Funktionen liegen nur verschlüsselt in der Seite (PBKDF2-SHA-256 + AES-GCM-256).
 * Ohne Passwort lassen sie sich nicht lesen. Das Passwort selbst steht nirgends im Code.
 */
(function () {
  'use strict';

  var SPEICHER = 'kt:ebak-zugang';
  var paket = JSON.parse(document.getElementById('ebak-paket').textContent);
  var form = document.getElementById('zugang-form');
  var feld = document.getElementById('zugang-passwort');
  var merken = document.getElementById('zugang-merken');
  var knopf = document.getElementById('zugang-knopf');
  var fehler = document.getElementById('zugang-fehler');

  function bytes(b64) {
    var s = atob(b64);
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  function base64(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }

  function lesen(store) {
    try { return JSON.parse(window[store].getItem(SPEICHER) || 'null'); } catch (e) { return null; }
  }

  function schreiben(store, wert) {
    try { window[store].setItem(SPEICHER, JSON.stringify(wert)); } catch (e) { /* nicht verfügbar */ }
  }

  function vergessen() {
    try { window.localStorage.removeItem(SPEICHER); } catch (e) { /* nicht verfügbar */ }
    try { window.sessionStorage.removeItem(SPEICHER); } catch (e) { /* nicht verfügbar */ }
  }

  function schluesselAusPasswort(passwort) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(passwort.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
      .then(function (basis) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: bytes(paket.salt), iterations: paket.iter, hash: 'SHA-256' },
          basis, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      });
  }

  function entschluesseln(schluessel) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(paket.iv) }, schluessel, bytes(paket.daten))
      .then(function (klartext) { return JSON.parse(new TextDecoder().decode(klartext)); });
  }

  function skriptLaden(eintrag) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = eintrag.code ? URL.createObjectURL(new Blob([eintrag.code], { type: 'text/javascript' })) : eintrag.src;
      s.async = false;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Skript konnte nicht geladen werden: ' + (eintrag.src || 'eBAK-Modul'))); };
      document.body.appendChild(s);
    });
  }

  function starten(inhalt) {
    var zugang = document.getElementById('zugang');
    zugang.parentNode.removeChild(zugang);
    document.title = 'Konzepte beurteilen · eBAK Konzept-Tool';
    // Der Inhalt stammt aus dem authentisierten, verschlüsselten Paket
    document.body.insertAdjacentHTML('afterbegin', inhalt.html);
    return inhalt.skripte.reduce(function (kette, eintrag) {
      return kette.then(function () { return skriptLaden(eintrag); });
    }, Promise.resolve());
  }

  function gemerkterSchluessel() {
    var g = lesen('sessionStorage') || lesen('localStorage');
    if (!g) return Promise.resolve(null);
    // Nach einem Passwortwechsel ist der gemerkte Schlüssel ungültig
    if (g.salt !== paket.salt) { vergessen(); return Promise.resolve(null); }
    return crypto.subtle.importKey('raw', bytes(g.schluessel), { name: 'AES-GCM' }, true, ['decrypt']).catch(function () { return null; });
  }

  function fehlerZeigen(text) {
    if (!document.body.contains(fehler)) {
      // Anmeldemaske ist schon entfernt (Fehler beim Laden der Skripte)
      var p = document.createElement('p');
      p.className = 'hinweis-box warnung';
      p.textContent = text + ' Bitte die Seite neu laden.';
      document.body.insertBefore(p, document.body.firstChild);
      return;
    }
    fehler.textContent = text;
    fehler.hidden = false;
    knopf.disabled = false;
    knopf.textContent = 'Öffnen';
    feld.focus();
    feld.select();
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var passwort = feld.value;
    if (!passwort) return;
    fehler.hidden = true;
    knopf.disabled = true;
    knopf.textContent = 'Wird geprüft …';
    var schluessel;
    schluesselAusPasswort(passwort).then(function (s) {
      schluessel = s;
      return entschluesseln(s);
    }).then(function (inhalt) {
      return crypto.subtle.exportKey('raw', schluessel).then(function (roh) {
        var wert = { salt: paket.salt, schluessel: base64(new Uint8Array(roh)) };
        schreiben('sessionStorage', wert);
        if (merken.checked) schreiben('localStorage', wert);
        feld.value = '';
        return starten(inhalt);
      });
    }).catch(function (e) {
      if (e && e.name === 'OperationError') fehlerZeigen('Das Passwort ist nicht korrekt.');
      else fehlerZeigen('Die eBAK-Seite konnte nicht geöffnet werden. ' + (e && e.message ? e.message : ''));
    });
  });

  if (!window.crypto || !crypto.subtle) {
    fehlerZeigen('Dieser Browser unterstützt die nötige Verschlüsselung nicht. Bitte einen aktuellen Browser verwenden.');
    knopf.disabled = true;
    return;
  }

  // Bereits angemeldet (gleicher Tab oder «angemeldet bleiben»)?
  gemerkterSchluessel().then(function (s) {
    if (!s) { feld.focus(); return; }
    knopf.disabled = true;
    knopf.textContent = 'Wird geöffnet …';
    return entschluesseln(s).then(starten).catch(function () {
      vergessen();
      knopf.disabled = false;
      knopf.textContent = 'Öffnen';
      feld.focus();
    });
  });
})();
