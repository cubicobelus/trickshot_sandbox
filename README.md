# Trickshot Sandbox

A browser FPS where you chain slides, bunnyhops and wall bounces to build speed, then land
absurd trickshots for a big score multiplier. No build step: three.js loads from a CDN.

## Play

**[▶ Play in your browser](https://cubicobelus.github.io/trickshot_sandbox/)** — nothing to download or install.
Click the link, then click **Click to play**. Press **Esc** for the menu. Needs a keyboard and mouse.

<details>
<summary>Running it offline</summary>

The game is four files that must sit **in the same folder**: `index.html`, `style.css`, `game.js` and `sounds.js`.
Downloading only `index.html` gives you an unstyled page that does nothing. Use **Code → Download ZIP**,
unzip, and open `index.html`. An internet connection is still needed (three.js loads from a CDN).

</details>

## How to play

**Controls:** WASD move, Space jump, Shift sprint, Ctrl slide, R reload, F inspect, left click attack,
right click aim (scope on the sniper, sights on the others) or throw (knife),
1 / 2 / Q / mouse wheel switch between gun and knife.

**Loadout:** pick one gun in the menu (sniper, rifle, AK, shotgun or pistol); you always carry the knife too.
1 is the gun, 2 the knife. The sniper's no-scope and quickscope bonuses are its own, and the other guns
score less per hit so trickshots stay king.

Base run speed is slow. You *build* speed by chaining slides, bunnyhops (hold jump on landing) and wall
bounces, up to 22 u/s. Score multipliers stack: air time, spins, speed, distance, no-scopes, quickscopes,
last-round shots, sliding, wall rides, moving and small targets, knife kills and streaks.

Settings (sensitivity, volume, unlimited ammo and so on) are saved in your browser.

## Files

- `index.html` — page + menus
- `style.css` — styles
- `game.js` — everything else (movement, scoring, weapons, audio). Tuning knobs live in the `CFG`
  object at the top.
- `sounds.js` — recorded sounds, embedded so the game also works when opened from disk
- `tools/shot-lab.html` — test bench for the sniper's sounds: the game's recordings with its processing
  on sliders, plus the best synthesized versions
  ([open it](https://cubicobelus.github.io/trickshot_sandbox/tools/shot-lab.html))

Multiplayer code is in `game.js` but switched off for now (`MULTIPLAYER_ENABLED`).

## Credits

Rifle shot: ["Rifle Gun Shot 01"](https://freesound.org/people/LilMati/sounds/433858/) by LilMati (CC0).
Pistol: ["gun shot.aif"](https://freesound.org/people/trip2000/sounds/52357/) by trip2000 (CC0).
Rifle: ["AssaultRifle1.wav"](https://freesound.org/people/SuperPhat/sounds/404562/) by SuperPhat (CC0).
AK: ["AK47 Shot"](https://freesound.org/people/LeMudCrab/sounds/163457/) by LeMudCrab (CC0).
Bolt action: from ["Sniper Rifle M24 SFX"](https://freesound.org/people/kennysvoice/sounds/351777/) by kennysvoice (CC0).
All other sounds are generated in code.
