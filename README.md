# Trickshot Sandbox

A browser FPS where you chain slides, bunnyhops and wall bounces to build speed, then land
absurd trickshots for a big score multiplier. No build step: three.js loads from a CDN.

## Play

**[▶ Play in your browser](https://cubicobelus.github.io/trickshot_sandbox/)** — nothing to download or install.
Click the link, then click **Click to play**. Press **Esc** for the menu. Needs a keyboard and mouse.

<details>
<summary>Running it offline</summary>

The game is three files that must sit **in the same folder**: `index.html`, `style.css` and `game.js`.
Downloading only `index.html` gives you an unstyled page that does nothing. Use **Code → Download ZIP**,
unzip, and open `index.html`. An internet connection is still needed (three.js loads from a CDN).

</details>

## How to play

**Controls:** WASD move, Space jump, Shift sprint, Ctrl slide, R reload, F inspect, left click attack,
right click scope, 1 / 2 / Q / mouse wheel switch weapons.

Base run speed is slow. You *build* speed by chaining slides, bunnyhops (hold jump on landing) and wall
bounces, up to 22 u/s. Score multipliers stack: air time, spins, speed, distance, no-scopes, quickscopes,
last-round shots, sliding, wall rides, moving and small targets, knife kills and streaks.

Settings (sensitivity, volume, unlimited ammo and so on) are saved in your browser.

## Files

- `index.html` — page + menus
- `style.css` — styles
- `game.js` — everything else (movement, scoring, weapons, audio). Tuning knobs live in the `CFG`
  object at the top.

Multiplayer code is in `game.js` but switched off for now (`MULTIPLAYER_ENABLED`).
