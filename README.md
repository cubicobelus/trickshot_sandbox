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

**Controls:** WASD move, Space jump, Shift sprint (or walk, with Auto sprint on in Settings > Gameplay), Ctrl slide
(when moving faster than a walk; slower, Ctrl crouch-walks), E grappling hook (tap it at a wall, the floor or a target to zip
there; tap again or jump to let go), R reload, F inspect, P replay last hit, left click attack,
right click aim (scope on the sniper, sights on the others) or throw (knife),
1 / 2 / Q / mouse wheel switch between gun and knife.
Playing goes fullscreen and locks keys like W, T and N away from the browser (Chrome and Edge), so Ctrl+W can't close the tab; turn that off in Settings > Gameplay. Every one of these can be changed in **Settings > Controls**: each action has two boxes, and a box takes a key, a
mouse button (left, right, middle, back, forward) or a wheel direction. Esc, Tab and Enter stay fixed for the menus.

**Tutorial:** new here? The Tutorial button in the menu walks you through the basics one goal at a time, from
looking around to landing a 3x trickshot. Each goal ticks off when you do it; Enter skips one. It starts by itself the first time you click to play.

**Maps:** pick one in the menu (a small picture of each is shown). **Arena** is the original trickshot map; **Courtyard** is close quarters at dusk (a ring of walls with four gates); **Foundry** is a steel works built for team play (a long hall of crates, side lanes and a raised gallery at each end); **Rooftops** has three levels: a street canyon between buildings, rooftops at 6.5 and 10 m, linked by ladders, ramps and bridges (walk up to a ladder and hold forward to climb, jump to let go). **Random** picks a different map each Score Attack run and each online round. Free play, Score Attack, practice with bots and online rooms all use them (the host picks the map for a room), and each map keeps its own Score Attack top 5.

**Modes:** Free play is endless. **Score Attack** gives you 1 minute (after a 3-2-1 countdown) to
score as much as you can; Esc pauses the clock, and your top 5 runs are kept in your browser.

**Stats:** the Stats button in the menu shows your lifetime numbers: play time, accuracy, records (longest
shot, highest multiplier, top speed...), each gun, targets by colour, movement, and how often you've landed
each trick. **Achievements** (also in the menu) are goals to chase, from your first hit to a 720 no-scope
or a 100x shot. Both are kept in your browser. **Settings > Gameplay > Erase all data** wipes everything
the game has saved and starts you over.

**Replays:** every hit is recorded. The menu's **Watch best trickshot** and **Watch last hit** buttons (and
**Watch best shot** on a Score Attack results screen) play it back from your view, slowing down around the
hit, with a **bullet cam** that rides the shot to the target. Press **P** while playing to watch your last
hit (P again to carry on). Your best trickshot's replay is kept in your browser. **Save video** in the replay bar
saves it as a .webm you can post anywhere.

**Loadout:** pick one gun in the menu (sniper, rifle, AK, shotgun or Deagle); you always carry the knife too.
1 is the gun, 2 the knife. The sniper's no-scope and quickscope bonuses are its own, and the other guns
score less per hit so trickshots stay king. Shots that land on a wall, platform or the floor leave bullet holes (switch them off in Settings > View).

Base run speed is slow. You *build* speed by chaining slides, bunnyhops (press jump just as you land) and
wall bounces, up to 22 u/s. Tap **E** to fire the grappling hook at a wall, the floor or a target and
zip there (the gun goes away while it's out).

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
Call of Duty, so the same hand movement turns you the same amount here. **Settings > View > Graphics** trades looks for speed
(Auto steps down by itself if the game runs slow), and **Show FPS** puts a frame counter in the corner. **Realistic shooting** (Settings > Gameplay; on by default in every mode) makes shots spread the faster you move, up to 10 u/s, and more in the air. Standing still is
perfectly accurate, crouching tames recoil, and the sniper has a little spread when it isn't scoped.

## Multiplayer

Open the **Multiplayer** tab in the menu, pick a loadout and a name, then **Create room** (share the 5-letter code or
the invite link) or **Join** with a code. Up to 8 players, 3-minute rounds, peer-to-peer over WebRTC: the host's browser
runs the room, so the host has to keep their tab open. It is experimental and has only been tested lightly.

- **Score Race:** everyone shoots the same targets, and the best trickscore when the timer ends wins. Players can't hurt each other.
- **Deathmatch** (and **Team Deathmatch**, two teams with no friendly fire): targets are off and players shoot each other. The first to the kill limit (5 to 50, or none) wins, or whoever has the most kills when the 3 minutes end. 100 health. Sniper: one hit kills, anywhere.
  Deagle: 55 to the body, a head hit kills. AK: 34 body / 50 head. Rifle: 26 body / 40 head. Shotgun: about 11 a pellet,
  falling off with distance. Knife: 55 a swing, a thrown knife kills. Health starts coming back after 10 seconds without taking
  damage or shooting. Only kills score (with the trick multipliers of the killing shot). When you're killed you watch the player who did it until you respawn, and the damage you deal floats up from the player you hit (switch the numbers off in Settings > View). Other players show what they're holding,
  reloads, knife swings and their grappling rope.
- The host checks hits against the shots it saw, limits how fast a player can send messages, and drops anyone who goes silent for
  12 seconds. It can't stop every kind of cheating, so play with people you know. Players can see each other's IP addresses
  (that's how WebRTC works).

**Practice vs bots** (Multiplayer tab, no internet needed): a deathmatch or team deathmatch against 1 to 5 AI players on Easy, Medium or Hard. They run
and strafe, use every gun with its real fire rate, reload, and take and deal the same damage as real players. Esc pauses it.

To switch multiplayer off completely, set `MULTIPLAYER_ENABLED` to `false` in `game.js`.

<details>
<summary><b>For developers: files, tuning and tests</b></summary>

**Files** (they must stay together):

- `index.html` — page + menus
- `style.css` — styles
- `game.js` — everything else (movement, scoring, weapons, audio). Tuning knobs live in the `CFG`
  object at the top.
- `sounds.js` — recorded sounds, embedded so the game also works when opened from disk
- `lib/three.min.js` — [three.js](https://threejs.org) r128 (MIT license), the 3D engine, unchanged
- `tools/sound-lab.html` — test bench for every sound in the game, played the way the game plays it,
  with sliders to try changes, plus the synthesized sniper shots kept for reference
  ([open it](https://cubicobelus.github.io/trickshot_sandbox/tools/sound-lab.html))

**Running it:** open `index.html` in a browser to play your local copy and refresh after editing. Tuning knobs (movement,
scoring, accuracy, the grapple) are in the `CFG` object at the top of `game.js`.

**Tests:** they drive the real page in a headless browser and check the loadouts, weapon switching, the trickshot
list, settings, controls, the grapple, the tutorial, a full Score Attack run and every sound in the sound lab.

```
pip install playwright
python -m playwright install chromium
python tests/run_tests.py
```

</details>

<details>
<summary><b>Sound credits</b></summary>

Sniper shot: ["Rifle Gun Shot 01"](https://freesound.org/people/LilMati/sounds/433858/) by LilMati (CC0).
Deagle: ["Gunshot.wav"](https://freesound.org/people/Cloud-10/sounds/632821/) by Cloud-10 (CC0).
Rifle: ["AssaultRifle1.wav"](https://freesound.org/people/SuperPhat/sounds/404562/) by SuperPhat (CC0).
AK: ["AK47 Shot"](https://freesound.org/people/LeMudCrab/sounds/163457/) by LeMudCrab (CC0).
Shotgun: ["Shotgun Shot 03.wav"](https://freesound.org/people/LilMati/sounds/473846/) by LilMati (CC0).
Bolt action: from ["Sniper Rifle M24 SFX"](https://freesound.org/people/kennysvoice/sounds/351777/) by kennysvoice (CC0).
Footsteps, landings, reloads, knife, impacts and handling: short clips from CC0 recordings on
freesound.org; each is credited in `sounds.js`. A couple of small cues (the perfect-wall-bounce ping) are
generated in code.

</details>
