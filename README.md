# PCSO Lotto Checker

Offline iPhone web app for checking PCSO 6-number lotto bets (6/42, 6/45, 6/49, 6/55, 6/58).
Live at https://nlacap.github.io/PCSO-Lotto-Checker/

## Structure

```
index.html            page markup only
css/styles.css        all styling
js/config.js          games, number ranges, draw days, prize tiers, version
js/validation.js      pure validation + matching logic (no DOM) — unit tested
js/ticketParser.js    reads bets from scanned/pasted ticket text — unit tested
js/resultsParser.js   reads official results copied/scanned from pcso.gov.ph — unit tested
js/storage.js         load/save, schema repair, migration of old saved data
js/picker.js          number-board overlay
js/status.js          status message box
js/dom.js             small DOM helpers
js/app.js             controller: builds the page, wires events, runs Compare
sw.js                 offline cache (bump CACHE when files are added/removed)
icons/                favicon, home-screen and PWA icons
tests/                node:test unit tests
```

## Validation rules

- Each cell accepts digits only (max 2); letters, signs and decimals are stripped as you type.
- Out-of-range and duplicate numbers are flagged red immediately, with a message under the row.
- Compare checks the draw date, the winning numbers and every bet, and lists **all** problems at once.
  Valid bets are still checked when another bet has an error.
- Warnings (not blocking): draw date in the future, date not on the game's usual draw day, two identical bets.
- Saved data is checked and repaired on load; damaged data is reset with a backup copy kept
  (`pcso-lotto-checker-v1.backup`). Save failures (Private Browsing, storage full) are shown, not hidden.

## Scan or paste

- **Whole ticket:** open "Scan or paste your ticket", tap the box, choose *Scan Text* (iPhone Live Text) and point at the ticket, then FILL BETS.
  Each line with six numbers (or a line starting A–F) becomes a bet; the game is read from the ticket when printed (6/49, SUPER, …).
  Lines that fail validation are listed, never silently kept.
- **One row:** paste or scan `05-12-23-34-40-41` (any separators) into the first box of a row and it spreads across all six.

## Saved PCSO results

Open "Scan or paste PCSO results" in the winning-numbers card and paste the results table
copied from pcso.gov.ph (or text copied from a screenshot with Live Text), then SAVE RESULTS.

- Reads every 6/42–6/58 row (2D/3D/4D/6D are skipped), validates it, and saves it on this device
  (`pcso-lotto-results-v1`, newest 60 draws per game).
- Works whether the text comes row by row (Safari copy) or column by column (Live Text).
  If the date column is cut off, the Draw Date set in the app is used.
- Picking a game and draw date fills the winning numbers from a saved result. Numbers you typed
  are never overwritten — if they differ, a USE SAVED PCSO RESULT button appears.
- A saved official result for a date also silences the "not a usual draw day" warning.

## Tests

```
npm test
```

Runs automatically on every push (GitHub Actions).

## Releasing

Bump `APP_VERSION` in `js/config.js` (shown in the page footer) and `CACHE` in `sw.js`.
