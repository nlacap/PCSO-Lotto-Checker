# PCSO Lotto Checker

Offline iPhone web app for checking PCSO 6-number lotto bets (6/42, 6/45, 6/49, 6/55, 6/58).
Live at https://nlacap.github.io/PCSO-Lotto-Checker/

## Structure

```
index.html            page markup only
css/styles.css        all styling
js/config.js          games, number ranges, draw days, prize tiers, version
js/validation.js      pure validation + matching logic (no DOM) — unit tested
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

## Tests

```
npm test
```

Runs automatically on every push (GitHub Actions).

## Releasing

Bump `APP_VERSION` in `js/config.js` (shown in the page footer) and `CACHE` in `sw.js`.
