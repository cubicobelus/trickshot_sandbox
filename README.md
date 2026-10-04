# Trickshot Sandbox

A browser FPS where you chain slides, bunnyhops and wall bounces to build speed, then land
absurd trickshots for a big score multiplier. Plain HTML and JavaScript, no build step.

## Play

**[▶ Play in your browser](https://cubicobelus.github.io/trickshot_sandbox/)** — nothing to download or install.
Click the link, then click **Click to play**. Press **Esc** for the menu. Needs a keyboard and mouse.

<details>
<summary>Running it offline</summary>

The game's files must stay **together**: `index.html`, `style.css`, `game.js`, `sounds.js` and the `lib` folder.
Downloading only `index.html` gives you an unstyled page that does nothing. Use **Code → Download ZIP**,
unzip, and open `index.html`. No internet connection is needed.

</details>

## How to play

**Controls:** WASD move, Space jump, Shift sprint, Ctrl slide, R reload, F inspect, left click attack,
right click aim (scope on the sniper, sights on the others) or throw (knife),
1 / 2 / Q / mouse wheel switch between gun and knife.

**Modes:** Free play is endless. **Score Attack** gives you 1 or 2 minutes (after a 3-2-1 countdown) to
score as much as you can; Esc pauses the clock, and your top 5 runs for each length are kept in your browser.

**Stats:** the Stats button in the menu shows your lifetime numbers: play time, accuracy, records (longest
shot, highest multiplier, top speed...), each gun, targets by colour, movement, and how often you've landed
each trick. **Achievements** (also in the menu) are goals to chase, from your first hit to a 720 no-scope
or a 100x shot. Both are kept in your browser.

**Loadout:** pick one gun in the menu (sniper, rifle, AK, shotgun or Deagle); you always carry the knife too.
1 is the gun, 2 the knife. The sniper's no-scope and quickscope bonuses are its own, and the other guns
score less per hit so trickshots stay king.

Base run speed is slow. You *build* speed by chaining slides, bunnyhops (press jump just as you land) and
wall bounces, up to 22 u/s.

**Scoring:** every trick multiplies the shot. Being airborne, hang time, spins, speed, distance (no cap: the
further, the more), no-scopes, quickscopes, flicks, quick switches, launches off pads and ramps, shooting
backwards mid-flight, several hits in one jump, last-round shots, sliding, wall bounces, small and moving
targets and streaks all stack. Two things scale a shot down: firing from close in (under 15 m, down to x0.4 at
3 m; knife swings are exempt) and standing still (moving under 2 u/s when you fire, even if you hop in place).
The full list with every value is under **Trickshot list** in the menu.

Targets come in four kinds: red (standard, still), orange (always moving), blue (small, still) and
purple (tiny and fast, and it runs from you if you get close). How many of each are up at once is set in Settings > Targets.

Settings (sensitivity, crosshair, sound levels, target counts, unlimited ammo and so on) are saved in your
browser. **Settings > Mouse** can import your sensitivity from CS2 / CS:GO / Apex / TF2, Valorant, Overwatch 2 or
Call of Duty, so the same hand movement turns you the same amount here. **Realistic accuracy** (Settings > Other, off by default) makes shots spread while you're in the air
and gives the sniper a little spread when it isn't scoped.

## Files

- `index.html` — page + menus
- `style.css` — styles
- `game.js` — everything else (movement, scoring, weapons, audio). Tuning knobs live in the `CFG`
  object at the top.
- `sounds.js` — recorded sounds, embedded so the game also works when opened from disk
- `lib/three.min.js` — [three.js](https://threejs.org) r128 (MIT license), the 3D engine, unchanged
- `tools/sound-lab.html` — test bench for every sound in the game, played the way the game plays it,
  with sliders to try changes, plus the synthesized sniper shots kept for reference
  ([open it](https://cubicobelus.github.io/trickshot_sandbox/tools/sound-lab.html))

Multiplayer code is in `game.js` but switched off for now (`MULTIPLAYER_ENABLED`).

## Development

Open `index.html` in a browser to play your local copy; refresh after editing. To run the tests (they drive the
real page in a headless browser and check loadouts, weapon switching, the trickshot list, settings, a full Score
Attack run and every sound in the sound lab):

```
pip install playwright
python -m playwright install chromium
python tests/run_tests.py
```

## Credits

Sniper shot: ["Rifle Gun Shot 01"](https://freesound.org/people/LilMati/sounds/433858/) by LilMati (CC0).
Deagle: ["Gunshot.wav"](https://freesound.org/people/Cloud-10/sounds/632821/) by Cloud-10 (CC0).
Rifle: ["AssaultRifle1.wav"](https://freesound.org/people/SuperPhat/sounds/404562/) by SuperPhat (CC0).
AK: ["AK47 Shot"](https://freesound.org/people/LeMudCrab/sounds/163457/) by LeMudCrab (CC0).
Shotgun: ["Shotgun Shot 03.wav"](https://freesound.org/people/LilMati/sounds/473846/) by LilMati (CC0).
Bolt action: from ["Sniper Rifle M24 SFX"](https://freesound.org/people/kennysvoice/sounds/351777/) by kennysvoice (CC0).
Footsteps, landings, reloads, knife, impacts and handling: short clips from CC0 recordings on
freesound.org; each is credited in `sounds.js`. A couple of small cues (the perfect-wall-bounce ping) are
generated in code.
