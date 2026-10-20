(function () {
  "use strict";

  // "Erase all data" sets this flag and reloads; the wipe happens here, before anything reads storage, so nothing
  // that saves as the page unloads can bring the old data back.
  try {
    if (sessionStorage.getItem("tsb-wipe")) {
      sessionStorage.removeItem("tsb-wipe");
      for (const k of Object.keys(localStorage)) if (k.startsWith("tsb-")) localStorage.removeItem(k);
    }
  } catch (e) { /* storage blocked: nothing to wipe */ }

  // ---- problems: anything the game throws is kept (the last few, with how often) and shown in a small bar, so a bug never passes
  // silently and a player can copy what happened. A repeating error (one thrown every frame) is counted, not shown again and again. ----
  const GAME_VERSION = "2026.10.19d";   // bump with each push, so a report says which build it came from
  const problems = [];   // newest last: { msg, where, n }
  let problemTimer = 0, problemDismissed = false;
  function renderProblems() {
    problemTimer = 0;
    const bar = document.getElementById("problem-bar");
    if (!bar || !problems.length || problemDismissed) return;
    const last = problems[problems.length - 1], total = problems.reduce((a, p) => a + p.n, 0);
    document.getElementById("problem-msg").textContent = "Something went wrong: " + last.msg.slice(0, 140) + (total > 1 ? " (" + total + " errors)" : "") +
      ". Esc, then Settings > Gameplay > Copy debug info.";
    bar.hidden = false;
  }
  function noteProblem(msg, where) {
    msg = String(msg || "unknown error").slice(0, 300);
    const known = problems.find((p) => p.msg === msg && p.where === where);
    if (known) known.n++;
    else { problems.push({ msg, where, n: 1 }); if (problems.length > 5) problems.shift(); problemDismissed = false; }
    if (!problemTimer) problemTimer = setTimeout(renderProblems, known ? 1000 : 150);   // (a burst is drawn once, not every frame)
  }
  window.addEventListener("error", (e) => {
    if (!e.message) return;   // (a failed image or script load is not an error event on the window)
    noteProblem(e.message, (e.filename || "").split("/").pop() + ":" + (e.lineno || 0) + ":" + (e.colno || 0));
  });
  window.addEventListener("unhandledrejection", (e) => noteProblem("Unhandled promise: " + ((e.reason && e.reason.message) || e.reason), ""));

  // "Import from a file" does the same: it leaves the checked data in sessionStorage and reloads, and it is written here.
  try {
    const pending = sessionStorage.getItem("tsb-import");
    if (pending) {
      sessionStorage.removeItem("tsb-import");
      const data = JSON.parse(pending);
      for (const k of Object.keys(localStorage)) if (k.startsWith("tsb-")) localStorage.removeItem(k);
      for (const k of Object.keys(data)) localStorage.setItem(k, data[k]);
    }
  } catch (e) { /* storage blocked: nothing to import */ }

  // A first-time visitor (nothing saved yet) is walked through the tutorial on their first click to play.
  // Read before anything below saves a setting or a stat. (The tests turn this off with window.__noForceTutorial.)
  const FIRST_VISIT = !window.__noForceTutorial && (() => {
    try { return !localStorage.getItem("tsb-tutorial") && !localStorage.getItem("tsb-stats") && !localStorage.getItem("tsb-settings"); } catch (e) { return false; }
  })();
  let tutOffered = false, hasPlayed = false;
  if (FIRST_VISIT) { const h = document.getElementById("howto"); if (h) h.open = true; }   // the how-to starts open for a new player

  // ======================================================================
  // CONFIG
  // ======================================================================
  const CFG = {
    gravity: 26,
    eyeHeight: 1.7,
    slideHeight: 0.92,
    crouchHeight: 1.15,
    heightLerpSpeed: 13,
    playerRadius: 0.4,
    groundSnapTolerance: 0.35,
    stepHeight: 0.6,            // ledges up to this tall are walked up; anything taller blocks you
    playerHeight: 1.85,         // feet to top of head, so you can walk under high floating slabs

    // --- speed: low base, high ceiling you have to earn ---
    groundMaxSpeed: 6.2,        // what plain running gets you
    sprintMultiplier: 1.45,     // ~9 u/s sprinting
    groundAccel: 12,
    friction: 8,
    momentumThreshold: 9.5,     // above this, friction drops so momentum survives
    momentumFriction: 1.6,
    momentumRamp: 6.0,          // blend width, so friction never snaps between the two
    maxSpeed: 22,               // hard ceiling

    airWishSpeedCap: 1.7,
    airAccel: 46,
    jumpSpeed: 8.6,
    boostPop: 5,                // a launch strip throws you at full speed along its arrows, with this much lift
    ladderSpeed: 4.4,           // climbing a ladder with forward / back
    bhopWindow: 0.12,           // land-and-jump inside this window skips ground friction...
    bhopKeep: 0.93,             // ...but each hop keeps only this share of the speed above a sprint,
    bhopKeepHeld: 0.81,         // and less when space is just held down instead of pressed on landing

    slideBoost: 5.5,
    slideMaxSpeed: 20,
    slideDuration: 0.9,
    slideCooldown: 0.4,
    slideFriction: 0.9,
    slideMinSpeed: 6.5,         // Ctrl slides only above walking speed (6.2); slower, it's a crouch-walk
    crouchWalkMult: 0.5,        // crouch-walking moves at this share of walking speed

    wallCheckDist: 0.85,
    wallPerfectWindow: 0.18,
    wallBounceRestitutionPerfect: 0.80,   // share of your into-the-wall speed thrown back out
    wallBounceRestitutionNormal: 0.55,
    wallBounceUpPerfect: 9.0,
    wallBounceUpNormal: 7.4,
    wallBouncePushOut: 1.5,
    wallBounceCooldown: 0.16,
    wallBounceMaxSpeed: 22,     // no bounce takes you past this
    wallBounceBonusPerfect: 5,  // a perfect bounce adds this when you hit the wall slowly, less as you speed up...
    wallBounceBonusMin: 2,      // ...but never under this, until the cap
    wallBounceBonusLate: 0.08,  // a late bounce adds up to this share of your speed, less the later it is...
    wallBounceLateWindow: 0.15, // ...down to nothing this long after the perfect window
    wallBounceMinSpeed: 5,      // speed straight into the wall needed to bounce, so hugging one and jumping doesn't
    wallImpactMemory: 0.25,     // a bounce still counts this long after hitting the wall
    wallBounceSteerLock: 0.5,   // after a bounce, movement keys don't steer for this long...
    wallBounceSteerFade: 0.15,  // ...then steering fades back in over this long
    wallRideScoreWindow: 1.4,

    // grappling hook (Pathfinder style): tap the key and the hook zips you to the spot you're aiming at
    grappleRange: 33,
    grappleDrawTime: 0.12,      // gun away, grapple out: the spear fires once it is out
    grappleFlightSpeed: 220,    // how fast the spear flies
    grappleReel: 30,            // speed along the rope you're pulled at
    grappleAccel: 140,          // how hard the rope snaps you up to that
    grappleMaxTime: 1.4,        // the hook lets go after this long, in case you can't reach it
    grappleMinLen: 2.5,         // pulled this close, the hook lets go
    grappleCooldown: 2.0,       // after it lets go (a miss uses the short one)
    grappleMissCooldown: 1.0,
    grappleMult: 1.3,
    grappleScoreWindow: 1.2,    // a shot counts as a GRAPPLE this long after letting go

    baseFov: 78,
    scopedFov: 26,
    scopeSway: 0.0016,          // breathing drift while scoped, radians (0 turns it off)
    speedFovBoost: 12,          // extra FOV at max speed
    adsTime: 0.20,
    baseSensitivity: 0.00073,   // radians per mouse count at sensitivity 1 (0.0418 degrees)
    maxMouseDelta: 1200,        // counts per event; only throws out browser glitch jumps, never a real flick
    accelThreshold: 25,         // px/event where accel reaches ~63% of its range

    maxShootDistance: 250,
    shotForce: 9,
    tracerSpeed: 380,
    tracerLength: 7,

    magSize: 5,
    reloadTime: 2.3,

    arenaHalfSize: 40,
    // jump pads: launch speed for each tier. Airtime from the ground and back is 2v/gravity,
    // so 13 gives about 1 s (3.3 m up) and 19.5 about 1.5 s (7.3 m up)
    jumpPadPower: 13,
    megaPadPower: 19.5,
    jumpPadBoost: 1.5,          // speed (u/s) a pad adds to your run, when you're moving
    megaPadBoost: 2.5,
    hitStopScale: 0.55,
    hitStopTime: 0.07,

    // ---- trickscore ----
    basePoints: 100,
    airMult: 1.4,               // every trick multiplies the shot: x1.4 for being off the ground...
    spinMultPer360: 1.4,        // each full 360 multiplies again (720 = x1.96)...
    spinMaxCount: 3,            // ...counting up to 3 turns (x2.74), so turning sensitivity up can't run away with it
    spin180Mult: 1.2,
    knifeMult: 1,               // a knife swing has no multiplier of its own: it scores on its tricks
    thrownKnifeMult: 1,         // a thrown knife scores on its tricks and distance, nothing of its own
    sprayMults: [1, 0.5, 0.25], // full-auto: the 2nd shot of a spray x0.5, the 3rd on x0.25 (tapping isn't a spray)
    knifeThrowCooldown: 0.6,    // unlimited knives, one per this many seconds
    knifeThrowSpeed: 32,
    knifeThrowGravity: 9,       // lighter than the world's, so throws carry
    knifeStickTime: 6,          // how long a stuck knife stays in a wall
    slideMult: 1.3,
    wallRideMult: 1.4,
    movingTargetMult: 1.3,
    smallTargetMult: 1.8,
    tinyTargetMult: 2.5,        // purple: tiny and fast (no separate moving bonus)
    // penalties scale the whole multiplier down, after the bonuses add up
    pointBlankMin: 3,           // CLOSE (under distanceFrom) slides down to the full penalty at this distance...
    pointBlankMult: 0.4,
    standingStillSpeed: 2,      // moving slower than this when you fire, even mid-hop...
    standingStillMult: 0.75,    // ...scales the shot by this
    portalScoreWindow: 2.5,     // PORTAL SHOT: a hit this soon after coming out of a portal
    portalMult: 1.3,
    stripScoreWindow: 2.5,      // STRIP SHOT: a hit this soon after a launch strip threw you
    stripMult: 1.3,
    platformMult: 1.2,          // PLATFORM SHOT: a hit while riding a lift or the shuttle
    zeroGMult: 1.3,             // ZERO-G: a hit after this long in the air (real seconds) on a low-gravity map
    zeroGAirTime: 3,
    zeroGMaxGravity: 15,
    chainWindow: 5,             // CHAIN: different movement tricks (slide, wall bounce, grapple, pad, ramp, portal, strip, lift) within this many seconds
    chainMultPer: 0.15,         // x1.15 for 2 different tricks, x1.30 for 3...
    chainMultMax: 1.6,
    newTrickMultPer: 0.1,       // NEW: each trick you have not landed yet this run adds this...
    newTrickMultMax: 1.5,       // ...up to this
    unrealisticMult: 0.5,       // Realistic shooting turned off (every shot lands exactly where you aim): the shot is worth this much
    // the purple target keeps away from you, like a snitch
    snitchRange: 12,            // starts running when you're this close
    snitchFlee: 7,              // how far it can pull away from its path
    snitchSpeedUp: 1.5,         // and its path speeds up by up to this much more
    noScopeMult: 1.6,
    noScopeMinDist: 20,
    quickscopeMult: 1.6,
    quickscopeWindow: 0.55,     // scope-in to shot must be under this
    lastRoundMult: 1.4,
    streakMultPer: 0.08,        // x1.08 per hit in the streak...
    streakMultMax: 1.8,
    // distance and speed multipliers grow smoothly; the speed tag shows your speed
    distanceFrom: 15,           // meters; closer than this the CLOSE penalty applies instead
    distanceMultPerM: 0.022,    // x1.33 at 30 m, x1.66 at 45 m, x2.43 at 80 m: no cap, further is always better
    speedFrom: 9.5,             // u/s, about a sprint
    speedMultPer: 0.07,         // x1.39 at 15 u/s, x1.88 at 22...
    speedMultMax: 1.875,        // what the 22 u/s speed cap gives
    flickAngle: 40,             // FLICK: at least this many degrees turned in the last flickWindow s before the shot...
    flickWindow: 0.25,
    flickMult: 1.3,
    snapFlickAngle: 80,         // ...SNAP FLICK: a bigger turn in less time
    snapFlickWindow: 0.15,
    snapFlickMult: 1.6,
    quickSwitchWindow: 0.35,    // a hit this soon after a weapon swap finishes
    quickSwitchMult: 1.4,
    quickSwitchFreshGun: 1.5,   // ...only if that gun hadn't fired this recently (swapping during your own bolt doesn't count)
    comboMultPer: 0.4,          // DOUBLE x1.4, TRIPLE x1.8, QUAD x2.2...
    comboMultMax: 2.6,
    hangTimeFrom: 1.0,          // seconds in the air before hang time starts paying
    hangTimeMultPerSec: 0.4,
    hangTimeMultMax: 1.8,
    launchMult: 1.3,            // a hit while still rising from a jump pad or ramp launch
    megaLaunchMult: 1.4,
    reverseSpeed: 8,            // moving at least this fast...
    reverseMult: 1.4,           // ...away from where you're aiming
    rocketJumpMult: 1.5,        // a hit while still in the air from the shove of your own blast: the RPG's...
    launcherJumpMult: 1.4,      // ...the launcher's...
    grenadeJumpMult: 1.4,       // ...a thrown grenade's...
    packJumpMult: 1.3,          // ...and the blast pack's (the easiest to line up, so the smallest)
    blastJumpMinPush: 5,        // the shove has to be at least this many u/s (a blast further off than about 3 to 5 m does not count)
    // Realistic shooting (a setting, on by default): extra spread, in radians
    realisticAirSpread: 0.025,  // any gun, while you're in the air (on top of the moving spread)
    realisticMoveSpread: 0.016, // any gun on the ground: none standing still, growing with speed until...
    realisticMoveFullSpeed: 10, // ...this speed (u/s), where it levels out. Aiming down sights halves it.
    crouchRecoilMult: 0.6,      // holding crouch (on the ground) tames recoil
    realisticHipSpread: 0.012,  // the sniper from the hip (not aiming), so a no-scope is a real gamble

  };

  // team colours (the red team turns orange with the colourblind setting) and the hill ring when two sides are on it
  const TEAM_COLORS = [0x3e8ef7, 0xe5484d], TEAM_NAMES = ["Blue", "Red"], HILL_CONTESTED = { c: 0xff4a3d, css: "#ff6a5e" };
  const SETTINGS = {
    sensX: 1.0, sensY: 1.0, scopedSensMult: 0.35, volume: 0.55,
    unlimitedAmmo: false, mouseAccel: false, accelStrength: 0.7,
    realisticShooting: true,   // shots spread while moving or airborne, and the sniper from the hip isn't laser-accurate (every mode)
    autoSprint: false,          // sprint whenever you move; Shift walks instead
    // crosshair
    xhStyle: "cross", xhColor: "#eeeeee", xhSize: 9, xhThick: 2, xhGap: 0, xhAlpha: 1, xhOutline: false, hitStyle: "flash",
    // view
    hand: "right", fov: 78, bob: 1, shake: 1, scopeSway: true, speedLines: true,
    quality: "auto", showFps: false, trickFeed: true, attach: {}, skin: {}, padOn: true, padLook: 1, reduceMotion: false, highContrast: false, soundCues: false, hudScale: 1, colorblindTargets: false, bulletHoles: true, damageNumbers: true, fullscreen: true, map: "arena",   // graphics: auto / high / medium / low, and the frame counter
    // sound levels, on top of the master volume
    volGuns: 1, volMove: 1, volHits: 1, volKnife: 1, volGear: 1,
    loadout: "rifle",   // the one gun carried alongside the knife
    playMode: "free",   // "free" play, or a Score Attack run: "sa60"
    // how many of each target kind are up at once
    tgtNormal: 6, tgtMoving: 4, tgtSmall: 3, tgtTiny: 2,
  };
  const DEFAULT_SETTINGS = Object.assign({}, SETTINGS);
  const handSign = () => (SETTINGS.hand === "left" ? -1 : 1);

  // ======================================================================
  // CONTROLS: every action has up to two inputs (a key, a mouse button or the wheel), set in Settings > Controls.
  // Inputs are named by physical key ("KeyW", "Space"), "Mouse0".."Mouse4", "WheelUp" / "WheelDown", or "Wheel"
  // (either direction). Left and right Shift / Ctrl / Alt count as one key.
  // ======================================================================
  const ACTIONS = [
    ["forward", "Move forward", ["KeyW"]], ["back", "Move back", ["KeyS"]],
    ["left", "Move left", ["KeyA"]], ["right", "Move right", ["KeyD"]],
    ["jump", "Jump", ["Space"]], ["sprint", "Sprint", ["ShiftLeft"]],
    ["slide", "Slide / crouch", ["ControlLeft"]], ["fire", "Attack", ["Mouse0"]],
    ["aim", "Aim / throw knife", ["Mouse2"]], ["reload", "Reload", ["KeyR"]],
    ["inspect", "Inspect weapon", ["KeyF"]], ["gun", "Switch to gun", ["Digit1"]],
    ["knife", "Switch to knife", ["Digit2"]], ["swap", "Swap gun / knife", ["KeyQ", "Wheel"]],
    ["replay", "Watch last hit", ["KeyP"]], ["grapple", "Grappling hook", ["KeyE"]],
    ["map", "Show map (hold)", ["KeyM"]], ["leaderboard", "Show leaderboard (hold)", ["KeyL"]], ["grenade", "Throw grenade", ["KeyG"]], ["satchel", "Blast pack", ["KeyC"]],
  ];
  const ACTION_IDS = ACTIONS.map((a) => a[0]);
  const ACTION_NAMES = Object.fromEntries(ACTIONS.map((a) => [a[0], a[1]]));
  const defaultBinds = () => Object.fromEntries(ACTIONS.map((a) => [a[0], [a[2][0] || null, a[2][1] || null]]));
  const BINDS = defaultBinds();
  const RESERVED_INPUTS = ["Escape", "Tab", "Enter", "NumpadEnter"];   // menus use these
  const SIDE_KEYS = { ShiftRight: "ShiftLeft", ControlRight: "ControlLeft", AltRight: "AltLeft", MetaRight: "MetaLeft" };
  const normalizeInput = (code) => SIDE_KEYS[code] || code;
  const isMouseInput = (id) => /^(Mouse|Wheel)/.test(id);
  const validInput = (v) => typeof v === "string" && !RESERVED_INPUTS.includes(v) &&
    (/^(Mouse[0-4]|Wheel|WheelUp|WheelDown)$/.test(v) || (/^[A-Za-z][A-Za-z0-9]{1,23}$/.test(v) && !isMouseInput(v)));
  const inputMatches = (bound, id) => bound === id || (bound === "Wheel" && (id === "WheelUp" || id === "WheelDown"));
  const actionsFor = (id) => ACTION_IDS.filter((a) => BINDS[a].some((b) => b && inputMatches(b, id)));

  // how an input is shown: the keyboard layout's own letter where the browser can tell us (AZERTY etc.)
  let layoutMap = null;
  const INPUT_NAMES = {
    Space: "Space", ShiftLeft: "Shift", ControlLeft: "Ctrl", AltLeft: "Alt", MetaLeft: "Win", CapsLock: "Caps Lock",
    Backspace: "Backspace", Delete: "Delete", Insert: "Insert", Home: "Home", End: "End", PageUp: "Page Up", PageDown: "Page Down",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ContextMenu: "Menu",
    Mouse0: "Left Mouse", Mouse1: "Middle Mouse", Mouse2: "Right Mouse", Mouse3: "Mouse 4", Mouse4: "Mouse 5",
    Wheel: "Mouse Wheel", WheelUp: "Wheel Up", WheelDown: "Wheel Down",
  };
  const SHORT_NAMES = { Mouse0: "LMB", Mouse1: "MMB", Mouse2: "RMB", Mouse3: "M4", Mouse4: "M5", Wheel: "Wheel", WheelUp: "Wheel ↑", WheelDown: "Wheel ↓" };
  function inputLabel(id, short) {
    if (!id) return "–";
    if (short && SHORT_NAMES[id]) return SHORT_NAMES[id];
    if (INPUT_NAMES[id]) return INPUT_NAMES[id];
    const mapped = layoutMap && layoutMap.get(id);
    if (mapped) return mapped.length === 1 ? mapped.toUpperCase() : mapped;
    let m = /^Key([A-Z])$/.exec(id) || /^Digit(\d)$/.exec(id);
    if (m) return m[1];
    m = /^Numpad(.+)$/.exec(id);
    if (m) return "Num " + m[1].replace(/^Add$/, "+").replace(/^Subtract$/, "-").replace(/^Multiply$/, "*").replace(/^Divide$/, "/").replace(/^Decimal$/, ".");
    return id.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  // all of an action's inputs, e.g. "Q / Mouse Wheel"; keyOnly leaves out mouse inputs
  function bindLabel(action, short, keyOnly) {
    const list = BINDS[action].filter((b) => b && !(keyOnly && isMouseInput(b)));
    return list.length ? list.map((b) => inputLabel(b, short)).join(" / ") : "unbound";
  }
  try {
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard.getLayoutMap().then((m) => { layoutMap = m; refreshControlsUI(); }).catch(() => {});
    }
  } catch (e) { /* not available: key names come from the physical key */ }

  // ======================================================================
  // SCENE
  // ======================================================================
  const scene = new THREE.Scene();
  let SKY_TOP = 0x3f7dc6, SKY_HORIZON = 0xcfe2ee;   // (a map's theme changes them)
  scene.background = new THREE.Color(SKY_HORIZON);
  scene.fog = new THREE.Fog(SKY_HORIZON, 45, 140);
  const SUN_DIR = new THREE.Vector3(30, 50, 20).normalize();

  const camera = new THREE.PerspectiveCamera(CFG.baseFov, window.innerWidth / window.innerHeight, 0.02, 500);
  const pitchObject = new THREE.Object3D();
  pitchObject.add(camera);
  const yawObject = new THREE.Object3D();
  yawObject.position.set(0, CFG.eyeHeight, 8);
  yawObject.add(pitchObject);
  scene.add(yawObject);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- graphics quality: how many pixels get drawn and how shadows are done ----
  // High is the full look. Medium draws 75% of the pixels' width and height with cheaper shadows,
  // Low draws half with no shadows. Auto starts on High and steps down while frames stay slow.
  const GFX_LEVELS = {
    high: { scale: 1, shadows: THREE.PCFSoftShadowMap },
    medium: { scale: 0.75, shadows: THREE.PCFShadowMap },
    low: { scale: 0.5, shadows: null },
  };
  const GFX_ORDER = ["high", "medium", "low"];
  let gfxLevel = null;
  function applyGraphics(level) {
    if (level === gfxLevel) return;
    const L = GFX_LEVELS[level];
    const shadowsChanged = !gfxLevel || GFX_LEVELS[gfxLevel].shadows !== L.shadows;
    gfxLevel = level;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * L.scale);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (shadowsChanged) {
      renderer.shadowMap.enabled = !!L.shadows;
      if (L.shadows) renderer.shadowMap.type = L.shadows;
      scene.traverse((o) => {   // materials rebuild their shaders for the new shadow setting
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
      });
      renderer.shadowMap.needsUpdate = true;
    }
  }
  // Auto: every 2 s of play, look at the average frame time; drop a level if it's slower than ~45 fps
  let gfxWindow = 0, gfxFrames = 0, gfxCooldown = 0;
  function updateAutoGraphics(realDt) {
    if (SETTINGS.quality !== "auto") return;
    gfxWindow += realDt; gfxFrames++;
    if (gfxCooldown > 0) gfxCooldown -= realDt;
    if (gfxWindow < 2) return;
    const avg = gfxWindow / gfxFrames;
    gfxWindow = 0; gfxFrames = 0;
    const i = GFX_ORDER.indexOf(gfxLevel);
    if (avg > 1 / 45 && i < GFX_ORDER.length - 1 && gfxCooldown <= 0) { applyGraphics(GFX_ORDER[i + 1]); gfxCooldown = 4; }
  }
  // the optional frame counter: frames per second, frame time, and the level in use
  const fpsEl = document.getElementById("fps");
  let fpsTime = 0, fpsFrames = 0, lastFps = 0;
  function updateFps(realDt) {
    fpsEl.hidden = !SETTINGS.showFps;
    fpsTime += realDt; fpsFrames++;   // (kept even with the counter hidden: the debug info quotes it)
    if (fpsTime < 0.5) return;
    lastFps = Math.round(fpsFrames / fpsTime);
    if (SETTINGS.showFps) fpsEl.textContent = lastFps + " fps · " + (fpsTime / fpsFrames * 1000).toFixed(1) + " ms · " +
      gfxLevel + (SETTINGS.quality === "auto" ? " (auto)" : "");
    fpsTime = 0; fpsFrames = 0;
  }

  // the environment map below already lights everything softly from the sky, so the
  // fill light is low and the sun does the shaping
  const hemi = new THREE.HemisphereLight(0xdbe9ff, 0x56663f, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.05);
  sun.position.copy(SUN_DIR).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
  scene.add(sun);

  // ---- sky: a gradient dome with a soft sun glow, and a few slow low-poly clouds ----
  function makeSkyDome(radius) {
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(SKY_TOP) },
        horizon: { value: new THREE.Color(SKY_HORIZON) },
        sunDir: { value: SUN_DIR },
      },
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: [
        "uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;",
        "void main() {",
        "  float h = vDir.y;",
        "  vec3 c = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55));",
        "  c = mix(c, horizon * 0.82, clamp(-h * 3.0, 0.0, 1.0));",          // a little darker below the horizon
        "  float s = max(dot(normalize(vDir), sunDir), 0.0);",
        "  c += vec3(1.0, 0.92, 0.75) * (pow(s, 400.0) * 1.2 + pow(s, 12.0) * 0.18);",  // sun disc and halo
        "  gl_FragColor = vec4(c, 1.0);",
        "}",
      ].join("\n"),
    }));
  }
  const skyDome = makeSkyDome(450);
  skyDome.renderOrder = -1;
  scene.add(skyDome);

  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa6b4, fog: false });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < puffs; j++) {
      const r = 9 + Math.random() * 9;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), cloudMat);
      m.position.set((j - puffs / 2) * r * 1.1, Math.random() * 4, Math.random() * 8);
      m.scale.y = 0.45;
      c.add(m);
    }
    const ang = (i / 9) * Math.PI * 2 + Math.random() * 0.5, dist = 220 + Math.random() * 90;
    c.position.set(Math.cos(ang) * dist, 70 + Math.random() * 40, Math.sin(ang) * dist);
    c.lookAt(0, c.position.y, 0);
    clouds.add(c);
  }
  scene.add(clouds);

  // Environment map: six small canvases painted with the same sky (and the ground below), so
  // shiny surfaces have something to reflect; without one, metal renders nearly black.
  // Plain 8-bit canvases rather than rendering the sky into float targets, which some
  // GPUs and software renderers get badly wrong.
  function buildEnvironment() {
    const css = (hex) => "#" + new THREE.Color(hex).getHexString();
    const n = 64;
    const face = (kind) => {
      const c = document.createElement("canvas");
      c.width = c.height = n;
      const g = c.getContext("2d");
      if (kind === "up") { g.fillStyle = css(SKY_TOP); g.fillRect(0, 0, n, n); }
      else if (kind === "down") { g.fillStyle = "#6c7268"; g.fillRect(0, 0, n, n); }   // muted, so chrome doesn't turn green
      else {
        const grad = g.createLinearGradient(0, 0, 0, n);
        grad.addColorStop(0, css(SKY_TOP));
        grad.addColorStop(0.48, css(SKY_HORIZON));
        grad.addColorStop(0.52, "#868c80");
        grad.addColorStop(1, "#6c7268");
        g.fillStyle = grad; g.fillRect(0, 0, n, n);
      }
      return c;
    };
    // +x, -x, +y, -y, +z, -z
    const env = new THREE.CubeTexture([face("side"), face("side"), face("up"), face("down"), face("side"), face("side")]);
    env.needsUpdate = true;
    if (scene.environment) scene.environment.dispose();
    scene.environment = env;
  }
  buildEnvironment();

  // ---- surface textures, drawn in code: small canvases tiled across each surface ----
  function canvasTexture(size, draw, repeatX, repeatY) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d"), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.repeat.set(repeatX || 1, repeatY || 1);
    return t;
  }
  function speckle(g, n, size, alpha, light) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = (Math.random() < 0.5 ? "rgba(0,0,0," : (light ? "rgba(255,255,255," : "rgba(0,0,0,")) + (Math.random() * alpha).toFixed(3) + ")";
      const w = 1 + Math.random() * 3;
      g.fillRect(Math.random() * size, Math.random() * size, w, w);
    }
  }
  // the two windows of a building front (a tile is 4 m by 3.2 m)
  function drawWindows(g, n) {
    g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 2;
    for (const x of [0.1, 0.56]) {
      const wx = x * n, wy = 0.2 * n, ww = 0.34 * n, wh = 0.5 * n;
      const grad = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
      grad.addColorStop(0, "#5f7488"); grad.addColorStop(0.5, "#2b3948"); grad.addColorStop(1, "#1f2a36");
      g.fillStyle = grad; g.fillRect(wx, wy, ww, wh); g.strokeRect(wx, wy, ww, wh);
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.beginPath(); g.moveTo(wx + 4, wy + wh - 4); g.lineTo(wx + ww * 0.45, wy + 4); g.lineTo(wx + ww * 0.62, wy + 4); g.lineTo(wx + 14, wy + wh - 4); g.fill();   // a glint
      g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(wx - 3, wy + wh, ww + 6, 5);   // the sill
    }
  }
  const SURFACE_DRAW = {
    // a building front: rows of windows on a plain wall, or on brick
    facade(g, n, base) { g.fillStyle = base || "#aeb2b7"; g.fillRect(0, 0, n, n); speckle(g, 900, n, 0.07, true); drawWindows(g, n); },
    facadeb(g, n, base) { SURFACE_DRAW.brick(g, n, base || "#b66d4f"); drawWindows(g, n); },
    // a flat roof: gravel and tar patches
    roof(g, n, base) {
      g.fillStyle = base || "#6e7279"; g.fillRect(0, 0, n, n); speckle(g, 2200, n, 0.2, true);
      g.fillStyle = "rgba(0,0,0,0.12)";
      for (let i = 0; i < 6; i++) g.fillRect(Math.random() * n, Math.random() * n, 40 + Math.random() * 60, 20 + Math.random() * 40);
      g.strokeStyle = "rgba(255,255,255,0.1)"; g.lineWidth = 3; g.strokeRect(0, 0, n, n);
    },
    // pale lake ice with cracks
    ice(g, n, base) {
      g.fillStyle = base || "#bfe3f2"; g.fillRect(0, 0, n, n); speckle(g, 700, n, 0.08, true);
      g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        let x = Math.random() * n, y = Math.random() * n;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 70; y += (Math.random() - 0.5) * 70; g.lineTo(x, y); }
        g.stroke();
      }
      g.strokeStyle = "rgba(120,170,200,0.35)"; g.lineWidth = 2; g.strokeRect(0, 0, n, n);
    },
    // moon dust with craters: a dark bowl, a bright rim on the sunny side, a shadow on the other, and a ring of throw-out
    moon(g, n, base) {
      g.fillStyle = base || "#8c8f96"; g.fillRect(0, 0, n, n); speckle(g, 3500, n, 0.22, true);
      const crater = (x, y, r) => {
        for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) {   // wrap round the tile edge so it repeats cleanly
          const cx = x + dx, cy = y + dy;
          if (cx + r * 1.6 < 0 || cx - r * 1.6 > n || cy + r * 1.6 < 0 || cy - r * 1.6 > n) continue;
          let grad = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.6);
          grad.addColorStop(0, "rgba(255,255,255,0.10)"); grad.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r * 1.6, 0, 7); g.fill();
          grad = g.createRadialGradient(cx + r * 0.25, cy + r * 0.25, r * 0.1, cx, cy, r);
          grad.addColorStop(0, "rgba(10,10,16,0.55)"); grad.addColorStop(0.7, "rgba(10,10,16,0.35)"); grad.addColorStop(1, "rgba(10,10,16,0.05)");
          g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
          g.lineWidth = Math.max(2, r * 0.14);
          g.strokeStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.95); g.stroke();   // lit rim, top-left
          g.strokeStyle = "rgba(0,0,0,0.4)"; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.05, Math.PI * 0.95); g.stroke();             // shaded rim, bottom-right
        }
      };
      crater(n * 0.3, n * 0.3, n * 0.2); crater(n * 0.78, n * 0.55, n * 0.14); crater(n * 0.4, n * 0.82, n * 0.1); crater(n * 0.88, n * 0.12, n * 0.07); crater(n * 0.12, n * 0.62, n * 0.06);
      g.strokeStyle = "rgba(255,255,255,0.06)"; g.lineWidth = 2; g.strokeRect(0, 0, n, n);
    },
    // meadow: grass with a scatter of wild flowers
    meadow(g, n, base) {
      g.fillStyle = base || "#6c9a47"; g.fillRect(0, 0, n, n);
      speckle(g, 3000, n, 0.18, true);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = ["#f4f1e6", "#f3d34a", "#e98fb1", "#b9a2ec"][i % 4];
        g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 0.8 + Math.random() * 1.0, 0, 7); g.fill();
      }
      g.strokeStyle = "rgba(255,255,255,0.05)"; g.lineWidth = 2; g.strokeRect(0, 0, n, n);
    },
    // a cliff: layers of stone, cracks and lichen
    rock(g, n, base) {
      g.fillStyle = base || "#8b857a"; g.fillRect(0, 0, n, n);
      for (let y = 0; y < n; y += 18 + Math.random() * 22) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0," + (0.06 + Math.random() * 0.14) + ")" : "rgba(255,255,255," + (0.05 + Math.random() * 0.1) + ")";
        g.fillRect(0, y, n, 10 + Math.random() * 16);
      }
      speckle(g, 2200, n, 0.22, true);
      g.strokeStyle = "rgba(20,18,14,0.45)"; g.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        let x = Math.random() * n, y = Math.random() * n;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 18; y += 8 + Math.random() * 22; g.lineTo(x, y); }
        g.stroke();
      }
      g.fillStyle = "rgba(96,128,64,0.28)";
      for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 3 + Math.random() * 8, 0, 7); g.fill(); }
    },
    // packed earth with pebbles (trails)
    dirt(g, n, base) {
      g.fillStyle = base || "#7c6547"; g.fillRect(0, 0, n, n);
      speckle(g, 2600, n, 0.24, true);
      for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(" + (110 + Math.random() * 60 | 0) + "," + (100 + Math.random() * 50 | 0) + "," + (85 + Math.random() * 40 | 0) + ",0.7)"; g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 1.5 + Math.random() * 3, 0, 7); g.fill(); }
    },
    // turf with a faint line every tile (4 m), handy for judging distance
    grass(g, n, base) {
      g.fillStyle = base || "#6f9a52"; g.fillRect(0, 0, n, n);
      speckle(g, 2600, n, 0.16, true);
      for (let i = 0; i < 7; i++) {   // faint darker and lighter patches (wrapped, so the tile edges do not show), so a big lawn is not one flat colour
        g.fillStyle = i % 2 ? "rgba(20,50,10,0.055)" : "rgba(210,235,120,0.045)";
        const cx = Math.random() * n, cy = Math.random() * n, rx = 34 + Math.random() * 50, ry = 26 + Math.random() * 40, rot = Math.random() * 3;
        for (const [ox, oy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) { g.beginPath(); g.ellipse(cx + ox, cy + oy, rx, ry, rot, 0, 7); g.fill(); }
      }
      g.strokeStyle = "rgba(255,255,255,0.13)"; g.lineWidth = 3;
      g.strokeRect(0, 0, n, n);
    },
    // concrete panels with seams
    concrete(g, n, base) {
      g.fillStyle = base || "#a5afb9"; g.fillRect(0, 0, n, n);
      speckle(g, 1400, n, 0.08, true);
      g.strokeStyle = "rgba(40,48,58,0.35)"; g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, n - 3, n - 3);
      g.fillStyle = "rgba(40,48,58,0.25)";
      for (const [x, y] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) { g.beginPath(); g.arc(x * n, y * n, 3, 0, 7); g.fill(); }
    },
    // painted blocks
    brick(g, n, base) {
      g.fillStyle = base || "#b06a62"; g.fillRect(0, 0, n, n);
      speckle(g, 900, n, 0.08, true);
      g.strokeStyle = "rgba(60,30,28,0.35)"; g.lineWidth = 2;
      const rows = 8;
      for (let r = 0; r < rows; r++) {
        const y = (r / rows) * n;
        g.beginPath(); g.moveTo(0, y); g.lineTo(n, y); g.stroke();
        for (let k = 0; k < 4; k++) {
          const x = ((k + (r % 2) * 0.5) / 4) * n;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + n / rows); g.stroke();
        }
      }
    },
    // steel deck plate inside a yellow and black hazard border
    // a dark steel floor plate, bolted at the corners (tiles every 4 m like the turf)
    slab(g, n, base) {
      g.fillStyle = base || "#4f565e"; g.fillRect(0, 0, n, n);
      speckle(g, 1800, n, 0.1, true);
      g.strokeStyle = "rgba(0,0,0,0.4)"; g.lineWidth = 4; g.strokeRect(2, 2, n - 4, n - 4);
      g.strokeStyle = "rgba(255,255,255,0.07)"; g.lineWidth = 2; g.beginPath(); g.moveTo(n / 2, 6); g.lineTo(n / 2, n - 6); g.moveTo(6, n / 2); g.lineTo(n - 6, n / 2); g.stroke();
      g.fillStyle = "rgba(0,0,0,0.45)";
      for (const [x, y] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) { g.beginPath(); g.arc(x * n, y * n, 4, 0, 7); g.fill(); }
    },
    // a shipping container: corrugated ribs, a darker frame and a door end line
    container(g, n, base) {
      g.fillStyle = base || "#b3392f"; g.fillRect(0, 0, n, n);
      for (let x = 0; x < n; x += 16) { g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(x, 0, 5, n); g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(x + 7, 0, 3, n); }
      g.fillStyle = "rgba(0,0,0,0.38)"; g.fillRect(0, 0, n, 9); g.fillRect(0, n - 9, n, 9);
      speckle(g, 500, n, 0.1, true);
    },
    deck(g, n, base) {
      g.fillStyle = base || "#8d949c"; g.fillRect(0, 0, n, n);
      g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2;
      for (let y = 8; y < n; y += 16) for (let x = 8 + (y % 32 ? 8 : 0); x < n; x += 16) {
        g.beginPath(); g.moveTo(x - 4, y + 3); g.lineTo(x + 4, y - 3); g.stroke();
      }
      const b = n * 0.11;
      g.save();
      g.beginPath(); g.rect(0, 0, n, n); g.rect(b, b, n - 2 * b, n - 2 * b); g.clip("evenodd");
      g.fillStyle = "#e3b53a"; g.fillRect(0, 0, n, n);
      g.fillStyle = "#2a2a2a";
      for (let x = -n; x < n * 2; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 14, 0); g.lineTo(x + 14 - n, n); g.lineTo(x - n, n); g.fill(); }
      g.restore();
    },
  };
  for (const c of ["cred", "cblue", "cgreen", "corange", "cyellow"]) SURFACE_DRAW[c] = SURFACE_DRAW.container;   // (one painting, five paints: the map's palette gives the colour)
  const surfaceCanvases = {};
  // Materials a level makes are shared when they are the same (so identical walls and every tree use one), and cleared when the map changes
  const levelMats = new Map();
  const waterAnim = [];   // the drifting glints on every pond and river: { tex, vx, vy }
  const sharedMat = (key, make) => { let m = levelMats.get(key); if (!m) { m = make(); levelMats.set(key, m); } return m; };
  function surfaceMaterial(kind, repeatX, repeatY, base) {
    const key = kind + (base || "");
    return sharedMat("surf|" + key + "|" + repeatX.toFixed(3) + "|" + repeatY.toFixed(3), () => {
      if (!surfaceCanvases[key]) surfaceCanvases[key] = canvasTexture(256, (g, n) => SURFACE_DRAW[kind](g, n, base));
      const t = surfaceCanvases[key].clone();
      t.needsUpdate = true;
      t.repeat.set(repeatX, repeatY);
      // (the sky's reflection turned shallow slopes flat white, so shiny surfaces reflect it at a lower strength)
      return new THREE.MeshStandardMaterial({ map: t, roughness: kind === "deck" ? 0.68 : kind === "ice" ? 0.15 : 0.9, metalness: kind === "deck" || kind === "slab" ? 0.2 : kind === "ice" ? 0.15 : 0,
        envMapIntensity: kind === "deck" || kind === "slab" ? 0.55 : kind === "ice" ? 0.8 : 1 });
    });
  }
  // The still pieces of a level that share a material become one mesh each (a draw call per mesh is what costs, and a
  // wooded map has hundreds of trees). Anything that moves, anything you stand on, and anything see-through is left alone.
  function mergeLevelMeshes() {
    const skip = new Set(groundMeshes);
    for (const mv of movers) skip.add(mv.mesh);
    for (const g of gates) skip.add(g.mesh);
    const groups = new Map();
    for (const o of levelGroup.children) {
      if (!o.isMesh || skip.has(o) || !o.geometry || !o.geometry.attributes.position || Array.isArray(o.material)) continue;
      if (o.material.transparent || o.material.alphaTest) continue;
      let list = groups.get(o.material);
      if (!list) groups.set(o.material, list = []);
      list.push(o);
    }
    for (const [mat, list] of groups) {
      if (list.length < 2) continue;
      const geos = list.map((o) => { o.updateMatrixWorld(true); const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); return g; });
      let total = 0;
      for (const g of geos) total += g.attributes.position.count;
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
      let off = 0;
      for (const g of geos) {
        pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
        off += g.attributes.position.count;
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = list.some((o) => o.castShadow); mesh.receiveShadow = list.some((o) => o.receiveShadow);
      levelGroup.add(mesh);
      for (const o of list) { levelGroup.remove(o); o.geometry.dispose(); }
      for (const g of geos) g.dispose();
    }
  }

  // ======================================================================
  // LEVEL
  // ======================================================================
  const groundMeshes = [];
  const wallBoxes = [];      // everything that blocks movement
  const bounceBoxes = [];    // the subset you can wall-bounce off: actual walls and pillars
  // A round rock or tank is a box with `round: {x, z, r}`: the box is only its bounding square for quick rejection, and walking into it,
  // bouncing off it and shooting it all use the circle (see resolveWalls, nearestWallNormal and rayHitBox).
  function rayHitBox(ray, box, out) {
    const hit = ray.intersectBox(box, out);
    if (!hit || !box.round) return hit;
    const c = box.round, o = ray.origin, d = ray.direction;
    const ox = o.x - c.x, oz = o.z - c.z, a = d.x * d.x + d.z * d.z, cc = ox * ox + oz * oz - c.r * c.r;
    let best = Infinity;
    if (a > 1e-9) {   // the curved side
      const b = ox * d.x + oz * d.z, disc = b * b - a * cc;
      if (disc >= 0) {
        const t = cc <= 0 ? 0 : (-b - Math.sqrt(disc)) / a;
        const y = o.y + d.y * t;
        if (t >= 0 && y >= box.min.y && y <= box.max.y) best = t;
      }
    }
    if (d.y < -1e-9 && o.y >= box.max.y) {   // the flat top, from above
      const t = (box.max.y - o.y) / d.y, px = ox + d.x * t, pz = oz + d.z * t;
      if (t >= 0 && px * px + pz * pz <= c.r * c.r && t < best) best = t;
    }
    if (best === Infinity) return null;
    return out.copy(o).addScaledVector(d, best);
  }
  const levelGroup = new THREE.Group();   // everything a map builds lives here, so changing map is: empty it and build again
  scene.add(levelGroup);
  const movers = [], portals = [], boosts = [], gates = [];   // moving platforms, portal ends, boost strips
  const ladders = [];        // { x, z, nx, nz, y0, y1 }: where it meets the wall, which way it faces (the side you climb from), bottom and top
  let levelPalette = {};     // this map's surface colours
  let levelLoadedHook = null;

  // surfaces: "grass" for the floor, "deck" for platforms, "concrete" and "brick" for walls
  function addGround(x, y, z, w, d, surface, solid) {
    const tile = surface === "moon" ? 12 : ["grass", "slab", "ice", "roof", "meadow", "dirt"].includes(surface) ? 4 : Math.max(w, d);   // floors tile every 4 m; decks show one border
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), surfaceMaterial(surface, w / tile, d / tile, levelPalette[surface]));
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    levelGroup.add(mesh);
    mesh.userData = { topY: y + 0.25, halfW: w / 2, halfD: d / 2, cx: x, cz: z };
    groundMeshes.push(mesh);
    if (solid) wallBoxes.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  }
  function addWall(x, y, z, w, h, d, surface, stand) {   // stand: its top is a floor you can land on
    const span = Math.max(w, d), tile = surface === "concrete" ? 4 : 3, facade = surface === "facade" || surface === "facadeb";
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surfaceMaterial(surface, facade ? span / 4 : span / tile, facade ? h / 3.2 : h / tile, levelPalette[surface]));
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    levelGroup.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    wallBoxes.push(box);
    bounceBoxes.push(box);
    if (stand) { mesh.userData = { topY: y + h / 2, halfW: w / 2, halfD: d / 2, cx: x, cz: z, wall: true }; groundMeshes.push(mesh); }
    return mesh;
  }

  // ---- ladders: one plane painted with rails and rungs (cut out with alphaTest) a hair off the wall ----
  const ladderTex = canvasTexture(64, (g, n) => {
    g.clearRect(0, 0, n, n);
    g.fillStyle = "#c7a548";
    g.fillRect(7, 0, 6, n); g.fillRect(n - 13, 0, 6, n);                       // the two rails
    for (let y = 4; y < n; y += 16) g.fillRect(9, y, n - 18, 4);                // a rung every quarter metre
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(11, 0, 2, n); g.fillRect(n - 9, 0, 2, n);
  });
  function addLadder(x, z, nx, nz, y0, y1) {
    const h = y1 - y0, tex = ladderTex.clone();
    tex.needsUpdate = true; tex.repeat.set(1, h);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }));
    mesh.position.set(x + nx * 0.05, (y0 + y1) / 2, z + nz * 0.05);
    mesh.rotation.y = Math.atan2(nx, nz);
    mesh.castShadow = false;
    levelGroup.add(mesh);
    ladders.push({ x, z, nx, nz, y0, y1 });
  }

  // ---- moving platforms: a deck that glides back and forth along x, y or z (everyone computes it from the same clock) ----
  function addMover(a) {   // [x, y, z, w, d, axis, range, speed, phase, surface]
    const mesh = addGround(a[0], a[1], a[2], a[3], a[4], a[9] || "deck", true);
    movers.push({ mesh, box: wallBoxes[wallBoxes.length - 1], base: new THREE.Vector3(a[0], a[1], a[2]), axis: a[5], range: a[6], speed: a[7], phase: a[8] || 0 });
  }
  function updateMovers() {
    if (!movers.length) { player.onMover = false; return; }
    let onAny = false;
    const clock = net.active ? mpTargetClock() : elapsedTime;
    for (const mv of movers) {
      const off = Math.sin(clock * mv.speed + mv.phase) * mv.range;
      const nx = mv.base.x + (mv.axis === "x" ? off : 0), ny = mv.base.y + (mv.axis === "y" ? off : 0), nz = mv.base.z + (mv.axis === "z" ? off : 0);
      const ud = mv.mesh.userData, oy = ud.topY - 0.25, ox = ud.cx, oz = ud.cz;
      // anyone standing on it is carried along
      const riding = player.onGround && !localDead && Math.abs(player.feetY - ud.topY) < 0.15 &&
        Math.abs(yawObject.position.x - ox) < ud.halfW + 0.1 && Math.abs(yawObject.position.z - oz) < ud.halfD + 0.1;
      mv.mesh.position.set(nx, ny, nz);
      ud.cx = nx; ud.cz = nz; ud.topY = ny + 0.25;
      mv.mesh.updateMatrixWorld(true);
      mv.box.setFromObject(mv.mesh);
      if (riding) { onAny = true; yawObject.position.x += nx - ox; yawObject.position.z += nz - oz; yawObject.position.y += ny - oy; player.feetY += ny - oy; }
    }
    if (onAny && !player.onMover) noteTrick("lift", "RIDING");
    player.onMover = onAny;
  }

  // ---- sliding gates: a solid wall that slides in and out of a gap on the shared clock, so the way through opens and closes ----
  function addGate(a) {   // [x, z, w, d, h, axis, range, speed, phase, surface]
    const mesh = addWall(a[0], a[4] / 2, a[1], a[2], a[4], a[3], a[9] || "deck");
    const box = wallBoxes[wallBoxes.length - 1];
    box.gate = true;   // (bots plan as if it were open)
    gates.push({ mesh, box, base: new THREE.Vector3(a[0], a[4] / 2, a[1]), axis: a[5], range: a[6], speed: a[7], phase: a[8] || 0 });
  }
  function updateGates() {
    if (!gates.length) return;
    const clock = net.active ? mpTargetClock() : elapsedTime;
    for (const g of gates) {
      const off = Math.sin(clock * g.speed + g.phase) * g.range;
      g.mesh.position.set(g.base.x + (g.axis === "x" ? off : 0), g.base.y, g.base.z + (g.axis === "z" ? off : 0));
      g.mesh.updateMatrixWorld(true);
      g.box.setFromObject(g.mesh);
    }
  }

  // ---- portals: walk into one end and come out of the other, still going the way you were (keeps your speed) ----
  function addPortalPair(a) {   // [x, z, facing x, facing z, x2, z2, facing x2, facing z2]
    const make = (x, z, nx, nz, color) => {
      const g = new THREE.Group();
      g.position.set(x, FLOOR_Y + 1.5, z);
      g.rotation.y = Math.atan2(nx, nz);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 8, 40), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.4 }));
      ring.scale.y = 1.5;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.97, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      disc.scale.y = 1.5;
      g.add(ring, disc);
      levelGroup.add(g);
      return { x, z, nx, nz, disc, pair: null };
    };
    const p = make(a[0], a[1], a[2], a[3], 0x2f9bff), q = make(a[4], a[5], a[6], a[7], 0xff8a2a);
    p.pair = q; q.pair = p;
    portals.push(p, q);
  }
  function tryPortals() {
    if (player.portalCool > 0) return;
    const px = yawObject.position.x, pz = yawObject.position.z, fy = player.feetY;
    for (const P of portals) {
      const dx = px - P.x, dz = pz - P.z, out = dx * P.nx + dz * P.nz, tan = -dx * P.nz + dz * P.nx;
      if (Math.abs(out) > 0.55 || Math.abs(tan) > 1.05 || fy > FLOOR_Y + 2.6 || fy < FLOOR_Y - 0.6) continue;
      if (-(player.velocity.x * P.nx + player.velocity.z * P.nz) < 1.0) continue;   // only when moving into it
      const Q = P.pair;
      const phi = Math.atan2(Q.nx, Q.nz) - (Math.atan2(P.nx, P.nz) + Math.PI);   // turn so that "into this one" becomes "out of that one"
      const c = Math.cos(phi), sn = Math.sin(phi), vx = player.velocity.x, vz = player.velocity.z;
      burst(_gStart.set(P.x, FLOOR_Y + 1.5, P.z), 0x7fc4ff, 10);
      yawObject.position.x = Q.x + Q.nx * 1.05; yawObject.position.z = Q.z + Q.nz * 1.05;
      yawObject.rotation.y += phi; player.lastYaw = yawObject.rotation.y;
      player.velocity.x = vx * c + vz * sn; player.velocity.z = vz * c - vx * sn;
      player.portalCool = 0.6; player.lastPortalAt = elapsedTime; stat("portals"); noteTrick("portal", "PORTAL");
      releaseHook(0);
      burst(_gStart.set(Q.x, FLOOR_Y + 1.5, Q.z), 0xffb070, 10);
      playSfx("jumpPad", 0.5, 1.5, 0.2, "volMove");
      return;
    }
  }

  // ---- boost strips: step on one and it adds speed along its arrows ----
  const boostTexBase = canvasTexture(64, (g, n) => {
    g.fillStyle = "rgba(20,12,4,0.55)"; g.fillRect(0, 0, n, n);
    g.strokeStyle = "#ffb42a"; g.lineWidth = 8; g.lineJoin = "miter";
    for (const y of [10, 40]) { g.beginPath(); g.moveTo(10, y + 18); g.lineTo(n / 2, y); g.lineTo(n - 10, y + 18); g.stroke(); }
  });
  function addBoost(a) {   // [x, z, direction x, direction z, width, length]
    const dl = Math.hypot(a[2], a[3]) || 1, dx = a[2] / dl, dz = a[3] / dl;
    const tex = boostTexBase.clone(); tex.needsUpdate = true; tex.repeat.set(1, Math.max(1, Math.round(a[5] / 2)));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(a[4], a[5]), new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mesh.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    const by = a[6] === undefined ? FLOOR_Y : a[6];
    g.position.set(a[0], by + 0.02, a[1]);
    g.rotation.y = Math.atan2(-dx, -dz);
    g.add(mesh);
    levelGroup.add(g);
    boosts.push({ x: a[0], z: a[1], y: by, dx, dz, w: a[4], l: a[5], pop: a[7] || CFG.boostPop, tex });
  }
  function tryBoosts() {
    if (player.boostCool > 0 || !player.onGround) return;
    const px = yawObject.position.x, pz = yawObject.position.z;
    for (const b of boosts) {
      const along = (px - b.x) * b.dx + (pz - b.z) * b.dz, across = -(px - b.x) * b.dz + (pz - b.z) * b.dx;
      if (Math.abs(along) > b.l / 2 || Math.abs(across) > b.w / 2 || Math.abs(player.feetY - b.y) > 0.6) continue;
      player.velocity.x = b.dx * CFG.maxSpeed; player.velocity.z = b.dz * CFG.maxSpeed;   // instantly at top speed, whatever you were doing
      player.velocity.y = b.pop;
      player.onGround = false; player.sliding = false; player.launch = "pad"; player.groundRise = 0;
      noteTrick("strip", "LAUNCH STRIP");
      player.boostCool = 0.5; player.lastBoostAt = elapsedTime;
      playSfx("jumpPad", 0.6, 1.4, 0.1, "volMove");
      return;
    }
  }
  // the animated part: arrows run along the strips, portals shimmer
  function updateLevelFx(dt) {
    for (const b of boosts) b.tex.offset.y -= dt * 1.2;
    const t = elapsedTime;
    for (const p of portals) p.disc.material.opacity = 0.34 + 0.12 * Math.sin(t * 3 + p.x + p.z);
  }

  // ---- kicker ramps: a sloped floor rising along x or z. Running off the high end turns
  // your speed into lift (see player.groundRise), so a fast run-up throws you into the air ----
  const FLOOR_Y = 0.25;   // top of the main ground
  const ramps = [];
  let rampKind = "deck";   // the surface a map paints its ramps with
  function addRamp(cx, cz, along, width, length, height, dir, base) {   // base: the height the foot of the ramp stands at (default the floor)
    base = base === undefined ? FLOOR_Y : base;
    const r = { cx, cz, along, dir, length, height, base,
      halfW: along === "x" ? length / 2 : width / 2, halfD: along === "x" ? width / 2 : length / 2 };
    ramps.push(r);
    // a wedge: profile in x (length) and y (height), extruded across the width
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(length, 0); shape.lineTo(length, height); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geo.translate(-length / 2, 0, -width / 2);
    {   // the texture goes on by metres of surface (the extruder's own mapping stretches it on a long, shallow slope)
      const pos = geo.attributes.position, uv = geo.attributes.uv, k = Math.hypot(length, height) / length;
      for (let t = 0; t + 2 < pos.count; t += 3) {
        const ax = pos.getX(t + 1) - pos.getX(t), ay = pos.getY(t + 1) - pos.getY(t), az = pos.getZ(t + 1) - pos.getZ(t);
        const bx = pos.getX(t + 2) - pos.getX(t), by = pos.getY(t + 2) - pos.getY(t), bz = pos.getZ(t + 2) - pos.getZ(t);
        const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx), m = Math.max(nx, ny, nz) || 1;
        for (let i = 0; i < 3; i++) {
          const x = pos.getX(t + i), y = pos.getY(t + i), z = pos.getZ(t + i);
          if (nz === m) uv.setXY(t + i, x, y);   // the two triangular sides
          else if (nx === m) uv.setXY(t + i, z, y);   // the tall end
          else uv.setXY(t + i, x * k, z);   // the slope and the underside
        }
      }
      uv.needsUpdate = true;
    }
    if (along === "x") { if (dir < 0) geo.rotateY(Math.PI); }
    else geo.rotateY(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    const mesh = new THREE.Mesh(geo, surfaceMaterial(rampKind, 0.25, 0.25, levelPalette[rampKind]));
    mesh.position.set(cx, base, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    levelGroup.add(mesh);
    // the sides and the tall end block you; on the slope your feet are always within a step
    // of these, so they never get in the way of running up it
    const along0 = (u) => (along === "x" ? cx : cz) + dir * (u - 0.5) * length;
    const box = (a0, a1, c0, c1, h) => {
      const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      wallBoxes.push(along === "x"
        ? new THREE.Box3(new THREE.Vector3(lo, base, c0), new THREE.Vector3(hi, base + h, c1))
        : new THREE.Box3(new THREE.Vector3(c0, base, lo), new THREE.Vector3(c1, base + h, hi)));
    };
    const across = along === "x" ? cz : cx, half = width / 2, segs = Math.ceil(length);
    for (let i = 0; i < segs; i++) {
      const h = height * (i + 1) / segs;
      if (h <= CFG.stepHeight) continue;
      box(along0(i / segs), along0((i + 1) / segs), across - half - 0.1, across - half + 0.1, h);
      box(along0(i / segs), along0((i + 1) / segs), across + half - 0.1, across + half + 0.1, h);
    }
    box(along0(1) - 0.15 * dir, along0(1) + 0.15 * dir, across - half, across + half, height);
  }
  function rampHeight(r, x, z) {
    if (Math.abs(x - r.cx) > r.halfW || Math.abs(z - r.cz) > r.halfD) return -Infinity;
    const a = r.along === "x" ? x - r.cx : z - r.cz;
    return r.base + r.height * Math.min(Math.max(0.5 + r.dir * a / r.length, 0), 1);
  }
  function rampAt(x, z, groundY) {
    for (const r of ramps) if (Math.abs(rampHeight(r, x, z) - groundY) < 0.001) return r;
    return null;
  }

  // ---- jump pads: stand on one and it fires you straight up, with a little extra speed ----
  // Two tiers, told apart by colour, size and the height of their light column.
  const PAD_TIERS = {
    normal: { power: () => CFG.jumpPadPower, boost: () => CFG.jumpPadBoost, color: 0x1bd6c8, beamColor: 0x5ff0e4, radius: 1.3, beam: 2.6 },
    mega: { power: () => CFG.megaPadPower, boost: () => CFG.megaPadBoost, color: 0xd23cff, beamColor: 0xe58bff, radius: 1.6, beam: 5.2 },
  };
  const padBaseMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.6 });
  // the light column fades out toward the top: an alpha map running from opaque at the base to clear
  const beamFade = canvasTexture(64, (g, n) => {
    const grad = g.createLinearGradient(0, n, 0, 0);   // canvas bottom is the cylinder's base (v = 0)
    grad.addColorStop(0, "#fff");
    grad.addColorStop(0.35, "#888");
    grad.addColorStop(1, "#000");
    g.fillStyle = grad; g.fillRect(0, 0, n, n);
  });
  beamFade.wrapS = beamFade.wrapT = THREE.ClampToEdgeWrapping;
  const jumpPads = [];
  function addJumpPad(x, y, z, tier) {
    const T = PAD_TIERS[tier];
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(T.radius + 0.15, T.radius + 0.3, 0.14, 32), padBaseMat);
    base.position.y = 0.07;
    base.receiveShadow = true;
    const glowMat = new THREE.MeshStandardMaterial({ color: T.color, emissive: T.color, emissiveIntensity: 0.8, roughness: 0.4 });
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(T.radius - 0.15, T.radius - 0.15, 0.16, 32), glowMat);
    glow.position.y = 0.08;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(T.radius, 0.05, 6, 40), glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    // a column of light so pads read from across the map; taller for the mega pads
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(T.radius - 0.4, T.radius - 0.15, T.beam, 24, 1, true), new THREE.MeshBasicMaterial({
      color: T.beamColor, alphaMap: beamFade, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 0.16 + T.beam / 2;
    g.add(base, glow, ring, beam);
    levelGroup.add(g);
    jumpPads.push({ x, y: y + 0.16, z, r: T.radius, power: T.power(), boost: T.boost(), glowMat, beam, flash: 0 });
  }
  function updateJumpPads(dt) {
    for (const p of jumpPads) {
      p.flash = Math.max(0, p.flash - dt * 3);
      p.glowMat.emissiveIntensity = 0.7 + 0.25 * Math.sin(elapsedTime * 4 + p.x) + p.flash * 1.5;
      p.beam.material.opacity = 0.26 + 0.08 * Math.sin(elapsedTime * 4 + p.x) + p.flash * 0.5;
    }
  }

  // ---- decoration: a mast, a water tank (solid), a door painted on a wall ----
  // water: a tinted body with two layers of bright ripples drifting different ways over it (the glints), so it moves and catches the light
  let waterTexBase = null;
  function waterTexture() {
    if (waterTexBase) return waterTexBase;
    const n = 128, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d"), img = g.createImageData(n, n), T = Math.PI * 2 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {   // sums of whole waves, so it tiles
      const v = Math.sin(x * T * 3 + Math.sin(y * T * 2) * 1.6) + Math.sin(y * T * 4 + Math.sin(x * T * 3) * 1.3) + Math.sin((x + y) * T * 2);
      const a = Math.pow(Math.max(0, v / 3), 3), i = (y * n + x) * 4;
      img.data[i] = 220; img.data[i + 1] = 240; img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    waterTexBase = new THREE.CanvasTexture(c);
    waterTexBase.wrapS = waterTexBase.wrapT = THREE.RepeatWrapping;
    return waterTexBase;
  }
  function addWater(geo, x, z, repX, repZ, scaleZ) {
    const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1f6a98, emissive: 0x082a44, emissiveIntensity: 0.3, transparent: true, opacity: 0.92, roughness: 0.55, metalness: 0.0, depthWrite: false }));
    body.rotation.x = -Math.PI / 2; body.scale.y = scaleZ; body.position.set(x, FLOOR_Y + 0.04, z);
    levelGroup.add(body);
    [[1, 0.012, 0.012, 0.26, 0.044], [0.6, -0.009, 0.016, 0.15, 0.048]].forEach(([rep, vx, vy, opacity, lift], k) => {
      const tex = waterTexture().clone();
      tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repX * rep * (k ? 1.7 : 1), repZ * rep * (k ? 1.7 : 1));
      const glints = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
      glints.rotation.x = -Math.PI / 2; glints.scale.y = scaleZ; glints.position.set(x, FLOOR_Y + lift, z);
      levelGroup.add(glints);
      waterAnim.push({ tex, vx, vy });
    });
  }
  function updateWater(t) { for (const a of waterAnim) a.tex.offset.set((t * a.vx) % 1, (t * a.vy) % 1); }
  function addDecor(d) {   // ["mast", x, roof height, z] ["tank", x, roof height, z] ["door", x, z, facing x, facing z]
    const kind = d[0];
    if (kind === "mast") {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), sharedMat("mast", () => new THREE.MeshStandardMaterial({ color: 0x59606a, metalness: 0.6, roughness: 0.5 })));
      pole.position.set(d[1], d[2] + 3, d[3]);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), sharedMat("lamp", () => new THREE.MeshBasicMaterial({ color: 0xff3b30 })));
      lamp.position.set(d[1], d[2] + 6.1, d[3]);
      levelGroup.add(pole, lamp);
    } else if (kind === "tank") {
      const steel = sharedMat("tank", () => new THREE.MeshStandardMaterial({ color: 0x7b8794, metalness: 0.5, roughness: 0.6 }));
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 20), steel);
      body.position.set(d[1], d[2] + 2.0, d[3]); body.castShadow = true;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 20), steel);
      cap.position.set(d[1], d[2] + 3.35, d[3]);
      levelGroup.add(body, cap);
      for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.15), sharedMat("leg", () => new THREE.MeshStandardMaterial({ color: 0x3a3f46 })));
        leg.position.set(d[1] + lx, d[2] + 0.5, d[3] + lz);
        levelGroup.add(leg);
      }
      const box = new THREE.Box3(new THREE.Vector3(d[1] - 1.25, d[2], d[3] - 1.25), new THREE.Vector3(d[1] + 1.25, d[2] + 3.3, d[3] + 1.25));
      box.round = { x: d[1], z: d[3], r: 1.25 };
      wallBoxes.push(box); bounceBoxes.push(box);
    } else if (kind === "tree") {   // ["tree", x, z, scale, height of the ground]
      const sc = d[3] || 1, gy = d[4] === undefined ? FLOOR_Y : d[4];
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * sc, 0.3 * sc, 3.4 * sc, 7), sharedMat("trunk", () => new THREE.MeshStandardMaterial({ color: 0x5b4331, roughness: 1 })));
      trunk.position.set(d[1], gy + 1.7 * sc, d[2]); trunk.castShadow = true;
      levelGroup.add(trunk);
      const bucket = Math.floor((Math.abs(d[1] * 7 + d[2] * 13) % 10) / 2.5), tint = 0.85 + bucket * 0.1;   // four shades of green, so the trees can share materials
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((2.1 - k * 0.5) * sc, (2.6 - k * 0.2) * sc, 8), sharedMat("cone" + bucket, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2f6a35).multiplyScalar(tint), roughness: 1, flatShading: true })));
        cone.position.set(d[1], gy + (2.6 + k * 1.45) * sc, d[2]);
        levelGroup.add(cone);
      }
      const box = new THREE.Box3(new THREE.Vector3(d[1] - 0.35 * sc, gy, d[2] - 0.35 * sc), new THREE.Vector3(d[1] + 0.35 * sc, gy + 5 * sc, d[2] + 0.35 * sc));
      wallBoxes.push(box); bounceBoxes.push(box);
    } else if (kind === "boulder") {   // ["boulder", x, z, size, height of the ground]: something to take cover behind or jump onto
      const sz = d[3] || 2, gy = d[4] === undefined ? FLOOR_Y : d[4];
      const geo = new THREE.IcosahedronGeometry(sz * 0.62, 0);
      const mesh = new THREE.Mesh(geo, sharedMat("boulder", () => new THREE.MeshStandardMaterial({ color: 0x8d887e, roughness: 1, flatShading: true })));
      mesh.scale.set(1.1, 0.78, 0.95); mesh.rotation.y = (d[1] * 3.1 + d[2] * 1.7) % 6.28;
      mesh.position.set(d[1], gy + sz * 0.4, d[2]); mesh.castShadow = true; mesh.receiveShadow = true;
      levelGroup.add(mesh);
      const half = sz * 0.58, top = gy + sz * 0.78;
      const box = new THREE.Box3(new THREE.Vector3(d[1] - half, gy, d[2] - half), new THREE.Vector3(d[1] + half, top, d[2] + half));
      box.round = { x: d[1], z: d[2], r: half };   // a round rock is round to walk into and shoot
      wallBoxes.push(box); bounceBoxes.push(box);
      const proxy = new THREE.Object3D();   // so you can land on top of it (the square inside the circle, so nobody stands on air)
      proxy.userData = { topY: top, halfW: half * 0.72, halfD: half * 0.72, cx: d[1], cz: d[2], wall: true };
      groundMeshes.push(proxy);
    } else if (kind === "pond") {   // ["pond", x, z, radius]: shallow water you can wade through
      const r = d[3];
      addWater(new THREE.CircleGeometry(r, 36), d[1], d[2], r / 3, r / 3, 0.7);
      const deep = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 28), new THREE.MeshBasicMaterial({ color: 0x14507a, transparent: true, opacity: 0.42, depthWrite: false }));   // deeper in the middle
      deep.rotation.x = -Math.PI / 2; deep.scale.y = 0.7; deep.position.set(d[1], FLOOR_Y + 0.052, d[2]);
      const foam = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r * 1.04, 48), new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.26, depthWrite: false }));   // foam along the edge
      foam.rotation.x = -Math.PI / 2; foam.scale.y = 0.7; foam.position.set(d[1], FLOOR_Y + 0.056, d[2]);
      levelGroup.add(deep, foam);
    } else if (kind === "river") {   // ["river", x, z, width, length]: shallow water you can wade through
      addWater(new THREE.PlaneGeometry(d[3], d[4]), d[1], d[2], d[3] / 6, d[4] / 6, 1);
      for (const side of [-1, 1]) {   // foam along both banks
        const foam = new THREE.Mesh(new THREE.PlaneGeometry(0.7, d[4]), new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.24, depthWrite: false }));
        foam.rotation.x = -Math.PI / 2; foam.position.set(d[1] + side * (d[3] / 2 - 0.3), FLOOR_Y + 0.056, d[2]);
        levelGroup.add(foam);
      }
    } else if (kind === "sign") {   // ["sign", x, z, "text", direction it faces (1 = +x, -1 = -x)]: a distance board
      const c = document.createElement("canvas"); c.width = 256; c.height = 128;
      const g = c.getContext("2d");
      g.fillStyle = "#22262b"; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = "#ffd24a"; g.lineWidth = 6; g.strokeRect(4, 4, 248, 120);
      g.fillStyle = "#fff"; g.font = "bold 64px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(d[3]), 128, 68);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
      board.position.set(d[1], FLOOR_Y + 2.4, d[2]); board.rotation.y = (d[4] || 1) > 0 ? Math.PI / 2 : -Math.PI / 2;
      levelGroup.add(board);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), new THREE.MeshStandardMaterial({ color: 0x555d66 }));
      post.position.set(d[1] - (d[4] || 1) * 0.12, FLOOR_Y + 1.2, d[2]);
      levelGroup.add(post);
    } else if (kind === "door") {
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.8), new THREE.MeshStandardMaterial({ color: 0x555d66, roughness: 0.8 }));
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), new THREE.MeshStandardMaterial({ color: 0x20252b, roughness: 0.7 }));
      for (const [m, off] of [[frame, 0.04], [leaf, 0.06]]) {
        m.position.set(d[1] + d[3] * off, FLOOR_Y + 1.4, d[2] + d[4] * off);
        m.rotation.y = Math.atan2(d[3], d[4]);
        levelGroup.add(m);
      }
    }
  }

  // ---- the hill of King of the Hill: a ring and a column of light on the summit, coloured by who holds it ----
  let hillVis = null;
  function buildHill(h) {
    const g = new THREE.Group();
    g.position.set(h.x, h.y + 0.04, h.z);
    const mk = (geo, opacity) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const ring = mk(new THREE.TorusGeometry(h.r, 0.12, 8, 56), 0.9); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1;
    const disc = mk(new THREE.CircleGeometry(h.r, 40), 0.16); disc.rotation.x = -Math.PI / 2;
    const beam = mk(new THREE.CylinderGeometry(h.r * 0.9, h.r, 14, 28, 1, true), 0.2); beam.position.y = 7;
    g.add(ring, disc, beam);
    g.visible = false;
    levelGroup.add(g);
    hillVis = { g, mats: [ring.material, disc.material, beam.material], h };
  }
  function setHillColor(hex) { if (hillVis) for (const m of hillVis.mats) m.color.setHex(hex); }

  // ---- maps ----
  // A map is plain data: walls [x, y, z, w, h, d, surface], decks [x, y, z, w, d, surface] (walkable platforms),
  // ramps [cx, cz, along, width, length, height, dir], pads [x, z, tier], spawns for deathmatch, a spawn for solo play, and a
  // theme (sky, light and surface colours). The floor's top is always 0.25 m. The outer walls are added from `half`.
  const MAPS = {}, MAP_ORDER = [];
  function defineMap(m) { MAPS[m.id] = m; MAP_ORDER.push(m.id); }
  const wallAt = (x, z, w, d, h, surface) => [x, h / 2, z, w, h, d, surface];   // a wall resting on the floor

  // The original arena: built for trickshots (bounce corridors, kicker ramps, pads and a sniper tower)
  defineMap({
    maxBots: 11,   // (a big map holds more bots in practice)
    id: "arena", name: "Arena", blurb: "The trickshot arena: bounce corridors, kicker ramps, jump pads and a sniper tower.",
    half: 40, floor: "grass", wallH: 12, targetMaxY: 9.5,
    theme: { skyTop: 0x3f7dc6, skyHorizon: 0xcfe2ee, fog: [45, 140], sunDir: [30, 50, 20], sunColor: 0xfff0d8, sunIntensity: 1.0, hemi: [0xd6e4f7, 0x4d5c3a, 0.58], surfaces: { grass: "#58853f" } },
    walls: [
      // bounce corridors: parallel walls to chain wall bounces down (the inner wall is 3.5 m lower so you can climb out over it)
      [-31, 5.75, -8, 1, 11.5, 22, "concrete"], [-25, 4, -8, 1, 8, 22, "concrete"],
      [18, 4, 6, 1, 8, 12, "brick"], [24, 5.75, 6, 1, 11.5, 12, "brick"],
      // pillars to bounce off and duck behind
      [-15, 4, -24, 3, 8, 3, "brick"], [13, 4, -24, 3, 8, 3, "brick"], [-18, 4, 20, 3, 8, 3, "brick"], [-6, 3, 30, 3, 6, 3, "brick"],
      // the legs of the sniper tower
      [27, 3.15, -33, 0.8, 6.3, 0.8, "concrete"], [33, 3.15, -33, 0.8, 6.3, 0.8, "concrete"], [27, 3.15, -27, 0.8, 6.3, 0.8, "concrete"], [33, 3.15, -27, 0.8, 6.3, 0.8, "concrete"],
    ],
    decks: [[30, 6.3, -30, 7, 7, "deck", true]],   // the tower: its top is at 6.55 m, which a mega pad clears
    ramps: [[-8, 18, "x", 4, 7, 2.4, 1], [12, 22, "z", 4, 7, 2.4, -1], [-4, -30, "x", 4, 7, 2.4, -1]],
    pads: [[0, -2, "mega"], [24, -24, "mega"], [-30, 30, "mega"], [-28, -27, "normal"], [30, 30, "normal"], [-28, 12, "normal"]],
    spawns: [[0, 8], [-28, 28], [28, 28], [28, -28], [-28, -28], [0, 28], [-28, 2], [8, -26], [26, -2], [-10, -34], [-34, -12], [36, 12], [-10, -12], [20, -16], [-14, 36], [36, -14], [18, 14], [36, -36]],
    playerSpawn: [0, 8],
  });

  // Courtyard: close quarters. A ring of walls with four gates round a small court, a lane all the way round outside it
  defineMap({
    flags: [[-20, 0, 0.25], [20, 0, 0.25]],
    id: "courtyard", name: "Courtyard", blurb: "Close quarters at dusk: a ring of walls with four gates, a lane round the outside. Great with shotguns and Deagles.",
    half: 25, floor: "grass", wallH: 8, targetMaxY: 6.5,
    theme: { skyTop: 0x3c4a8c, skyHorizon: 0xf0b58a, fog: [26, 90], sunDir: [-40, 16, 30], sunColor: 0xffc99a, sunIntensity: 1.0, hemi: [0xffd9b8, 0x6a5a44, 0.55],
      surfaces: { grass: "#c9b48a", concrete: "#b7a89a", brick: "#a35c48", deck: "#7d8591" } },
    walls: [
      // the ring (4.5 m: nobody sees over it), with a 5 m gate in the middle of each side
      wallAt(-7.25, -12, 9.5, 1, 4.5, "brick"), wallAt(7.25, -12, 9.5, 1, 4.5, "brick"),
      wallAt(-7.25, 12, 9.5, 1, 4.5, "brick"), wallAt(7.25, 12, 9.5, 1, 4.5, "brick"),
      wallAt(-12, -7.25, 1, 9.5, 4.5, "brick"), wallAt(-12, 7.25, 1, 9.5, 4.5, "brick"),
      wallAt(12, -7.25, 1, 9.5, 4.5, "brick"), wallAt(12, 7.25, 1, 9.5, 4.5, "brick"),
      // the court: four pillars round a low block
      wallAt(-4.5, -4.5, 2.5, 2.5, 4, "concrete"), wallAt(4.5, -4.5, 2.5, 2.5, 4, "concrete"),
      wallAt(-4.5, 4.5, 2.5, 2.5, 4, "concrete"), wallAt(4.5, 4.5, 2.5, 2.5, 4, "concrete"),
      wallAt(0, 0, 3, 3, 1.4, "concrete"),
      // the outside lane: low walls to crouch behind, and a tall pillar in each corner
      wallAt(18, 5, 1, 4, 1.4, "concrete"), wallAt(18, -5, 1, 4, 1.4, "concrete"), wallAt(-18, 5, 1, 4, 1.4, "concrete"), wallAt(-18, -5, 1, 4, 1.4, "concrete"),
      wallAt(5, 18, 4, 1, 1.4, "concrete"), wallAt(-5, 18, 4, 1, 1.4, "concrete"), wallAt(5, -18, 4, 1, 1.4, "concrete"), wallAt(-5, -18, 4, 1, 1.4, "concrete"),
      wallAt(-20, -20, 3, 3, 6, "brick"), wallAt(20, -20, 3, 3, 6, "brick"), wallAt(-20, 20, 3, 3, 6, "brick"), wallAt(20, 20, 3, 3, 6, "brick"),
    ],
    decks: [], ramps: [],
    pads: [[-19.5, 0, "normal"], [19.5, 0, "normal"]],
    spawns: [[-21, -9], [-21, 9], [21, -9], [21, 9], [-9, -21], [9, -21], [-9, 21], [9, 21], [0, -8], [0, 8], [-8, 0], [8, 0], [-9, -9], [9, 9], [-9, 9], [9, -9]],
    playerSpawn: [0, 8],
  });

  // Foundry: a long central hall with crates, side lanes through gaps in the walls, and a raised gallery at each end
  defineMap({
    flags: [[0, -28, 2.65], [0, 28, 2.65]],
    id: "foundry", name: "Foundry", blurb: "A steel works, symmetric for team play: a long hall of crates with sliding gates, side lanes, and a raised gallery at each end.",
    half: 35, floor: "slab", wallH: 9, targetMaxY: 7,
    theme: { skyTop: 0x5f6d7d, skyHorizon: 0xb9c3cc, fog: [30, 105], sunDir: [-25, 45, -30], sunColor: 0xe8eef5, sunIntensity: 0.85, hemi: [0xcfd8e2, 0x4a4f55, 0.7],
      surfaces: { slab: "#4f565e", concrete: "#8b949d", brick: "#9b5a3d", deck: "#6b747d" } },
    walls: [
      // the hall: two long walls with a pair of gaps each (4 m) to cross through
      wallAt(-9, -14.5, 1, 11, 6, "concrete"), wallAt(-9, 0, 1, 10, 6, "concrete"), wallAt(-9, 14.5, 1, 11, 6, "concrete"),
      wallAt(9, -14.5, 1, 11, 6, "concrete"), wallAt(9, 0, 1, 10, 6, "concrete"), wallAt(9, 14.5, 1, 11, 6, "concrete"),
      // crates in the hall
      wallAt(-3.5, 0, 2, 2, 1.4, "deck"), wallAt(3.5, 0, 2, 2, 1.4, "deck"),
      // the side lanes: an outer wall with a gap, so the lanes can be entered from the yards
      wallAt(-21, -9, 1, 10, 4.5, "brick"), wallAt(-21, 9, 1, 10, 4.5, "brick"), wallAt(21, -9, 1, 10, 4.5, "brick"), wallAt(21, 9, 1, 10, 4.5, "brick"),
      // a tall pillar in each corner of the yards
      wallAt(-30, -30, 3, 3, 7, "brick"), wallAt(30, -30, 3, 3, 7, "brick"), wallAt(-30, 30, 3, 3, 7, "brick"), wallAt(30, 30, 3, 3, 7, "brick"),
    ],
    // a raised gallery at each end, reached by a ramp from either side (tops are level with the ramps' high ends: 2.65 m)
    decks: [[0, 2.4, -28, 14, 6, "deck", true], [0, 2.4, 28, 14, 6, "deck", true]],
    ramps: [[-10, -28, "x", 4, 6, 2.4, 1], [10, -28, "x", 4, 6, 2.4, -1], [-10, 28, "x", 4, 6, 2.4, 1], [10, 28, "x", 4, 6, 2.4, -1]],
    pads: [[-28, 0, "normal"], [28, 0, "normal"]],
    boosts: [[0, -18, 0, 1, 3.5, 3.5], [0, 18, 0, -1, 3.5, 3.5]],
    // sliding gates in the four gaps of the hall: they slide into the wall to open and back to close
    gates: [[-9, 7, 1.2, 4, 6, "z", 4, 0.5, 0, "deck"], [-9, -7, 1.2, 4, 6, "z", 4, 0.5, 3.14, "deck"], [9, 7, 1.2, 4, 6, "z", 4, 0.5, 1.57, "deck"], [9, -7, 1.2, 4, 6, "z", 4, 0.5, 4.71, "deck"]],
    spawns: [[-30, -22], [30, -22], [-30, 22], [30, 22], [-28, 0], [28, 0], [-15, -24], [15, -24], [-15, 24], [15, 24], [0, -23], [0, 23], [-5, -3], [5, 3], [-15, 9], [15, -9], [-17, -9], [17, 9]],
    playerSpawn: [0, 22],
  });

  // Moonbase: low gravity, black sky, two portal pairs and boost strips
  defineMap({
    flags: [[-38, -30, 0.25], [38, 30, 0.25]],
    maxBots: 11,   // (a big map holds more bots in practice)
    id: "moonbase", name: "Moonbase", blurb: "Low gravity on the moon: huge jumps and long hang time, rocks and base modules, two pairs of portals.",
    half: 45, floor: "moon", wallH: 18, targetMaxY: 18, physics: { gravity: 8.5 },
    theme: { skyTop: 0x04050c, skyHorizon: 0x1a1d2c, fog: [80, 260], sunDir: [-30, 28, 40], sunColor: 0xffffff, sunIntensity: 1.35, hemi: [0x5b6c92, 0x2a2d3a, 0.62],
      surfaces: { moon: "#8c8f96", concrete: "#767a82", brick: "#5b6470", deck: "#a0a6af", facade: "#8f969f", facadeb: "#6e7885", roof: "#6c7078" } },
    buildings: [[-22, -20, 12, 8, 4.5, "facade"], [22, 20, 12, 8, 4.5, "facade"], [22, -22, 8, 12, 6.5, "facadeb"], [-22, 22, 8, 12, 6.5, "facadeb"], [0, 0, 7, 7, 9.5, "facade"]],
    walls: [
      wallAt(-33, -5, 4, 4, 7, "brick"), wallAt(33, 5, 4, 4, 7, "brick"), wallAt(-6, -33, 4, 4, 8, "brick"), wallAt(6, 33, 4, 4, 8, "brick"),
      wallAt(-35, 30, 5, 5, 5, "brick"), wallAt(35, -30, 5, 5, 5, "brick"),
      wallAt(-12, -10, 3, 3, 1.6, "brick"), wallAt(12, 10, 3, 3, 1.6, "brick"), wallAt(-10, 12, 3, 3, 1.6, "brick"), wallAt(10, -12, 3, 3, 1.6, "brick"),
    ],
    decks: [], ramps: [],
    pads: [[-7, 0, "normal"], [7, 0, "normal"], [0, -7, "normal"], [0, 7, "normal"]],
    portals: [[-38, 0, 1, 0, 38, 0, -1, 0], [0, -38, 0, 1, 0, 38, 0, -1]],
    spawns: [[-38, -38], [38, -38], [-38, 38], [38, 38], [-40, -20], [40, 20], [-20, 40], [20, -40], [-10, -30], [10, 30], [30, 10], [-30, -10], [-35, 13], [35, -13], [-11, 5], [11, -5], [-3, 41], [3, -41]],
    playerSpawn: [0, -30],
  });

  // Ice Lake: slippery. Everything you do carries on; steering is slow
  defineMap({
    maxBots: 11,   // (a big map holds more bots in practice)
    id: "icelake", name: "Ice Lake", blurb: "A frozen lake where nothing stops: slides never end and turning is slow. Ice pillars, snowbanks, an iceberg with a ramp up.",
    half: 40, floor: "ice", wallH: 7, targetMaxY: 9, physics: { friction: 0.7, momentumFriction: 0.25, groundAccel: 3.2, slideFriction: 0.22, maxSpeed: 25, speedMultMax: 2.085 },   // the speed cap is 25 here, and the speed bonus reaches x2.085 with it (a map's own maxSpeed and speedMultMax)
    theme: { skyTop: 0x5f9bd6, skyHorizon: 0xe4f1fb, fog: [50, 170], sunDir: [20, 45, -35], sunColor: 0xfff6e6, sunIntensity: 1.0, hemi: [0xe6f3ff, 0x9fb4c4, 0.8],
      surfaces: { ice: "#bfe3f2", concrete: "#dfeaf2", brick: "#9fd0e8", deck: "#c9d9e6", facade: "#dfeaf2", facadeb: "#9fd0e8", roof: "#d6e4ee" } },
    walls: [
      wallAt(-25, -20, 3, 3, 6, "brick"), wallAt(25, -20, 3, 3, 6, "brick"), wallAt(-25, 20, 3, 3, 6, "brick"), wallAt(25, 20, 3, 3, 6, "brick"), wallAt(0, -30, 3, 3, 6, "brick"), wallAt(0, 30, 3, 3, 6, "brick"),
      wallAt(-12, -8, 10, 1.5, 1.3, "concrete"), wallAt(12, 8, 10, 1.5, 1.3, "concrete"),
      wallAt(0, 0, 10, 10, 4.5, "brick"),   // the iceberg: a solid block whose top (4.5 m) you can stand on
    ],
    decks: [],
    ramps: [[-9, 0, "x", 4, 8, 4.25, 1], [28, -5, "x", 4, 8, 2.4, -1], [-28, 6, "x", 4, 8, 2.4, 1]],
    pads: [],
    boosts: [[0, -14, 1, 0, 3.5, 3.5], [0, 14, -1, 0, 3.5, 3.5]],
    spawns: [[-34, -34], [34, -34], [-34, 34], [34, 34], [-36, 0], [36, 0], [0, -36], [0, 36], [-20, -30], [20, 30], [-12, 8], [12, -8], [-6, -16], [6, 16], [-16, 26], [16, -26], [-30, -16], [30, 16]],
    playerSpawn: [0, 24],
  });

  // Range: a long lane with distance boards, for the shooting range mode (dummies stand at rangeSpots)
  defineMap({
    id: "range", noRandom: true, name: "Range", blurb: "A long firing lane with distance boards every 10 metres. Used by the shooting range mode.",
    half: 40, floor: "slab", wallH: 8, targetMaxY: 6,
    theme: { skyTop: 0x6fa8e8, skyHorizon: 0xe8eef2, fog: [80, 240], sunDir: [30, 55, 10], sunColor: 0xfff6e8, sunIntensity: 1.0, hemi: [0xe6f0ff, 0x7d8288, 0.65],
      surfaces: { slab: "#7d838b", concrete: "#9aa0a8", brick: "#8a6f5c", deck: "#838b95" } },
    walls: [wallAt(-14, 0, 1, 76, 1.2, "concrete"), wallAt(14, 0, 1, 76, 1.2, "concrete"), wallAt(0, 33, 6, 1, 1.1, "concrete")],   // lane edges, and the firing line
    decks: [], ramps: [], pads: [],
    decor: [["sign", -13, 26, "10 m", 1], ["sign", 13, 26, "10 m", -1], ["sign", -13, 16, "20 m", 1], ["sign", 13, 16, "20 m", -1], ["sign", -13, 1, "35 m", 1], ["sign", 13, 1, "35 m", -1],
      ["sign", -13, -14, "50 m", 1], ["sign", 13, -14, "50 m", -1], ["sign", -13, -34, "70 m", 1], ["sign", 13, -34, "70 m", -1]],
    rangeSpots: [[0, 26], [-5, 16], [5, 1], [-4, -14], [4, -34]],
    spawns: [[-6, 36], [-2, 36], [2, 36], [6, 36]],
    playerSpawn: [0, 36],
  });

  // Summit: a wooded valley around a stepped hill. The hill is where King of the Hill is played
  const plateau = (cx, cz, w, d, top, topKind) => ({ wall: [cx, (top - 0.5) / 2, cz, w, top - 0.5, d, "rock"], deck: [cx, top - 0.25, cz, w, d, topKind || "meadow", true] });
  const SUMMIT_TIERS = [plateau(0, 0, 44, 44, 3), plateau(0, 0, 26, 26, 6), plateau(0, 0, 10, 10, 9)];
  const summitDecor = [];
  {
    let seed = 20261008;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const spawnsAt = [[-40, -40], [40, -40], [-40, 40], [40, 40], [-41, 0], [41, 0], [0, -41], [0, 41], [-30, -38], [30, 38], [-38, 30], [38, -30]];
    for (let tries = 0; tries < 400 && summitDecor.length < 46; tries++) {
      const x = (rand() * 2 - 1) * 41, z = (rand() * 2 - 1) * 41;
      if (Math.abs(x) < 26 && Math.abs(z) < 26) continue;                     // the hill and its shelf
      if (Math.abs(x) < 4.5 || Math.abs(z) < 4.5) continue;                   // the trails up
      if (summitDecor.some((q) => Math.hypot(q[1] - x, q[2] - z) < 4)) continue;
      if (spawnsAt.some((s) => Math.hypot(s[0] - x, s[1] - z) < 3.5)) continue;
      if (Math.hypot(x + 34, z + 30) < 8 || Math.hypot(x - 36, z - 34) < 7) continue;   // the ponds
      summitDecor.push(["tree", x, z, 0.8 + rand() * 0.7]);
    }
  }
  defineMap({
    maxBots: 11,   // (a big map holds more bots in practice)
    id: "summit", name: "Summit", blurb: "A wooded valley round a stepped hill with a lookout on top: trails and ramps up three tiers, ladders up the last cliff, boulders and trees for cover. The home of King of the Hill.",
    half: 45, floor: "grass", wallH: 12, targetMaxY: 14, boundary: "rock", rampSurface: "dirt",
    theme: { skyTop: 0x4a93e0, skyHorizon: 0xe3edf3, fog: [75, 230], sunDir: [40, 60, -20], sunColor: 0xfff1d6, sunIntensity: 0.95, hemi: [0xdfe9f5, 0x4c5f33, 0.5],
      surfaces: { grass: "#46682d", meadow: "#527636", rock: "#8b857a", dirt: "#7c6547", concrete: "#8b857a", deck: "#7c6547" } },
    walls: SUMMIT_TIERS.map((t) => t.wall),
    decks: SUMMIT_TIERS.map((t) => t.deck),
    // up from the valley on all four sides, then up each tier
    ramps: [
      [0, 28, "z", 4, 12, 2.75, -1], [0, -28, "z", 4, 12, 2.75, 1], [28, 0, "x", 4, 12, 2.75, -1], [-28, 0, "x", 4, 12, 2.75, 1],
      [16.5, 0, "x", 4, 7, 3, -1, 3], [-16.5, 0, "x", 4, 7, 3, 1, 3],
      [0, 8, "z", 4, 6, 3, -1, 6], [0, -8, "z", 4, 6, 3, 1, 6],
    ],
    ladders: [[5, 0, 1, 0, 6, 9], [-5, 0, -1, 0, 6, 9]],
    pads: [[-17, 17, "mega", 3], [17, -17, "mega", 3]],
    decor: summitDecor.concat([
      ["boulder", -26, -12, 2.6], ["boulder", 25, 14, 3], ["boulder", -13, 27, 2.4], ["boulder", 14, -28, 2.8], ["boulder", 35, -12, 3.4], ["boulder", -36, 14, 3.2],
      ["boulder", -16, -17, 1.8, 3], ["boulder", 15, 18, 2, 3], ["boulder", 18, -12, 1.6, 3], ["boulder", -18, 12, 1.6, 3],
      ["boulder", 9, 10, 1.4, 6], ["boulder", -9, -10, 1.4, 6],
      ["tree", -19, 19, 0.9, 3], ["tree", 19, -19, 0.9, 3], ["tree", 20, 18, 1, 3], ["tree", -20, -18, 1, 3],
      ["pond", -34, -30, 5.5], ["pond", 36, 34, 4.5],
    ]),
    hill: { x: 0, z: 0, y: 9, r: 3.6 },
    spawns: [[-40, -40], [40, -40], [-40, 40], [40, 40], [-41, 0], [41, 0], [0, -41], [0, 41], [-30, -38], [30, 38], [-38, 30], [38, -30], [-25, 11], [25, -11], [-17, 37], [17, -37], [25, 19], [-25, -19]],
    playerSpawn: [0, 41],
  });

  // Canyon: a desert canyon with a river down the middle, a base at each end, and ledges up both sides
  const CANYON_LEDGES = [plateau(-40, -29, 16, 34, 7, "dirt"), plateau(-40, 29, 16, 34, 7, "dirt"), plateau(40, -29, 16, 34, 7, "dirt"), plateau(40, 29, 16, 34, 7, "dirt")];   // (the raised bases at each end of the river are gone: the flags sit on the ground)
  const CANYON_BOULDERS = [[-20, -30, 4.5], [18, -34, 5], [-24, -10, 6], [22, -8, 5.5], [-18, 12, 5], [20, 14, 6.5], [-22, 32, 4.5], [16, 30, 5]];
  defineMap({
    flags: [[0, -40, 0.25], [0, 40, 0.25]],
    maxBots: 11,   // (a big map holds more bots in practice)
    id: "canyon", name: "Canyon", blurb: "A desert canyon with a river down the middle: long sight lines, a flag spot at each end, ledges up both sides (take the ramps or the mega pads) and two bridges.",
    half: 50, floor: "dirt", wallH: 24, targetMaxY: 12, boundary: "rock", rampSurface: "dirt",
    theme: { skyTop: 0x6aa4da, skyHorizon: 0xf3dcb4, fog: [75, 230], sunDir: [-35, 50, 25], sunColor: 0xfff0d0, sunIntensity: 1.05, hemi: [0xf5e6d0, 0x8a6a4a, 0.6],
      surfaces: { dirt: "#c9a46b", rock: "#b8714a", concrete: "#b8714a", deck: "#a8814f" } },
    walls: CANYON_LEDGES.map((t) => t.wall).concat([wallAt(-18, -8, 3, 3, 9, "rock"), wallAt(18, 8, 3, 3, 9, "rock"), wallAt(-12, 18, 3, 3, 7, "rock"), wallAt(12, -18, 3, 3, 7, "rock")]),
    decks: CANYON_LEDGES.map((t) => t.deck).concat([[0, 2.25, -25, 12, 6, "dirt", true], [0, 2.25, 25, 12, 6, "dirt", true]]),
    ramps: [
      [-26, -22, "x", 5, 12, 6.75, -1], [-26, 22, "x", 5, 12, 6.75, -1], [26, -22, "x", 5, 12, 6.75, 1], [26, 22, "x", 5, 12, 6.75, 1],   // up to the ledges
      [-9.5, -25, "x", 6, 7, 2.25, 1], [9.5, -25, "x", 6, 7, 2.25, -1], [-9.5, 25, "x", 6, 7, 2.25, 1], [9.5, 25, "x", 6, 7, 2.25, -1],   // up to the bridges
    ],
    pads: [[-28, 0, "mega"], [28, 0, "mega"], [-12, -36, "normal"], [12, 36, "normal"]],
    decor: CANYON_BOULDERS.map((b) => ["boulder", b[0], b[1], b[2]]).concat([["river", 0, 0, 8, 68]]),
    spawns: [[-22, -44], [22, -44], [-22, 44], [22, 44], [-40, 0], [40, 0], [-18, -2], [18, 2], [-27, -15], [27, 15], [-27, 15], [27, -15], [14, -28], [-14, 28], [12, 24], [-12, -24], [0, -46], [0, 46]],
    playerSpawn: [-16, 44],
  });

  // Rooftops: a street canyon between two rows of buildings at three heights, with ladders, ramps, bridges and pads between the levels
  const roofBox = (x, z, top, w, d, h) => [x, top + h / 2, z, w, h, d, "deck"];   // a crate or vent standing on a roof
  defineMap({
    flags: [[0, -31.5, 0.25], [0, 31.5, 0.25]],   // at the two ends of the street
    id: "rooftops", name: "Rooftops", blurb: "Three levels: a street canyon, rooftops at 6.5 and 10 m, climbed by ladders, ramps and lifts, linked by bridges and a shuttle. Hold forward at a ladder to climb.",
    half: 34, floor: "slab", wallH: 14, targetMaxY: 13,
    theme: { skyTop: 0x4f86d4, skyHorizon: 0xf1e2c8, fog: [55, 170], sunDir: [35, 40, -25], sunColor: 0xfff3dc, sunIntensity: 1.1, hemi: [0xe6f0ff, 0x6d6f73, 0.6],
      surfaces: { slab: "#5a5e66", concrete: "#aeb2b7", brick: "#b66d4f", deck: "#838b95", facade: "#aeb2b7", facadeb: "#b66d4f", roof: "#6e7279" } },
    // [x, z, width, depth, height, surface, parapet edges]: windows on the fronts, a low wall round each roof except where a ladder, ramp or bridge arrives
    buildings: [
      [-13.5, -18.5, 17, 15, 6.5, "facade", "n"], [-13.5, 0, 17, 14, 10, "facadeb", ""], [-13.5, 18.5, 17, 15, 6.5, "facade", "s"],
      [13.5, -18.5, 17, 15, 6.5, "facade", "n"], [13.5, 0, 17, 14, 10, "facadeb", ""], [13.5, 18.5, 17, 15, 6.5, "facade", "s"],
    ],
    decor: [
      ["mast", -20, 6.5, -24], ["mast", 20, 6.5, 24], ["mast", -20, 6.5, 24], ["mast", 20, 6.5, -24], ["tank", -17, 10, -4], ["tank", 17, 10, -4],
      ["door", -5, -15, 1, 0], ["door", -5, 4.5, 1, 0], ["door", -5, 15, 1, 0], ["door", 5, -15, -1, 0], ["door", 5, -4.5, -1, 0], ["door", 5, 15, -1, 0],
    ],
    // a shuttle gliding across the street between the two tall roofs, and a lift beside each tall building
    movers: [[0, 9.75, -3, 4, 4, "x", 2.9, 0.6, 0, "deck"], [-23.5, 5, -3, 3, 3, "y", 4.75, 0.5, 0, "deck"], [23.5, 5, 3, 3, 3, "y", 4.75, 0.5, 3.14, "deck"]],

    walls: [
      // vents and crates on the roofs to take cover behind
      roofBox(-16, -20, 6.5, 3, 3, 1.8), roofBox(-10, -16.5, 6.5, 2, 2, 1.2), roofBox(16, -20, 6.5, 3, 3, 1.8), roofBox(10, -16.5, 6.5, 2, 2, 1.2),
      roofBox(-16, 20, 6.5, 3, 3, 1.8), roofBox(-10, 16.5, 6.5, 2, 2, 1.2), roofBox(16, 20, 6.5, 3, 3, 1.8), roofBox(10, 16.5, 6.5, 2, 2, 1.2),
      roofBox(-15, 3, 10, 3, 3, 2), roofBox(-9, -3, 10, 2, 2, 1.2), roofBox(15, 3, 10, 3, 3, 2), roofBox(9, -3, 10, 2, 2, 1.2),
      // low cover down in the street and the yards
      wallAt(0, -8, 3, 1, 1.4, "concrete"), wallAt(0, 8, 3, 1, 1.4, "concrete"), wallAt(-27, -12, 1, 4, 1.4, "concrete"), wallAt(27, -12, 1, 4, 1.4, "concrete"),
      wallAt(-27, 12, 1, 4, 1.4, "concrete"), wallAt(27, 12, 1, 4, 1.4, "concrete"),
    ],
    // a bridge over the street between each pair of low roofs
    decks: [[0, 6.25, -18.5, 10, 3, "deck", true], [0, 6.25, 18.5, 10, 3, "deck", true]],
    // a ramp from each yard up to a low roof (the roof edge is at 6.5 m)
    ramps: [[-27, -18.5, "x", 4, 10, 6.25, 1], [27, -18.5, "x", 4, 10, 6.25, -1], [-27, 18.5, "x", 4, 10, 6.25, 1], [27, 18.5, "x", 4, 10, 6.25, -1]],
    pads: [[0, -25, "normal"], [0, 25, "normal"], [-27, -7, "mega"], [-27, 7, "mega"], [27, -7, "mega"], [27, 7, "mega"], [-12, -12.3, "mega", 6.5], [12, 12.3, "mega", 6.5]],   // the last two sit on the low roofs: run off one to reach the tall roof
    // [x, z, facing x, facing z, bottom, top]: on the street walls up to each roof, and on the yard side of the tall buildings
    ladders: [
      [-5, -22, 1, 0, 0.25, 6.5], [-5, 0, 1, 0, 0.25, 10], [-5, 22, 1, 0, 0.25, 6.5],
      [5, -22, -1, 0, 0.25, 6.5], [5, 0, -1, 0, 0.25, 10], [5, 22, -1, 0, 0.25, 6.5],
      [-22, 0, -1, 0, 0.25, 10], [22, 0, 1, 0, 0.25, 10],
    ],
    spawns: [[-29, -27], [29, -27], [-29, 27], [29, 27], [-29, 0], [29, 0], [0, -21], [0, 21], [-13, -9], [13, -9], [-13, 9], [13, 9], [0, -4], [0, 4], [-30, -14], [30, 14], [-30, 14], [30, -14]],
    playerSpawn: [0, 26],
  });

  // Harbour: a container terminal. Rows of shipping containers make lanes and cover; some stand two high (ladders up), some have a ramp
  // up the side. Mirrored four ways: a flag yard at each end (z), a clear lane up the middle.
  const HARBOUR = { walls: [], decks: [], ramps: [], ladders: [], spawns: [] };
  {
    // every container is the same size: 12 m long, 2.5 m wide, 3.6 m high (stacked ones 7.2: taller than a real one, so a jump does not show you over it). A container is a wall with a thin deck on its roof: the deck is what bots and ladders and ramps treat as a floor
    const CH = 3.6;
    const cbox = (x, z, w, d, col, y0, h) => [x, (y0 || 0) + (h || CH) / 2, z, w, h || CH, d, col];   // plain: cover you can still jump onto if low
    const cont = (x, z, w, d, col, y0) => { const top = (y0 || 0) + CH; return { wall: [x, ((y0 || 0) + top - 0.5) / 2, z, w, top - 0.5 - (y0 || 0), d, col], deck: [x, top - 0.25, z, w, d, col, true] }; };
    const quarter = {
      walls: [cbox(12, 29, 2.5, 12, "cred"), cbox(26, 10, 12, 2.5, "cgreen"), cbox(28, 24, 12, 2.5, "cyellow"), cbox(0, 38.5, 12, 2.5, "cred"), cbox(0, 14, 12, 2.5, "corange")],
      conts: [cont(12, 14, 2.5, 12, "cblue"), cont(12, 29, 2.5, 12, "corange", CH)],
      ramps: [[17.75, 14, "x", 3, 9, CH - 0.25, -1]],
      ladders: [[10.75, 29, -1, 0, 0.25, CH * 2]],
      spawns: [[5, 27], [18, 33], [35, 35], [34, 16]],
    };
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const mir = (w) => [w[0] * sx, w[1], w[2] * sz, w[3], w[4], w[5], w[6]];
      for (const w of quarter.walls) if (!(w[0] === 0 && sx < 0)) HARBOUR.walls.push(mir(w));
      for (const c of quarter.conts) { HARBOUR.walls.push(mir(c.wall)); HARBOUR.decks.push([c.deck[0] * sx, c.deck[1], c.deck[2] * sz, c.deck[3], c.deck[4], c.deck[5], true]); }
      for (const r of quarter.ramps) HARBOUR.ramps.push([r[0] * sx, r[1] * sz, r[2], r[3], r[4], r[5], r[6] * sx]);
      for (const l of quarter.ladders) HARBOUR.ladders.push([l[0] * sx, l[1] * sz, l[2] * sx, l[3] * sz, l[4], l[5]]);
      for (const q of quarter.spawns) HARBOUR.spawns.push([q[0] * sx, q[1] * sz]);
    }
    HARBOUR.spawns.push([0, 24], [0, -24]);
  }
  defineMap({
    flags: [[0, -35, 0.25], [0, 35, 0.25]],
    id: "harbour", name: "Harbour", blurb: "A container terminal at sunset: rows of containers make lanes and cover, some stacked two high (ladders) and some with a ramp up the side. A flag yard at each end.",
    half: 40, floor: "slab", wallH: 12, targetMaxY: 8,
    theme: { skyTop: 0x4a7fc0, skyHorizon: 0xf7d9b4, fog: [45, 140], sunDir: [-40, 28, 30], sunColor: 0xffd9a8, sunIntensity: 1.0, hemi: [0xfbe3c8, 0x5e6368, 0.62],
      surfaces: { slab: "#6d7378", concrete: "#a39d94", deck: "#7d848b", cred: "#b3392f", cblue: "#2f5f9e", cgreen: "#3a7d4f", corange: "#d9822b", cyellow: "#d6b13a" } },
    walls: HARBOUR.walls,
    decks: HARBOUR.decks,
    ramps: HARBOUR.ramps,
    pads: [],
    ladders: HARBOUR.ladders,
    spawns: HARBOUR.spawns,
    playerSpawn: [0, 24],
  });

  const BASE_PHYS = { gravity: CFG.gravity, friction: CFG.friction, momentumFriction: CFG.momentumFriction, groundAccel: CFG.groundAccel, slideFriction: CFG.slideFriction, maxSpeed: CFG.maxSpeed, speedMultMax: CFG.speedMultMax };
  let currentMap = null;
  // "random" is a choice, never a map: it picks one of the real maps (a different one from the current map each time)
  function pickRandomMap(excludeId) {
    const pool = MAP_ORDER.filter((i) => i !== excludeId && !MAPS[i].noRandom);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const resolveMapChoice = (choice) => (choice === "random" ? pickRandomMap(currentMap && currentMap.id) : choice);
  let SPAWNS = [[0, 8]];   // the deathmatch spawn points of the current map
  // paint the sky, fog and light of a map
  function applyTheme(t) {
    SKY_TOP = t.skyTop; SKY_HORIZON = t.skyHorizon;
    scene.background.setHex(t.skyHorizon);
    scene.fog.color.setHex(t.skyHorizon); scene.fog.near = t.fog[0]; scene.fog.far = t.fog[1];
    skyDome.material.uniforms.top.value.setHex(t.skyTop);
    skyDome.material.uniforms.horizon.value.setHex(t.skyHorizon);
    SUN_DIR.set(t.sunDir[0], t.sunDir[1], t.sunDir[2]).normalize();
    sun.position.copy(SUN_DIR).multiplyScalar(60);
    sun.color.setHex(t.sunColor); sun.intensity = t.sunIntensity;
    hemi.color.setHex(t.hemi[0]); hemi.groundColor.setHex(t.hemi[1]); hemi.intensity = t.hemi[2];
    buildEnvironment();
  }
  // empty the level and build a map. opts.keepPlayer: leave the player where they are (replays do)
  function loadMap(id, opts) {
    const m = MAPS[id] || MAPS.arena;
    opts = opts || {};
    if (currentMap === m && !opts.force) return;
    const first = !currentMap;
    levelGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => { if (mt.map) mt.map.dispose(); mt.dispose(); });
    });
    levelGroup.clear();
    levelMats.clear(); waterAnim.length = 0;
    groundMeshes.length = 0; wallBoxes.length = 0; bounceBoxes.length = 0; ramps.length = 0; jumpPads.length = 0; ladders.length = 0; movers.length = 0; portals.length = 0; boosts.length = 0; gates.length = 0;
    currentMap = m;
    CFG.arenaHalfSize = m.half;
    Object.assign(CFG, BASE_PHYS, m.physics || {});   // some maps change gravity or friction
    levelPalette = m.theme.surfaces || {};
    applyTheme(m.theme);
    const H = m.half, wh = m.wallH || 12;
    addGround(0, 0, 0, H * 2, H * 2, m.floor || "grass");
    const bk = m.boundary || "concrete";
    addWall(0, wh / 2, -H, H * 2, wh, 1, bk);
    addWall(0, wh / 2, H, H * 2, wh, 1, bk);
    addWall(-H, wh / 2, 0, 1, wh, H * 2, bk);
    addWall(H, wh / 2, 0, 1, wh, H * 2, bk);
    for (const w of m.walls) addWall(w[0], w[1], w[2], w[3], w[4], w[5], w[6], true);   // crates and pillars can be jumped onto
    // a building: a solid body with a walkable roof on top (a roof's top is at its height h)
    // [x, z, width, depth, height, surface, parapet edges]: "n" "s" "w" "e" put a low wall along that edge of the roof
    for (const b of m.buildings || []) {
      addWall(b[0], (b[4] - 0.5) / 2, b[1], b[2], b[4] - 0.5, b[3], b[5]);
      addGround(b[0], b[4] - 0.25, b[1], b[2], b[3], "roof", true);
      for (const e of b[6] || "") {
        if (e === "n") addWall(b[0], b[4] + 0.55, b[1] - b[3] / 2 + 0.2, b[2], 1.1, 0.4, "concrete", true);
        if (e === "s") addWall(b[0], b[4] + 0.55, b[1] + b[3] / 2 - 0.2, b[2], 1.1, 0.4, "concrete", true);
        if (e === "w") addWall(b[0] - b[2] / 2 + 0.2, b[4] + 0.55, b[1], 0.4, 1.1, b[3], "concrete", true);
        if (e === "e") addWall(b[0] + b[2] / 2 - 0.2, b[4] + 0.55, b[1], 0.4, 1.1, b[3], "concrete", true);
      }
    }
    for (const d of m.decks) addGround(d[0], d[1], d[2], d[3], d[4], d[5], d[6]);
    rampKind = m.rampSurface || "deck";
    for (const r of m.ramps) addRamp(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]);
    for (const p of m.pads) addJumpPad(p[0], p[3] === undefined ? FLOOR_Y : p[3], p[1], p[2]);   // [x, z, tier, height (default the floor)]
    for (const l of m.ladders || []) addLadder(l[0], l[1], l[2], l[3], l[4], l[5]);
    for (const d of m.decor || []) addDecor(d);
    hillVis = null;
    if (m.hill) buildHill(m.hill);
    for (const a of m.movers || []) addMover(a);
    for (const a of m.gates || []) addGate(a);
    for (const a of m.portals || []) addPortalPair(a);
    for (const a of m.boosts || []) addBoost(a);
    mergeLevelMeshes();
    SPAWNS = m.spawns;
    PLAYER_SPAWN.set(m.playerSpawn[0], 1.7, m.playerSpawn[1]);
    const e = H + 10;   // the shadow camera has to cover the whole map
    sun.shadow.camera.left = -e; sun.shadow.camera.right = e; sun.shadow.camera.top = e; sun.shadow.camera.bottom = -e;
    sun.shadow.camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
    if (!first && levelLoadedHook) levelLoadedHook(opts);
  }

  // ======================================================================
  // TARGETS
  // ======================================================================
  // Four kinds, each with one look and one behaviour, so you can read a target at a glance:
  //   red: standard, stands still      orange: standard size, always moving
  //   blue: small, stands still        purple: tiny, darts about fast
  // How many of each are up at once is a setting; a hit target comes back as the same kind.
  const TARGET_TYPES = {
    normal: { color: "#e5352f", scale: 1, motion: "none", setting: "tgtNormal" },
    moving: { color: "#ff8a1c", scale: 1, motion: "slide", setting: "tgtMoving" },
    small: { color: "#19c6e0", scale: 0.5, motion: "none", setting: "tgtSmall" },
    tiny: { color: "#7b2bf0", scale: 0.3, motion: "dart", setting: "tgtTiny" },
  };
  const TARGET_ORDER = ["normal", "moving", "small", "tiny"];
  const targets = [];
  let targetsReady = false;   // set once startup is done; settings changes before then are just stored
  // A steel plate painted with a bullseye in the target type's colour, held in a steel rim.
  // When it's hit the whole plate punches out and falls, leaving the empty rim hanging for a
  // moment.
  const plateGeo = new THREE.CylinderGeometry(0.97, 0.97, 0.07, 40);
  plateGeo.rotateX(Math.PI / 2);   // faces +Z
  const plateRimGeo = new THREE.TorusGeometry(1, 0.06, 8, 40);
  const plateSteel = new THREE.MeshStandardMaterial({ color: 0x8e959d, roughness: 0.45, metalness: 0.7 });
  function bullseyeMaterial(color) {
    const tex = canvasTexture(256, (g, n) => {
      const rings = [color, "#f4f4f2", color, "#f4f4f2", color];
      rings.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(n / 2, n / 2, (n / 2) * (1 - i * 0.19), 0, Math.PI * 2); g.fill(); });
      g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(n / 2, n / 2, (n / 2) * (1 - i * 0.19) - 1, 0, Math.PI * 2); g.stroke(); }
    });
    // a touch of glow so a plate in shadow still reads against the sky
    return new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.38, roughness: 0.55, metalness: 0.1 });
  }
  // plate materials for its [edge, front, back]
  const TARGET_LOOKS = {};
  for (const kind of TARGET_ORDER) TARGET_LOOKS[kind] = [plateSteel, bullseyeMaterial(TARGET_TYPES[kind].color), plateSteel];
  // the colourblind-friendly set (Okabe-Ito): blue, yellow, pink and green never lean on red against orange
  const TARGET_COLORS_DEFAULT = {}, TARGET_COLORS_SAFE = { normal: "#0072b2", moving: "#f0e442", small: "#cc79a7", tiny: "#009e73" };
  for (const kind of TARGET_ORDER) TARGET_COLORS_DEFAULT[kind] = TARGET_TYPES[kind].color;
  let targetPaletteSafe = false;
  // the HUD grows with the window (1080p gets 1.15x, 1440p and up 1.4x), times the Accessibility size setting
  function applyHudScale() {
    const auto = Math.min(Math.max(Math.min(window.innerWidth / 1280, window.innerHeight / 720), 1), 1.5);
    document.documentElement.style.setProperty("--hud-scale", String(+(SETTINGS.hudScale * (1 + (auto - 1) * 0.6)).toFixed(3)));
  }
  window.addEventListener("resize", applyHudScale);
  function applyTargetPalette() {
    if (targetPaletteSafe === !!SETTINGS.colorblindTargets) return;
    targetPaletteSafe = !!SETTINGS.colorblindTargets;
    for (const kind of TARGET_ORDER) {
      TARGET_TYPES[kind].color = (targetPaletteSafe ? TARGET_COLORS_SAFE : TARGET_COLORS_DEFAULT)[kind];
      TARGET_LOOKS[kind] = [plateSteel, bullseyeMaterial(TARGET_TYPES[kind].color), plateSteel];
    }
    for (const t of targets) if (t.children[0] && t.userData.type) t.children[0].material = TARGET_LOOKS[t.userData.type];
  }

  const PLAYER_SPAWN = new THREE.Vector3(0, 1.7, 8);
  loadMap("arena");   // the first build (the level hook isn't set yet, so nothing else is touched)

  const _spawnProbe = new THREE.Vector3();
  function insideSolid(x, y, z, margin) {
    _spawnProbe.set(x, y, z);
    for (const b of wallBoxes) if (b.distanceToPoint(_spawnProbe) < margin) return true;
    for (const r of ramps) if (rampHeight(r, x, z) > -Infinity && y < r.height + r.base + margin) return true;
    return false;
  }

  // Where a target of this kind should go: try a batch of random spots and keep the one furthest
  // from the other targets, and further still from ones of the same kind, so the map fills evenly
  // and no colour bunches up in one corner. Never right next to the player.
  // a target has to be visible from at least 3 of 14 spread-out open spots on the map (picked when the map loads)
  let mapViews = [];
  function targetSeen(x, y, z) {
    if (!mapViews.length) return true;
    let seen = 0;
    for (const v of mapViews) if (botLineClear(v[0], 1.7, v[1], x, y, z) && ++seen >= 3) return true;
    return false;
  }
  function buildMapViews() {
    mapViews = [];
    const cells = [];
    for (let j = 0; j < NAV_N; j++) for (let i = 0; i < NAV_N; i++) if (!navBlocked[j * NAV_N + i]) cells.push([-navHalf + (i + 0.5) * NAV_CELL, -navHalf + (j + 0.5) * NAV_CELL]);
    for (let k = 0; k < 14 && cells.length; k++) mapViews.push(cells.splice(Math.floor(Math.random() * cells.length), 1)[0]);
  }
  function pickTargetSpot(type, exclude) {
    const lim = CFG.arenaHalfSize - 6;
    const me = yawObject.position;
    let best = null, bestScore = -Infinity;
    for (let a = 0; a < 48; a++) {
      const x = (Math.random() * 2 - 1) * lim;
      const z = (Math.random() * 2 - 1) * lim;
      const y = 1.7 + Math.random() * ((currentMap.targetMaxY || 9) - 1.7);
      if (Math.hypot(x - PLAYER_SPAWN.x, z - PLAYER_SPAWN.z) < 11) continue;
      if (Math.hypot(x - me.x, z - me.z) < 12) continue;
      if (insideSolid(x, y, z, 1.6)) continue;
      if (!targetSeen(x, y, z)) continue;   // never somewhere nobody can see from the open parts of the map
      let nearAny = 30, nearSame = 40;
      for (const t of targets) {
        if (t === exclude || !t.userData.base) continue;
        const b = t.userData.base;
        const d = Math.hypot(x - b.x, z - b.z, (y - b.y) * 0.6);
        nearAny = Math.min(nearAny, d);
        if (t.userData.type === type) nearSame = Math.min(nearSame, d);
      }
      const score = nearAny + 0.6 * nearSame + Math.random() * 2;
      if (score > bestScore) { bestScore = score; best = new THREE.Vector3(x, y, z); }
    }
    return best || new THREE.Vector3((Math.random() * 2 - 1) * lim, 2 + Math.random() * 6, -(8 + Math.random() * 18));
  }

  // where a moving target is at time `clock`, from its base and motion
  const _tgtPos = new THREE.Vector3();
  function targetPositionAt(ud, clock, out) {
    const m = ud.motion;
    out.copy(ud.base);
    if (!m) return out;
    if (m.kind === "slide") {
      const off = Math.cos(clock * m.speed + m.phase) * m.amp;
      out.x += off * m.ax; out.z += off * m.az;
      if (m.ampV) out.y += Math.sin(clock * m.speedV + m.phase) * m.ampV;
    } else {
      // dart: three sine waves at unrelated rates trace a looping, hard-to-predict path
      out.x += Math.sin(clock * m.fx + m.px) * m.amp;
      out.z += Math.sin(clock * m.fz + m.pz) * m.amp;
      out.y += Math.sin(clock * m.fy + m.py) * m.ampV;
    }
    return out;
  }
  // true if the whole path stays in the open: inside the arena, above the floor, clear of walls
  function pathIsClear(ud) {
    const bound = CFG.arenaHalfSize - 2;
    for (let i = 0; i < 64; i++) {
      targetPositionAt(ud, i * 0.37, _tgtPos);
      if (Math.abs(_tgtPos.x) > bound || Math.abs(_tgtPos.z) > bound || _tgtPos.y < 1.3) return false;
      if (insideSolid(_tgtPos.x, _tgtPos.y, _tgtPos.z, 1.2 * ud.scale + 0.3)) return false;
    }
    return true;
  }
  function makeMotion(kind) {
    const phase = Math.random() * Math.PI * 2;
    if (kind === "slide") {
      // orange: a steady slide back and forth, about 3 to 6 u/s through the middle; some also bob
      const ang = Math.random() * Math.PI * 2;
      return { kind, phase, ax: Math.cos(ang), az: Math.sin(ang), amp: 3.5 + Math.random() * 3, speed: 0.75 + Math.random() * 0.3,
        ampV: Math.random() < 0.35 ? 1 + Math.random() : 0, speedV: 1 + Math.random() * 0.6 };
    }
    // purple: fast, around 8 to 10 u/s on average, and never quite repeating the same line
    return { kind, phase, amp: 3.5 + Math.random(), ampV: 1 + Math.random() * 0.5,
      fx: 2.2 + Math.random() * 0.6, fz: 1.8 + Math.random() * 0.5, fy: 2.8 + Math.random() * 0.6,
      px: Math.random() * 6.28, pz: Math.random() * 6.28, py: Math.random() * 6.28 };
  }

  // give a target its kind: size, look, and (for movers) a path. Returns false if no full-size
  // path fits here without hitting a wall; with `squeeze` it settles for a smaller one instead.
  function setTargetType(t, type, squeeze) {
    const ud = t.userData, T = TARGET_TYPES[type];
    ud.type = type;
    ud.small = type === "small" || type === "tiny";   // scoring reads these
    ud.moving = T.motion !== "none";
    ud.scale = T.scale;
    t.scale.setScalar(ud.scale);
    ud.hitRadius = 1.1 * ud.scale;
    t.children[0].material = TARGET_LOOKS[type];
    ud.motion = null;
    if (T.motion === "none") return true;
    for (let tries = 0; tries < 6; tries++) {
      ud.motion = makeMotion(T.motion);
      if (pathIsClear(ud)) return true;
    }
    if (!squeeze) return false;
    for (let tries = 0; tries < 6; tries++) {
      ud.motion = makeMotion(T.motion);
      ud.motion.amp *= 0.6; ud.motion.ampV *= 0.6;
      if (pathIsClear(ud)) return true;
    }
    ud.motion.amp = 1.2; ud.motion.ampV = 0;   // boxed in: a short wiggle in place
    return true;
  }

  function placeTarget(t) {
    // movers get a few spots to try, so they end up somewhere with room to move
    for (let attempt = 0; attempt < 6; attempt++) {
      t.userData.base.copy(pickTargetSpot(t.userData.type, t));
      if (setTargetType(t, t.userData.type, attempt === 5)) break;
    }
    t.position.copy(targetPositionAt(t.userData, elapsedTime, _tgtPos));
  }

  function makeTarget(type) {
    const group = new THREE.Group();
    const plate = new THREE.Mesh(plateGeo, TARGET_LOOKS[type]);
    const rim = new THREE.Mesh(plateRimGeo, plateSteel);
    group.add(plate, rim);   // children[0] plate, [1] rim
    group.userData = { idx: targets.length, alive: true, hitRadius: 1.1, base: new THREE.Vector3(), type, moving: false, small: false, scale: 1, motion: null, knockT: -1 };
    scene.add(group);
    targets.push(group);
    placeTarget(group);
    return group;
  }
  function removeTarget(t) {
    scene.remove(t);
    targets.splice(targets.indexOf(t), 1);
    targets.forEach((x, i) => { x.userData.idx = i; });
  }
  // bring the targets on the map in line with the per-kind counts in the settings
  function syncTargetCounts() {
    if (net.active) return;   // a match uses the host's targets
    for (const type of TARGET_ORDER) {
      const want = SETTINGS[TARGET_TYPES[type].setting];
      const have = targets.filter((t) => t.userData.type === type);
      for (let i = have.length; i < want; i++) makeTarget(type);
      for (let i = have.length - 1; i >= want; i--) removeTarget(have[i]);
    }
  }

  // hit: the plate punches out backwards and tumbles down; the empty rim hangs a moment, then shrinks away
  const TARGET_RING_HOLD = 0.5, TARGET_RING_SHRINK = 0.15;
  function knockOutTarget(t) {
    const ud = t.userData;
    ud.knockT = 0;
    ud.coreVel = ud.coreVel || new THREE.Vector3();
    ud.coreVel.set((Math.random() - 0.5) * 1.5, 1.5 + Math.random(), -(3.5 + Math.random() * 1.5));   // local: back, up a little
    ud.coreSpin = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 6);
    recEvent({ type: "ko", i: targets.indexOf(t), ty: ud.type, cv: [r3(ud.coreVel.x), r3(ud.coreVel.y), r3(ud.coreVel.z)], sp: r2(ud.coreSpin) });
  }
  function animateKnockout(t, dt) {
    const ud = t.userData;
    if (ud.knockT === undefined || ud.knockT < 0) return;
    ud.knockT += dt;
    const plate = t.children[0];
    ud.coreVel.y -= CFG.gravity * 0.6 * dt;
    plate.position.addScaledVector(ud.coreVel, dt / ud.scale);   // local units are scaled with the target
    plate.rotation.x += ud.coreSpin * dt;
    plate.scale.setScalar(Math.max(0.01, 1 - Math.max(0, ud.knockT - 0.45) / 0.25));
    const k = Math.max(0, ud.knockT - TARGET_RING_HOLD) / TARGET_RING_SHRINK;
    t.children[1].scale.setScalar(Math.max(0.01, 1 - k));
    if (k >= 1 && ud.knockT >= 0.7) { t.visible = false; ud.knockT = -1; }
  }
  function resetTargetParts(t) {
    for (const c of t.children) { c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.setScalar(1); }
    t.userData.knockT = -1;
  }

  function respawnTarget(t) {
    resetTargetParts(t);
    t.userData.tclock = undefined;
    placeTarget(t);
    if (typeof recEvent === "function") recEvent({ type: "spawn", i: targets.indexOf(t), ty: t.userData.type, p: [r3(t.position.x), r3(t.position.y), r3(t.position.z)] });
    t.userData.alive = true;
    t.visible = true;
  }

  // Everything a remote peer needs to rebuild a target exactly as the host has it.
  function serializeTarget(t) {
    const u = t.userData;
    return { b: [u.base.x, u.base.y, u.base.z], ty: u.type, a: u.alive, mo: u.motion };
  }
  function applyTargetData(t, d) {
    const u = t.userData;
    resetTargetParts(t);
    u.base.set(d.b[0], d.b[1], d.b[2]);
    setTargetType(t, TARGET_TYPES[d.ty] ? d.ty : "normal", true);
    u.motion = d.mo || null;
    t.position.copy(targetPositionAt(u, elapsedTime, _tgtPos));
    u.alive = d.a;
    t.visible = d.a;
  }

  // The purple target is a snitch: get close and it speeds up and pulls away from you, back
  // toward its own path once you back off. It won't run through walls or out of the arena,
  // so you can corner it.
  function snitchStep(t, dt) {
    const ud = t.userData;
    if (ud.tclock === undefined) { ud.tclock = elapsedTime; ud.fear = 0; ud.fleeX = 0; ud.fleeY = 0; ud.fleeZ = 0; }
    const dx = t.position.x - yawObject.position.x, dz = t.position.z - yawObject.position.z;
    const d = Math.hypot(dx, t.position.y - yawObject.position.y, dz);
    const fear = Math.max(0, 1 - d / CFG.snitchRange);
    ud.fear += (fear - ud.fear) * Math.min(1, dt * 4);
    ud.tclock += dt * (1 + CFG.snitchSpeedUp * ud.fear);
    const hd = Math.hypot(dx, dz) || 1, want = CFG.snitchFlee * ud.fear, k = Math.min(1, dt * 3);
    ud.fleeX += (dx / hd * want - ud.fleeX) * k;
    ud.fleeZ += (dz / hd * want - ud.fleeZ) * k;
    ud.fleeY += (want * 0.35 - ud.fleeY) * k;
    targetPositionAt(ud, ud.tclock, _tgtPos);
    const bound = CFG.arenaHalfSize - 2;
    for (let i = 0; i < 4; i++) {
      const x = _tgtPos.x + ud.fleeX, y = _tgtPos.y + ud.fleeY, z = _tgtPos.z + ud.fleeZ;
      if (Math.abs(x) < bound && Math.abs(z) < bound && y > 1.3 && y < 14 && !insideSolid(x, y, z, 0.6)) break;
      ud.fleeX *= 0.6; ud.fleeY *= 0.6; ud.fleeZ *= 0.6;   // blocked: give up some of the getaway
    }
    t.position.set(_tgtPos.x + ud.fleeX, _tgtPos.y + ud.fleeY, _tgtPos.z + ud.fleeZ);
  }

  let elapsedTime = 0;
  function updateTargets(dt) {
    elapsedTime += dt;
    // in multiplayer every peer samples the host's clock, so moving targets line up
    const clock = net.active ? mpTargetClock() : elapsedTime;
    for (const t of targets) {
      const ud = t.userData;
      if (!ud.alive) {
        animateKnockout(t, dt);
        if (net.role === "client") continue;   // the host decides when targets come back
        ud.respawnTimer -= dt;
        if (ud.respawnTimer <= 0) { respawnTarget(t); if (net.role === "host") mpAnnounceSpawn(t); }
        continue;
      }
      if (ud.type === "tiny" && !net.active) snitchStep(t, dt);
      else if (ud.motion) t.position.copy(targetPositionAt(ud, clock, _tgtPos));
      // face the player, with a gentle sway so they don't look pinned in place
      t.rotation.y = Math.atan2(yawObject.position.x - t.position.x, yawObject.position.z - t.position.z) +
        Math.sin(clock * (ud.scale < 1 ? 2.1 : 1.3) + (ud.motion ? ud.motion.phase : ud.idx)) * 0.22;
    }
  }

  // ======================================================================
  // PROPS
  // ======================================================================
  const props = [];
  const propMeshes = [];
  let propsWereMoving = false, propShadowTimer = 0;   // shadows re-bake ~10x a second while a crate moves
  function activeProps() { return net.active ? [] : propMeshes; }
  function setPropsEnabled(on) {
    for (const p of props) p.mesh.visible = on;
    renderer.shadowMap.needsUpdate = true;
  }
  function updateProps(dt) {
    if (net.active) return;
    let moving = false;
    for (const p of props) {
      const pos = p.mesh.position;
      p.velocity.y -= CFG.gravity * dt;
      pos.addScaledVector(p.velocity, dt);

      // push out of pillars and platform sides (ignored when the crate is sitting on top)
      for (const box of wallBoxes) {
        if (pos.y + p.half <= box.min.y || pos.y - p.half >= box.max.y - 0.3) continue;
        const ox = Math.min(pos.x + p.half - box.min.x, box.max.x - (pos.x - p.half));
        const oz = Math.min(pos.z + p.half - box.min.z, box.max.z - (pos.z - p.half));
        if (ox <= 0 || oz <= 0) continue;
        if (ox < oz) {
          pos.x += pos.x < (box.min.x + box.max.x) / 2 ? -ox : ox;
          p.velocity.x *= -0.4;
        } else {
          pos.z += pos.z < (box.min.z + box.max.z) / 2 ? -oz : oz;
          p.velocity.z *= -0.4;
        }
      }

      const floorY = currentGroundY(pos.x, pos.z, pos.y - p.half + 0.3) + p.half;
      if (pos.y < floorY) {
        pos.y = floorY;
        if (p.velocity.y < -0.5) p.velocity.y *= -0.35; else p.velocity.y = 0;
        p.velocity.x *= 0.9; p.velocity.z *= 0.9;
      }
      const limit = CFG.arenaHalfSize - 1 - p.half;
      if (pos.x > limit) { pos.x = limit; p.velocity.x *= -0.4; }
      if (pos.x < -limit) { pos.x = -limit; p.velocity.x *= -0.4; }
      if (pos.z > limit) { pos.z = limit; p.velocity.z *= -0.4; }
      if (pos.z < -limit) { pos.z = -limit; p.velocity.z *= -0.4; }
      p.velocity.x *= (1 - 0.15 * dt);
      p.velocity.z *= (1 - 0.15 * dt);
      const spin = p.velocity.length() * dt;
      p.mesh.rotation.x += spin * 0.3;
      p.mesh.rotation.z += spin * 0.2;

      if (p.velocity.lengthSq() > 0.01 || pos.y > floorY + 0.01) moving = true;
    }
    // shadows are baked for speed, so re-bake while any crate is still moving
    propShadowTimer -= dt;
    if ((moving && propShadowTimer <= 0) || (!moving && propsWereMoving)) { renderer.shadowMap.needsUpdate = true; propShadowTimer = 0.1; }
    propsWereMoving = moving;
  }

  // ======================================================================
  // PARTICLES (pooled)
  // ======================================================================
  const particlePool = [];
  const particleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (let i = 0; i < 140; i++) {
    const mesh = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ transparent: true }));
    mesh.visible = false; mesh.frustumCulled = false;
    scene.add(mesh);
    particlePool.push({ mesh, vel: new THREE.Vector3(), life: 0, age: 0, active: false, grav: 1 });
  }
  function spawnParticle(pos, color, vx, vy, vz, life, scale, grav) {
    for (const p of particlePool) {
      if (p.active) continue;
      p.active = true; p.age = 0; p.life = life;
      p.grav = grav === undefined ? 1 : grav;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(scale || 1);
      p.mesh.position.copy(pos);
      p.vel.set(vx, vy, vz);
      return p;
    }
    return null;
  }
  function burst(pos, color, count) {
    for (let i = 0; i < count; i++) {
      spawnParticle(pos, color,
        (Math.random() - 0.5) * 7, Math.random() * 5 + 1.5, (Math.random() - 0.5) * 7,
        0.5 + Math.random() * 0.3, 1, 1);
    }
  }
  function updateParticles(dt) {
    for (const p of particlePool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) { p.active = false; p.mesh.visible = false; continue; }
      p.vel.y -= CFG.gravity * 0.6 * p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = 1 - p.age / p.life;
    }
  }

  // ======================================================================
  // TRACERS (pooled, travel from muzzle to impact)
  // ======================================================================
  const tracerPool = [];
  const tracerGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 6);
  tracerGeo.rotateX(Math.PI / 2);   // bake the axis onto +Z so we can aim with lookAt
  const tracerMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(tracerGeo, tracerMat.clone());
    mesh.visible = false; mesh.frustumCulled = false;
    scene.add(mesh);
    tracerPool.push({ mesh, origin: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, travelled: 0, active: false });
  }
  const _tracerTip = new THREE.Vector3();
  const _tracerMid = new THREE.Vector3();

  function spawnTracer(origin, dir, dist) {
    for (const t of tracerPool) {
      if (t.active) continue;
      t.active = true;
      t.origin.copy(origin);
      t.dir.copy(dir);
      t.dist = Math.min(dist, CFG.maxShootDistance);
      t.travelled = 0;
      t.mesh.visible = true;
      t.mesh.material.opacity = 0.95;
      return t;
    }
    return null;
  }

  function updateTracers(dt) {
    for (const t of tracerPool) {
      if (!t.active) continue;
      t.travelled += CFG.tracerSpeed * dt;
      if (t.travelled >= t.dist) { t.active = false; t.mesh.visible = false; continue; }
      // the streak is a segment trailing behind the leading edge
      const tip = Math.min(t.travelled, t.dist);
      const tail = Math.max(0, tip - CFG.tracerLength);
      const len = tip - tail;
      _tracerTip.copy(t.origin).addScaledVector(t.dir, tip);
      _tracerMid.copy(t.origin).addScaledVector(t.dir, (tip + tail) / 2);
      t.mesh.position.copy(_tracerMid);
      t.mesh.lookAt(_tracerTip);
      t.mesh.scale.set(1, 1, Math.max(len, 0.01));
      t.mesh.material.opacity = 0.95 * (1 - t.travelled / t.dist) + 0.15;
    }
  }

  // ======================================================================
  // SMOKE (pooled soft sprites: muzzle blast and barrel wisps)
  // ======================================================================
  const smokeTex = (function () {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const smokePool = [];
  for (let i = 0; i < 28; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, color: 0xa9a9a4, transparent: true, opacity: 0, depthWrite: false,
    }));
    sprite.visible = false; sprite.frustumCulled = false;
    scene.add(sprite);
    smokePool.push({ sprite, vel: new THREE.Vector3(), age: 0, life: 0, size0: 0, size1: 0, alpha: 0, active: false });
  }

  function spawnSmoke(pos, vx, vy, vz, life, size0, size1, alpha) {
    for (const s of smokePool) {
      if (s.active) continue;
      s.active = true; s.age = 0; s.life = life;
      s.size0 = size0; s.size1 = size1; s.alpha = alpha;
      s.sprite.position.copy(pos);
      s.sprite.scale.setScalar(size0);
      s.sprite.material.rotation = Math.random() * Math.PI * 2;
      s.sprite.material.opacity = 0;
      s.sprite.visible = true;
      s.vel.set(vx, vy, vz);
      return s;
    }
    return null;
  }

  function updateSmoke(dt) {
    const drag = Math.max(0, 1 - dt * 3.2);
    for (const s of smokePool) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.life) { s.active = false; s.sprite.visible = false; continue; }
      s.vel.multiplyScalar(drag);
      s.vel.y += 0.5 * dt;   // warm smoke drifts up
      s.sprite.position.addScaledVector(s.vel, dt);
      const t = s.age / s.life;
      s.sprite.scale.setScalar(s.size0 + (s.size1 - s.size0) * easeOut(t));
      s.sprite.material.opacity = s.alpha * Math.min(s.age / 0.04, 1) * (1 - t) * (1 - t);
    }
  }

  // ======================================================================
  // SHELL CASINGS (pooled, thrown out by the bolt)
  // ======================================================================
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.3, metalness: 0.85 });
  const casingGeo = new THREE.CylinderGeometry(0.010, 0.012, 0.08, 8);
  const smallCasingGeo = new THREE.CylinderGeometry(0.0065, 0.0075, 0.032, 8);
  const magnumCasingGeo = new THREE.CylinderGeometry(0.0092, 0.0098, 0.034, 10);   // .50 AE: short and fat
  const shellGeo = new THREE.CylinderGeometry(0.0115, 0.0115, 0.066, 10);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xa3231b, roughness: 0.55, metalness: 0.1 });
  const CASINGS = {
    rifle: { geo: casingGeo, mat: brassMat, ping: 1 },
    small: { geo: smallCasingGeo, mat: brassMat, ping: 0.7 },
    magnum: { geo: magnumCasingGeo, mat: brassMat, ping: 0.9 },
    shell: { geo: shellGeo, mat: shellMat, ping: 0.25 },   // plastic: a dull tap, not a ring
  };
  const casingPool = [];
  for (let i = 0; i < 24; i++) {   // enough for a full-auto burst
    const mesh = new THREE.Mesh(casingGeo, brassMat);
    mesh.visible = false; mesh.frustumCulled = false;
    scene.add(mesh);
    casingPool.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), age: 0, bounces: 0, resting: false, active: false, ping: 1 });
  }

  function ejectCasing(pos, vel, kind) {
    let c = casingPool.find((k) => !k.active);
    if (!c) c = casingPool.reduce((a, b) => (a.age > b.age ? a : b));   // recycle the oldest
    const type = CASINGS[kind] || CASINGS.rifle;
    c.mesh.geometry = type.geo;
    c.mesh.material = type.mat;
    c.ping = type.ping;
    c.active = true; c.age = 0; c.bounces = 0; c.resting = false;
    c.mesh.visible = true;
    c.mesh.scale.setScalar(1);
    c.mesh.position.copy(pos);
    c.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    c.vel.copy(vel);
    c.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 12, 18 + Math.random() * 14);
  }

  function updateCasings(dt) {
    for (const c of casingPool) {
      if (!c.active) continue;
      c.age += dt;
      const m = c.mesh;
      if (c.age > 4 || m.position.y < -60) { c.active = false; m.visible = false; continue; }
      if (c.age > 3.5) m.scale.setScalar(Math.max((4 - c.age) / 0.5, 0.01));
      if (c.resting) continue;
      c.vel.y -= CFG.gravity * dt;
      m.position.addScaledVector(c.vel, dt);
      m.rotation.x += c.spin.x * dt; m.rotation.y += c.spin.y * dt; m.rotation.z += c.spin.z * dt;
      const gy = currentGroundY(m.position.x, m.position.z, m.position.y + 0.3);
      if (m.position.y - 0.012 <= gy && c.vel.y < 0) {
        m.position.y = gy + 0.012;
        if (c.bounces < 3) playCasingPing(Math.min(-c.vel.y / 6, 1) * (c.bounces ? 0.5 : 1) * c.ping);
        c.bounces++;
        c.vel.y = -c.vel.y * 0.32;
        c.vel.x *= 0.55; c.vel.z *= 0.55;
        c.spin.multiplyScalar(0.45);
        if (c.vel.y < 0.6) {
          // settle on its side
          c.resting = true;
          m.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2);
        }
      }
    }
  }

  // ======================================================================
  // VIEWMODELS
  // ======================================================================
  const metalDark = new THREE.MeshStandardMaterial({ color: 0x232427, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.55 });
  const metalMid = new THREE.MeshStandardMaterial({ color: 0x3c3f45, roughness: 0.5, metalness: 0.5, envMapIntensity: 0.55 });
  const woodStock = new THREE.MeshStandardMaterial({ color: 0x4b3a2a, roughness: 0.8, metalness: 0.05 });
  const scopeGlass = new THREE.MeshStandardMaterial({ color: 0x0b1820, emissive: 0x06202c, emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.9 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.35 });
  const portMat = new THREE.MeshBasicMaterial({ color: 0x050506 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcfd6dd, roughness: 0.12, metalness: 0.95 });
  const bladeEdgeMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.05, metalness: 1.0 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.85, metalness: 0.1 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x8a2f26, roughness: 0.5, metalness: 0.5 });

  function addPart(parent, geo, mat, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(m);
    return m;
  }

  const rifleGroup = new THREE.Group();
  const HALF_PI = Math.PI / 2;
  // receiver, top rail and bolt shroud
  addPart(rifleGroup, new THREE.BoxGeometry(0.10, 0.115, 0.46), metalMid, 0, 0, 0);
  addPart(rifleGroup, new THREE.BoxGeometry(0.045, 0.014, 0.44), metalDark, 0, 0.064, -0.02);
  for (let i = 0; i < 9; i++) addPart(rifleGroup, new THREE.BoxGeometry(0.05, 0.006, 0.012), metalDark, 0, 0.073, -0.21 + i * 0.045);
  addPart(rifleGroup, new THREE.CylinderGeometry(0.026, 0.028, 0.05, 12), metalMid, 0, 0.02, 0.255, HALF_PI, 0, 0);
  // stock: wood with a raised cheek rest and a rubber butt pad
  const rifleStock = new THREE.Group();   // the light stock attachment swaps it for a skeleton frame
  rifleGroup.add(rifleStock);
  addPart(rifleStock, new THREE.BoxGeometry(0.08, 0.10, 0.34), woodStock, 0, -0.01, 0.36);
  addPart(rifleStock, new THREE.BoxGeometry(0.07, 0.06, 0.20), woodStock, 0, -0.07, 0.42, -0.12, 0, 0);
  addPart(rifleStock, new THREE.BoxGeometry(0.055, 0.04, 0.18), woodStock, 0, 0.07, 0.30);
  addPart(rifleGroup, new THREE.BoxGeometry(0.085, 0.15, 0.03), gripMat, 0, -0.03, 0.54);
  // pistol grip, trigger guard and trigger
  addPart(rifleGroup, new THREE.BoxGeometry(0.05, 0.13, 0.055), gripMat, 0, -0.11, 0.19, 0.32, 0, 0);
  addPart(rifleGroup, new THREE.TorusGeometry(0.032, 0.006, 6, 14, Math.PI), metalDark, 0, -0.058, 0.10, 0, HALF_PI, Math.PI);
  addPart(rifleGroup, new THREE.BoxGeometry(0.008, 0.035, 0.008), metalDark, 0, -0.075, 0.10, 0.25, 0, 0);
  // wooden forend under the barrel
  addPart(rifleGroup, new THREE.BoxGeometry(0.075, 0.07, 0.36), woodStock, 0, -0.025, -0.40);
  // tapered barrel
  addPart(rifleGroup, new THREE.CylinderGeometry(0.023, 0.033, 0.88, 16), metalDark, 0, 0.005, -0.64, HALF_PI, 0, 0);
  // muzzle brake: a block with three gas ports cut into each side (a fitted muzzle attachment replaces it)
  const rifleBrake = new THREE.Group();
  rifleGroup.add(rifleBrake);
  addPart(rifleBrake, new THREE.BoxGeometry(0.068, 0.058, 0.15), metalDark, 0, 0.005, -1.11);
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      addPart(rifleBrake, new THREE.BoxGeometry(0.004, 0.036, 0.022), portMat, side * 0.0335, 0.005, -1.065 - i * 0.04);
    }
  }
  // folded bipod, legs tucked along the barrel
  addPart(rifleGroup, new THREE.CylinderGeometry(0.034, 0.034, 0.03, 12), metalDark, 0, 0.0, -0.62, HALF_PI, 0, 0);
  // scope: tube, objective bell, eyepiece, turrets and mounts. It is an attachment: hidden until
  // a scope is fitted (the low-zoom and high-zoom scopes are different models), and the iron sights below fold away under it
  const rifleScope = new THREE.Group();
  rifleScope.position.set(0, 0.12, -0.05);
  rifleScope.visible = false;
  rifleGroup.add(rifleScope);
  // low zoom: a short, slim fixed-power scope with one turret. Both end at the same eyepiece, so aiming lines up
  const scopeLow = new THREE.Group();
  rifleScope.add(scopeLow);
  addPart(scopeLow, new THREE.CylinderGeometry(0.028, 0.028, 0.32, 16), metalDark, 0, 0, 0.04, HALF_PI, 0, 0);          // tube
  addPart(scopeLow, new THREE.CylinderGeometry(0.028, 0.04, 0.05, 16), metalDark, 0, 0, -0.145, HALF_PI, 0, 0);         // objective, flaring to the front
  addPart(scopeLow, new THREE.CylinderGeometry(0.036, 0.028, 0.046, 16), metalDark, 0, 0, 0.223, HALF_PI, 0, 0);        // eyepiece
  addPart(scopeLow, new THREE.CylinderGeometry(0.034, 0.034, 0.07, 16), metalMid, 0, 0, 0.01, HALF_PI, 0, 0);           // turret housing
  addPart(scopeLow, new THREE.CylinderGeometry(0.016, 0.016, 0.028, 12), metalMid, 0, 0.038, 0.01);                      // elevation turret
  for (const z of [-0.05, 0.1]) {
    addPart(scopeLow, new THREE.TorusGeometry(0.033, 0.009, 8, 16), metalDark, 0, 0, z);
    addPart(scopeLow, new THREE.BoxGeometry(0.028, 0.06, 0.028), metalDark, 0, -0.04, z);
  }
  addPart(scopeLow, new THREE.CircleGeometry(0.036, 20), scopeGlass, 0, 0, -0.1715);
  addPart(scopeLow, new THREE.CircleGeometry(0.026, 20), scopeGlass, 0, 0, 0.2465, 0, Math.PI, 0);
  // high zoom: long, with a big flared objective and sunshade, tall turrets on top and the side, and a parallax wheel
  const scopeHigh = new THREE.Group();
  rifleScope.add(scopeHigh);
  addPart(scopeHigh, new THREE.CylinderGeometry(0.034, 0.034, 0.4, 16), metalDark, 0, 0, 0, HALF_PI, 0, 0);              // tube
  addPart(scopeHigh, new THREE.CylinderGeometry(0.034, 0.056, 0.11, 16), metalDark, 0, 0, -0.255, HALF_PI, 0, 0);        // objective bell
  addPart(scopeHigh, new THREE.CylinderGeometry(0.06, 0.06, 0.07, 16, 1, true), metalDark, 0, 0, -0.33, HALF_PI, 0, 0);  // sunshade (open at both ends)
  addPart(scopeHigh, new THREE.CylinderGeometry(0.034, 0.042, 0.06, 16), metalDark, 0, 0, 0.215, HALF_PI, 0, 0);        // eyepiece
  addPart(scopeHigh, new THREE.CylinderGeometry(0.044, 0.044, 0.07, 16), metalMid, 0, 0, 0.01, HALF_PI, 0, 0);          // turret housing
  addPart(scopeHigh, new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12), metalMid, 0, 0.056, -0.01);                       // elevation turret
  addPart(scopeHigh, new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12), metalDark, 0, 0.08, -0.01);                    // its cap
  addPart(scopeHigh, new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12), metalMid, 0.056, 0, -0.01, 0, 0, HALF_PI);        // windage turret
  addPart(scopeHigh, new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12), metalDark, 0.08, 0, -0.01, 0, 0, HALF_PI);
  addPart(scopeHigh, new THREE.CylinderGeometry(0.026, 0.026, 0.014, 12), metalMid, -0.05, 0, -0.17, 0, 0, HALF_PI);     // parallax wheel
  for (const z of [-0.1, 0.14]) {
    addPart(scopeHigh, new THREE.TorusGeometry(0.040, 0.010, 8, 16), metalDark, 0, 0, z);
    addPart(scopeHigh, new THREE.BoxGeometry(0.03, 0.05, 0.03), metalDark, 0, -0.035, z);
  }
  addPart(scopeHigh, new THREE.CircleGeometry(0.052, 20), scopeGlass, 0, 0, -0.3615);
  addPart(scopeHigh, new THREE.CircleGeometry(0.012, 10), glintMat, -0.016, 0.017, -0.3625);
  addPart(scopeHigh, new THREE.CircleGeometry(0.038, 20), scopeGlass, 0, 0, 0.246, 0, Math.PI, 0);
  // iron sights: a hooded front post near the muzzle and a notched rear on the receiver; aiming
  // puts the post's tip level with the top of the notch
  const rifleIrons = new THREE.Group();
  rifleGroup.add(rifleIrons);
  addPart(rifleIrons, new THREE.BoxGeometry(0.024, 0.032, 0.03), metalDark, 0, 0.052, -0.99);      // front sight block
  addPart(rifleIrons, new THREE.BoxGeometry(0.004, 0.04, 0.004), metalMid, 0, 0.088, -0.99);        // front post
  addPart(rifleIrons, new THREE.BoxGeometry(0.004, 0.044, 0.022), metalDark, -0.013, 0.09, -0.99);  // hood ears
  addPart(rifleIrons, new THREE.BoxGeometry(0.004, 0.044, 0.022), metalDark, 0.013, 0.09, -0.99);
  addPart(rifleIrons, new THREE.BoxGeometry(0.034, 0.016, 0.03), metalDark, 0, 0.084, 0.06);        // rear sight base
  addPart(rifleIrons, new THREE.BoxGeometry(0.011, 0.016, 0.006), metalDark, -0.0105, 0.1, 0.06);   // rear ears, the notch between
  addPart(rifleIrons, new THREE.BoxGeometry(0.011, 0.016, 0.006), metalDark, 0.0105, 0.1, 0.06);
  const magMesh = addPart(rifleGroup, new THREE.BoxGeometry(0.055, 0.19, 0.07), metalDark, 0, -0.15, 0.02, -0.15, 0, 0);

  // ---- dropped magazines: the empty mag falls out during a reload and lies on the floor ----
  const magDropPool = [];
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(magMesh.geometry, metalDark);
    mesh.rotation.order = "YXZ";
    mesh.visible = false; mesh.frustumCulled = false;
    mesh.castShadow = false;   // shadows are baked; a moving caster would leave a stale one
    scene.add(mesh);
    magDropPool.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), age: 0, bounces: 0, resting: false, active: false });
  }
  const _magDropVel = new THREE.Vector3();
  const _magDropQuat = new THREE.Quaternion();

  function dropMagazine(w) {
    const magMeshNow = w.mag;
    let m = magDropPool.find((k) => !k.active);
    if (!m) m = magDropPool.reduce((a, b) => (a.age > b.age ? a : b));   // recycle the oldest
    m.active = true; m.age = 0; m.bounces = 0; m.resting = false;
    m.mesh.geometry = w.dropGeo || magMeshNow.geometry;   // a curved mag built from parts drops as one block
    while (m.mesh.children.length) m.mesh.remove(m.mesh.children[0]);   // the last drop's extra parts (shared geometry: nothing to free)
    if (w.magAt) {   // an extended magazine or pull tab falls with it
      const extra = w.magAt.clone();
      if (w.dropGeo) { extra.position.set(0, -w.dropGeo.parameters.height / 2, 0); extra.rotation.set(0, 0, 0); }   // under the single block
      m.mesh.add(extra);
    }
    magMeshNow.getWorldPosition(m.mesh.position);
    magMeshNow.getWorldQuaternion(_magDropQuat);
    m.mesh.quaternion.copy(_magDropQuat);
    m.mesh.scale.setScalar(1);
    m.mesh.visible = true;
    camera.getWorldQuaternion(_magDropQuat);
    _magDropVel.set((0.25 + Math.random() * 0.3) * handSign(), -1.4, 0.2).applyQuaternion(_magDropQuat);
    m.vel.copy(_magDropVel).add(player.velocity);
    m.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8);
  }

  function updateMagDrops(dt) {
    for (const m of magDropPool) {
      if (!m.active) continue;
      m.age += dt;
      const o = m.mesh;
      if (m.age > 8 || o.position.y < -60) { m.active = false; o.visible = false; continue; }
      if (m.age > 7.5) o.scale.setScalar(Math.max((8 - m.age) / 0.5, 0.01));
      if (m.resting) continue;
      m.vel.y -= CFG.gravity * dt;
      o.position.addScaledVector(m.vel, dt);
      o.rotation.x += m.spin.x * dt; o.rotation.y += m.spin.y * dt; o.rotation.z += m.spin.z * dt;
      const gy = currentGroundY(o.position.x, o.position.z, o.position.y + 0.3);
      if (o.position.y - 0.05 <= gy && m.vel.y < 0) {
        if (m.bounces < 2) playMagLand(Math.min(-m.vel.y / 6, 1) * (m.bounces ? 0.5 : 1));
        m.bounces++;
        m.vel.y = -m.vel.y * 0.22;
        m.vel.x *= 0.4; m.vel.z *= 0.4;
        m.spin.multiplyScalar(0.3);
        o.position.y = gy + 0.05;
        if (m.vel.y < 0.5) {
          // lie flat on its side
          m.resting = true;
          o.rotation.set(Math.PI / 2, o.rotation.y, 0);
          o.position.y = gy + 0.036;
        }
      }
    }
  }
  // bolt: pivots on the receiver so the handle can lift, pull back and slam home
  const boltMesh = new THREE.Group();
  boltMesh.position.set(0.05, 0.02, 0.20);
  rifleGroup.add(boltMesh);
  addPart(boltMesh, new THREE.CylinderGeometry(0.008, 0.008, 0.055, 8), metalMid, 0.027, 0, 0, 0, 0, Math.PI / 2);
  addPart(boltMesh, new THREE.SphereGeometry(0.018, 10, 10), metalMid, 0.058, -0.004, 0);
  addPart(rifleGroup, new THREE.BoxGeometry(0.012, 0.012, 0.24), metalDark, 0.022, -0.035, -0.75);
  addPart(rifleGroup, new THREE.BoxGeometry(0.012, 0.012, 0.24), metalDark, -0.022, -0.035, -0.75);
  addPart(rifleGroup, new THREE.BoxGeometry(0.018, 0.016, 0.02), gripMat, 0.022, -0.035, -0.88);
  addPart(rifleGroup, new THREE.BoxGeometry(0.018, 0.016, 0.02), gripMat, -0.022, -0.035, -0.88);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffc66a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), flashMat);
  muzzleFlash.position.set(0, 0.005, -1.20);
  muzzleFlash.visible = false;
  rifleGroup.add(muzzleFlash);
  // forward plume, plus the sideways jets the muzzle brake throws out
  addPart(muzzleFlash, new THREE.ConeGeometry(0.06, 0.38, 8), flashMat, 0, 0, -0.17, -Math.PI / 2, 0, 0);
  addPart(muzzleFlash, new THREE.BoxGeometry(0.34, 0.03, 0.03), flashMat, 0, 0, 0.13);
  addPart(muzzleFlash, new THREE.BoxGeometry(0.26, 0.022, 0.022), flashMat, 0, 0, 0.06);
  const flashJets = [muzzleFlash.children[1], muzzleFlash.children[2]];

  // lights up the surroundings for a frame; lives on the camera so it never drops out
  // of the scene (an invisible parent would remove it and force a shader rebuild)
  const muzzleLight = new THREE.PointLight(0xffb060, 0, 10, 2);
  muzzleLight.position.set(0.3, -0.15, -1.6);
  const FLASH_TIME = 0.09;   // seconds; the flash fades out over this

  const knifeGroup = new THREE.Group();
  (function buildKnife() {
    const s = new THREE.Shape();
    s.moveTo(0.00, -0.030);
    s.lineTo(0.24, -0.030);
    s.quadraticCurveTo(0.33, -0.026, 0.395, 0.002);
    s.lineTo(0.315, 0.030);
    s.quadraticCurveTo(0.285, 0.040, 0.225, 0.042);
    s.lineTo(0.00, 0.042);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.013, bevelEnabled: true, bevelThickness: 0.0035, bevelSize: 0.0035, bevelSegments: 1, steps: 1,
    });
    geo.translate(0, 0, -0.0065);
    geo.rotateY(Math.PI / 2);
    knifeGroup.add(new THREE.Mesh(geo, bladeMat));
    addPart(knifeGroup, new THREE.BoxGeometry(0.016, 0.010, 0.30), bladeEdgeMat, 0, -0.026, -0.16);
    addPart(knifeGroup, new THREE.BoxGeometry(0.016, 0.011, 0.20), metalMid, 0, 0.012, -0.16);
    addPart(knifeGroup, new THREE.BoxGeometry(0.085, 0.030, 0.030), metalDark, 0, 0.004, 0.018);
    addPart(knifeGroup, new THREE.CylinderGeometry(0.023, 0.026, 0.055, 10), gripMat, 0, -0.002, 0.062, Math.PI / 2, 0, 0);
    addPart(knifeGroup, new THREE.CylinderGeometry(0.026, 0.026, 0.055, 10), gripMat, 0, -0.004, 0.118, Math.PI / 2, 0, 0);
    addPart(knifeGroup, new THREE.CylinderGeometry(0.026, 0.022, 0.055, 10), gripMat, 0, -0.006, 0.174, Math.PI / 2, 0, 0);
    addPart(knifeGroup, new THREE.CylinderGeometry(0.026, 0.020, 0.028, 10), accentMat, 0, -0.007, 0.212, Math.PI / 2, 0, 0);
    knifeGroup.scale.setScalar(0.92);
  })();


  const polymerMat = new THREE.MeshStandardMaterial({ color: 0x2b2c2f, roughness: 0.75, metalness: 0.15, envMapIntensity: 0.6 });
  // ---- assault rifle: flat-top carbine with a quad-rail handguard ----
  const arGroup = new THREE.Group();
  addPart(arGroup, new THREE.BoxGeometry(0.05, 0.06, 0.26), metalDark, 0, 0.02, 0);              // upper receiver
  addPart(arGroup, new THREE.BoxGeometry(0.046, 0.05, 0.19), metalMid, 0, -0.03, 0.02);         // lower receiver
  addPart(arGroup, new THREE.BoxGeometry(0.03, 0.012, 0.25), metalDark, 0, 0.056, -0.01);       // top rail
  addPart(arGroup, new THREE.BoxGeometry(0.062, 0.062, 0.25), polymerMat, 0, 0.015, -0.26);     // handguard
  for (let i = 0; i < 6; i++) addPart(arGroup, new THREE.BoxGeometry(0.066, 0.008, 0.012), metalDark, 0, 0.015, -0.16 - i * 0.04);
  addPart(arGroup, new THREE.CylinderGeometry(0.011, 0.011, 0.24, 10), metalDark, 0, 0.015, -0.50, HALF_PI, 0, 0);   // barrel
  addPart(arGroup, new THREE.CylinderGeometry(0.015, 0.015, 0.055, 10), metalDark, 0, 0.015, -0.64, HALF_PI, 0, 0);  // flash hider
  // iron sights: aiming looks through the rear ring with the front post's tip at its centre
  addPart(arGroup, new THREE.BoxGeometry(0.008, 0.036, 0.012), metalDark, 0, 0.059, -0.37);     // front sight post
  const arRear = new THREE.Group();   // folds away under a red dot
  arGroup.add(arRear);
  addPart(arRear, new THREE.BoxGeometry(0.03, 0.016, 0.03), metalDark, 0, 0.064, 0.08);        // rear sight base
  addPart(arRear, new THREE.TorusGeometry(0.0075, 0.0025, 6, 14), metalDark, 0, 0.077, 0.08);  // rear sight ring
  addPart(arGroup, new THREE.BoxGeometry(0.035, 0.1, 0.04), gripMat, 0, -0.085, 0.10, 0.35, 0, 0);   // pistol grip
  addPart(arGroup, new THREE.TorusGeometry(0.026, 0.005, 6, 12, Math.PI), metalDark, 0, -0.058, 0.04, 0, HALF_PI, Math.PI);
  addPart(arGroup, new THREE.CylinderGeometry(0.016, 0.016, 0.17, 10), metalDark, 0, 0.008, 0.21, HALF_PI, 0, 0);    // buffer tube
  addPart(arGroup, new THREE.BoxGeometry(0.045, 0.075, 0.14), polymerMat, 0, -0.015, 0.31);     // stock
  addPart(arGroup, new THREE.BoxGeometry(0.02, 0.012, 0.03), metalMid, 0, 0.055, 0.12);         // charging handle
  const arMag = addPart(arGroup, new THREE.BoxGeometry(0.03, 0.15, 0.065), metalDark, 0, -0.12, -0.035, 0.2, 0, 0);

  // ---- AK: wooden furniture, gas tube over the barrel, slant brake, curved mag ----
  const akGroup = new THREE.Group();
  addPart(akGroup, new THREE.BoxGeometry(0.048, 0.06, 0.27), metalDark, 0, 0, 0);                // receiver
  addPart(akGroup, new THREE.BoxGeometry(0.044, 0.018, 0.25), metalMid, 0, 0.038, 0.005);       // dust cover
  addPart(akGroup, new THREE.BoxGeometry(0.004, 0.012, 0.09), metalMid, 0.026, 0.008, 0.02);     // bolt carrier slot
  addPart(akGroup, new THREE.BoxGeometry(0.02, 0.01, 0.012), metalMid, 0.036, 0.008, -0.04);     // charging handle, right side
  addPart(akGroup, new THREE.CylinderGeometry(0.011, 0.011, 0.42, 10), metalDark, 0, 0.0, -0.33, HALF_PI, 0, 0);    // barrel
  addPart(akGroup, new THREE.CylinderGeometry(0.009, 0.009, 0.22, 8), metalDark, 0, 0.03, -0.22, HALF_PI, 0, 0);    // gas tube
  addPart(akGroup, new THREE.BoxGeometry(0.05, 0.04, 0.17), woodStock, 0, -0.012, -0.22);        // lower handguard
  addPart(akGroup, new THREE.BoxGeometry(0.036, 0.02, 0.15), woodStock, 0, 0.035, -0.22);        // upper handguard
  addPart(akGroup, new THREE.BoxGeometry(0.028, 0.045, 0.03), metalDark, 0, 0.012, -0.36);       // gas block
  addPart(akGroup, new THREE.BoxGeometry(0.022, 0.04, 0.03), metalDark, 0, 0.02, -0.5);          // front sight block
  addPart(akGroup, new THREE.BoxGeometry(0.004, 0.022, 0.004), metalMid, 0, 0.049, -0.5);        // front sight post
  addPart(akGroup, new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), metalDark, 0, 0.0, -0.565, HALF_PI, 0, 0);   // slant brake
  // rear sight: a leaf with a notch the front post lines up in
  addPart(akGroup, new THREE.BoxGeometry(0.032, 0.012, 0.04), metalDark, 0, 0.034, -0.105);
  addPart(akGroup, new THREE.BoxGeometry(0.011, 0.012, 0.006), metalDark, -0.0105, 0.054, -0.105);
  addPart(akGroup, new THREE.BoxGeometry(0.011, 0.012, 0.006), metalDark, 0.0105, 0.054, -0.105);
  addPart(akGroup, new THREE.BoxGeometry(0.032, 0.006, 0.006), metalDark, 0, 0.045, -0.105);
  addPart(akGroup, new THREE.BoxGeometry(0.034, 0.1, 0.042), woodStock, 0, -0.07, 0.08, 0.3, 0, 0);    // pistol grip
  addPart(akGroup, new THREE.TorusGeometry(0.024, 0.0045, 6, 12, Math.PI), metalDark, 0, -0.032, 0.025, 0, HALF_PI, Math.PI);
  (function buildAkStock() {
    const p = new THREE.Shape();
    p.moveTo(0.00, 0.022);
    p.lineTo(0.26, 0.0);
    p.lineTo(0.28, -0.012);
    p.lineTo(0.29, -0.115);
    p.lineTo(0.16, -0.07);
    p.lineTo(0.00, -0.028);
    p.closePath();
    const geo = new THREE.ExtrudeGeometry(p, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 2 });
    geo.translate(0, 0, -0.018);
    geo.rotateY(-Math.PI / 2);
    const stock = new THREE.Mesh(geo, woodStock);
    stock.position.set(0, -0.005, 0.135);
    akGroup.add(stock);
  })();
  // banana mag: three segments curving forward, moved as one
  const akMag = new THREE.Group();
  akMag.position.set(0, -0.05, -0.045);
  akGroup.add(akMag);
  addPart(akMag, new THREE.BoxGeometry(0.028, 0.06, 0.06), metalDark, 0, -0.03, 0, 0.12, 0, 0);
  addPart(akMag, new THREE.BoxGeometry(0.028, 0.06, 0.058), metalDark, 0, -0.085, -0.016, 0.32, 0, 0);
  addPart(akMag, new THREE.BoxGeometry(0.028, 0.055, 0.055), metalDark, 0, -0.135, -0.044, 0.55, 0, 0);

  // ---- pump shotgun: a classic 870-style gun ----
  const shotgunGroup = new THREE.Group();
  // receiver, with the ejection port on the right and the loading port underneath
  addPart(shotgunGroup, new THREE.BoxGeometry(0.062, 0.08, 0.25), metalDark, 0, 0, 0);
  addPart(shotgunGroup, new THREE.BoxGeometry(0.004, 0.032, 0.085), portMat, 0.0312, 0.012, -0.03);
  addPart(shotgunGroup, new THREE.BoxGeometry(0.036, 0.004, 0.09), portMat, 0, -0.0402, -0.03);
  // barrel with a vent rib on top; the bead sits on the rib's front end
  addPart(shotgunGroup, new THREE.CylinderGeometry(0.016, 0.016, 0.62, 14), metalDark, 0, 0.022, -0.44, HALF_PI, 0, 0);
  addPart(shotgunGroup, new THREE.BoxGeometry(0.012, 0.004, 0.6), metalMid, 0, 0.042, -0.44);
  for (let i = 0; i < 12; i++) addPart(shotgunGroup, new THREE.BoxGeometry(0.008, 0.004, 0.006), metalMid, 0, 0.0385, -0.17 - i * 0.05);
  addPart(shotgunGroup, new THREE.SphereGeometry(0.005, 8, 8), metalMid, 0, 0.049, -0.735);
  // magazine tube, end cap, and the barrel band that clamps the two together
  addPart(shotgunGroup, new THREE.CylinderGeometry(0.0145, 0.0145, 0.5, 12), metalMid, 0, -0.018, -0.4, HALF_PI, 0, 0);
  addPart(shotgunGroup, new THREE.CylinderGeometry(0.016, 0.016, 0.022, 12), metalDark, 0, -0.018, -0.66, HALF_PI, 0, 0);
  addPart(shotgunGroup, new THREE.BoxGeometry(0.036, 0.06, 0.018), metalDark, 0, 0.002, -0.62);
  // trigger guard, trigger, safety and sling stud
  addPart(shotgunGroup, new THREE.BoxGeometry(0.02, 0.008, 0.075), metalMid, 0, -0.044, 0.05);
  addPart(shotgunGroup, new THREE.TorusGeometry(0.024, 0.005, 6, 12, Math.PI), metalMid, 0, -0.046, 0.05, 0, HALF_PI, Math.PI);
  addPart(shotgunGroup, new THREE.BoxGeometry(0.006, 0.028, 0.006), metalDark, 0, -0.058, 0.055, 0.25, 0, 0);
  addPart(shotgunGroup, new THREE.CylinderGeometry(0.004, 0.004, 0.024, 8), metalDark, 0, -0.04, 0.09, 0, 0, HALF_PI);
  addPart(shotgunGroup, new THREE.CylinderGeometry(0.004, 0.004, 0.012, 8), metalMid, 0, -0.038, -0.6);
  // stock: a side profile (comb, heel, toe, wrist) extruded to the stock's thickness
  (function buildShotgunStock() {
    const p = new THREE.Shape();
    // a real shotgun's stock drops away below the sight line, which also keeps it out of
    // view when aiming down the barrel
    p.moveTo(0.00, 0.012);    // top of the wrist, against the receiver
    p.lineTo(0.12, -0.012);
    p.lineTo(0.31, -0.03);    // comb, where the cheek rests
    p.lineTo(0.345, -0.036);  // heel
    p.lineTo(0.37, -0.15);    // toe
    p.lineTo(0.20, -0.085);
    p.lineTo(0.09, -0.060);   // under the wrist
    p.lineTo(0.00, -0.040);
    p.closePath();
    const geo = new THREE.ExtrudeGeometry(p, { depth: 0.046, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 });
    geo.translate(0, 0, -0.023);
    geo.rotateY(-Math.PI / 2);   // profile runs back along +z, thickness across x
    const stock = new THREE.Mesh(geo, woodStock);
    stock.position.set(0, 0, 0.125);
    shotgunGroup.add(stock);
    addPart(shotgunGroup, new THREE.BoxGeometry(0.058, 0.12, 0.014), gripMat, 0, -0.093, 0.125 + 0.362, -0.19, 0, 0);   // butt pad
  })();
  // pump: rounded and ribbed, riding on the magazine tube
  const shotgunPump = new THREE.Group();
  shotgunPump.position.set(0, -0.018, -0.32);
  shotgunGroup.add(shotgunPump);
  const pumpBody = addPart(shotgunPump, new THREE.CylinderGeometry(0.03, 0.03, 0.17, 12), polymerMat, 0, 0.002, 0, HALF_PI, 0, 0);
  pumpBody.scale.set(0.95, 1, 0.82);
  for (let i = 0; i < 7; i++) addPart(shotgunPump, new THREE.TorusGeometry(0.0285, 0.0028, 4, 14), gripMat, 0, 0.002, -0.066 + i * 0.022);
  // ---- Desert Eagle: polished stainless, one long slab-sided slide over a frame (the sights sit on the slide, the barrel
  // nose is fixed and shows when the slide kicks back), a squared trigger guard and a chunky rubber grip ----
  const stainlessMat = new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.22, metalness: 0.9 });
  const stainlessDark = new THREE.MeshStandardMaterial({ color: 0xa7acb3, roughness: 0.3, metalness: 0.85 });
  const pistolGroup = new THREE.Group();
  addPart(pistolGroup, new THREE.BoxGeometry(0.038, 0.03, 0.27), stainlessDark, 0, -0.012, -0.03);    // the frame, under the whole slide
  for (let i = 0; i < 3; i++) addPart(pistolGroup, new THREE.BoxGeometry(0.034, 0.004, 0.008), metalDark, 0, -0.0275, -0.08 - i * 0.022);   // rail slots under the muzzle
  addPart(pistolGroup, new THREE.CylinderGeometry(0.0125, 0.0125, 0.04, 12), stainlessMat, 0, 0.034, -0.19, HALF_PI, 0, 0);   // the barrel nose
  addPart(pistolGroup, new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 10), portMat, 0, 0.034, -0.2105, HALF_PI, 0, 0);   // bore
  // slide: the whole top half, which kicks back on every shot
  const pistolSlide = new THREE.Group();
  pistolGroup.add(pistolSlide);
  addPart(pistolSlide, new THREE.BoxGeometry(0.04, 0.0455, 0.285), stainlessMat, 0, 0.0258, -0.0475);
  addPart(pistolSlide, new THREE.BoxGeometry(0.012, 0.004, 0.2), stainlessDark, 0, 0.0505, -0.06);        // the ribbed top
  for (let i = 0; i < 6; i++) addPart(pistolSlide, new THREE.BoxGeometry(0.042, 0.034, 0.0035), stainlessDark, 0, 0.026, 0.05 + i * 0.008);   // serrations at the back
  addPart(pistolSlide, new THREE.BoxGeometry(0.004, 0.012, 0.045), portMat, 0.0205, 0.036, 0.0);          // the ejection port, on the right
  addPart(pistolSlide, new THREE.BoxGeometry(0.005, 0.015, 0.012), stainlessDark, 0, 0.056, -0.175);      // front sight
  addPart(pistolSlide, new THREE.BoxGeometry(0.008, 0.009, 0.008), stainlessDark, -0.009, 0.053, 0.083);   // rear sight, two ears
  addPart(pistolSlide, new THREE.BoxGeometry(0.008, 0.009, 0.008), stainlessDark, 0.009, 0.053, 0.083);
  // squared trigger guard, trigger, slide stop
  addPart(pistolGroup, new THREE.BoxGeometry(0.008, 0.032, 0.008), stainlessDark, 0, -0.036, -0.06);
  addPart(pistolGroup, new THREE.BoxGeometry(0.008, 0.008, 0.06), stainlessDark, 0, -0.05, -0.034);
  addPart(pistolGroup, new THREE.BoxGeometry(0.006, 0.024, 0.006), metalDark, 0, -0.032, -0.03, 0.25, 0, 0);
  addPart(pistolGroup, new THREE.BoxGeometry(0.004, 0.008, 0.03), stainlessDark, 0.02, -0.004, 0.0);
  addPart(pistolGroup, new THREE.BoxGeometry(0.04, 0.135, 0.058), gripMat, 0, -0.08, 0.06, 0.24, 0, 0);    // rubber grip
  const pistolMag = addPart(pistolGroup, new THREE.BoxGeometry(0.03, 0.12, 0.045), metalDark, 0, -0.09, 0.062, 0.24, 0, 0);

  for (const side of [-1, 1]) addPart(pistolGroup, new THREE.BoxGeometry(0.002, 0.1, 0.042), metalDark, side * 0.0205, -0.082, 0.06, 0.24, 0, 0);   // inset panels on its sides
  // ---- SMG: a short boxy receiver with a vented shroud, a straight 32-round magazine and a folding wire stock ----
  // sights: the rear ring and the front post both sit 0.074 above the bore, which is what aiming lines up (see adsPos)
  const smgGroup = new THREE.Group();
  addPart(smgGroup, new THREE.BoxGeometry(0.05, 0.068, 0.30), metalDark, 0, 0.012, -0.02);               // receiver
  addPart(smgGroup, new THREE.BoxGeometry(0.036, 0.01, 0.28), metalMid, 0, 0.051, -0.02);                // top cover
  addPart(smgGroup, new THREE.BoxGeometry(0.056, 0.056, 0.12), polymerMat, 0, 0.008, -0.23);             // shroud
  for (let i = 0; i < 4; i++) addPart(smgGroup, new THREE.BoxGeometry(0.058, 0.008, 0.012), metalDark, 0, 0.008, -0.19 - i * 0.025);   // vent slots
  addPart(smgGroup, new THREE.CylinderGeometry(0.0095, 0.0095, 0.1, 10), metalDark, 0, 0.012, -0.34, HALF_PI, 0, 0);   // barrel
  addPart(smgGroup, new THREE.CylinderGeometry(0.014, 0.014, 0.045, 10), metalDark, 0, 0.012, -0.395, HALF_PI, 0, 0);  // flash hider
  addPart(smgGroup, new THREE.BoxGeometry(0.005, 0.04, 0.006), metalDark, 0, 0.054, -0.27);             // front sight post
  const smgRear = new THREE.Group();   // folds away under a red dot
  smgGroup.add(smgRear);
  addPart(smgRear, new THREE.BoxGeometry(0.03, 0.012, 0.03), metalDark, 0, 0.062, 0.04);                 // rear sight base
  addPart(smgRear, new THREE.TorusGeometry(0.0075, 0.0025, 6, 14), metalDark, 0, 0.074, 0.04);           // rear sight ring
  addPart(smgGroup, new THREE.BoxGeometry(0.016, 0.012, 0.03), metalMid, 0.03, 0.035, 0.0);              // charging handle
  addPart(smgGroup, new THREE.BoxGeometry(0.035, 0.1, 0.04), gripMat, 0, -0.075, 0.11, 0.3, 0, 0);       // pistol grip
  addPart(smgGroup, new THREE.TorusGeometry(0.026, 0.005, 6, 12, Math.PI), metalDark, 0, -0.05, 0.05, 0, HALF_PI, Math.PI);   // trigger guard
  for (const sx of [-0.02, 0.02]) addPart(smgGroup, new THREE.BoxGeometry(0.01, 0.01, 0.24), metalMid, sx, 0.0, 0.24);   // wire stock
  addPart(smgGroup, new THREE.BoxGeometry(0.05, 0.07, 0.012), metalDark, 0, 0.0, 0.355);                 // butt plate
  const smgMag = addPart(smgGroup, new THREE.BoxGeometry(0.03, 0.17, 0.056), metalDark, 0, -0.115, -0.02);

  // ---- DMR (marksman rifle): a long slim rifle with a full-length handguard, a 10-round box magazine and iron sights ----
  const dmrGroup = new THREE.Group();
  addPart(dmrGroup, new THREE.BoxGeometry(0.048, 0.07, 0.34), metalDark, 0, 0.01, 0);                    // receiver
  addPart(dmrGroup, new THREE.BoxGeometry(0.03, 0.012, 0.46), metalMid, 0, 0.056, -0.05);                // top rail
  addPart(dmrGroup, new THREE.BoxGeometry(0.056, 0.06, 0.36), polymerMat, 0, 0.012, -0.36);              // handguard
  for (let i = 0; i < 6; i++) addPart(dmrGroup, new THREE.BoxGeometry(0.058, 0.008, 0.012), metalDark, 0, 0.012, -0.22 - i * 0.05);   // vent slots
  addPart(dmrGroup, new THREE.CylinderGeometry(0.0105, 0.0105, 0.2, 10), metalDark, 0, 0.012, -0.64, HALF_PI, 0, 0);   // barrel
  addPart(dmrGroup, new THREE.CylinderGeometry(0.0145, 0.0145, 0.06, 10), metalDark, 0, 0.012, -0.76, HALF_PI, 0, 0);  // flash hider
  addPart(dmrGroup, new THREE.BoxGeometry(0.005, 0.04, 0.006), metalDark, 0, 0.057, -0.5);              // front sight post
  const dmrRear = new THREE.Group();   // folds away under a red dot
  dmrGroup.add(dmrRear);
  addPart(dmrRear, new THREE.BoxGeometry(0.03, 0.016, 0.03), metalDark, 0, 0.064, 0.10);                 // rear sight base
  addPart(dmrRear, new THREE.TorusGeometry(0.0075, 0.0025, 6, 14), metalDark, 0, 0.077, 0.10);           // rear sight ring
  addPart(dmrGroup, new THREE.BoxGeometry(0.036, 0.1, 0.042), gripMat, 0, -0.075, 0.12, 0.3, 0, 0);      // pistol grip
  addPart(dmrGroup, new THREE.TorusGeometry(0.028, 0.005, 6, 12, Math.PI), metalDark, 0, -0.05, 0.05, 0, HALF_PI, Math.PI);   // trigger guard
  addPart(dmrGroup, new THREE.BoxGeometry(0.02, 0.012, 0.03), metalMid, 0.028, 0.035, 0.05);             // charging handle
  addPart(dmrGroup, new THREE.CylinderGeometry(0.02, 0.026, 0.31, 10), polymerMat, 0, -0.01, 0.305, HALF_PI, 0, 0);   // stock tube
  addPart(dmrGroup, new THREE.BoxGeometry(0.05, 0.085, 0.03), gripMat, 0, -0.01, 0.47);                  // butt pad
  const dmrMag = addPart(dmrGroup, new THREE.BoxGeometry(0.034, 0.12, 0.075), metalDark, 0, -0.09, -0.02, 0.1, 0, 0);

  // ---- burst rifle: a slim carbine with a short vented handguard and a big flash hider; one pull fires three rounds ----
  // sights: the rear ring and the front post both sit 0.078 above the bore (see adsPos)
  const burstGroup = new THREE.Group();
  addPart(burstGroup, new THREE.BoxGeometry(0.052, 0.066, 0.34), metalDark, 0, 0.018, 0);                // receiver
  addPart(burstGroup, new THREE.BoxGeometry(0.034, 0.012, 0.36), metalMid, 0, 0.057, -0.01);             // top rail
  addPart(burstGroup, new THREE.BoxGeometry(0.056, 0.056, 0.22), polymerMat, 0, 0.014, -0.28);           // handguard
  for (let i = 0; i < 4; i++) addPart(burstGroup, new THREE.BoxGeometry(0.06, 0.008, 0.012), metalDark, 0, 0.014, -0.22 - i * 0.04);   // vent slots
  addPart(burstGroup, new THREE.CylinderGeometry(0.0105, 0.0105, 0.2, 10), metalDark, 0, 0.014, -0.49, HALF_PI, 0, 0);   // barrel
  addPart(burstGroup, new THREE.CylinderGeometry(0.0155, 0.0155, 0.07, 10), metalDark, 0, 0.014, -0.625, HALF_PI, 0, 0);  // flash hider
  addPart(burstGroup, new THREE.CylinderGeometry(0.018, 0.018, 0.012, 10), metalMid, 0, 0.014, -0.6, HALF_PI, 0, 0);      // its ring
  addPart(burstGroup, new THREE.BoxGeometry(0.022, 0.026, 0.04), metalDark, 0, 0.0275, -0.46);           // gas block
  addPart(burstGroup, new THREE.BoxGeometry(0.006, 0.04, 0.008), metalDark, 0, 0.058, -0.46);            // front sight post
  const burstRear = new THREE.Group();   // folds away under a red dot
  burstGroup.add(burstRear);
  addPart(burstRear, new THREE.BoxGeometry(0.03, 0.016, 0.03), metalDark, 0, 0.0645, 0.10);               // rear sight base
  addPart(burstRear, new THREE.TorusGeometry(0.0075, 0.0025, 6, 14), metalDark, 0, 0.078, 0.10);         // rear sight ring
  addPart(burstGroup, new THREE.BoxGeometry(0.004, 0.012, 0.03), accentMat, 0.027, 0.03, 0.0);           // the burst selector
  addPart(burstGroup, new THREE.BoxGeometry(0.036, 0.1, 0.042), gripMat, 0, -0.075, 0.12, 0.3, 0, 0);    // pistol grip
  addPart(burstGroup, new THREE.TorusGeometry(0.026, 0.005, 6, 12, Math.PI), metalDark, 0, -0.05, 0.05, 0, HALF_PI, Math.PI);   // trigger guard
  addPart(burstGroup, new THREE.BoxGeometry(0.02, 0.012, 0.03), metalMid, 0.03, 0.04, 0.12);             // charging handle
  addPart(burstGroup, new THREE.CylinderGeometry(0.016, 0.016, 0.2, 10), metalDark, 0, 0.012, 0.27, HALF_PI, 0, 0);   // buffer tube
  addPart(burstGroup, new THREE.BoxGeometry(0.045, 0.08, 0.14), polymerMat, 0, -0.012, 0.37);            // stock
  const burstMag = addPart(burstGroup, new THREE.BoxGeometry(0.03, 0.15, 0.066), metalDark, 0, -0.085, -0.02, 0.15, 0, 0);

  // ---- LMG: a heavy receiver, a long shrouded barrel, a folded bipod and a big box magazine for 100 rounds ----
  // sights: the rear ring and the front post both sit 0.088 above the bore
  const lmgGroup = new THREE.Group();   // (the drum is the magazine mesh: the attachments' magazine parts are not built for it, so it has its own option)
  addPart(lmgGroup, new THREE.BoxGeometry(0.062, 0.082, 0.46), metalDark, 0, 0.014, 0);                  // receiver
  addPart(lmgGroup, new THREE.BoxGeometry(0.05, 0.012, 0.4), metalMid, 0, 0.061, -0.02);                 // top cover
  addPart(lmgGroup, new THREE.BoxGeometry(0.066, 0.066, 0.34), polymerMat, 0, 0.012, -0.40);             // heat shroud
  for (let i = 0; i < 6; i++) addPart(lmgGroup, new THREE.BoxGeometry(0.07, 0.008, 0.012), metalDark, 0, 0.012, -0.28 - i * 0.045);   // vent slots
  addPart(lmgGroup, new THREE.CylinderGeometry(0.0125, 0.0125, 0.22, 10), metalDark, 0, 0.012, -0.68, HALF_PI, 0, 0);   // barrel
  addPart(lmgGroup, new THREE.CylinderGeometry(0.0185, 0.0185, 0.07, 10), metalDark, 0, 0.012, -0.825, HALF_PI, 0, 0);  // muzzle device
  for (const sx of [-0.02, 0.02]) addPart(lmgGroup, new THREE.BoxGeometry(0.008, 0.012, 0.18), metalMid, sx, -0.0265, -0.45);   // folded bipod legs
  addPart(lmgGroup, new THREE.BoxGeometry(0.03, 0.02, 0.04), metalDark, 0, 0.055, -0.5);                 // front sight base
  addPart(lmgGroup, new THREE.BoxGeometry(0.006, 0.03, 0.008), metalDark, 0, 0.073, -0.5);               // front sight post
  const lmgRear = new THREE.Group();   // folds away under a red dot
  lmgGroup.add(lmgRear);
  addPart(lmgRear, new THREE.BoxGeometry(0.03, 0.02, 0.03), metalDark, 0, 0.0735, 0.12);                // rear sight base
  addPart(lmgRear, new THREE.TorusGeometry(0.0075, 0.0025, 6, 14), metalDark, 0, 0.088, 0.12);           // rear sight ring
  addPart(lmgGroup, new THREE.BoxGeometry(0.022, 0.014, 0.04), metalMid, 0.04, 0.03, 0.02);              // charging handle
  addPart(lmgGroup, new THREE.BoxGeometry(0.04, 0.11, 0.046), gripMat, 0, -0.08, 0.15, 0.3, 0, 0);       // pistol grip
  addPart(lmgGroup, new THREE.TorusGeometry(0.028, 0.005, 6, 12, Math.PI), metalDark, 0, -0.055, 0.075, 0, HALF_PI, Math.PI);   // trigger guard
  addPart(lmgGroup, new THREE.BoxGeometry(0.05, 0.1, 0.22), polymerMat, 0, -0.005, 0.34);                // stock
  addPart(lmgGroup, new THREE.BoxGeometry(0.052, 0.11, 0.02), gripMat, 0, -0.005, 0.46);                 // butt pad
  addPart(lmgGroup, new THREE.BoxGeometry(0.06, 0.04, 0.07), metalDark, 0, -0.04, 0);                     // feed neck
  const lmgMag = addPart(lmgGroup, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 24), metalDark, 0, -0.115, 0, 0, 0, HALF_PI);   // the drum (its axis runs across the gun)
  addPart(lmgMag, new THREE.CylinderGeometry(0.045, 0.045, 0.108, 16), metalMid, 0, 0, 0);                // hub
  for (const sy of [-1, 1]) addPart(lmgMag, new THREE.TorusGeometry(0.093, 0.006, 6, 24), metalMid, 0, sy * 0.052, 0, HALF_PI, 0, 0);   // rims

  // ---- crossbow: a dark stock with a rail, a prod with two flexing limbs and a moving string, and a bolt lying in the groove ----
  // sights: the rear ring and the front post both sit 0.07 above the rail's centre line (see adsPos)
  const crossbowGroup = new THREE.Group();
  addPart(crossbowGroup, new THREE.BoxGeometry(0.05, 0.07, 0.6), metalDark, 0, 0, 0.05);                  // stock body
  addPart(crossbowGroup, new THREE.BoxGeometry(0.026, 0.012, 0.5), metalMid, 0, 0.041, 0.0);              // rail on top
  addPart(crossbowGroup, new THREE.BoxGeometry(0.075, 0.056, 0.08), metalDark, 0, 0.0, -0.3);             // prod block
  addPart(crossbowGroup, new THREE.BoxGeometry(0.03, 0.03, 0.05), metalMid, 0, 0.02, -0.12);              // latch
  addPart(crossbowGroup, new THREE.BoxGeometry(0.008, 0.03, 0.008), metalDark, 0, 0.055, -0.2);           // front sight post
  const crossbowRear = new THREE.Group();   // folds away under an optic
  crossbowGroup.add(crossbowRear);
  addPart(crossbowRear, new THREE.BoxGeometry(0.03, 0.016, 0.03), metalDark, 0, 0.052, 0.0);             // rear sight base
  addPart(crossbowRear, new THREE.TorusGeometry(0.0075, 0.0025, 6, 14), metalDark, 0, 0.07, 0.0);        // rear sight ring
  addPart(crossbowGroup, new THREE.BoxGeometry(0.04, 0.1, 0.045), gripMat, 0, -0.075, 0.14, 0.3, 0, 0);  // grip
  addPart(crossbowGroup, new THREE.TorusGeometry(0.026, 0.005, 6, 12, Math.PI), metalDark, 0, -0.05, 0.08, 0, HALF_PI, Math.PI);   // trigger guard
  addPart(crossbowGroup, new THREE.BoxGeometry(0.045, 0.08, 0.2), polymerMat, 0, -0.01, 0.43);            // butt
  addPart(crossbowGroup, new THREE.BoxGeometry(0.05, 0.09, 0.02), gripMat, 0, -0.01, 0.54);               // butt pad
  // each limb is two segments, the outer one bending a little more as the string comes back
  const XB = { px: 0.035, pz: -0.33, y: 0.015, inner: 0.17, outer: 0.15, latchZ: -0.12 };
  const xbLimbs = [];
  for (const sx of [-1, 1]) {
    const inner = new THREE.Group(); inner.position.set(sx * XB.px, XB.y, XB.pz); crossbowGroup.add(inner);
    addPart(inner, new THREE.BoxGeometry(XB.inner, 0.022, 0.032), polymerMat, sx * XB.inner / 2, 0, 0);
    const outer = new THREE.Group(); outer.position.set(sx * XB.inner, 0, 0); inner.add(outer);
    addPart(outer, new THREE.BoxGeometry(XB.outer, 0.018, 0.026), polymerMat, sx * XB.outer / 2, 0, 0);
    addPart(outer, new THREE.BoxGeometry(0.014, 0.024, 0.036), metalMid, sx * XB.outer, 0, 0);            // the string's nock at the tip
    xbLimbs.push({ sx, inner, outer });
  }
  const xbString = [-1, 1].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 1), metalMid); crossbowGroup.add(m); return m; });
  // d: 1 = drawn back and latched, 0 = relaxed (just fired); a little below 0 is the limbs springing past
  function setCrossbowDraw(d) {
    const a1 = 0.42 - 0.42 * d, a2 = 0.55 - 0.85 * d;   // how far each segment sweeps forward
    const tipZ = XB.pz - XB.inner * Math.sin(a1) - XB.outer * Math.sin(a2);
    const tipX = XB.px + XB.inner * Math.cos(a1) + XB.outer * Math.cos(a2);
    const zS = tipZ * (1 - d) + XB.latchZ * d;
    xbLimbs.forEach((l) => { l.inner.rotation.y = l.sx * a1; l.outer.rotation.y = l.sx * (a2 - a1); });
    xbString.forEach((m, k) => {
      const sx = k === 0 ? -1 : 1, dx = sx * tipX, dz = tipZ - zS, len = Math.hypot(dx, dz);
      m.position.set(dx / 2, XB.y, (tipZ + zS) / 2);
      m.scale.set(1, 1, len);
      m.rotation.set(0, Math.atan2(dx, dz), 0);
    });
  }
  setCrossbowDraw(1);
  // the bolt is the "magazine": it slides out of the groove and a fresh one rises into it on a reload
  const crossbowMag = addPart(crossbowGroup, new THREE.BoxGeometry(0.008, 0.008, 0.26), metalMid, 0, 0.0525, -0.25);
  addPart(crossbowMag, new THREE.ConeGeometry(0.008, 0.035, 8), metalMid, 0, 0, -0.1475, -HALF_PI, 0, 0);   // head
  addPart(crossbowMag, new THREE.BoxGeometry(0.04, 0.002, 0.04), accentMat, 0, 0, 0.11);                   // fletching
  addPart(crossbowMag, new THREE.BoxGeometry(0.002, 0.04, 0.04), accentMat, 0, 0, 0.11);

  // ---- grenade launcher: a stubby body, a fat barrel with a muzzle ring, a pump under it and a grenade lying in the open breech ----
  const launcherGroup = new THREE.Group();
  addPart(launcherGroup, new THREE.BoxGeometry(0.06, 0.085, 0.5), metalDark, 0, 0, 0.02);                           // receiver
  addPart(launcherGroup, new THREE.CylinderGeometry(0.036, 0.036, 0.36, 14), metalMid, 0, 0.012, -0.4, HALF_PI, 0, 0);   // the fat barrel
  addPart(launcherGroup, new THREE.CylinderGeometry(0.043, 0.043, 0.03, 14), metalDark, 0, 0.012, -0.59, HALF_PI, 0, 0); // muzzle ring
  addPart(launcherGroup, new THREE.BoxGeometry(0.07, 0.05, 0.15), polymerMat, 0, -0.058, -0.26);                      // pump
  addPart(launcherGroup, new THREE.BoxGeometry(0.04, 0.1, 0.045), gripMat, 0, -0.08, 0.13, 0.3, 0, 0);                // grip
  addPart(launcherGroup, new THREE.TorusGeometry(0.026, 0.005, 6, 12, Math.PI), metalDark, 0, -0.05, 0.08, 0, HALF_PI, Math.PI);   // trigger guard
  addPart(launcherGroup, new THREE.BoxGeometry(0.045, 0.085, 0.2), polymerMat, 0, -0.005, 0.37);                       // stock
  addPart(launcherGroup, new THREE.BoxGeometry(0.05, 0.09, 0.02), gripMat, 0, -0.005, 0.48);                           // butt pad
  addPart(launcherGroup, new THREE.BoxGeometry(0.008, 0.035, 0.008), metalDark, 0, 0.065, -0.5);                       // front post
  addPart(launcherGroup, new THREE.BoxGeometry(0.034, 0.008, 0.016), metalDark, 0, 0.047, 0.1);                         // rear sight base
  for (const sx of [-1, 1]) addPart(launcherGroup, new THREE.BoxGeometry(0.008, 0.03, 0.016), metalDark, sx * 0.013, 0.06, 0.1);   // and its two posts (an open notch to aim through)
  const launcherMag = addPart(launcherGroup, new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), accentMat, 0, 0.046, -0.06, HALF_PI, 0, 0);   // the grenade in the breech (the "magazine")
  addPart(launcherMag, new THREE.SphereGeometry(0.02, 10, 6), accentMat, 0, 0.05, 0);

  // ---- RPG: a long tube with a flared rear, a pistol grip, a sight and a warhead poking out of the front (the "magazine": it goes after a shot and a new one is loaded) ----
  const rpgGroup = new THREE.Group();
  addPart(rpgGroup, new THREE.CylinderGeometry(0.05, 0.05, 0.85, 14), metalDark, 0, 0, -0.05, HALF_PI, 0, 0);          // the tube
  addPart(rpgGroup, new THREE.CylinderGeometry(0.075, 0.05, 0.14, 14), metalMid, 0, 0, 0.42, HALF_PI, 0, 0);           // flared rear
  addPart(rpgGroup, new THREE.CylinderGeometry(0.058, 0.058, 0.05, 14), metalMid, 0, 0, -0.45, HALF_PI, 0, 0);         // front collar
  addPart(rpgGroup, new THREE.BoxGeometry(0.04, 0.1, 0.045), gripMat, 0, -0.1, 0.1, 0.3, 0, 0);                        // grip
  addPart(rpgGroup, new THREE.BoxGeometry(0.035, 0.07, 0.04), gripMat, 0, -0.08, -0.2, -0.1, 0, 0);                    // front hand grip
  addPart(rpgGroup, new THREE.TorusGeometry(0.026, 0.005, 6, 12, Math.PI), metalDark, 0, -0.062, 0.05, 0, HALF_PI, Math.PI);   // trigger guard
  addPart(rpgGroup, new THREE.BoxGeometry(0.008, 0.04, 0.008), metalDark, 0, 0.075, -0.4);                             // front post
  const rpgRear = new THREE.Group();   // folds away under an optic
  rpgGroup.add(rpgRear);
  addPart(rpgRear, new THREE.BoxGeometry(0.034, 0.008, 0.016), metalDark, 0, 0.058, 0.15);                              // rear sight base
  for (const sx of [-1, 1]) addPart(rpgRear, new THREE.BoxGeometry(0.008, 0.03, 0.016), metalDark, sx * 0.013, 0.071, 0.15);   // and its two posts (an open notch to aim through)
  const rpgMag = new THREE.Group(); rpgMag.position.set(0, 0, -0.5); rpgGroup.add(rpgMag);
  addPart(rpgMag, new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12), accentMat, 0, 0, 0, HALF_PI, 0, 0);                 // the warhead's body
  addPart(rpgMag, new THREE.ConeGeometry(0.04, 0.12, 12), accentMat, 0, 0, -0.12, -HALF_PI, 0, 0);                      // and its nose

  const HELD = [rifleGroup, arGroup, akGroup, shotgunGroup, pistolGroup, knifeGroup, smgGroup, dmrGroup, burstGroup, lmgGroup, crossbowGroup, launcherGroup, rpgGroup];
  for (const g of HELD) g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  // everything held sits under one root, so left-handed is a single mirror (three.js
  // flips face winding for negative scale, so the models still render correctly)
  const viewmodelRoot = new THREE.Group();
  camera.add(viewmodelRoot);
  for (const g of HELD) { viewmodelRoot.add(g); g.visible = g === rifleGroup; }
  camera.add(muzzleLight);

  // the grapple: a slim spy-gadget launcher, a black tube with silver bands and a small grip
  const spearSteelHeld = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.8, roughness: 0.3 });
  const grappleGroup = new THREE.Group();
  addPart(grappleGroup, new THREE.CylinderGeometry(0.024, 0.024, 0.3, 12), metalDark, 0, 0.01, -0.1, HALF_PI, 0, 0);   // tube
  for (const z of [0.02, -0.1, -0.22]) addPart(grappleGroup, new THREE.CylinderGeometry(0.028, 0.028, 0.012, 12), spearSteelHeld, 0, 0.01, z, HALF_PI, 0, 0);   // bands
  addPart(grappleGroup, new THREE.CylinderGeometry(0.014, 0.018, 0.1, 8), metalMid, 0, 0.01, -0.3, HALF_PI, 0, 0);       // muzzle
  addPart(grappleGroup, new THREE.BoxGeometry(0.03, 0.085, 0.04), gripMat, 0, -0.05, 0.03, 0.15, 0, 0);
  addPart(grappleGroup, new THREE.BoxGeometry(0.012, 0.012, 0.03), accentMat, 0, -0.012, -0.02);   // trigger
  addPart(grappleGroup, new THREE.ConeGeometry(0.014, 0.1, 8), spearSteelHeld, 0, 0.01, -0.38, -HALF_PI, 0, 0);   // the spear tip, peeking out
  grappleGroup.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  grappleGroup.visible = false;
  viewmodelRoot.add(grappleGroup);

  // ---- inspect animation sets (3 per weapon, picked at random) ----
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // Each returns offsets that MUST be zero at t=0 and t=1 so the weapon
  // lands exactly back on its rest pose.
  const RIFLE_INSPECTS = [
    // tilt in to show the receiver
    function (t, p, r) {
      const l = Math.sin(Math.PI * t);
      p.set(-0.10 * l, 0.06 * l, 0.18 * l);
      r.set(Math.sin(Math.PI * t) * 0.45, Math.sin(Math.PI * t) * 1.5, Math.sin(Math.PI * t * 2) * 0.4);
    },
    // raise and roll to show the scope, with a bolt tap at the apex
    function (t, p, r) {
      const l = Math.sin(Math.PI * t);
      const tap = Math.max(0, Math.sin(Math.PI * Math.min(Math.max((t - 0.42) / 0.18, 0), 1)));
      p.set(-0.05 * l, 0.14 * l - 0.02 * tap, 0.10 * l);
      r.set(-0.55 * l, 0.35 * l, -0.9 * l);
      boltMesh.position.z = 0.20 + 0.05 * tap;
    },
    // drop it low and spin it a full turn
    function (t, p, r) {
      const l = Math.sin(Math.PI * t);
      p.set(0.04 * l, -0.16 * l, 0.06 * l);
      r.set(0.3 * l, Math.PI * 2 * easeInOut(t), 0.25 * l);
    },
  ];

  const GUN_INSPECTS = [RIFLE_INSPECTS[0], RIFLE_INSPECTS[2]];

  const KNIFE_INSPECTS = [
    // classic spin in the hand
    function (t, p, r) {
      const l = Math.sin(Math.PI * t);
      p.set(-0.14 * l, 0.10 * l, 0.16 * l);
      r.set(Math.sin(Math.PI * t) * 0.55, Math.PI * 2 * easeInOut(t), Math.sin(Math.PI * t * 2) * 0.9);
    },
    // toss it up, let it flip end over end, catch it
    function (t, p, r) {
      const toss = Math.sin(Math.PI * t);
      p.set(-0.06 * toss, 0.30 * toss, 0.05 * toss);
      r.set(Math.PI * 2 * easeInOut(t), 0.2 * toss, 0.15 * toss);
    },
    // twirl it flat with a pommel flourish
    function (t, p, r) {
      const l = Math.sin(Math.PI * t);
      p.set(-0.18 * l, 0.04 * l, 0.20 * l);
      r.set(0.25 * l, -0.8 * l, Math.PI * 2 * easeInOut(t));
    },
  ];

  // Every weapon is data; all the guns share one firing path.
  //   scope: the sniper overlay, only with a scope fitted; otherwise every gun aims down sights, zooming to adsZoom x FOV
  //   sniper: the sniper, scoped or not (its no-scope and quickscope tags, and its hip spread)
  //   spread/spreadAds: half-angle of the shot cone in radians; bloom widens it per shot
  //   scoreScale: points multiplier, so spraying can't outscore a sniper trickshot
  //   action: what cycles after a shot (bolt, pump, slide or nothing)
  //   reload.keys: [time, x, y, rx, ry, rz] offsets from rest; mag* are seconds
  //   sound: how the recorded report is played back (until each gun gets its own)
  //   recoilKick: aim climb per shot in radians (up), extra per shot of a burst (grow), random
  //     sideways drift (side, widening through a burst), the most it can climb (max), and how
  //     fast it settles back (recover, per second) once you've stopped firing for `hold` s
  const WEAPONS = {
    rifle: {
      name: "SNIPER", group: rifleGroup,
      restPos: new THREE.Vector3(0.30, -0.30, -0.62), restRot: new THREE.Euler(0.03, -0.09, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.108, -0.24), adsRot: new THREE.Euler(0, 0, 0),   // iron sights; a fitted scope lifts this to its own axis
      canADS: true, scope: false, adsZoom: 0.62, sniper: true, scopeAdsY: -0.12, fireRate: 1.1, auto: false, isMelee: false, usesAmmo: true,
      magSize: CFG.magSize, ammoLabel: "ROUNDS", pellets: 1, spread: 0, spreadAds: 0, bloom: 0, bloomMax: 0, bloomRecover: 0,
      scoreScale: 1, recoil: 1, kick: 1, flashScale: 1, brake: true, smoke: 1,
      action: "bolt", ejectOnShot: false, casing: "rifle",
      muzzle: new THREE.Vector3(0, 0.005, -1.20), eject: new THREE.Vector3(0.06, 0.035, 0.12),
      sound: { rate: 1, lowcut: 60, length: 1.8, gain: 1 },
      recoilKick: { up: 0.035, grow: 0, side: 0.004, max: 0.05, recover: 3, hold: 0.22 },
      mag: magMesh, magRestY: magMesh.position.y,
      reload: {
        time: CFG.reloadTime, magOut: 0.18, magDrop: 0.32, magUp: 0.70, magSeat: 1.15, travel: 0.17, rise: 0.33,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.25, -0.09,  0.07,  0.12, 0.18, -0.70],  // lift it and roll the underside toward you
          [0.85, -0.09,  0.05,  0.08, 0.18, -0.78],  // hold while the fresh mag comes up
          [1.15, -0.09,  0.08,  0.14, 0.18, -0.66],  // seat it
          [1.40, -0.04,  0.015, 0.08, 0.10,  0.34],  // roll over to the bolt side
          [2.12, -0.04,  0.015, 0.08, 0.10,  0.34],
          [2.30,  0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 2.0, inspects: RIFLE_INSPECTS,
    },
    ar: {
      name: "RIFLE", group: arGroup,
      restPos: new THREE.Vector3(0.22, -0.24, -0.50), restRot: new THREE.Euler(0.03, -0.08, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.077, -0.30), adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, scope: false, adsZoom: 0.72, fireRate: 0.1, auto: true, isMelee: false, usesAmmo: true,
      magSize: 30, ammoLabel: "ROUNDS", pellets: 1, spread: 0.007, spreadAds: 0.0025, bloom: 0.0035, bloomMax: 0.03, bloomRecover: 0.09,
      scoreScale: 1, recoil: 0.35, kick: 0.22, flashScale: 0.55, brake: false, smoke: 0.3,
      action: "none", ejectOnShot: true, casing: "small",
      muzzle: new THREE.Vector3(0, 0.015, -0.68), eject: new THREE.Vector3(0.03, 0.025, -0.01),
      sound: { recording: "ar", rate: 1, lowcut: 80, length: 0.6, gain: 0.8 },
      recoilKick: { up: 0.0075, grow: 0.0009, side: 0.0043, max: 0.13, recover: 7, hold: 0.12 },
      mag: arMag, magRestY: arMag.position.y,
      reload: {
        time: 2.0, magOut: 0.2, magDrop: 0.36, magUp: 0.75, magSeat: 1.2, travel: 0.15, rise: 0.3, charge: 1.5,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.25, -0.07,  0.06,  0.12, 0.15, -0.60],
          [0.85, -0.07,  0.04,  0.08, 0.15, -0.66],
          [1.20, -0.07,  0.07,  0.14, 0.15, -0.56],
          [1.42, -0.03,  0.02,  0.10, 0.05,  0.25],  // roll back to work the charging handle
          [1.75, -0.03,  0.02,  0.10, 0.05,  0.25],
          [2.00,  0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 1.8, inspects: GUN_INSPECTS,
    },
    ak: {
      name: "AK", group: akGroup,
      restPos: new THREE.Vector3(0.22, -0.25, -0.52), restRot: new THREE.Euler(0.03, -0.08, 0.01),
      // close in, like a cheek on the stock: the stock sits behind the camera, out of view
      adsPos: new THREE.Vector3(0.0, -0.06, -0.2), adsRot: new THREE.Euler(0, 0, 0),   // post tip level with the notch
      canADS: true, scope: false, adsZoom: 0.74, fireRate: 0.1, auto: true, isMelee: false, usesAmmo: true,
      // heavier than the rifle: kicks harder and blooms faster, but each hit is worth more
      magSize: 30, ammoLabel: "ROUNDS", pellets: 1, spread: 0.009, spreadAds: 0.0035, bloom: 0.005, bloomMax: 0.04, bloomRecover: 0.08,
      scoreScale: 1, recoil: 0.5, kick: 0.4, flashScale: 0.7, brake: false, smoke: 0.35,
      action: "none", ejectOnShot: true, casing: "small",
      muzzle: new THREE.Vector3(0, 0, -0.6), eject: new THREE.Vector3(0.03, 0.02, 0.0),
      sound: { recording: "ak", rate: 1, lowcut: 80, length: 0.6, gain: 0.85 },
      recoilKick: { up: 0.0135, grow: 0.0023, side: 0.019, max: 0.30, recover: 5, hold: 0.15 },   // terrible on purpose
      mag: akMag, magRestY: akMag.position.y, dropGeo: new THREE.BoxGeometry(0.028, 0.17, 0.07),
      reload: {
        time: 2.2, magOut: 0.22, magDrop: 0.4, magUp: 0.8, magSeat: 1.3, travel: 0.13, rise: 0.3, charge: 1.62,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.25, -0.07,  0.06,  0.14, 0.15, -0.62],
          [0.90, -0.07,  0.04,  0.10, 0.15, -0.68],
          [1.30, -0.07,  0.07,  0.16, 0.15, -0.58],
          [1.52, -0.03,  0.02,  0.10, 0.05,  0.30],  // over to the right for the charging handle
          [1.95, -0.03,  0.02,  0.10, 0.05,  0.30],
          [2.20,  0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 1.8, inspects: GUN_INSPECTS,
    },
    shotgun: {
      name: "SHOTGUN", group: shotgunGroup,
      restPos: new THREE.Vector3(0.26, -0.27, -0.55), restRot: new THREE.Euler(0.03, -0.07, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.049, -0.34), adsRot: new THREE.Euler(0, 0, 0),   // the stock drops away below the view (pushed out so the receiver does not fill the screen)
      canADS: true, scope: false, adsZoom: 0.85, fireRate: 0.85, auto: false, isMelee: false, usesAmmo: true,
      magSize: 6, ammoLabel: "SHELLS", pellets: 9, spread: 0.065, spreadAds: 0.05, bloom: 0, bloomMax: 0, bloomRecover: 0,
      range: 70, scoreScale: 0.6, recoil: 1.15, kick: 0.9, flashScale: 1.25, brake: false, smoke: 1.1,
      action: "pump", ejectOnShot: false, casing: "shell",
      muzzle: new THREE.Vector3(0, 0.022, -0.77), eject: new THREE.Vector3(0.04, 0.02, 0.02),
      sound: { recording: "shotgun", rate: 1, lowcut: 45, length: 1.4, gain: 1.05 },
      recoilKick: { up: 0.045, grow: 0, side: 0.008, max: 0.06, recover: 6, hold: 0.08 },
      reload: { style: "shells", start: 0.35, perShell: 0.42, end: 0.3 },
      inspectDuration: 1.9, inspects: GUN_INSPECTS,
    },
    pistol: {
      name: "DEAGLE", group: pistolGroup,
      restPos: new THREE.Vector3(0.18, -0.19, -0.38), restRot: new THREE.Euler(0.02, -0.06, 0),
      adsPos: new THREE.Vector3(0.0, -0.06, -0.32), adsRot: new THREE.Euler(0, 0, 0),   // front blade between the rear ears
      canADS: true, scope: false, adsZoom: 0.82, fireRate: 0.26, auto: false, isMelee: false, usesAmmo: true,
      magSize: 7, ammoLabel: "ROUNDS", pellets: 1, spread: 0.0035, spreadAds: 0.001, bloom: 0.004, bloomMax: 0.012, bloomRecover: 0.05,
      scoreScale: 0.8, recoil: 0.75, kick: 0.55, flashScale: 0.7, brake: false, smoke: 0.5,
      action: "slide", ejectOnShot: true, casing: "magnum",
      muzzle: new THREE.Vector3(0, 0.034, -0.215), eject: new THREE.Vector3(0.024, 0.04, 0.03),
      sound: { recording: "pistol", rate: 1, lowcut: 60, length: 1.8, gain: 0.9 },
      recoilKick: { up: 0.03, grow: 0, side: 0.006, max: 0.05, recover: 8, hold: 0.05 },
      mag: pistolMag, magRestY: pistolMag.position.y,
      reload: {
        time: 1.6, magOut: 0.12, magDrop: 0.26, magUp: 0.55, magSeat: 0.95, travel: 0.08, rise: 0.2, slideRelease: 1.2,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.18, -0.04,  0.06,  0.22, 0.10, -0.40],
          [0.80, -0.04,  0.05,  0.18, 0.10, -0.45],
          [0.98, -0.04,  0.07,  0.24, 0.10, -0.38],
          [1.25, -0.02,  0.02,  0.05, 0.05,  0.10],
          [1.60,  0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 1.7, inspects: GUN_INSPECTS, inspectReach: 0.45,   // a pistol doesn't need the rifle's big moves
    },
    knife: {
      name: "KNIFE", group: knifeGroup,
      restPos: new THREE.Vector3(0.24, -0.24, -0.42), restRot: new THREE.Euler(0.06, -0.26, 0.10),
      adsPos: new THREE.Vector3(0.24, -0.24, -0.42), adsRot: new THREE.Euler(0.06, -0.26, 0.10),
      canADS: false, fireRate: 0.38, auto: true, isMelee: true, throwGap: 350,   // ms: the host drops thrown knives that come faster
      usesAmmo: false, range: 3.0, inspectDuration: 1.9, inspects: KNIFE_INSPECTS,
      slashDuration: 0.42,
    },
    smg: {
      name: "SMG", group: smgGroup,
      restPos: new THREE.Vector3(0.22, -0.24, -0.48), restRot: new THREE.Euler(0.03, -0.08, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.074, -0.26), adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, scope: false, adsZoom: 0.8, fireRate: 0.065, auto: true, isMelee: false, usesAmmo: true,
      magSize: 32, ammoLabel: "ROUNDS", pellets: 1, spread: 0.011, spreadAds: 0.005, bloom: 0.004, bloomMax: 0.035, bloomRecover: 0.1,
      scoreScale: 0.7, recoil: 0.28, kick: 0.18, flashScale: 0.5, brake: false, smoke: 0.25,
      action: "none", ejectOnShot: true, casing: "small",
      muzzle: new THREE.Vector3(0, 0.012, -0.42), eject: new THREE.Vector3(0.03, 0.03, -0.02),
      sound: { recording: "ar", rate: 1.28, lowcut: 120, length: 0.4, gain: 0.7 },
      recoilKick: { up: 0.0055, grow: 0.0007, side: 0.0035, max: 0.1, recover: 8, hold: 0.1 },
      mag: smgMag, magRestY: smgMag.position.y,
      reload: {
        time: 1.8, magOut: 0.18, magDrop: 0.32, magUp: 0.68, magSeat: 1.08, travel: 0.14, rise: 0.28, charge: 1.35,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.22, -0.07,  0.06,  0.12, 0.15, -0.60],
          [0.76, -0.07,  0.04,  0.08, 0.15, -0.66],
          [1.08, -0.07,  0.07,  0.14, 0.15, -0.56],
          [1.28, -0.03,  0.02,  0.10, 0.05,  0.25],
          [1.58, -0.03,  0.02,  0.10, 0.05,  0.25],
          [1.80,  0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 1.8, inspects: GUN_INSPECTS,
    },
    dmr: {
      name: "DMR", group: dmrGroup,
      restPos: new THREE.Vector3(0.23, -0.26, -0.55), restRot: new THREE.Euler(0.03, -0.08, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.077, -0.32), adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, scope: false, adsZoom: 0.55, fireRate: 0.32, auto: false, isMelee: false, usesAmmo: true,
      magSize: 10, ammoLabel: "ROUNDS", pellets: 1, spread: 0.0025, spreadAds: 0.0004, bloom: 0.004, bloomMax: 0.02, bloomRecover: 0.1,
      scoreScale: 0.9, recoil: 0.7, kick: 0.6, flashScale: 0.8, brake: false, smoke: 0.5,
      action: "none", ejectOnShot: true, casing: "rifle",
      muzzle: new THREE.Vector3(0, 0.012, -0.8), eject: new THREE.Vector3(0.03, 0.03, 0.0),
      sound: { recording: "ak", rate: 0.82, lowcut: 70, length: 0.9, gain: 0.95 },
      recoilKick: { up: 0.02, grow: 0, side: 0.004, max: 0.07, recover: 5, hold: 0.2 },
      mag: dmrMag, magRestY: dmrMag.position.y,
      reload: {
        time: 2.4, magOut: 0.22, magDrop: 0.4, magUp: 0.9, magSeat: 1.4, travel: 0.16, rise: 0.3, charge: 1.9,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.28, -0.07,  0.06,  0.12, 0.15, -0.60],
          [1.0,  -0.07,  0.04,  0.08, 0.15, -0.66],
          [1.4,  -0.07,  0.07,  0.14, 0.15, -0.56],
          [1.65, -0.03,  0.02,  0.10, 0.05,  0.25],
          [2.1,  -0.03,  0.02,  0.10, 0.05,  0.25],
          [2.4,   0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 1.8, inspects: GUN_INSPECTS,
    },
    burst: {
      name: "BURST", group: burstGroup,
      restPos: new THREE.Vector3(0.22, -0.25, -0.52), restRot: new THREE.Euler(0.03, -0.08, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.078, -0.30), adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, scope: false, adsZoom: 0.68, fireRate: 0.42, burst: 3, burstGap: 0.055, auto: false, isMelee: false, usesAmmo: true,
      magSize: 30, ammoLabel: "ROUNDS", pellets: 1, spread: 0.005, spreadAds: 0.0012, bloom: 0, bloomMax: 0, bloomRecover: 0.1,
      scoreScale: 0.8, recoil: 0.4, kick: 0.3, flashScale: 0.6, brake: false, smoke: 0.35,
      action: "none", ejectOnShot: true, casing: "small",
      muzzle: new THREE.Vector3(0, 0.014, -0.66), eject: new THREE.Vector3(0.03, 0.03, 0.0),
      sound: { recording: "ar", rate: 0.9, lowcut: 90, length: 0.55, gain: 0.85 },
      recoilKick: { up: 0.01, grow: 0.0015, side: 0.003, max: 0.09, recover: 7, hold: 0.12 },
      mag: burstMag, magRestY: burstMag.position.y,
      reload: {
        time: 2.1, magOut: 0.2, magDrop: 0.36, magUp: 0.78, magSeat: 1.24, travel: 0.15, rise: 0.3, charge: 1.55,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.25, -0.07,  0.06,  0.12, 0.15, -0.60],
          [0.88, -0.07,  0.04,  0.08, 0.15, -0.66],
          [1.24, -0.07,  0.07,  0.14, 0.15, -0.56],
          [1.46, -0.03,  0.02,  0.10, 0.05,  0.25],
          [1.82, -0.03,  0.02,  0.10, 0.05,  0.25],
          [2.10,  0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 1.8, inspects: GUN_INSPECTS,
    },
    lmg: {
      name: "LMG", group: lmgGroup,
      restPos: new THREE.Vector3(0.24, -0.27, -0.55), restRot: new THREE.Euler(0.03, -0.08, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.088, -0.32), adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, scope: false, adsZoom: 0.75, adsBase: 1.6, fireRate: 0.085, auto: true, isMelee: false, usesAmmo: true,   // slow to aim: adsBase stretches the aim-in time
      magSize: 100, ammoLabel: "ROUNDS", pellets: 1, spread: 0.016, spreadAds: 0.007, bloom: 0.0025, bloomMax: 0.04, bloomRecover: 0.08,
      scoreScale: 0.6, recoil: 0.5, kick: 0.35, flashScale: 0.9, brake: false, smoke: 0.5,
      action: "none", ejectOnShot: true, casing: "rifle",
      muzzle: new THREE.Vector3(0, 0.012, -0.87), eject: new THREE.Vector3(0.04, 0.03, 0.0),
      sound: { recording: "ak", rate: 0.92, lowcut: 55, length: 0.5, gain: 1.0 },
      recoilKick: { up: 0.0045, grow: 0.0005, side: 0.0055, max: 0.12, recover: 6, hold: 0.12 },
      mag: lmgMag, magRestY: lmgMag.position.y,
      reload: {
        time: 4.4, magOut: 0.4, magDrop: 0.8, magUp: 1.9, magSeat: 3.0, travel: 0.2, rise: 0.35, charge: 3.6,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.45, -0.08,  0.07,  0.16, 0.16, -0.62],
          [1.9,  -0.08,  0.05,  0.12, 0.16, -0.70],
          [3.0,  -0.08,  0.08,  0.18, 0.16, -0.58],
          [3.45, -0.04,  0.03,  0.12, 0.06,  0.28],
          [4.0,  -0.04,  0.03,  0.12, 0.06,  0.28],
          [4.4,   0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 2.0, inspects: GUN_INSPECTS,
    },
    crossbow: {
      name: "CROSSBOW", group: crossbowGroup, projectile: true,   // projectile: it fires a bolt that flies (speed and drop: BOLT_SPEED, BOLT_GRAVITY) instead of a hit-scan
      restPos: new THREE.Vector3(0.22, -0.25, -0.52), restRot: new THREE.Euler(0.03, -0.08, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.07, -0.30), adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, scope: false, adsZoom: 0.62, fireRate: 0.9, auto: false, isMelee: false, usesAmmo: true,
      drawNow: 1, magSize: 1, ammoLabel: "BOLTS", pellets: 1, spread: 0.006, spreadAds: 0.0005, bloom: 0, bloomMax: 0, bloomRecover: 0.1,
      scoreScale: 0.9, recoil: 0.5, kick: 0.4, flashScale: 0, brake: false, smoke: 0,
      action: "none", ejectOnShot: false, casing: "small",
      muzzle: new THREE.Vector3(0, 0.0525, -0.42), eject: new THREE.Vector3(0.03, 0.03, 0.0),
      sound: { recording: "pistol", rate: 2, lowcut: 900, length: 0.25, gain: 0.5 },
      recoilKick: { up: 0.02, grow: 0, side: 0.002, max: 0.05, recover: 5, hold: 0.2 },
      mag: crossbowMag, magRestY: crossbowMag.position.y,
      reload: {
        time: 1.9, magOut: 0.15, magDrop: 0.3, magUp: 0.8, magSeat: 1.25, travel: 0.1, rise: 0.12, charge: 0.75,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.25, -0.05,  0.05,  0.14, 0.10, -0.45],
          [0.90, -0.05,  0.04,  0.10, 0.10, -0.50],
          [1.25, -0.05,  0.06,  0.14, 0.10, -0.42],
          [1.50, -0.02,  0.02,  0.08, 0.04,  0.15],
          [1.70, -0.02,  0.02,  0.08, 0.04,  0.15],
          [1.90,  0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 1.8, inspects: GUN_INSPECTS,
    },
    launcher: {
      name: "LAUNCHER", group: launcherGroup, projectile: "grenade",   // projectile "grenade": it lobs a grenade that bounces and blows up (GREN_*), splash damage in a ball
      restPos: new THREE.Vector3(0.24, -0.26, -0.5), restRot: new THREE.Euler(0.03, -0.07, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.075, -0.3), adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, scope: false, adsZoom: 0.8, fireRate: 0.9, auto: false, isMelee: false, usesAmmo: true,
      magSize: 4, ammoLabel: "GRENADES", pellets: 1, spread: 0.012, spreadAds: 0.004, bloom: 0, bloomMax: 0, bloomRecover: 0.1,
      scoreScale: 0.8, recoil: 1.1, kick: 0.9, flashScale: 0.8, brake: false, smoke: 0.8,
      action: "none", ejectOnShot: false, casing: "small",
      muzzle: new THREE.Vector3(0, 0.012, -0.62), eject: new THREE.Vector3(0.03, 0.03, 0.0),
      sound: { recording: "shotgun", rate: 0.62, lowcut: 40, length: 1.2, gain: 0.9 },
      recoilKick: { up: 0.04, grow: 0, side: 0.006, max: 0.06, recover: 6, hold: 0.1 },
      mag: launcherMag, magRestY: launcherMag.position.y,
      reload: {
        time: 2.3, magOut: 0.2, magDrop: 0.35, magUp: 1.0, magSeat: 1.5, travel: 0.1, rise: 0.12, charge: 0.9,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.30, -0.05,  0.05,  0.14, 0.10, -0.45],
          [1.10, -0.05,  0.04,  0.10, 0.10, -0.50],
          [1.50, -0.05,  0.06,  0.14, 0.10, -0.42],
          [1.80, -0.02,  0.02,  0.08, 0.04,  0.15],
          [2.05, -0.02,  0.02,  0.08, 0.04,  0.15],
          [2.30,  0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 1.8, inspects: GUN_INSPECTS,
    },
    rpg: {
      name: "RPG", group: rpgGroup, projectile: "rocket",   // projectile "rocket": a fast rocket that goes off on whatever it touches (BLAST.rpg)
      restPos: new THREE.Vector3(0.2, -0.2, -0.4), restRot: new THREE.Euler(0.03, -0.07, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.105, -0.3), adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, scope: false, adsZoom: 0.78, fireRate: 1.2, auto: false, isMelee: false, usesAmmo: true,
      magSize: 1, ammoLabel: "ROCKETS", pellets: 1, spread: 0.01, spreadAds: 0.002, bloom: 0, bloomMax: 0, bloomRecover: 0.1,
      scoreScale: 0.8, recoil: 1.4, kick: 1.1, flashScale: 1.2, brake: false, smoke: 1.4,
      action: "none", ejectOnShot: false, casing: "small",
      muzzle: new THREE.Vector3(0, 0, -0.52), eject: new THREE.Vector3(0.03, 0.03, 0.0),
      sound: { recording: "shotgun", rate: 0.5, lowcut: 40, length: 1.4, gain: 1.0 },
      recoilKick: { up: 0.05, grow: 0, side: 0.008, max: 0.07, recover: 6, hold: 0.12 },
      mag: rpgMag, magRestY: rpgMag.position.y,
      reload: {
        time: 3.0, magOut: 0.2, magDrop: 0.35, magUp: 1.3, magSeat: 2.0, travel: 0.1, rise: 0.12, charge: 1.2,
        keys: [
          [0.00,  0,     0,     0,    0,     0   ],
          [0.35, -0.05,  0.05,  0.14, 0.10, -0.45],
          [1.40, -0.05,  0.04,  0.10, 0.10, -0.50],
          [2.00, -0.05,  0.06,  0.14, 0.10, -0.42],
          [2.40, -0.02,  0.02,  0.08, 0.04,  0.15],
          [2.70, -0.02,  0.02,  0.08, 0.04,  0.15],
          [3.00,  0,     0,     0,    0,     0   ],
        ],
      },
      inspectDuration: 1.8, inspects: GUN_INSPECTS,
    },
  };
  // (a gun travels over the network as its place in this list, so new guns go at the end, after the knife, never in the middle)
  const WEAPON_ORDER = ["rifle", "ar", "ak", "shotgun", "pistol", "knife", "smg", "dmr", "burst", "lmg", "crossbow", "launcher", "rpg"];
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id];
    w.id = id;
    if (w.usesAmmo) { w.ammo = w.magSize; w.bloomNow = 0; }
  }
  function refillAmmo() { for (const id of WEAPON_ORDER) if (WEAPONS[id].usesAmmo) WEAPONS[id].ammo = WEAPONS[id].magSize; }

  const vm = {
    current: "rifle", pending: null, last: "knife",
    switchTimer: 0, switchDuration: 0.44, swapped: true, switchDoneAt: -99,
    drawTimer: 0.4, drawDuration: 0.4,
    inspectTimer: 0, inspectIndex: 0,
    recoil: 0,
    slashTimer: 0, swingIndex: -1, swingKind: "fore", meleePending: false,
    bobTimer: 0, adsProgress: 0, wantADS: false, adsStartTime: -99, flashTimer: 0,
    boltTime: -1, boltCues: [], spentCasing: false,
    throwTimer: 0,
    grappleOut: 0,   // 0 gun in hand, 1 grapple in hand
    pumpTime: -1, pumpCues: [], slideTime: -1,
    recoilPitch: 0, recoilYaw: 0, burstShots: 0, burstQueue: 0, burstTimer: 0, lastShotAt: -99,   // recoil on the aim (where bullets go)
    viewRecoilPitch: 0, viewRecoilYaw: 0,                            // how much of it the view (crosshair) shows
    camKick: 0, camKickYaw: 0,
  };

  function currentWeapon() { return WEAPONS[vm.current]; }

  function switchWeapon(name) {
    if (name === vm.current || vm.switchTimer > 0 || !WEAPONS[name]) return;
    vm.last = vm.current;
    vm.pending = name;
    vm.switchDuration = 0.44;
    vm.switchTimer = vm.switchDuration;
    vm.swapped = false;
    vm.inspectTimer = 0;
    vm.wantADS = false;
    cancelReload();
    cancelBoltCycle();
    cancelPump();
    vm.recoilPitch = vm.recoilYaw = vm.viewRecoilPitch = vm.viewRecoilYaw = 0;
    vm.burstShots = 0;
    vm.throwTimer = 0;
    vm.slashTimer = 0;
    vm.meleePending = false;
    playSwitchSound();
  }

  function startInspect() {
    if (vm.switchTimer > 0 || vm.inspectTimer > 0 || reload.active || vm.boltTime >= 0 || vm.pumpTime >= 0 || vm.throwTimer > 0 || vm.grappleOut > 0) return;
    const w = currentWeapon();
    vm.inspectIndex = Math.floor(Math.random() * w.inspects.length);
    vm.inspectTimer = w.inspectDuration;
    playInspectSound();
  }

  // ---- bolt cycle after each rifle shot (lift, rack back, push home, lock) ----
  // The sound is a recorded bolt action (freesound 351777, CC0) played a little fast.
  // The animation keys are lined up with its clicks, in seconds from when the sound starts.
  const BOLT = {
    clipStart: 0.42, clipLen: 1.05, rate: 1.25,   // where the bolt sits in the recording
    lift: [0, 0.03], back: [0.13, 0.296], forward: [0.48, 0.664], lock: [0.664, 0.728],
    len: 0.84,
    delay: 0.25,   // after a shot, let it ring before working the bolt
  };
  const BOLT_CYCLE = BOLT.delay + BOLT.len;   // keep under the rifle's fireRate
  const _ejectPos = new THREE.Vector3();
  const _ejectVel = new THREE.Vector3();
  const _camQuat = new THREE.Quaternion();
  const _smokeRight = new THREE.Vector3();

  function startBoltCycle() {
    vm.boltTime = 0;
    vm.boltCues = [[BOLT.delay, playBoltCycleSound], [BOLT.delay + BOLT.back[1], ejectSpentCasing]];
  }

  // bolt handle pose for t seconds into the bolt sound; the travel eases in so it
  // hits each stop at speed. Returns a 0..1 jolt that spikes on the two slams.
  function poseBolt(t) {
    const lin = (k) => Math.min(Math.max((t - k[0]) / (k[1] - k[0]), 0), 1);
    const slam = (k) => { const x = lin(k); return x * x; };
    boltMesh.rotation.z = (easeInOut(lin(BOLT.lift)) - easeInOut(lin(BOLT.lock))) * 1.15;
    boltMesh.position.z = 0.20 + (slam(BOLT.back) - slam(BOLT.forward)) * 0.13;
    const jolt = (at) => (t >= at ? Math.exp(-(t - at) * 22) : 0);
    return jolt(BOLT.back[1]) + jolt(BOLT.forward[1]);
  }

  function cancelBoltCycle() {
    vm.boltTime = -1;
    vm.boltCues.length = 0;
    stopBoltSound();
    boltMesh.position.z = 0.20;
    boltMesh.rotation.z = 0;
  }

  // throw the fired case out of the gun's port to the side, carrying the player's momentum
  function ejectFrom(w) {
    _ejectPos.copy(w.eject);
    w.group.localToWorld(_ejectPos);
    camera.getWorldQuaternion(_camQuat);
    const k = w.casing === "small" ? 0.8 : w.casing === "magnum" ? 1.15 : 1;
    _ejectVel.set((2.2 + Math.random() * 0.9) * k * handSign(), (1.9 + Math.random() * 0.8) * k, 0.5 + Math.random() * 0.5)
      .applyQuaternion(_camQuat).add(player.velocity);
    ejectCasing(_ejectPos, _ejectVel, w.casing);
    if (w.casing !== "small") spawnSmoke(_ejectPos, player.velocity.x, 0.3, player.velocity.z, 0.8, 0.04, 0.22, 0.22);
  }
  // the bolt or pump throws out the case left in the chamber by the last shot
  function ejectSpentCasing() {
    if (!vm.spentCasing) return;
    vm.spentCasing = false;
    ejectFrom(currentWeapon());
  }

  // ---- shotgun pump: back (ejecting the shell), then forward, timed to the bolt recording's clacks ----
  const PUMP = { delay: 0.14, back: [0, 0.11], forward: [0.17, 0.28], len: 0.34 };
  const PUMP_TRAVEL = 0.10, PUMP_REST_Z = -0.32;
  function startPump() {
    vm.pumpTime = 0;
    vm.pumpCues = [[PUMP.delay, () => playActionClack("back", 1.2)], [PUMP.delay + PUMP.back[1], ejectSpentCasing],
      [PUMP.delay + PUMP.forward[0], () => playActionClack("forward", 1.2)]];
  }
  function posePump(t) {
    const lin = (k) => Math.min(Math.max((t - k[0]) / (k[1] - k[0]), 0), 1);
    const slam = (k) => { const x = lin(k); return x * x; };
    shotgunPump.position.z = PUMP_REST_Z + (slam(PUMP.back) - slam(PUMP.forward)) * PUMP_TRAVEL;
    const jolt = (at) => (t >= at ? Math.exp(-(t - at) * 25) : 0);
    return jolt(PUMP.back[1]) + jolt(PUMP.forward[1]);
  }
  function cancelPump() {
    vm.pumpTime = -1;
    vm.pumpCues.length = 0;
    shotgunPump.position.z = PUMP_REST_Z;
  }

  // pistol slide cycle, in seconds: slam back, hold, ride forward
  const SLIDE_BACK = 0.028, SLIDE_HOLD = 0.045, SLIDE_RETURN = 0.075, SLIDE_TRAVEL = 0.05;

  // shot spread: a random direction inside a cone around the aim
  const _sprRight = new THREE.Vector3(), _sprUp = new THREE.Vector3(), _worldUp = new THREE.Vector3(0, 1, 0);
  function spreadDirection(base, halfAngle, out) {
    out.copy(base);
    if (halfAngle <= 0) return out;
    camera.getWorldQuaternion(_camQuat);
    _sprRight.set(1, 0, 0).applyQuaternion(_camQuat);
    _sprUp.set(0, 1, 0).applyQuaternion(_camQuat);
    const r = Math.tan(halfAngle * Math.sqrt(Math.random())), th = Math.random() * Math.PI * 2;
    return out.addScaledVector(_sprRight, r * Math.cos(th)).addScaledVector(_sprUp, r * Math.sin(th)).normalize();
  }

  // blast smoke out the front plus a puff from each side of the muzzle brake;
  // kept faint while aiming so it doesn't cloud the view
  function muzzleSmoke(pos, dir, amount) {
    const a = (1 - 0.8 * easeInOut(vm.adsProgress)) * amount;
    if (a < 0.05) return;
    const pv = player.velocity;
    for (let i = 0; i < 3; i++) {
      const sp = 2 + i * 2.2 + Math.random();
      spawnSmoke(pos, pv.x + dir.x * sp, dir.y * sp + 0.3, pv.z + dir.z * sp,
        0.8 + Math.random() * 0.5, 0.14, 0.8 + i * 0.3, 0.45 * a);
    }
    _smokeRight.set(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(_camQuat));
    for (const side of [-1, 1]) {
      spawnSmoke(pos, pv.x + _smokeRight.x * side * 3, 0.4, pv.z + _smokeRight.z * side * 3, 0.7, 0.1, 0.6, 0.36 * a);
    }
  }

  const _tmpPos = new THREE.Vector3();
  const _tmpRot = new THREE.Euler();

  // Sample keyframes [time, ...values] at time t, easing in and out of every key so the
  // motion has no corners. Writes the values into `out` and returns it.
  function sampleKeys(keys, t, out) {
    let i = 1;
    while (i < keys.length - 1 && t > keys[i][0]) i++;
    const a = keys[i - 1], b = keys[i];
    const k = easeInOut(Math.min(Math.max((t - a[0]) / (b[0] - a[0]), 0), 1));
    for (let j = 1; j < a.length; j++) out[j - 1] = a[j] + (b[j] - a[j]) * k;
    return out;
  }

  // Knife swings, as offsets from the rest pose: [time, x, y, z, rx, ry, rz].
  // Each has a wind-up, a fast cut through the middle of the screen, a follow-through
  // and a recovery. `contact` is when the blade crosses the centre and the hit lands.
  const SWINGS = {
    fore: { contact: 0.13, keys: [   // upper right to lower left
      [0.00,  0,     0,     0,     0,     0,     0   ],
      [0.09,  0.06,  0.10, -0.02,  0.50, -0.40, -0.50],
      [0.17, -0.24,  0.00, -0.16, -0.25,  0.85,  0.50],
      [0.26, -0.30, -0.06, -0.12, -0.35,  0.95,  0.60],
      [0.42,  0,     0,     0,     0,     0,     0   ],
    ] },
    back: { contact: 0.13, keys: [   // left to lower right, backhand
      [0.00,  0,     0,     0,     0,     0,     0   ],
      [0.09, -0.20,  0.08, -0.02,  0.40,  0.65,  0.55],
      [0.17,  0.10, -0.04, -0.14, -0.25, -0.65, -0.50],
      [0.26,  0.14, -0.08, -0.10, -0.35, -0.75, -0.60],
      [0.42,  0,     0,     0,     0,     0,     0   ],
    ] },
    stab: { contact: 0.15, keys: [   // draw back, then thrust in toward the crosshair
      [0.00,  0,     0,     0,     0,     0,     0   ],
      [0.10,  0.03, -0.04,  0.10,  0.15,  0.05,  0   ],
      [0.16, -0.12,  0.06, -0.26, -0.05,  0.30,  0   ],
      [0.24, -0.12,  0.06, -0.23, -0.05,  0.30,  0   ],
      [0.42,  0,     0,     0,     0,     0,     0   ],
    ] },
  };
  const SWING_ORDER = ["fore", "back", "fore", "back", "stab"];
  const _swing = [0, 0, 0, 0, 0, 0];

  let lastXhOpacity = -1;
  function updateViewmodel(dt, moving, sprinting, onGround) {
    let holster = 0;
    if (vm.switchTimer > 0) {
      vm.switchTimer -= dt;
      const elapsed = vm.switchDuration - vm.switchTimer;
      const half = vm.switchDuration / 2;
      if (elapsed < half) {
        holster = easeInOut(Math.min(elapsed / half, 1));
      } else {
        if (!vm.swapped && vm.pending) {
          currentWeapon().group.visible = false;
          vm.current = vm.pending; vm.pending = null; vm.swapped = true;
          currentWeapon().group.visible = true;
          fitMuzzleFlash(currentWeapon());
          updateHotbar(); updateAmmoHud();
        }
        holster = 1 - easeInOut(Math.min((elapsed - half) / half, 1));
      }
      if (vm.switchTimer <= 0) { vm.switchTimer = 0; holster = 0; vm.switchDoneAt = elapsedTime; }
    } else if (vm.drawTimer > 0) {
      vm.drawTimer -= dt;
      holster = easeInOut(Math.max(vm.drawTimer, 0) / vm.drawDuration);
    }

    // the grapple: the gun lowers away first, then the grapple comes up; letting go runs it backwards
    const gTarget = player.grappleWant ? 1 : 0;
    vm.grappleOut += Math.max(-dt / CFG.grappleDrawTime, Math.min(dt / CFG.grappleDrawTime, gTarget - vm.grappleOut));
    const gunAway = easeInOut(Math.min(vm.grappleOut * 2, 1)), grappleUp = easeInOut(Math.max(vm.grappleOut * 2 - 1, 0));
    holster = Math.max(holster, gunAway);

    const w = currentWeapon();

    const adsBlocked = vm.switchTimer > 0 || vm.inspectTimer > 0 || reload.active || vm.grappleOut > 0;
    const adsTarget = (vm.wantADS && w.canADS && !adsBlocked) ? 1 : 0;
    const adsStep = dt / (CFG.adsTime * (w.adsMult || 1));
    if (vm.adsProgress < adsTarget) vm.adsProgress = Math.min(vm.adsProgress + adsStep, 1);
    else if (vm.adsProgress > adsTarget) vm.adsProgress = Math.max(vm.adsProgress - adsStep, 0);
    const adsEased = easeInOut(vm.adsProgress);

    const px = w.restPos.x + (w.adsPos.x - w.restPos.x) * adsEased;
    const py = w.restPos.y + (w.adsPos.y - w.restPos.y) * adsEased;
    const pz = w.restPos.z + (w.adsPos.z - w.restPos.z) * adsEased;
    const rx = w.restRot.x + (w.adsRot.x - w.restRot.x) * adsEased;
    const ry = w.restRot.y + (w.adsRot.y - w.restRot.y) * adsEased;
    const rz = w.restRot.z + (w.adsRot.z - w.restRot.z) * adsEased;

    const speedFactor = moving ? (sprinting ? 1.6 : 1.0) : 0;
    vm.bobTimer += dt * (onGround ? (2 + speedFactor * 8) : 1.2);
    const bobScale = (1 - adsEased) * (0.3 + speedFactor) * (SETTINGS.reduceMotion ? 0 : SETTINGS.bob);
    const bobX = Math.sin(vm.bobTimer) * 0.012 * bobScale;
    const bobY = Math.abs(Math.sin(vm.bobTimer * 2)) * 0.008 * bobScale;

    vm.recoil *= Math.max(0, 1 - dt * 11);

    // camera punch (gone long before the bolt lets you fire again), plus a slow
    // figure-eight breathing sway while scoped. Both move the real aim, so what
    // the reticle shows is where the shot goes.
    vm.camKick *= Math.max(0, 1 - dt * 10);
    const sway = SETTINGS.scopeSway && !SETTINGS.reduceMotion && w.scope ? CFG.scopeSway * adsEased : 0;
    const kick = vm.camKick * (SETTINGS.reduceMotion ? 0 : SETTINGS.shake);
    if (w.recoilKick && elapsedTime - vm.lastShotAt > w.recoilKick.hold) {
      const settle = Math.exp(-w.recoilKick.recover * dt);
      vm.recoilPitch *= settle;
      vm.recoilYaw *= settle;
    }
    // The crosshair shows all of the first few kicks, then only half: in a long spray the bullets
    // climb past it and you pull down to compensate. It glides there rather than snapping.
    // Aiming down sights, the sights stay roughly on the shots instead (the view takes almost all of it).
    const hipShare = vm.burstShots <= 2 ? 1 : Math.max(0.5, 1 - (vm.burstShots - 2) * 0.1);
    const viewShare = hipShare + (0.95 - hipShare) * adsEased;
    const glide = Math.min(1, dt * 24);
    vm.viewRecoilPitch += (vm.recoilPitch * viewShare - vm.viewRecoilPitch) * glide;
    vm.viewRecoilYaw += (vm.recoilYaw * viewShare - vm.viewRecoilYaw) * glide;
    camera.rotation.x = kick * 0.032 * (1 + 0.6 * adsEased) + Math.sin(elapsedTime * 1.6) * sway + vm.viewRecoilPitch;
    camera.rotation.y = kick * vm.camKickYaw * 0.008 + Math.sin(elapsedTime * 0.8) * sway * 1.3 + vm.viewRecoilYaw;

    // bolt: roll the rifle toward you while it works, with a jolt on each slam
    let boltTilt = 0, boltJolt = 0;
    if (vm.boltTime >= 0) {
      vm.boltTime += dt;
      while (vm.boltCues.length && vm.boltTime >= vm.boltCues[0][0]) vm.boltCues.shift()[1]();
      const bt = vm.boltTime;
      boltJolt = poseBolt(bt - BOLT.delay);
      const rollIn = Math.min(Math.max((bt - BOLT.delay + 0.08) / 0.16, 0), 1);
      const rollOut = Math.min(Math.max((BOLT_CYCLE - bt) / 0.18, 0), 1);
      boltTilt = easeInOut(Math.min(rollIn, rollOut)) * (1 - adsEased);
      if (bt >= BOLT_CYCLE) cancelBoltCycle();
    } else if (reload.active && w.action === "bolt" && reload.elapsed >= RELOAD_BOLT_AT) {
      boltJolt = poseBolt(reload.elapsed - RELOAD_BOLT_AT);
    }
    // shotgun pump, after a shot or at the end of a reload from empty
    if (vm.pumpTime >= 0) {
      vm.pumpTime += dt;
      while (vm.pumpCues.length && vm.pumpTime >= vm.pumpCues[0][0]) vm.pumpCues.shift()[1]();
      boltJolt += 0.6 * posePump(vm.pumpTime - PUMP.delay);
      if (vm.pumpTime >= PUMP.delay + PUMP.len) cancelPump();
    }
    boltJolt *= 1 - adsEased;

    // pistol slide: slams back on every shot, holds a moment, then rides forward to
    // chamber the next round; on an empty mag it stays locked open
    let slide = 0, slideBack = vm.slideTime < 0;
    if (vm.slideTime >= 0) {
      vm.slideTime += dt;
      const t = vm.slideTime;
      if (t < SLIDE_BACK) slide = easeOut(t / SLIDE_BACK);
      else if (t < SLIDE_HOLD) slide = 1;
      else slide = 1 - easeInOut(Math.min((t - SLIDE_HOLD) / SLIDE_RETURN, 1));
      slideBack = t >= SLIDE_BACK;
      if (t >= SLIDE_HOLD + SLIDE_RETURN) vm.slideTime = -1;
    }
    const lockedOpen = WEAPONS.pistol.ammo <= 0 && !SETTINGS.unlimitedAmmo && !reload.active;
    if (lockedOpen && slideBack) slide = 1;
    pistolSlide.position.z = SLIDE_TRAVEL * slide;

    // spread blooms while spraying and settles back when you stop
    for (const id of WEAPON_ORDER) {
      const g = WEAPONS[id];
      if (g.bloomNow > 0) g.bloomNow = Math.max(0, g.bloomNow - g.bloomRecover * dt);
    }

    // knife swing: play the keyframes, and land the hit when the blade crosses the centre
    _swing.fill(0);
    if (vm.slashTimer > 0) {
      vm.slashTimer -= dt;
      const sw = SWINGS[vm.swingKind];
      const t = w.slashDuration - Math.max(vm.slashTimer, 0);
      sampleKeys(sw.keys, t, _swing);
      if (vm.meleePending && t >= sw.contact) { vm.meleePending = false; meleeStrike(); }
      if (vm.slashTimer <= 0) { vm.slashTimer = 0; _swing.fill(0); }
    }

    let ipx = 0, ipy = 0, ipz = 0, irx = 0, iry = 0, irz = 0;
    if (vm.inspectTimer > 0) {
      vm.inspectTimer -= dt;
      const t = 1 - Math.max(vm.inspectTimer, 0) / w.inspectDuration;
      w.inspects[vm.inspectIndex](Math.min(t, 1), _tmpPos, _tmpRot);
      const reach = w.inspectReach || 1;
      ipx = _tmpPos.x * reach; ipy = _tmpPos.y * reach; ipz = _tmpPos.z * reach;
      irx = _tmpRot.x; iry = _tmpRot.y; irz = _tmpRot.z;
      if (vm.inspectTimer <= 0) { vm.inspectTimer = 0; boltMesh.position.z = 0.20; }
    }

    const rl = reload.active ? (reload.shells ? shellReloadPose(reload.elapsed) : reloadPose(w, reload.elapsed)) : RELOAD_REST;

    // knife throw: snap forward and let go, then a fresh knife flips up from below
    let thX = 0, thY = 0, thZ = 0, thRX = 0;
    if (vm.throwTimer > 0) {
      vm.throwTimer -= dt;
      const t = CFG.knifeThrowCooldown - Math.max(vm.throwTimer, 0);
      if (!vm.throwReleased && t >= THROW_RELEASE) { vm.throwReleased = true; releaseKnife(); }
      if (t < THROW_RELEASE) {
        const k = easeOut(t / THROW_RELEASE);
        thZ = -0.22 * k; thY = 0.06 * k; thRX = -0.9 * k; thX = -0.05 * k;
      } else {
        const back = Math.min((t - THROW_RELEASE) / (CFG.knifeThrowCooldown - THROW_RELEASE), 1);
        const up = easeOut(Math.max((back - 0.25) / 0.75, 0));
        thY = -0.35 * (1 - up); thRX = 1.2 * (1 - up);
      }
      knifeGroup.visible = !(t >= THROW_RELEASE && t < THROW_RELEASE + 0.12) && vm.current === "knife";
      if (vm.throwTimer <= 0) { vm.throwTimer = 0; knifeGroup.visible = vm.current === "knife"; }
    }

    grappleGroup.visible = grappleUp > 0;
    grappleGroup.position.set(0.22 + bobX, -0.25 + bobY - (1 - grappleUp) * 0.5, -0.5);
    grappleGroup.rotation.set(0.04 + (1 - grappleUp) * 1.1, -0.08, 0.01);

    const holsterDrop = holster * 0.45;
    const holsterTilt = holster * 1.1;

    w.group.position.set(
      px + bobX + ipx + rl.x + thX + _swing[0] - boltTilt * 0.04,
      py + bobY + ipy + rl.y + thY + _swing[1] - holsterDrop + boltTilt * 0.015,
      pz + ipz + thZ + _swing[2] + vm.recoil * 0.16 + boltJolt * 0.012
    );
    w.group.rotation.set(
      rx + irx + rl.rx + thRX + _swing[3] - vm.recoil * 0.34 + holsterTilt + boltTilt * 0.08 - boltJolt * 0.03,
      ry + iry + rl.ry + _swing[4] + boltTilt * 0.10,
      rz + irz + rl.rz + _swing[5] + boltTilt * 0.34
    );

    // muzzle flash: a hot first frame, then a quick fade so it lingers just long enough to catch.
    // Scoped, the rifle is hidden, so a faint warm glow rises into the lens instead.
    let flashK = 0;
    if (vm.flashTimer > 0) {
      vm.flashTimer -= dt;
      flashK = Math.max(vm.flashTimer / FLASH_TIME, 0);
      flashK *= flashK;
      muzzleFlash.visible = true;
      flashMat.opacity = flashK;
      muzzleFlash.scale.setScalar((0.8 + Math.random() * 0.6) * (w.flashScale || 1));
      muzzleLight.intensity = 2.0 * flashK;
      if (vm.flashTimer <= 0) { muzzleFlash.visible = false; vm.flashTimer = 0; muzzleLight.intensity = 0; }
    }
    scopeFlashEl.style.opacity = (flashK * 0.55 * (w.scope ? adsEased : 0)).toFixed(3);

    // FOV: scope zoom, plus a speed-driven widening for a sense of momentum
    const speedNow = Math.hypot(player.velocity.x, player.velocity.z);
    const speedT = Math.max(0, Math.min((speedNow - CFG.groundMaxSpeed) / (CFG.maxSpeed - CFG.groundMaxSpeed), 1));
    const speedFov = SETTINGS.reduceMotion ? 0 : CFG.speedFovBoost * speedT * (1 - adsEased);
    const adsFov = w.scope ? CFG.scopedFov * (w.scopeFovMult || 1) : SETTINGS.fov * (w.adsZoom || 1) * (w.zoomMult || 1);
    const targetFov = SETTINGS.fov + (adsFov - SETTINGS.fov) * adsEased + speedFov;
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov += (targetFov - camera.fov) * Math.min(dt * 12, 1);
      camera.updateProjectionMatrix();
    }
    speedlinesEl.style.opacity = SETTINGS.speedLines && !SETTINGS.reduceMotion ? Math.max(0, (speedT - 0.35) / 0.65) * 0.85 * (1 - adsEased) : 0;

    const scopeAlpha = w.scope ? Math.max(0, (adsEased - 0.55) / 0.45) : 0;
    lastScopeAlpha = scopeAlpha;
    scopeEl.style.opacity = scopeAlpha;
    // the lens closes in from slightly too big as your eye settles behind it
    scopeEl.style.transform = "translate(-50%, -50%) scale(" + (1.2 - 0.2 * scopeAlpha).toFixed(3) + ")";
    scopeLinesEl.style.opacity = scopeAlpha;
    // the scope has its own reticle; iron sights are the aim, so the crosshair fades out while aiming
    const xhOpacity = w.scope ? (adsEased > 0.5 ? 0 : 1) : Math.max(0, 1 - adsEased * 2);
    if (xhOpacity !== lastXhOpacity) { crosshairEl.style.opacity = xhOpacity; lastXhOpacity = xhOpacity; }
    w.group.visible = scopeAlpha < 0.98 && vm.grappleOut <= 0.5;
  }

  function updateHotbar() {
    for (const id in hotbarSlots) hotbarSlots[id].classList.toggle("active", vm.current === id);
  }

  // the one muzzle flash moves to whichever gun is held
  function fitMuzzleFlash(w) {
    if (!w.muzzle) return;
    w.group.add(muzzleFlash);
    muzzleFlash.position.copy(w.muzzle);
    for (const j of flashJets) j.visible = !!w.brake;
  }

  // ======================================================================
  // AUDIO — reverb bus + saturation + per-shot randomization
  // ======================================================================
  let audioCtx = null, masterGain = null, noiseBuffer = null, convolver = null, wetGain = null, shaper = null;

  function makeImpulseResponse(ctx, duration, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const imp = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) {
        // slight early-reflection cluster then a smooth exponential tail
        const t = i / len;
        const early = (i < rate * 0.06 && Math.random() < 0.02) ? 2.5 : 1;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early;
      }
    }
    return imp;
  }

  function makeSaturationCurve(amount) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  // Sound is optional: a browser, an extension or a privacy setting can refuse Web Audio, and then the game still runs, silently.
  let audioFailed = false;
  function initAudio() {
    if (audioFailed) return;
    try { initAudioNow(); } catch (e) { audioFailed = true; audioCtx = null; masterGain = null; }
  }
  function initAudioNow() {
    if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = SETTINGS.volume;
    masterGain.connect(audioCtx.destination);

    // reverb send: this is what stops everything sounding dry and synthetic
    convolver = audioCtx.createConvolver();
    convolver.buffer = makeImpulseResponse(audioCtx, 1.9, 2.6);
    wetGain = audioCtx.createGain();
    wetGain.gain.value = 0.42;
    convolver.connect(wetGain).connect(masterGain);

    shaper = audioCtx.createWaveShaper();
    shaper.curve = makeSaturationCurve(2.6);
    shaper.oversample = "2x";
    shaper.connect(masterGain);

    const n = Math.floor(audioCtx.sampleRate * 1.0);
    noiseBuffer = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      // slightly correlated noise sounds more like air than pure white hiss
      const white = Math.random() * 2 - 1;
      last = 0.82 * last + 0.18 * white;
      d[i] = white * 0.75 + last * 0.6;
    }

    decodeEmbedded("rifleShot", (buf) => { rifleShotBuffer = trimToFirstShot(buf); });
    decodeEmbedded("boltCycle", (buf) => { boltCycleBuffer = buf; });
    decodeEmbedded("pistolShot", (buf) => { shotBuffers.pistol = trimToFirstShot(buf); });
    decodeEmbedded("arShot", (buf) => { shotBuffers.ar = trimToFirstShot(buf); });
    decodeEmbedded("akShot", (buf) => { shotBuffers.ak = trimToFirstShot(buf); });
    const sfx = (window.TSB_SOUNDS && window.TSB_SOUNDS.sfx) || {};
    for (const name of Object.keys(sfx)) decodeClip(sfx[name], (buf) => { sfxBuffers[name] = trimLeadingSilence(buf); });
  }

  // Recorded sounds (CC0, from freesound) are embedded in sounds.js and decoded once:
  //  rifleShot - "Rifle Gun Shot 01" by LilMati (433858), trimmed to start on the shot
  //  boltCycle - "Sniper Rifle M24 SFX" by kennysvoice (351777); only its bolt action is used
  //  pistolShot - "Gunshot.wav" by Cloud-10 (632821)
  //  arShot - "AssaultRifle1.wav" by SuperPhat (404562)
  //  akShot - "AK47 Shot" by LeMudCrab (163457)
  let rifleShotBuffer = null, boltCycleBuffer = null;
  const shotBuffers = {};   // the other guns' reports, by the name in each weapon's sound.recording

  const sfxBuffers = {};   // the short clips in sounds.js (TSB_SOUNDS.sfx), by name

  // MP3 encoding pads the start of a clip with a few dozen ms of silence; cut it so a click or
  // an impact plays the moment it's triggered
  function trimLeadingSilence(buf) {
    const d = buf.getChannelData(0);
    let i = 0;
    while (i < d.length && Math.abs(d[i]) < 0.004) i++;
    i = Math.max(0, i - Math.floor(buf.sampleRate * 0.001));
    if (i < 8) return buf;
    const out = audioCtx.createBuffer(buf.numberOfChannels, buf.length - i, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(i));
    return out;
  }

  function decodeEmbedded(name, done) {
    decodeClip(window.TSB_SOUNDS && window.TSB_SOUNDS[name], done);
  }
  function decodeClip(b64, done) {
    if (!b64) return;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    audioCtx.decodeAudioData(bytes.buffer).then(done, () => {});
  }

  // start just before the first big transient, stop before a second shot if the
  // recording has one, and normalise to full scale
  function trimToFirstShot(buf) {
    const sr = buf.sampleRate, ch = buf.numberOfChannels;
    const mono = new Float32Array(buf.length);
    for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / ch; }
    let peak = 0;
    for (let i = 0; i < mono.length; i++) peak = Math.max(peak, Math.abs(mono[i]));
    let start = 0;
    for (let i = 0; i < mono.length; i++) {
      if (Math.abs(mono[i]) > peak * 0.3) { start = Math.max(0, i - Math.floor(sr * 0.004)); break; }
    }
    const win = Math.floor(sr * 0.005);
    let end = Math.min(mono.length, start + sr * 3.2), level = 0;
    for (let i = start + Math.floor(sr * 0.35); i + win < end; i += win) {
      let e = 0;
      for (let j = i; j < i + win; j++) e = Math.max(e, Math.abs(mono[j]));
      if (level > 0 && e > peak * 0.45 && e > level * 4) { end = i - Math.floor(sr * 0.01); break; }
      level = level ? level * 0.7 + e * 0.3 : e;
    }
    const len = Math.max(1, Math.floor(end - start));
    const out = audioCtx.createBuffer(2, len, sr);
    let pk = 0;
    for (let c = 0; c < 2; c++) {
      const src = buf.getChannelData(Math.min(c, ch - 1)), d = out.getChannelData(c);
      for (let i = 0; i < len; i++) { d[i] = src[start + i]; pk = Math.max(pk, Math.abs(d[i])); }
    }
    for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < len; i++) d[i] *= 0.95 / (pk || 1); }
    return out;
  }

  // route a node to dry master (optionally through saturation) and the reverb send
  function route(node, wet, saturate) {
    if (saturate) node.connect(shaper); else node.connect(masterGain);
    if (wet > 0) {
      const s = audioCtx.createGain();
      s.gain.value = wet;
      node.connect(s).connect(convolver);
    }
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  function noiseHit(freq, q, gain, dur, type, delay, wet, saturate) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime + (delay || 0);
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = rnd(0.85, 1.18);
    src.loop = true;
    const f = audioCtx.createBiquadFilter();
    f.type = type || "bandpass";
    f.frequency.value = freq * rnd(0.94, 1.06);
    f.Q.value = q;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.002);   // near-instant attack = a crack, not a bloop
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(f).connect(g);
    route(g, wet === undefined ? 0.25 : wet, saturate);
    src.start(now); src.stop(now + dur + 0.02);
  }

  function noiseSweep(f0, f1, q, gain, dur, type, delay, wet) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime + (delay || 0);
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = rnd(0.9, 1.12);
    src.loop = true;
    const f = audioCtx.createBiquadFilter();
    f.type = type || "bandpass";
    f.frequency.setValueAtTime(f0, now);
    f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), now + dur);
    f.Q.value = q;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(f).connect(g);
    route(g, wet === undefined ? 0.3 : wet, false);
    src.start(now); src.stop(now + dur + 0.02);
  }

  function tone(type, f0, f1, gain, dur, delay, wet, saturate) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime + (delay || 0);
    const o = audioCtx.createOscillator();
    o.type = type;
    const jitter = rnd(0.97, 1.03);
    o.frequency.setValueAtTime(f0 * jitter, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1 * jitter, 1), now + dur);
    o.detune.value = rnd(-18, 18);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g);
    route(g, wet === undefined ? 0.22 : wet, saturate);
    o.start(now); o.stop(now + dur + 0.02);
  }

  // the recording, processed as tuned in the shot lab: 60 Hz low cut, light
  // compression, full level for 0.9 s then a fade to silence at 1.8 s
  function playShotSound(profile, level) {   // level: 1 = your own gun, less for someone else's
    if (!audioCtx) return;
    const pf = profile || WEAPONS.rifle.sound;
    const buf = pf.recording ? (shotBuffers[pf.recording] || sfxBuffers[pf.recording + "Shot"]) : rifleShotBuffer;
    if (!buf) { noiseHit(1400, 0.5, 1.2, 0.12, "lowpass", 0, 0.3, true); return; }   // still decoding
    const now = audioCtx.currentTime;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pf.rate * rnd(0.98, 1.02);   // tiny variation so repeat shots aren't identical
    const hp = audioCtx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = pf.lowcut; hp.Q.value = 0.7;
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -15.6; comp.ratio.value = 6; comp.knee.value = 6;
    comp.attack.value = 0.004; comp.release.value = 0.15;
    const makeup = audioCtx.createGain();
    makeup.gain.value = 1.56 * pf.gain * SETTINGS.volGuns * (level === undefined ? 1 : level);
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(1, now);
    env.gain.setValueAtTime(1, now + pf.length * 0.5);
    env.gain.linearRampToValueAtTime(0, now + pf.length);
    src.connect(hp).connect(comp).connect(makeup).connect(env).connect(masterGain);
    src.start(now);
    src.stop(now + pf.length + 0.05);
  }

  // play a recorded clip; a small random pitch change keeps repeats from sounding identical
  function playSfx(name, vol, rate, wet, group) {
    vol *= SETTINGS[group] === undefined ? 1 : SETTINGS[group];
    if (!audioCtx || !sfxBuffers[name] || vol <= 0.001) return;
    const src = audioCtx.createBufferSource();
    src.buffer = sfxBuffers[name];
    src.playbackRate.value = (rate || 1) * rnd(0.97, 1.03);
    const g = audioCtx.createGain();
    g.gain.value = vol;
    src.connect(g);
    route(g, wet === undefined ? 0.1 : wet, false);
    src.start();
  }

  function playDryFire() { playSfx("dryFire", 0.6, 1, 0.1, "volGuns"); }
  // steel plate ping; bigger multipliers ring a little higher, like the old beep did
  // another player taking a hit: a dull thump for the body, a sharper thwack for the head (no metal plate ding)
  function playPlayerHit(head, level) {
    const l = level === undefined ? 1 : level;
    if (head) {   // a sharp crack, then a heavy thud right behind it: louder and longer than a body hit
      playSfx("knifeStick", 1.0 * l, 1.15, 0.12, "volHits");
      setTimeout(() => playSfx("land", 0.85 * l, 0.8, 0.1, "volHits"), 55);
    } else playSfx("land", 0.6 * l, 1.3, 0.06, "volHits");   // one soft, short thump
  }
  function playHitSound(pitch) { playSfx("targetDing", 0.55, 0.92 + (pitch - 1) * 0.3, 0.2, "volHits"); }
  function playSwitchSound() { playSfx("draw", 0.5, 1, 0.1, "volGear"); }
  function playInspectSound() { playSfx("inspect", 0.45, 1, 0.1, "volGear"); }
  // scope ring turning: as recorded going in, a little lower coming out
  function playScopeSound(inward) { playSfx("scope", 0.45, inward ? 1 : 0.82, 0.1, "volGear"); }
  function playKnifeSwing() { playSfx("knifeSwing", 0.6, 1.15, 0.1, "volKnife"); }
  function playKnifeHit() { playSfx("knifeHit", 0.6, 1, 0.2, "volKnife"); }
  // jump pad: an air rush, deeper for the mega pads
  function playPadLaunch(power) { playSfx("jumpPad", 0.7, power > 15 ? 0.8 : 1.05, 0.25, "volMove"); }

  // thrown knife biting into a surface: quieter the further away it lands
  function playKnifeStick(dist) { playSfx("knifeStick", 0.6 / (1 + dist / 6), 1, 0.15 + Math.min(dist / 80, 0.25), "volKnife"); }
  // the kick off the wall, plus the perfect-bounce cue on top of a perfect one
  function playWallBounce(perfect) {
    playSfx("wallBounce", 0.6, 1, 0.1, "volMove");
    const v = SETTINGS.volMove;
    if (perfect && v > 0) { tone("triangle", 500, 1150, 0.18 * v, 0.16, 0, 0.4); noiseHit(1300, 1.5, 0.16 * v, 0.11, "bandpass", 0, 0.4); }
  }
  // footsteps and landings: kept quiet, so movement sounds like movement without getting in the way
  function playFootstep(speed) { playSfx("step" + (1 + Math.floor(Math.random() * 4)), 0.09 + 0.06 * Math.min(speed / 9, 1), 1, 0.05, "volMove"); }
  function playLanding(vol) { playSfx("land", vol, rnd(0.95, 1.05), 0.08, "volMove"); }
  function playSlideStart() { playSfx("slide", 0.35, 1, 0.1, "volMove"); }
  function playMagOut() { playSfx("magOut", 0.55, 1, 0.1, "volGear"); }
  function playMagIn() { playSfx("magIn", 0.55, 1, 0.1, "volGear"); }
  // empty magazine hitting the floor: a dull metal clunk
  function playMagLand(vol) { playSfx("magLand", 0.5 * vol, 1, 0.15, "volGear"); }
  function playBolt() { noiseHit(2800, 3.5, 0.20, 0.07, "highpass", 0, 0.3); noiseHit(1100, 2, 0.16, 0.10, "bandpass", 0.06, 0.35); }
  // the recorded bolt action (see BOLT); stopped early if the cycle is interrupted
  let boltSrc = null;
  function playBoltCycleSound() {
    if (!audioCtx) return;
    stopBoltSound();
    if (!boltCycleBuffer) { playBolt(); return; }   // still decoding
    const src = audioCtx.createBufferSource();
    src.buffer = boltCycleBuffer;
    src.playbackRate.value = BOLT.rate;
    const g = audioCtx.createGain();
    g.gain.value = 0.9 * SETTINGS.volGuns;
    src.connect(g);
    route(g, 0.08, false);
    src.start(audioCtx.currentTime, BOLT.clipStart, BOLT.clipLen);
    boltSrc = src;
  }
  // one clack from the bolt recording: "back" is the bolt slamming open, "forward" slamming home.
  // Pump, slide and charging handle borrow these (sped up) until they get their own recordings.
  const ACTION_CLACKS = { back: [0.70, 0.15], forward: [1.16, 0.16] };
  function playActionClack(which, rate) {
    if (!audioCtx) return;
    if (!boltCycleBuffer) { playBolt(); return; }
    const [at, len] = ACTION_CLACKS[which];
    const src = audioCtx.createBufferSource();
    src.buffer = boltCycleBuffer;
    src.playbackRate.value = rate * rnd(0.97, 1.03);
    const g = audioCtx.createGain();
    g.gain.value = 0.85 * SETTINGS.volGuns;
    src.connect(g);
    route(g, 0.08, false);
    src.start(audioCtx.currentTime, at, len);
  }
  // a shotgun shell pushed into the tube
  function playShellInsert() { playSfx("shellInsert", 0.55, 1, 0.1, "volGear"); }

  function stopBoltSound() {
    if (!boltSrc) return;
    try { boltSrc.stop(); } catch (e) { /* already finished */ }
    boltSrc = null;
  }
  // brass hitting the floor: a tiny tink, pitched a little differently each bounce
  function playCasingPing(vol) { if (vol >= 0.05) playSfx("casing", 0.35 * vol, rnd(0.9, 1.2), 0.15, "volGear"); }

  // ======================================================================
  // DOM
  // ======================================================================
  const blocker = document.getElementById("blocker");
  const startBtn = document.getElementById("start-btn");
  // phones and tablets can't pointer-lock or use WASD; say so instead of failing silently
  if (!matchMedia("(any-pointer: fine)").matches) document.getElementById("touch-note").hidden = false;
  const settingsPanel = document.getElementById("settings");
  const hud = document.getElementById("hud");
  const domEl = renderer.domElement;

  const crosshairEl = document.getElementById("crosshair");
  const scopeEl = document.getElementById("scope");
  const scopeLinesEl = document.getElementById("scope-lines");
  const scopeFlashEl = document.getElementById("scope-flash");
  const speedlinesEl = document.getElementById("speedlines");
  const speedEl = document.getElementById("speed-val");
  const speedbarEl = document.getElementById("speedbar-fill");
  // bottom left: a tile each for the grenade, the blast pack and the grapple (a look for each state, no writing but the key), and the two bars under the crosshair that show a throw
  const abEls = { nade: document.getElementById("ab-nade"), pack: document.getElementById("ab-pack"), hook: document.getElementById("ab-hook") };
  const abFuseEl = abEls.pack.querySelector(".ab-fuse");
  const tbEls = { box: document.getElementById("throw-bars"), dist: document.getElementById("tb-dist"), cookBox: document.getElementById("tb-cook-box"), cook: document.getElementById("tb-cook") };
  function setAb(el, state, action) {   // state: ready, cool, charging, armed or active; "" hides the tile
    if (el.hidden !== !state) el.hidden = !state;
    if (!state) return;
    if (el.dataset.state !== state) el.dataset.state = state;
    const key = bindLabel(action, true).split(" / ")[0], k = el.firstElementChild.nextElementSibling;
    if (k.textContent !== key) k.textContent = key;
  }
  const hpBarEl = document.getElementById("hpbar"), hpFillEl = document.getElementById("hpbar-fill"), hpTextEl = document.getElementById("hpbar-text");
  const stateEl = document.getElementById("state-val");
  const streakEl = document.getElementById("streak-val");
  const scoreEl = document.getElementById("score-val");
  const bonusTagsEl = document.getElementById("bonus-tags");
  const feedEl = document.getElementById("feed");
  // weapon icons for the hotbar, all pointing left, drawn in a 64 x 24 box
  const WEAPON_ICONS = {
    rifle: '<rect x="0.5" y="10.3" width="3.6" height="3.4" rx="0.6"/><rect x="3" y="11" width="25" height="2" rx="0.8"/><path d="M24 10 L44 10 L44 15 L27.5 15 Q25 15 24 13.6 Z"/><path d="M43 10 L50 10.6 L62.4 11.4 L63 18.6 L60.4 18.9 L52 15.6 L47.4 16.2 L45 19.8 L41.6 19.8 L43.2 15 Z"/><rect x="27" y="5.4" width="15" height="2.6" rx="1.2"/><path d="M22 4.3 L27.6 5 L27.6 8.4 L22 9.1 Z"/><path d="M41.4 5 L44.6 4.6 L44.6 8.8 L41.4 8.4 Z"/><rect x="29.6" y="7.6" width="1.8" height="2.6"/><rect x="37.6" y="7.6" width="1.8" height="2.6"/><rect x="33.5" y="4.2" width="2" height="1.4" rx="0.4"/><circle cx="45.6" cy="12.6" r="1.4"/><rect x="33" y="15" width="5" height="2.6" rx="0.4"/><path d="M38.6 15 Q39 18.4 42 18.2 L42 17.1 Q40 17.2 39.8 15 Z"/>',
    ar: '<rect x="4" y="10" width="14" height="2.6" rx="1"/><rect x="16" y="8.5" width="16" height="5.5" rx="1"/><rect x="30" y="7.5" width="16" height="7" rx="1"/><rect x="33" y="5" width="9" height="2.5" rx="1"/><path d="M34 14 L39 14 L37.5 22 L33 21 Z"/><path d="M43 14 L47 14 L47.5 19.5 L44 19.5 Z"/><rect x="46" y="9" width="7" height="3" rx="1"/><rect x="52" y="7.5" width="9" height="8" rx="1.5"/>',
    ak: '<rect x="0.5" y="9.5" width="3.2" height="2.6" rx="0.5"/><rect x="3" y="10.1" width="9" height="1.4"/><path d="M9.6 7.6 L11.6 7.6 L12.4 12 L9.6 12 Z"/><rect x="12" y="7.8" width="9.5" height="1.9" rx="0.8"/><rect x="12" y="10" width="10" height="3.8" rx="1.2"/><rect x="21" y="8.6" width="19" height="5.4" rx="0.6"/><path d="M21 8.8 Q30 6.4 40 7.3 L40 8.8 Z"/><rect x="21.6" y="7" width="2" height="1.8"/><path d="M25.6 14 L31 14 Q31.4 18.6 34.6 22.4 L30.2 23.6 Q26.6 19 25.6 14 Z"/><path d="M35 14 L38.6 14 L40.4 20.6 L37 21.2 Z"/><path d="M31.6 14 Q32 16.6 34.8 16.4 L34.8 15.4 Q33 15.6 32.8 14 Z"/><path d="M39.5 8.8 L46 9.6 L62.4 12 L63 18.8 L60.6 19 L46 14.6 L39.5 14 Z"/>',
    shotgun: '<rect x="2" y="9" width="36" height="2.6" rx="1"/><rect x="8" y="12" width="26" height="2.4" rx="1"/><rect x="14" y="11" width="12" height="4.5" rx="1.5"/><rect x="36" y="8.5" width="12" height="6.5" rx="1"/><path d="M47 9 L62 11 L62 18 L47 15 Z"/><path d="M40 15 L44 15 L43 18 L40 17 Z"/>',
    pistol: '<g transform="translate(6.5 0)"><path d="M5 5.2 L46 5.2 L46 11.2 L7.4 11.2 L5 9.2 Z"/><rect x="8" y="3.6" width="35" height="1.6" rx="0.4"/><rect x="7.6" y="2.6" width="1.6" height="1.4"/><rect x="41.6" y="2.6" width="2.8" height="1.4"/><rect x="12" y="11" width="34.5" height="3.2" rx="0.4"/><path d="M21.4 14 L21.4 19.2 Q21.4 20.4 22.8 20.4 L32 20.4 L32 18.6 L23.4 18.6 L23.4 14 Z"/><path d="M27.6 14 L29.4 14 L29 17.4 L27.8 17.4 Z"/><path d="M33 14 L46 14 Q47.8 14 48.2 15.8 L50.6 23.4 L39.6 23.4 L36.6 15.6 Z"/><path d="M45.8 5.8 L49.6 4.4 L50.4 7.2 L46.2 9 Z"/></g>',
    smg: '<rect x="2" y="10" width="9" height="2.6" rx="1"/><rect x="9" y="8.5" width="12" height="5.5" rx="1"/><rect x="20" y="7.5" width="22" height="7" rx="1"/><rect x="24" y="5" width="12" height="2.5" rx="1"/><rect x="27" y="14" width="5.5" height="9" rx="1"/><path d="M38 14 L43 14 L42 21.5 L37 21 Z"/><rect x="42" y="9" width="14" height="1.6"/><rect x="42" y="12" width="14" height="1.6"/><rect x="55" y="7.5" width="5" height="8" rx="1"/>',
    burst: '<rect x="1" y="10" width="8" height="2.6" rx="1"/><rect x="8" y="8.5" width="17" height="6" rx="1"/><rect x="24" y="8" width="16" height="6" rx="1"/><rect x="39" y="9.2" width="19" height="2.8"/><rect x="57" y="8.2" width="5" height="4.8" rx="1"/><rect x="13" y="6" width="9" height="2.3" rx="1"/><path d="M16 14.5 L21 14.5 L20.5 21.5 L15.5 21 Z"/><path d="M9 14 L13 14 L14.5 19.5 L10.5 19.5 Z"/>',
    lmg: '<rect x="1" y="9" width="8" height="4.5" rx="1"/><rect x="8" y="7.5" width="20" height="7.5" rx="1"/><rect x="27" y="8.5" width="22" height="5.5" rx="1"/><rect x="48" y="9.3" width="12" height="2.2"/><rect x="30" y="5.5" width="6" height="2.5"/><circle cx="17" cy="17.5" r="6"/><path d="M33 14 L48 14 L47 17.5 L34 16 Z"/>',
    crossbow: '<rect x="2" y="10" width="9" height="3" rx="1"/><rect x="10" y="9" width="34" height="5" rx="1"/><path d="M40 11.5 L47 11.5 L57 4 L59 6.5 L50 13 L59 19.5 L57 22 L47 14.5 L40 14.5 Z"/><rect x="18" y="14" width="5" height="8" rx="1"/><rect x="11" y="7.3" width="38" height="1.6"/>',
    dmr: '<rect x="0.5" y="10.2" width="6" height="2.4" rx="0.8"/><rect x="5" y="8.8" width="26" height="5.2" rx="1"/><rect x="30" y="7.8" width="17" height="7" rx="1"/><rect x="34" y="5.2" width="9" height="2.6" rx="1"/><path d="M34 14.5 L40 14.5 L39.5 21 L34.5 21 Z"/><path d="M43 14.5 L47 14.5 L47.5 19.5 L44 19.5 Z"/><rect x="46" y="9" width="8" height="3.2" rx="1"/><rect x="53" y="7.5" width="9" height="8.5" rx="1.5"/>',
    rpg: '<rect x="6" y="9" width="40" height="6" rx="2"/><path d="M2 7 L8 9 L8 15 L2 17 Z"/><path d="M46 8 L58 12 L46 16 Z"/><rect x="22" y="15" width="5" height="7" rx="1"/><rect x="32" y="15" width="4" height="5" rx="1"/>',
    launcher: '<rect x="2" y="10" width="10" height="4" rx="1"/><rect x="11" y="8.5" width="22" height="6.5" rx="1"/><rect x="30" y="7" width="26" height="8" rx="3"/><rect x="54" y="6" width="6" height="10" rx="1"/><rect x="18" y="14" width="5" height="7" rx="1"/><rect x="27" y="15" width="11" height="3.5" rx="1"/>',
    knife: '<path d="M5 13.5 L33 8.5 L41 11 L41 13.6 L33 15.4 L5 15.4 Z"/><rect x="41" y="8" width="3" height="9" rx="1"/><rect x="44" y="10.3" width="15" height="4.2" rx="2.1"/><circle cx="60.5" cy="12.4" r="2.4"/>',
  };
  const iconSVG = (id) => '<svg viewBox="0 0 64 24" fill="currentColor">' + WEAPON_ICONS[id] + "</svg>";

  // ---- loadout: one gun plus the knife ----
  const GUNS = WEAPON_ORDER.filter((id) => WEAPONS[id].usesAmmo);

  // ---- attachments: each gun has up to three slots; every option is a trade, and unlocks once you have landed `need` hits with that gun ----
  // fx: ads (aim-down-sights time), spread (hip), spreadAds, recoil, mag (size), reload (time), flash, sound (how loud), scopeFov (>1 wider)
  const ATTACH_SLOTS = {
    optic: "Optic", muzzle: "Muzzle", stock: "Stock", grip: "Grip", barrel: "Barrel", mag: "Magazine", sights: "Sights", bipod: "Bipod",
  };
  const SUPPRESSOR = { id: "suppressor", name: "Suppressor", need: 20, fx: { flash: 0.2, sound: 0.45, recoil: 1.05 }, text: "Quieter, almost no flash; a touch more kick" };
  const AT_REDDOT = { id: "reddot", name: "Red dot", need: 10, fx: { ads: 0.85, spreadAds: 0.8 }, text: "Aims down sights 15% faster, tighter when aimed" };
  const AT_BRAKE = { id: "brake", name: "Muzzle brake", need: 55, fx: { recoil: 0.8, sound: 1.2 }, text: "20% less recoil, louder" };
  const AT_SCOPE2 = { id: "optic-2x", name: "2x scope", need: 50, fx: { zoom: 0.7, ads: 1.15 }, text: "A closer view when aimed, a little slower to aim" };
  const AT_SCOPE4 = { id: "optic-4x", name: "4x scope", need: 90, fx: { zoom: 0.45, ads: 1.35 }, text: "A much closer view, slower to aim" };
  const AT_BARRELS = [
    { id: "longbarrel", name: "Long barrel", need: 45, fx: { spread: 0.85, spreadAds: 0.8, ads: 1.1 }, text: "Tighter shots, a touch slower to aim" },
    { id: "heavybarrel", name: "Heavy barrel", need: 70, fx: { recoil: 0.88, ads: 1.1 }, text: "12% less recoil, slower to aim" },
  ];
  const AT_GRIPS = [
    { id: "vgrip", name: "Vertical grip", need: 30, fx: { recoil: 0.85 }, text: "15% less recoil" },
    { id: "agrip", name: "Angled grip", need: 65, fx: { ads: 0.85, spread: 0.92 }, text: "Faster to aim, a little tighter from the hip" },
  ];
  const AT_MAGS = [
    { id: "extmag", name: "Extended magazine", need: 40, fx: { mag: 1.5, reload: 1.15 }, text: "50% more rounds, slower reload" },
    { id: "fastmag", name: "Fast magazine", need: 80, fx: { reload: 0.8 }, text: "Reloads 20% faster" },
  ];
  const AT_BIPOD = [{ id: "bipod", name: "Bipod", need: 35, fx: { bipod: 0.45, ads: 1.08 }, text: "Far steadier while crouched (the slide key), a touch slower to aim" }];
  const ATTACHMENTS = {
    rifle: {   // the sniper
      optic: [{ id: "scope-low", name: "Low-zoom scope", need: 10, fx: { ads: 0.8, scopeFov: 1.4 }, text: "Scopes in 20% faster, a wider view (a quickscope's friend)" },
        { id: "scope-high", name: "High-zoom scope", need: 40, fx: { ads: 1.25, scopeFov: 0.65 }, text: "A much closer view, but slower to scope in" }],
      muzzle: [SUPPRESSOR, AT_BRAKE],
      stock: [{ id: "stock-light", name: "Light stock", need: 30, fx: { ads: 0.9, recoil: 1.08 }, text: "Aims 10% faster, a little more kick" },
        { id: "stock-heavy", name: "Heavy stock", need: 65, fx: { recoil: 0.85, ads: 1.1 }, text: "Steadier, slower to aim" }],
    },
    ar: { optic: [AT_REDDOT, AT_SCOPE2], muzzle: [SUPPRESSOR, { id: "comp", name: "Compensator", need: 55, fx: { recoil: 0.85 }, text: "15% less recoil" }], barrel: AT_BARRELS, grip: AT_GRIPS, mag: AT_MAGS },
    ak: { optic: [AT_REDDOT, AT_SCOPE2], muzzle: [SUPPRESSOR, { id: "comp", name: "Compensator", need: 55, fx: { recoil: 0.85 }, text: "15% less recoil" }], barrel: AT_BARRELS, grip: AT_GRIPS, mag: AT_MAGS },
    smg: { optic: [AT_REDDOT], muzzle: [SUPPRESSOR, { id: "comp", name: "Compensator", need: 55, fx: { recoil: 0.85 }, text: "15% less recoil" }], barrel: AT_BARRELS, grip: AT_GRIPS, mag: AT_MAGS },
    dmr: { optic: [AT_REDDOT, AT_SCOPE2, AT_SCOPE4], muzzle: [SUPPRESSOR, AT_BRAKE], grip: AT_GRIPS, mag: AT_MAGS, bipod: AT_BIPOD },
    burst: { optic: [AT_REDDOT, AT_SCOPE2], muzzle: [SUPPRESSOR, { id: "comp", name: "Compensator", need: 55, fx: { recoil: 0.85 }, text: "15% less recoil" }], barrel: AT_BARRELS, grip: AT_GRIPS, mag: AT_MAGS },
    lmg: { optic: [AT_REDDOT, AT_SCOPE2, AT_SCOPE4], muzzle: [SUPPRESSOR, AT_BRAKE], grip: AT_GRIPS, mag: [{ id: "drum", name: "Big drum", need: 40, fx: { mag: 1.5, reload: 1.15 }, text: "A bigger drum: 150 rounds, slower reload" }], bipod: AT_BIPOD },
    crossbow: { optic: [AT_REDDOT, AT_SCOPE2, AT_SCOPE4] },
    launcher: {
      mag: [{ id: "lbig", name: "Extra grenades", need: 30, fx: { mag: 1.5, reload: 1.15 }, text: "Six grenades, a slower reload" },
        { id: "lquick", name: "Quick loader", need: 60, fx: { reload: 0.7 }, text: "Reloads 30% faster" }],
    },
    rpg: {
      optic: [AT_REDDOT, AT_SCOPE2],
      mag: [{ id: "rquick", name: "Quick loader", need: 30, fx: { reload: 0.7 }, text: "Reloads 30% faster" }],
    },
    shotgun: {
      barrel: [{ id: "choke", name: "Choke", need: 15, fx: { spread: 0.7, spreadAds: 0.7 }, text: "A tighter spread, harder to land from close up" },
        { id: "wide", name: "Wide barrel", need: 40, fx: { spread: 1.25, spreadAds: 1.25 }, text: "A wider spread, forgiving up close" },
        { id: "slug", name: "Slugs", need: 60, fx: { spread: 0.1, spreadAds: 0.1, mag: 0.67 }, text: "Every pellet flies as one: a tight, heavy shot that carries, with 2 fewer shells" }],
      mag: [{ id: "tube", name: "Extended tube", need: 35, fx: { mag: 1.34, reload: 1.1 }, text: "Two more shells, slower to reload" }],
    },
    pistol: {   // the Deagle
      muzzle: [{ id: "comp", name: "Compensator", need: 15, fx: { recoil: 0.8 }, text: "20% less recoil" }, SUPPRESSOR],
      sights: [{ id: "laser", name: "Laser", need: 25, fx: { spread: 0.75, spreadAds: 0.9 }, text: "A tighter spread from the hip" }],
      mag: [{ id: "extmag", name: "Extended magazine", need: 45, fx: { mag: 1.3, reload: 1.1 }, text: "Two more rounds, slower reload" }],
    },
  };
  // what a fitted attachment looks like, built from where each gun's parts really are (see AT_MOUNT)
  const AT_STEEL = new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.7, roughness: 0.45 });
  const AT_RUBBER = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.9 });
  const AT_DOT = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const AT_DOT_HALO = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending });
  const AT_LENS = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  let reticleTexBase = null;
  const AT_RETICLE = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  function reticleTexture() {   // a duplex reticle: thick outer posts narrowing to fine lines, small ticks, a red centre dot
    if (reticleTexBase) return reticleTexBase;
    const n = 128, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    g.strokeStyle = "#08090b"; g.fillStyle = "#08090b";
    g.lineWidth = 1.6; g.lineCap = "butt";
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      g.beginPath(); g.moveTo(64 + dx * 7, 64 + dy * 7); g.lineTo(64 + dx * 40, 64 + dy * 40); g.stroke();   // the fine part
    }
    g.lineWidth = 4.5;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      g.beginPath(); g.moveTo(64 + dx * 40, 64 + dy * 40); g.lineTo(64 + dx * 62, 64 + dy * 62); g.stroke();   // the thick outer post
    }
    g.lineWidth = 1.2;
    for (const k of [14, 22, 30]) for (const s of [-1, 1]) {   // ticks along the cross
      g.beginPath(); g.moveTo(64 + s * k, 61); g.lineTo(64 + s * k, 67); g.stroke();
      g.beginPath(); g.moveTo(61, 64 + s * k); g.lineTo(67, 64 + s * k); g.stroke();
    }
    g.fillStyle = "#ff3b30"; g.beginPath(); g.arc(64, 64, 1.8, 0, 7); g.fill();
    reticleTexBase = new THREE.CanvasTexture(c);
    AT_RETICLE.map = reticleTexBase;
    return reticleTexBase;
  }
  const AT_DOT_RISE = 0.034;   // a red dot's window centre sits this far above the rail it is clamped to
  // per gun (the viewmodel, and AV_MOUNT for the other-player models; forward is -z):
  //   muzzle [z where a muzzle device starts, barrel height, barrel radius, suppressor length]
  //   optic [z, rail top]; under [z, fore-end bottom]; butt [z of the butt's back face, centre height, height, stock length]; tube [z of the tube's end, height, radius]
  //   mag: where a magazine's bottom is, in the magazine's own space (the parts ride along with it through a reload) [height, z, tilt, width, depth]
  const AT_MOUNT = {
    rifle: { muzzle: [-1.035, 0.005, 0.034, 0.34], butt: [0.555, -0.03, 0.15, 0.32] },
    ar: { muzzle: [-0.64, 0.015, 0.015, 0.26], optic: [-0.03, 0.062], under: [-0.3, -0.016], mag: [-0.075, 0, 0, 0.03, 0.065] },
    ak: { muzzle: [-0.545, 0, 0.014, 0.24], optic: [0.04, 0.047], under: [-0.23, -0.032], mag: [-0.158, -0.058, 0.55, 0.028, 0.055] },
    shotgun: { muzzle: [-0.75, 0.022, 0.016, 0.2], tube: [-0.671, -0.018, 0.0145] },
    smg: { muzzle: [-0.4175, 0.012, 0.014, 0.24], optic: [0.0, 0.056], under: [-0.23, -0.02], mag: [-0.085, 0, 0, 0.03, 0.056] },
    dmr: { muzzle: [-0.79, 0.012, 0.0145, 0.3], optic: [0.0, 0.062], under: [-0.36, -0.018], mag: [-0.06, 0, 0, 0.034, 0.075] },
    burst: { muzzle: [-0.66, 0.014, 0.0155, 0.26], optic: [0.0, 0.063], under: [-0.30, -0.014], mag: [-0.075, 0, 0, 0.03, 0.066] },
    lmg: { muzzle: [-0.86, 0.012, 0.0185, 0.3], optic: [0.02, 0.067], under: [-0.40, -0.021] },
    crossbow: { optic: [0.0, 0.047] },
    launcher: { under: [-0.12, -0.043] },
    rpg: { optic: [0.12, 0.05], under: [-0.2, -0.05] },
    pistol: { muzzle: [-0.186, 0.034, 0.016, 0.13], under: [-0.1, -0.024], mag: [-0.06, 0, 0, 0.03, 0.045] },
  };
  const AV_MOUNT = {
    rifle: { muzzle: [-1.0, 0.01, 0.022, 0.32], butt: [0.3, -0.02, 0.1, 0.2] },   // (these models have no separate magazine, so mag is in the gun's space)
    ar: { muzzle: [-0.875, 0.005, 0.013, 0.24], optic: [-0.05, 0.0425], under: [-0.45, -0.0425], mag: [-0.24, -0.2, 0, 0.03, 0.05] },
    ak: { muzzle: [-0.76, 0, 0.018, 0.24], optic: [-0.05, 0.0425], under: [-0.55, -0.035], mag: [-0.253, -0.188, 0.35, 0.03, 0.05] },
    shotgun: { muzzle: [-0.975, 0.02, 0.03, 0.2], tube: [-0.75, -0.03, 0.035] },
    smg: { muzzle: [-0.65, 0.005, 0.013, 0.22], optic: [-0.05, 0.0425], under: [-0.35, -0.0425], mag: [-0.23, -0.1, 0, 0.03, 0.05] },
    dmr: { muzzle: [-1.1, 0.005, 0.014, 0.26], optic: [-0.1, 0.0425], under: [-0.6, -0.0425], mag: [-0.19, -0.15, 0, 0.03, 0.05] },
    burst: { muzzle: [-0.875, 0.005, 0.013, 0.24], optic: [-0.05, 0.0425], under: [-0.45, -0.0425], mag: [-0.24, -0.2, 0, 0.03, 0.05] },
    lmg: { muzzle: [-1.0, 0.005, 0.015, 0.26], optic: [-0.05, 0.05], under: [-0.55, -0.05] },
    crossbow: { optic: [-0.1, 0.0425] },
    launcher: { under: [-0.2, -0.07] },
    rpg: { optic: [0.0, 0.07], under: [-0.2, -0.07] },
    pistol: { muzzle: [-0.28, 0.02, 0.02, 0.13], under: [-0.17, -0.05], mag: [-0.149, 0.018, 0.2, 0.045, 0.06] },
  };
  // a laser's beam: thick and bright by the gun, thinner and fainter further out until it is gone (the materials are shared)
  const AT_BEAM_SEGS = 14, AT_BEAM_LEN = 0.55;
  const AT_BEAM = [];
  for (let i = 0; i <= AT_BEAM_SEGS; i++) { const t = i / AT_BEAM_SEGS; AT_BEAM.push({ r: 0.003 * (1 - t * 0.85), a: 0.9 * Math.pow(1 - t, 1.4) + 0.03 }); }
  const beamMat = (opacity) => new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const AT_BEAM_MATS = AT_BEAM.map((b) => ({ core: beamMat(b.a), glow: beamMat(b.a * 0.22) }));
  function attachParts(ids, M) {
    const g = new THREE.Group();
    const add = (geo, mat, x, y, z, rx) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; g.add(m); return m; };
    const HP = Math.PI / 2;
    let mz = M.muzzle;
    if (mz && ids.includes("longbarrel")) {   // a longer barrel: a sleeve out past the old muzzle, and anything on the muzzle moves out with it
      const ext = mz[3] * 0.4, r = Math.max(mz[2], 0.012);
      add(new THREE.CylinderGeometry(r, r, ext, 12), AT_STEEL, 0, mz[1], mz[0] - ext / 2, HP);
      add(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.016, 12), AT_STEEL, 0, mz[1], mz[0] - ext + 0.008, HP);
      mz = [mz[0] - ext, mz[1], mz[2], mz[3]];
    }
    if (mz && ids.includes("heavybarrel")) {   // a fat sleeve over the barrel, with two bands
      const len = Math.min(0.22, M.muzzle[3] * 0.85), r = Math.max(M.muzzle[2] * 1.3, 0.018), zc = M.muzzle[0] + 0.03 + len / 2;
      add(new THREE.CylinderGeometry(r, r, len, 14), AT_STEEL, 0, mz[1], zc, HP);
      for (const f of [0.2, 0.8]) add(new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.012, 14), AT_RUBBER, 0, mz[1], zc - len / 2 + len * f, HP);
    }
    for (const id of ids) {
      if (id === "suppressor" && mz) {   // a can twice the barrel's width, from the muzzle forward
        const r = Math.max(mz[2] * 1.9, 0.024), len = mz[3];
        add(new THREE.CylinderGeometry(r, r, len, 14), AT_STEEL, 0, mz[1], mz[0] - len / 2, HP);
        add(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.004, 10), AT_RUBBER, 0, mz[1], mz[0] - len - 0.002, HP);
      } else if ((id === "brake" || id === "comp") && mz) {   // a ported block a little wider than the barrel
        const w = mz[2] * 2.5, len = Math.max(mz[2] * 4, 0.06);
        add(new THREE.BoxGeometry(w, w, len), AT_STEEL, 0, mz[1], mz[0] - len / 2);
        for (const side of [-1, 1]) for (let i = 0; i < 2; i++) add(new THREE.BoxGeometry(0.003, w * 0.6, len * 0.16), AT_RUBBER, side * (w / 2 + 0.0005), mz[1], mz[0] - len * (0.3 + i * 0.36));
      } else if (id === "choke" && mz) add(new THREE.CylinderGeometry(mz[2] * 1.15, mz[2] * 1.3, 0.05, 14), AT_STEEL, 0, mz[1], mz[0] - 0.025, HP);
      else if (id === "wide" && mz) add(new THREE.CylinderGeometry(mz[2] * 1.7, mz[2] * 1.2, 0.045, 14), AT_STEEL, 0, mz[1], mz[0] - 0.022, HP);
      else if ((id === "optic-2x" || id === "optic-4x") && M.optic) {   // a scope on a clamp: an open tube, a flared front with glass, an eyepiece ring (the frame you aim through) and a turret
        const [z, t] = M.optic, big = id === "optic-4x", len = big ? 0.17 : 0.11, r = big ? 0.0225 : 0.019, c = t + AT_DOT_RISE;
        add(new THREE.BoxGeometry(0.024, 0.015, 0.05), AT_STEEL, 0, t + 0.0075, z);
        add(new THREE.CylinderGeometry(r, r, len, 14, 1, true), AT_STEEL, 0, c, z, HP);
        add(new THREE.CylinderGeometry(r, r * 1.35, 0.03, 14, 1, true), AT_STEEL, 0, c, z - len / 2 - 0.015, HP);
        add(new THREE.TorusGeometry(r * 1.02, 0.0045, 6, 16), AT_STEEL, 0, c, z + len / 2);
        add(new THREE.CircleGeometry(r * 1.3, 14), AT_LENS, 0, c, z - len / 2 - 0.03);
        reticleTexture();
        add(new THREE.PlaneGeometry(r * 1.85, r * 1.85), AT_RETICLE, 0, c, z + len / 2 - 0.014);   // the reticle you aim with, just inside the eyepiece
        add(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), AT_STEEL, 0, c + r + 0.004, z);
      } else if (id === "reddot" && M.optic) {   // a reflex sight: a clamp and base, a slim frame round the window, a hood with a lip, a glass, a small emitter pod, two knobs, and a pin-prick dot
        const [z, t] = M.optic, c = t + AT_DOT_RISE;
        add(new THREE.BoxGeometry(0.03, 0.008, 0.05), AT_STEEL, 0, t + 0.004, z);                       // rail clamp
        for (const side of [-1, 1]) { const bolt = add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.006, 8), AT_RUBBER, side * 0.0165, t + 0.004, z + 0.012); bolt.rotation.z = HP; }
        add(new THREE.BoxGeometry(0.036, 0.012, 0.052), AT_STEEL, 0, t + 0.014, z);                     // the base the window sits on
        add(new THREE.BoxGeometry(0.03, 0.008, 0.012), AT_STEEL, 0, t + 0.0145, z - 0.03, 0.5);        // its sloped nose
        for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.0045, 0.037, 0.05), AT_STEEL, side * 0.0175, c, z);   // the two sides of the window
        add(new THREE.BoxGeometry(0.039, 0.005, 0.054), AT_RUBBER, 0, c + 0.021, z);                    // the hood over the top
        add(new THREE.BoxGeometry(0.037, 0.003, 0.012), AT_RUBBER, 0, c + 0.021, z - 0.032);            // and its lip out front
        add(new THREE.PlaneGeometry(0.03, 0.034), AT_LENS, 0, c, z - 0.021);                            // the glass
        add(new THREE.BoxGeometry(0.014, 0.008, 0.012), AT_STEEL, 0, c - 0.0125, z - 0.016);            // the emitter pod at the foot of the window
        const knobW = add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.008, 10), AT_RUBBER, 0.0225, c + 0.005, z - 0.004); knobW.rotation.z = HP;   // windage knob
        add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.005, 10), AT_RUBBER, 0, c + 0.0255, z - 0.004);  // elevation knob
        add(new THREE.BoxGeometry(0.0016, 0.0016, 0.001), AT_DOT, 0, c, z - 0.0215);                   // the dot (small: it is a point of light)
        add(new THREE.CircleGeometry(0.0038, 12), AT_DOT_HALO, 0, c, z - 0.0218);                      // and its faint glow
      } else if (id === "vgrip" && M.under) add(new THREE.CylinderGeometry(0.015, 0.017, 0.1, 10), AT_STEEL, 0, M.under[1] - 0.048, M.under[0]);
      else if (id === "agrip" && M.under) add(new THREE.BoxGeometry(0.028, 0.03, 0.085), AT_STEEL, 0, M.under[1] - 0.012, M.under[0] + 0.01, 0.35);
      else if (id === "laser" && M.under) {   // a box under the frame, the red lens facing forward
        add(new THREE.BoxGeometry(0.026, 0.022, 0.06), AT_STEEL, 0, M.under[1] - 0.011, M.under[0]);
        add(new THREE.CylinderGeometry(0.004, 0.004, 0.002, 8), AT_DOT, 0, M.under[1] - 0.011, M.under[0] - 0.031, HP);
        const by = M.under[1] - 0.011, bz = M.under[0] - 0.032, sl = AT_BEAM_LEN / AT_BEAM_SEGS;
        for (let k = 0; k < AT_BEAM_SEGS; k++) {   // the beam, a run of short cones that thin out
          const a = AT_BEAM[k], b = AT_BEAM[k + 1];
          for (const [mat, grow] of [[AT_BEAM_MATS[k].core, 1], [AT_BEAM_MATS[k].glow, 3.5]]) {
            const seg = add(new THREE.CylinderGeometry(a.r * grow, b.r * grow, sl, 8, 1, true), mat, 0, by, bz - (k + 0.5) * sl, HP);
            if (k >= 3) seg.userData.noFit = true;   // the preview frames the gun and the start of the beam, not all of it
          }
        }
      } else if (id === "stock-heavy" && M.butt) add(new THREE.BoxGeometry(0.09, M.butt[2] * 1.05, 0.05), AT_RUBBER, 0, M.butt[1], M.butt[0] + 0.02);
      else if (id === "stock-light" && M.butt) {   // a skeleton frame in place of the wooden stock: top bar, lower strut, upright
        const [zBack, yc, h, len] = M.butt, zb = zBack - 0.03;
        add(new THREE.BoxGeometry(0.035, 0.025, len), AT_STEEL, 0, yc + h / 2 - 0.0125, zb - len / 2);
        add(new THREE.BoxGeometry(0.03, 0.022, len * 0.8), AT_STEEL, 0, yc - h / 2 + 0.011, zb - len * 0.4);
        add(new THREE.BoxGeometry(0.05, h * 0.95, 0.03), AT_STEEL, 0, yc, zb - 0.015);
      }
      else if (id === "bipod" && M.under) {   // a mount block under the fore-end and two legs swung forward and down
        const [z, y] = M.under;
        add(new THREE.BoxGeometry(0.04, 0.02, 0.045), AT_STEEL, 0, y - 0.008, z + 0.03);
        for (const side of [-1, 1]) {
          const leg = add(new THREE.CylinderGeometry(0.0055, 0.004, 0.11, 8), AT_STEEL, side * 0.02, y - 0.05, z - 0.01, 0.9);
          leg.rotation.z = side * -0.12;
        }
      }
      else if (id === "tube" && M.tube) {   // the magazine tube runs on past its old end
        const [z, y, r] = M.tube;
        add(new THREE.CylinderGeometry(r, r, 0.08, 12), AT_STEEL, 0, y, z - 0.04, HP);
        add(new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.02, 12), AT_STEEL, 0, y, z - 0.09, HP);
      }
    }
    return g;
  }
  // extended and fast magazines, built at the magazine's bottom (M.mag), tilted with it
  function magParts(ids, M) {
    if (!M.mag) return null;
    const [y, z, tilt, w, d] = M.mag, g = new THREE.Group();
    g.position.set(0, y, z); g.rotation.x = tilt;
    const add = (geo, mat, py) => { const m = new THREE.Mesh(geo, mat); m.position.y = py; g.add(m); };
    if (ids.includes("extmag")) { add(new THREE.BoxGeometry(w, 0.06, d), AT_STEEL, -0.03); add(new THREE.BoxGeometry(w + 0.006, 0.012, d + 0.008), AT_STEEL, -0.064); }   // the extra length and a base plate
    else if (ids.includes("fastmag")) add(new THREE.BoxGeometry(0.012, 0.026, 0.004), AT_RUBBER, -0.013);   // a pull tab
    else return null;
    return g;
  }
  // ---- gun skins: three recolours per gun on top of the base look, unlocked by hits with that gun (like attachments) ----
  // A skin swaps the materials of a gun's parts by their role (the dark metal, the lighter metal, the grips, the wood, the accent, the steel): a part
  // keeps its shape, only its paint changes. Parts with other materials (glass, brass, blades) are left alone.
  const camoTexture = (colors) => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = colors[0]; g.fillRect(0, 0, 64, 64);
    let seed = colors.join("").length * 7919;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 26; i++) {
      g.fillStyle = colors[1 + Math.floor(rnd() * (colors.length - 1))];
      g.beginPath(); g.ellipse(rnd() * 64, rnd() * 64, 4 + rnd() * 9, 3 + rnd() * 6, rnd() * 3, 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const SKIN_THEMES = {
    desert: { name: "Desert", sw: ["#c2a56a", "#6b5a3a"], roles: {
      dark: { camo: ["#a8895a", "#7a6340", "#5a4a30", "#c4ab7c"], metalness: 0.15, roughness: 0.8 }, mid: { color: 0x6f5f3d, metalness: 0.3, roughness: 0.6 },
      grip: { color: 0x4a3f2a, metalness: 0.05, roughness: 0.9 }, wood: { color: 0x9a7a45, metalness: 0.05, roughness: 0.8 },
      accent: { color: 0xd0a24a, metalness: 0.5, roughness: 0.5 }, steel: { color: 0x8a7a55, metalness: 0.6, roughness: 0.45 } } },
    midnight: { name: "Midnight", sw: ["#1d2b57", "#22d3ee"], roles: {
      dark: { color: 0x1c2a5c, metalness: 0.6, roughness: 0.35 }, mid: { color: 0x2f4a94, metalness: 0.6, roughness: 0.35 },
      grip: { color: 0x0b1020, metalness: 0.1, roughness: 0.8 }, wood: { color: 0x25357a, metalness: 0.1, roughness: 0.6 },
      accent: { color: 0x22d3ee, metalness: 0.4, roughness: 0.4, emissive: 0x0a6f85, emissiveIntensity: 0.8 }, steel: { color: 0x4560b0, metalness: 0.6, roughness: 0.3 } } },
    gold: { name: "Gold", sw: ["#d9b04a", "#7a5a10"], roles: {
      dark: { color: 0xb8892a, metalness: 0.95, roughness: 0.3 }, mid: { color: 0xd9b04a, metalness: 0.95, roughness: 0.25 },
      grip: { color: 0x3b2a14, metalness: 0.1, roughness: 0.8 }, wood: { color: 0x5a3b18, metalness: 0.1, roughness: 0.6 },
      accent: { color: 0xfff0b0, metalness: 0.6, roughness: 0.3, emissive: 0x7a5a10, emissiveIntensity: 0.5 }, steel: { color: 0xe8c860, metalness: 1, roughness: 0.2 } } },
    arctic: { name: "Arctic", sw: ["#e9eef2", "#5fb4e8"], roles: {
      dark: { camo: ["#e9eef2", "#b8c4cc", "#8f9ca6", "#dfe6eb"], metalness: 0.1, roughness: 0.75 }, mid: { color: 0x9aa8b3, metalness: 0.4, roughness: 0.5 },
      grip: { color: 0x5c6670, metalness: 0.05, roughness: 0.9 }, wood: { color: 0xcfd6dc, metalness: 0.05, roughness: 0.7 },
      accent: { color: 0x5fb4e8, metalness: 0.5, roughness: 0.4 }, steel: { color: 0xd6dde3, metalness: 0.8, roughness: 0.3 } } },
    crimson: { name: "Crimson", sw: ["#8a1c22", "#ff5a3a"], roles: {
      dark: { color: 0x5a0f14, metalness: 0.7, roughness: 0.35 }, mid: { color: 0x8a1c22, metalness: 0.6, roughness: 0.4 },
      grip: { color: 0x1a0b0d, metalness: 0.05, roughness: 0.85 }, wood: { color: 0x7a2420, metalness: 0.05, roughness: 0.7 },
      accent: { color: 0xff5a3a, metalness: 0.4, roughness: 0.4, emissive: 0x6a1a0a, emissiveIntensity: 0.6 }, steel: { color: 0xc23a40, metalness: 0.8, roughness: 0.3 } } },
  };
  // each gun's three skins, and the hits with that gun that open them
  const GUN_SKINS = {
    rifle: ["arctic", "midnight", "desert"], ar: ["desert", "midnight", "gold"], ak: ["crimson", "desert", "gold"], shotgun: ["crimson", "midnight", "gold"],
    pistol: ["arctic", "midnight", "gold"], smg: ["arctic", "crimson", "midnight"], dmr: ["desert", "arctic", "gold"], burst: ["midnight", "crimson", "arctic"],
    lmg: ["desert", "crimson", "gold"], crossbow: ["desert", "midnight", "arctic"], launcher: ["crimson", "desert", "gold"], rpg: ["midnight", "arctic", "crimson"],
  };
  const SKIN_NEED = [25, 75, 150];
  const skinMats = new Map();
  function skinMaterial(skinId, role) {
    const key = skinId + "|" + role;
    let m = skinMats.get(key);
    if (!m) {
      const d = SKIN_THEMES[skinId].roles[role];
      const opts = { color: d.camo ? 0xffffff : d.color, metalness: Math.min(d.metalness, 0.6), roughness: Math.max(d.roughness, 0.35), envMapIntensity: 0.6 };   // (a very metallic paint reads black without a bright sky to reflect)
      if (d.camo) opts.map = camoTexture(d.camo);
      if (d.emissive !== undefined) { opts.emissive = d.emissive; opts.emissiveIntensity = d.emissiveIntensity; }
      m = new THREE.MeshStandardMaterial(opts);
      skinMats.set(key, m);
    }
    return m;
  }
  const SKIN_ROLE_OF = new Map([[metalDark, "dark"], [metalMid, "mid"], [gripMat, "grip"], [polymerMat, "grip"], [woodStock, "wood"], [accentMat, "accent"], [stainlessMat, "steel"], [stainlessDark, "steel"]]);
  const skinBase = new WeakMap();   // a part -> its own material and role, from before any skin
  function applyGunSkin(group, skinId) {
    const id = SKIN_THEMES[skinId] ? skinId : "";
    if ((group.userData.skinNow || "") === id) return;
    group.userData.skinNow = id;
    group.traverse((o) => {
      if (!o.isMesh) return;
      let b = skinBase.get(o);
      if (!b) { b = { mat: o.material, role: o.userData.role || SKIN_ROLE_OF.get(o.material) || null }; skinBase.set(o, b); }
      if (b.role) o.material = id ? skinMaterial(id, b.role) : b.mat;
    });
  }
  const skinUnlocked = (gun, i) => devUnlockAll || ((stats.guns[gun] && stats.guns[gun].hits) || 0) >= SKIN_NEED[i];
  function chosenSkin(gun) {   // the skin you picked for a gun, if it is open
    const id = SETTINGS.skin && SETTINGS.skin[gun], list = GUN_SKINS[gun] || [], i = list.indexOf(id);
    return i >= 0 && skinUnlocked(gun, i) ? id : "";
  }
  const attachCode = () => {
    const ids = chosenAttachments(SETTINGS.loadout).map((o) => o.id), sk = chosenSkin(SETTINGS.loadout);
    if (sk) ids.push("skin-" + sk);   // (the skin rides along in the attachment code, so other players see it)
    return ids.length ? SETTINGS.loadout + ":" + ids.join(",") : "";
  };
  const AT_CODE_OK = /^[a-z]{2,8}:[a-z0-9,\-]{1,90}$/;
  function randomAttachCode(gun) {   // a bot's look: a few random attachments (they do not change how a bot shoots)
    if (net.gungame) { const ids = (ggParsePreset(net.ggp)[gun] || []).map((o) => o.id); return ids.length ? gun + ":" + ids.join(",") : ""; }   // (in a gun game, the game's setup)
    const ids = [];
    for (const opts of Object.values(ATTACHMENTS[gun] || {})) if (Math.random() < 0.4) ids.push(opts[Math.floor(Math.random() * opts.length)].id);
    if (GUN_SKINS[gun] && Math.random() < 0.4) ids.push("skin-" + GUN_SKINS[gun][Math.floor(Math.random() * 3)]);
    return ids.length ? gun + ":" + ids.join(",") : "";
  }
  const WEAPON_BASE = {};   // what each gun is without attachments
  for (const id of GUNS) {
    const w = WEAPONS[id];
    WEAPON_BASE[id] = { mag: w.magSize, spread: w.spread, spreadAds: w.spreadAds, recoil: w.recoil, kick: w.kick, flash: w.flashScale, reload: Object.assign({}, w.reload), adsY: w.adsPos.y, muzzleZ: w.muzzle ? w.muzzle.z : 0 };
  }
  const baseMag = (id) => (WEAPON_BASE[id] ? WEAPON_BASE[id].mag : WEAPONS[id].magSize);
  let devUnlockAll = false;   // the dev tools window (the ` key) turns this on: every attachment opens, for testing; otherwise each unlocks by hits landed with its gun
  const attachUnlocked = (gun, opt) => devUnlockAll || ((stats.guns[gun] && stats.guns[gun].hits) || 0) >= opt.need;
  let ggPresetKey = null, ggPresetMap = {};   // the gun game's attachments for each gun (parsed from the host's string, see makeGgPreset)
  function ggParsePreset(str) {
    const out = {};
    for (const part of String(str || "").split(";")) {
      const [gun, list] = part.split(":");
      if (!GUNS.includes(gun)) continue;
      const known = Object.values(ATTACHMENTS[gun] || {}).flat();
      out[gun] = (list || "").split(",").map((id) => known.find((o) => o.id === id)).filter(Boolean);
    }
    return out;
  }
  // each game the host rolls a setup for every gun: a sniper always has a scope, a marksman rifle or crossbow always an optic, the rest get
  // each slot with some chance, one option from the slot. Nothing needs unlocking, and everyone gets the same.
  const GG_SLOT_CHANCE = { bipod: 0.3, optic: 0.7, muzzle: 0.45, barrel: 0.3, grip: 0.5, mag: 0.4, stock: 0.4, sights: 0.5 };
  const GG_MUST_OPTIC = ["rifle", "dmr", "crossbow"];
  function makeGgPreset() {
    const parts = [];
    for (const gun of GUNS) {
      const ids = [];
      for (const [slot, opts] of Object.entries(ATTACHMENTS[gun] || {})) {
        if ((slot === "optic" && GG_MUST_OPTIC.includes(gun)) || Math.random() < (GG_SLOT_CHANCE[slot] || 0.4)) ids.push(opts[Math.floor(Math.random() * opts.length)].id);
      }
      parts.push(gun + ":" + ids.join(","));
    }
    return parts.join(";");
  }
  let ggOn = false;   // true while a gun game is on (set by ggSync and ggRestore: the loadout code runs before the room state exists)
  function chosenAttachments(gun) {   // what is fitted (an option that is still locked, or unknown, is ignored)
    if (ggOn) return ggPresetMap[gun] || [];   // a gun game uses the game's own setup for each gun, not yours
    const out = [], fitted = (SETTINGS.attach && SETTINGS.attach[gun]) || {};
    for (const [slot, opts] of Object.entries(ATTACHMENTS[gun] || {})) {
      const o = opts.find((x) => x.id === fitted[slot]);
      if (o && attachUnlocked(gun, o)) out.push(o);
    }
    return out;
  }
  function applyAttachments() {
    for (const id of GUNS) {
      const w = WEAPONS[id], base = WEAPON_BASE[id], fx = { ads: 1, spread: 1, spreadAds: 1, recoil: 1, mag: 1, reload: 1, flash: 1, sound: 1, scopeFov: 1, zoom: 1, bipod: 1 };
      for (const o of chosenAttachments(id)) for (const k of Object.keys(o.fx)) fx[k] *= o.fx[k];
      w.magSize = Math.max(1, Math.round(base.mag * fx.mag));
      w.spread = base.spread * fx.spread; w.spreadAds = base.spreadAds * fx.spreadAds;
      w.recoil = base.recoil * fx.recoil; w.kick = base.kick * fx.recoil;
      w.flashScale = base.flash * fx.flash;
      for (const k of Object.keys(base.reload)) if (typeof base.reload[k] === "number") w.reload[k] = base.reload[k] * fx.reload;
      applyGunSkin(w.group, chosenSkin(id));
      w.bipodK = fx.bipod;
      w.adsMult = (w.adsBase || 1) * fx.ads; w.scopeFovMult = fx.scopeFov; w.zoomMult = fx.zoom; w.soundMult = fx.sound;
      if (w.ammo > w.magSize) w.ammo = w.magSize;
      if (w.atGroup) { w.group.remove(w.atGroup); w.atGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); w.atGroup = null; }
      const ids = chosenAttachments(id).map((o) => o.id), has = (x) => ids.includes(x), anyOptic = has("reddot") || has("optic-2x") || has("optic-4x");
      if (ids.length && AT_MOUNT[id]) { w.atGroup = attachParts(ids, AT_MOUNT[id]); w.group.add(w.atGroup); }
      if (w.magAt) { w.magAt.parent.remove(w.magAt); w.magAt.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); w.magAt = null; }
      const mp = w.mag && magParts(ids, AT_MOUNT[id]);
      if (mp) { w.magAt = mp; w.mag.add(mp); }
      w.adsPos.y = base.adsY;
      if (w.muzzle) {   // a long barrel puts the muzzle further out
        w.muzzle.z = base.muzzleZ - (has("longbarrel") && AT_MOUNT[id].muzzle ? AT_MOUNT[id].muzzle[3] * 0.4 : 0);
        if (muzzleFlash.parent === w.group) muzzleFlash.position.copy(w.muzzle);
      }
      if (id === "rifle") {   // the sniper: iron sights, unless a scope is fitted
        const scoped = has("scope-low") || has("scope-high");
        w.scope = scoped; rifleScope.visible = scoped; rifleIrons.visible = !scoped;
        scopeLow.visible = has("scope-low"); scopeHigh.visible = has("scope-high");
        rifleBrake.visible = !has("suppressor") && !has("brake");
        rifleStock.visible = !has("stock-light");
        if (scoped) w.adsPos.y = w.scopeAdsY;
      }
      if (AT_MOUNT[id].optic && anyOptic) w.adsPos.y = -(AT_MOUNT[id].optic[1] + AT_DOT_RISE);   // look through the dot
      if (id === "ar") arRear.visible = !anyOptic;
      if (id === "smg") smgRear.visible = !anyOptic;
      if (id === "dmr") dmrRear.visible = !anyOptic;
      if (id === "burst") burstRear.visible = !anyOptic;
      if (id === "lmg") { lmgRear.visible = !anyOptic; lmgMag.scale.setScalar(has("drum") ? 1.22 : 1); }
      if (id === "crossbow") crossbowRear.visible = !anyOptic;
      if (id === "rpg") rpgRear.visible = !anyOptic;
    }
    updateAmmoHud();
  }
  const loadoutWeapons = () => [SETTINGS.loadout, "knife"];
  let hotbarSlots = {};
  const hotbarKey = (action) => (BINDS[action].find(Boolean) ? inputLabel(BINDS[action].find(Boolean), true) : "");
  function buildHotbar() {
    const bar = document.getElementById("hotbar");
    bar.innerHTML = "";
    hotbarSlots = {};
    loadoutWeapons().forEach((id, i) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.innerHTML = '<div class="head"><span class="num">' + esc(i === 0 ? hotbarKey("gun") : hotbarKey("knife")) + '</span><span class="name">' + WEAPONS[id].name +
        '</span></div><div class="icon">' + iconSVG(id) + "</div>";
      bar.appendChild(slot);
      hotbarSlots[id] = slot;
    });
  }
  // swap the gun slot, instantly (this happens from the menu)
  function setLoadout(id) {
    if (!GUNS.includes(id)) return;
    if (ggOn && !ggForcing) return;   // in a gun game the ladder picks your gun
    const prev = SETTINGS.loadout;
    SETTINGS.loadout = id;
    if (vm.current !== id) {   // even from the knife: picking a gun puts it in your hand
      cancelReload(); cancelBoltCycle(); cancelPump();
      vm.switchTimer = 0; vm.pending = null; vm.swapped = true; vm.throwTimer = 0; vm.slashTimer = 0;
      vm.inspectTimer = 0; vm.wantADS = false; vm.adsProgress = 0;
      vm.recoilPitch = vm.recoilYaw = vm.viewRecoilPitch = vm.viewRecoilYaw = 0; vm.burstShots = 0; vm.burstQueue = 0;
      currentWeapon().group.visible = false;
      vm.current = id;
      currentWeapon().group.visible = true;
      fitMuzzleFlash(currentWeapon());
    }
    if (vm.last !== "knife") vm.last = id;
    buildHotbar();
    updateHotbar();
    updateAmmoHud();
    renderLoadout();
    if (prev !== id) saveSettings();
  }
  // the menu shows a few favourites, plus your gun if it is not one of them, and a More button for the rest
  const QUICK_GUNS = ["rifle", "ar", "shotgun"];
  const GUN_CLASSES = [["Snipers and marksman", ["rifle", "dmr"]], ["Rifles", ["ar", "ak", "burst"]], ["SMGs", ["smg"]], ["Machine guns", ["lmg"]], ["Specialty", ["crossbow", "launcher", "rpg"]], ["Shotguns", ["shotgun"]], ["Pistols", ["pistol"]]];
  const loadoutEl = document.getElementById("loadout"), loadoutPopupEl = document.getElementById("loadout-popup"), loadoutGroupsEl = document.getElementById("loadout-groups");
  const gunButton = (id) => {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.gun = id; b.className = "lo-gun" + (id === SETTINGS.loadout ? " active" : "");
    b.innerHTML = iconSVG(id) + WEAPONS[id].name;
    b.addEventListener("click", () => {
      const again = id === SETTINGS.loadout;   // a second click on your gun opens its attachments
      setLoadout(id); setLoadoutPopup(false);
      if (again) setAttachPopup(true);
    });
    return b;
  };
  function renderLoadout() {
    loadoutEl.textContent = "";
    const label = document.createElement("span"); label.className = "lo-label"; label.textContent = "Loadout"; loadoutEl.appendChild(label);
    for (const id of QUICK_GUNS.includes(SETTINGS.loadout) ? QUICK_GUNS : [...QUICK_GUNS, SETTINGS.loadout]) loadoutEl.appendChild(gunButton(id));
    const more = document.createElement("button");
    more.type = "button"; more.id = "loadout-more"; more.className = "lo-more"; more.textContent = "More guns";
    more.addEventListener("click", () => setLoadoutPopup(true));
    loadoutEl.appendChild(more);
    const locked = ggOn;   // (a gun game picks your gun for you)
    for (const b of loadoutEl.querySelectorAll("button")) { b.disabled = locked; b.title = locked ? "The gun game picks your gun" : ""; }
    document.getElementById("attach-open").disabled = locked;
  }
  function setLoadoutPopup(open) {
    if (open) {
      loadoutGroupsEl.textContent = "";
      const groups = GUN_CLASSES.map(([title, ids]) => [title, ids.filter((id) => GUNS.includes(id))]);
      groups.push(["Other", GUNS.filter((id) => !GUN_CLASSES.some(([, ids]) => ids.includes(id)))]);   // a gun nobody filed yet still shows
      for (const [title, ids] of groups) {
        if (!ids.length) continue;
        const sec = document.createElement("div"); sec.className = "lo-group";
        sec.innerHTML = "<h3>" + title + "</h3>";
        const row = document.createElement("div"); row.className = "lo-row";
        for (const id of ids) row.appendChild(gunButton(id));
        sec.appendChild(row); loadoutGroupsEl.appendChild(sec);
      }
    }
    loadoutPopupEl.hidden = !open;
  }
  document.getElementById("loadout-close").addEventListener("click", () => setLoadoutPopup(false));
  loadoutPopupEl.addEventListener("click", (e) => { if (e.target === loadoutPopupEl) setLoadoutPopup(false); });
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !loadoutPopupEl.hidden) setLoadoutPopup(false); });
  renderLoadout();
  loadoutEl.addEventListener("click", (e) => e.stopPropagation());   // the menu backdrop starts the game
  const ammoCountEl = document.getElementById("ammo-count");
  const ammoLabelEl = document.getElementById("ammo-label");

  const sensXEl = document.getElementById("sens-x");
  const sensYEl = document.getElementById("sens-y");
  const sensScopeEl = document.getElementById("sens-scope");
  const accelStrengthEl = document.getElementById("accel-strength");
  const volumeEl = document.getElementById("volume");
  const sensXVal = document.getElementById("sens-x-val");
  const sensYVal = document.getElementById("sens-y-val");
  const sensScopeVal = document.getElementById("sens-scope-val");
  const accelStrengthVal = document.getElementById("accel-strength-val");
  const volumeVal = document.getElementById("volume-val");
  const sensLink = document.getElementById("sens-link");
  const mouseAccelEl = document.getElementById("mouse-accel");
  const unlimitedAmmoEl = document.getElementById("unlimited-ammo");

  // Newer settings bind themselves through a data-setting attribute: the element's type
  // decides how the value is read, and its own min/max or options validate saved values.
  const boundEls = Array.from(document.querySelectorAll("[data-setting]"));
  function readBound(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "range") return parseFloat(el.value);
    return el.value;
  }
  function writeBound(el, v) {
    if (el.type === "checkbox") el.checked = v; else el.value = v;
    const out = el.parentElement.querySelector(".val");
    if (out && el.type === "range") out.textContent = Number.isInteger(+el.step) ? String(v) : (+v).toFixed(2);
  }
  function validBound(el, v) {
    if (el.type === "checkbox") return typeof v === "boolean";
    if (el.type === "range") return typeof v === "number" && Number.isFinite(v) && v >= +el.min && v <= +el.max;
    if (el.type === "color") return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
    return Array.from(el.options || []).some((o) => o.value === v);
  }

  function refreshSettingsUI() {
    sensXVal.textContent = SETTINGS.sensX.toFixed(2);
    sensYVal.textContent = SETTINGS.sensY.toFixed(2);
    sensScopeVal.textContent = SETTINGS.scopedSensMult.toFixed(2);
    accelStrengthVal.textContent = SETTINGS.accelStrength.toFixed(2);
    volumeVal.textContent = SETTINGS.volume.toFixed(2);
    sensXEl.value = SETTINGS.sensX;
    sensYEl.value = SETTINGS.sensY;
    sensScopeEl.value = SETTINGS.scopedSensMult;
    accelStrengthEl.value = SETTINGS.accelStrength;
    volumeEl.value = SETTINGS.volume;
    sensYEl.disabled = sensLink.checked;
    accelStrengthEl.disabled = !SETTINGS.mouseAccel;
    mouseAccelEl.checked = SETTINGS.mouseAccel;
    unlimitedAmmoEl.checked = SETTINGS.unlimitedAmmo;
    for (const el of boundEls) writeBound(el, SETTINGS[el.dataset.setting]);
    applySettings();
    saveSettings();
  }

  // ---- crosshair, drawn as SVG from the settings ----
  function crosshairSVG(s) {
    const L = s.xhSize, T = s.xhThick, G = s.xhGap, st = s.xhStyle, outline = s.xhOutline || s.highContrast;
    const lines = [], dots = [];
    if (st === "cross" || st === "cross-dot" || st === "t") {
      lines.push([-G - L, 0, -G, 0], [G, 0, G + L, 0], [0, G, 0, G + L]);
      if (st !== "t") lines.push([0, -G - L, 0, -G]);
    }
    const ringR = G + L * 0.6 + 2;
    if (st === "circle") dots.push({ r: ringR, ring: true });
    if (st === "cross-dot" || st === "dot" || st === "circle") dots.push({ r: Math.max(T * 0.9, 1), ring: false });
    // square caps on both passes make the outline a 1 px border all round
    const draw = (extra, color) =>
      lines.map(([a, b, c, d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${color}" stroke-width="${T + extra}" stroke-linecap="square"/>`).join("") +
      dots.map((c) => (c.ring
        ? `<circle r="${c.r}" fill="none" stroke="${color}" stroke-width="${T + extra}"/>`
        : `<circle r="${c.r + extra / 2}" fill="${color}"/>`)).join("");
    const half = Math.ceil(Math.max(G + L, st === "circle" ? ringR : 0) + T + 3);
    return `<svg width="${half * 2}" height="${half * 2}" viewBox="${-half} ${-half} ${half * 2} ${half * 2}" opacity="${s.xhAlpha}">` +
      (outline ? draw(2, "#000") : "") + draw(0, "currentColor") + "</svg>";
  }

  const xhPreviewEl = document.getElementById("xh-preview");
  let decalMesh = null;   // the bullet holes (built further down)
  function applySettings() {
    applyTargetPalette();
    TEAM_COLORS[1] = SETTINGS.colorblindTargets ? 0xf5a623 : 0xe5484d;
    TEAM_NAMES[1] = SETTINGS.colorblindTargets ? "Orange" : "Red";
    HILL_CONTESTED.c = SETTINGS.colorblindTargets ? 0xff4fd8 : 0xff4a3d; HILL_CONTESTED.css = SETTINGS.colorblindTargets ? "#ff7be3" : "#ff6a5e";
    document.body.classList.toggle("hc", !!SETTINGS.highContrast);
    applyHudScale();
    if (decalMesh) decalMesh.visible = !!SETTINGS.bulletHoles;
    if (targetsReady) syncTargetCounts();
    if (SETTINGS.quality === "auto") { if (!gfxLevel) applyGraphics("high"); }
    else applyGraphics(SETTINGS.quality);
    const svg = crosshairSVG(SETTINGS);
    crosshairEl.innerHTML = svg;
    crosshairEl.style.color = SETTINGS.xhColor;
    // the same crosshair over sky, grass and wall colours
    xhPreviewEl.innerHTML = `<div style="color:${SETTINGS.xhColor}">${svg}</div>`.repeat(3);
    viewmodelRoot.scale.x = handSign();
    muzzleLight.position.x = 0.3 * handSign();
  }

  // settings survive a reload; storage can be blocked (private windows), so it's optional
  const SETTINGS_KEY = "tsb-settings";
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(Object.assign({ linkY: sensLink.checked, binds: BINDS }, SETTINGS)));
    } catch (e) { /* ignore */ }
  }
  (function loadSettings() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch (e) { /* ignore */ }
    if (!saved || typeof saved !== "object") return;
    // only take values that fit the sliders' own ranges
    const num = (key, el) => {
      const v = Number(saved[key]);
      if (Number.isFinite(v) && v >= parseFloat(el.min) && v <= parseFloat(el.max)) SETTINGS[key] = v;
    };
    num("sensX", sensXEl); num("sensY", sensYEl); num("scopedSensMult", sensScopeEl);
    num("accelStrength", accelStrengthEl); num("volume", volumeEl);
    if (typeof saved.mouseAccel === "boolean") SETTINGS.mouseAccel = saved.mouseAccel;
    if (typeof saved.unlimitedAmmo === "boolean") SETTINGS.unlimitedAmmo = saved.unlimitedAmmo;
    if (typeof saved.linkY === "boolean") sensLink.checked = saved.linkY;
    if (typeof saved.loadout === "string" && GUNS.includes(saved.loadout)) SETTINGS.loadout = saved.loadout;
    if (saved.skin && typeof saved.skin === "object") for (const g of GUNS) if (typeof saved.skin[g] === "string" && (GUN_SKINS[g] || []).includes(saved.skin[g])) SETTINGS.skin[g] = saved.skin[g];
    if (saved.attach && typeof saved.attach === "object") {   // only what the catalogue has
      for (const g of GUNS) {
        let s = saved.attach[g];
        if (!s || typeof s !== "object") continue;
        if ((s.grip === "extmag" || s.grip === "fastmag") && !s.mag) s = Object.assign({}, s, { mag: s.grip, grip: null });   // magazines used to share the grip slot
        for (const slot of Object.keys(ATTACHMENTS[g] || {})) if (typeof s[slot] === "string" && ATTACHMENTS[g][slot].some((o) => o.id === s[slot])) (SETTINGS.attach[g] = SETTINGS.attach[g] || {})[slot] = s[slot];
      }
    }
    if (["free", "sa60"].includes(saved.playMode)) SETTINGS.playMode = saved.playMode;
    if (typeof saved.map === "string" && (MAPS[saved.map] || saved.map === "random")) SETTINGS.map = saved.map;
    if (saved.binds && typeof saved.binds === "object") {
      for (const a of ACTION_IDS) {
        const s = saved.binds[a];
        if (Array.isArray(s)) BINDS[a] = [0, 1].map((i) => (validInput(s[i]) ? s[i] : null));
      }
      // an action added since these were saved starts on its default, unless the player has put that input to other use
      const taken = new Set(ACTION_IDS.filter((a) => Array.isArray(saved.binds[a])).flatMap((a) => BINDS[a]));
      for (const a of ACTION_IDS) if (!Array.isArray(saved.binds[a])) BINDS[a] = BINDS[a].map((b) => (b && taken.has(b) ? null : b));
    }
    for (const el of boundEls) {
      const key = el.dataset.setting;
      if (validBound(el, saved[key])) SETTINGS[key] = saved[key];
    }
  })();

  sensXEl.addEventListener("input", () => {
    SETTINGS.sensX = parseFloat(sensXEl.value);
    if (sensLink.checked) SETTINGS.sensY = SETTINGS.sensX;
    refreshSettingsUI();
  });
  sensYEl.addEventListener("input", () => { SETTINGS.sensY = parseFloat(sensYEl.value); refreshSettingsUI(); });
  sensScopeEl.addEventListener("input", () => { SETTINGS.scopedSensMult = parseFloat(sensScopeEl.value); refreshSettingsUI(); });
  accelStrengthEl.addEventListener("input", () => { SETTINGS.accelStrength = parseFloat(accelStrengthEl.value); refreshSettingsUI(); });
  volumeEl.addEventListener("input", () => {
    SETTINGS.volume = parseFloat(volumeEl.value);
    if (masterGain) masterGain.gain.value = SETTINGS.volume;
    refreshSettingsUI();
  });
  sensLink.addEventListener("change", () => {
    if (sensLink.checked) SETTINGS.sensY = SETTINGS.sensX;
    refreshSettingsUI();
  });
  mouseAccelEl.addEventListener("change", () => { SETTINGS.mouseAccel = mouseAccelEl.checked; refreshSettingsUI(); });
  unlimitedAmmoEl.addEventListener("change", () => {
    SETTINGS.unlimitedAmmo = unlimitedAmmoEl.checked;
    if (SETTINGS.unlimitedAmmo) cancelReload();
    refillAmmo();
    updateAmmoHud();
    saveSettings();
  });
  for (const el of boundEls) {
    el.addEventListener(el.type === "range" || el.type === "color" ? "input" : "change", () => {
      SETTINGS[el.dataset.setting] = readBound(el);
      refreshSettingsUI();
    });
  }

  // ---- import a sensitivity from another game ----
  // Each game turns a fixed number of degrees per mouse count per point of sensitivity. Matching that turn
  // means the same hand movement turns you the same amount here (with mouse acceleration off in both).
  const SENS_GAMES = {
    cs2: { name: "CS2 / CS:GO / Apex / TF2", yaw: 0.022 },
    valorant: { name: "Valorant", yaw: 0.07 },
    overwatch: { name: "Overwatch 2", yaw: 0.0066 },
    cod: { name: "Call of Duty (MW 2019 and later)", yaw: 0.0066 },
  };
  const OUR_YAW = CFG.baseSensitivity * 180 / Math.PI;   // degrees per count at sensitivity 1
  const siGameEl = document.getElementById("si-game"), siSensEl = document.getElementById("si-sens");
  const siDpiEl = document.getElementById("si-dpi"), siResultEl = document.getElementById("si-result");
  for (const [id, g] of Object.entries(SENS_GAMES)) siGameEl.add(new Option(g.name, id));
  function sensImport() {
    const g = SENS_GAMES[siGameEl.value], their = parseFloat(siSensEl.value), dpi = parseFloat(siDpiEl.value);
    if (!g || !(their > 0)) return null;
    const ours = their * g.yaw / OUR_YAW;
    const cm360 = dpi > 0 ? 360 / (their * g.yaw) / dpi * 2.54 : null;
    return { ours, cm360, clamped: Math.min(Math.max(ours, parseFloat(sensXEl.min)), parseFloat(sensXEl.max)) };
  }
  function showSensImport() {
    const r = sensImport();
    if (!r) { siResultEl.textContent = "Pick the game, type your sensitivity there, and press Apply. Turn mouse acceleration off in both games."; return; }
    siResultEl.textContent = "That's " + r.ours.toFixed(2) + " here" + (r.cm360 ? " (" + r.cm360.toFixed(1) + " cm per 360\u00B0 at " + siDpiEl.value + " DPI)" : "") +
      (r.clamped !== r.ours ? ", past this game's range, so it would be set to " + r.clamped.toFixed(2) : "") + ".";
  }
  for (const el of [siGameEl, siSensEl, siDpiEl]) el.addEventListener("input", showSensImport);
  document.getElementById("si-apply").addEventListener("click", () => {
    const r = sensImport();
    if (!r) { showSensImport(); return; }
    SETTINGS.sensX = SETTINGS.sensY = Math.round(r.clamped * 1000) / 1000;
    sensLink.checked = true;
    SETTINGS.mouseAccel = false;
    refreshSettingsUI();
    siResultEl.textContent = "Set to " + SETTINGS.sensX.toFixed(2) + " (X and Y), mouse acceleration off." + (r.cm360 ? " " + r.cm360.toFixed(1) + " cm per 360\u00B0." : "");
  });
  showSensImport();

  // ready-made crosshairs: each one sets every crosshair setting, and they can still be fine-tuned
  const XH_PRESETS = {
    "Classic": { xhStyle: "cross", xhColor: "#eeeeee", xhSize: 9, xhThick: 2, xhGap: 0, xhAlpha: 1, xhOutline: false },
    "Gap cross": { xhStyle: "cross", xhColor: "#7cfc00", xhSize: 7, xhThick: 2, xhGap: 4, xhAlpha: 1, xhOutline: true },
    "Tiny": { xhStyle: "cross", xhColor: "#eeeeee", xhSize: 4, xhThick: 1.5, xhGap: 2, xhAlpha: 0.9, xhOutline: true },
    "Big cross": { xhStyle: "cross", xhColor: "#22d3ee", xhSize: 16, xhThick: 2, xhGap: 3, xhAlpha: 1, xhOutline: false },
    "Dot": { xhStyle: "dot", xhColor: "#ffffff", xhSize: 9, xhThick: 4, xhGap: 0, xhAlpha: 1, xhOutline: true },
    "Ring": { xhStyle: "circle", xhColor: "#ffd24a", xhSize: 10, xhThick: 1.5, xhGap: 0, xhAlpha: 1, xhOutline: true },
    "T": { xhStyle: "t", xhColor: "#ff4fd8", xhSize: 8, xhThick: 2, xhGap: 2, xhAlpha: 1, xhOutline: false },
  };
  const xhPresetsEl = document.getElementById("xh-presets");
  for (const [name, vals] of Object.entries(XH_PRESETS)) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn small"; b.textContent = name;
    b.addEventListener("click", () => { Object.assign(SETTINGS, vals); refreshSettingsUI(); });
    xhPresetsEl.appendChild(b);
  }

  // quick colour picks next to the colour input
  const swatchesEl = document.getElementById("xh-swatches");
  for (const c of ["#eeeeee", "#7cfc00", "#22d3ee", "#ffd24a", "#ff4fd8", "#ff3b3b"]) {
    const b = document.createElement("button");
    b.type = "button"; b.style.background = c; b.title = c;
    b.addEventListener("click", () => { SETTINGS.xhColor = c; refreshSettingsUI(); });
    swatchesEl.appendChild(b);
  }

  // tabs
  const settingsTabs = settingsPanel.querySelectorAll(".stab");
  settingsTabs.forEach((tab) => tab.addEventListener("click", () => {
    settingsTabs.forEach((t) => t.classList.toggle("active", t === tab));
    settingsPanel.querySelectorAll(".spanel").forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    document.getElementById("settings-reset").hidden = tab.dataset.tab === "controls";   // that tab has its own reset
    stopListening();
  }));

  document.getElementById("settings-reset").addEventListener("click", () => {
    Object.assign(SETTINGS, DEFAULT_SETTINGS);
    sensLink.checked = true;
    if (masterGain) masterGain.gain.value = SETTINGS.volume;
    cancelReload();
    refillAmmo();
    setLoadout(SETTINGS.loadout);
    refreshSettingsUI();
    loadMap(resolveMapChoice(SETTINGS.map));
    refreshMapUI();
  });

  settingsPanel.addEventListener("click", (e) => e.stopPropagation());
  refreshSettingsUI();

  // ======================================================================
  // INPUT
  // ======================================================================
  const keys = {};
  let pointerLocked = false;
  let mouseHeld = false, attackPressed = false;
  let jumpQueued = false, jumpQueueTimer = 0;

  // raw mouse input where the browser offers it, so the OS's pointer acceleration doesn't bend your aim
  // (other shooters read the mouse raw too, which is what makes an imported sensitivity match)
  function lockPointer() {
    try {
      const p = domEl.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { const q = domEl.requestPointerLock(); if (q && q.catch) q.catch(() => {}); });
    } catch (e) {
      domEl.requestPointerLock();
    }
  }

  // after a replay from the middle of a game was closed with Esc (the browser won't let Esc grab the mouse
  // back): one click carries on, Esc again goes to the menu
  const resumeEl = document.getElementById("resume");
  resumeEl.addEventListener("click", (e) => { e.stopPropagation(); requestPlay(); });
  window.addEventListener("keydown", (e) => {
    if (resumeEl.hidden) return;
    if (e.code === "Escape") showScreen("menu");
    else requestPlay();   // move, jump, anything: straight back in
  });

  function requestPlay() {
    if (uiMode === "mp" && !net.active) return;   // nothing to play until you're in a room
    if (!resultsEl.hidden) return;                  // the results screen has its own buttons
    initAudio();
    if (FIRST_VISIT && !tutOffered && uiMode === "solo" && !tut.active) { tutOffered = true; startTutorial(); return; }   // first time: the tutorial comes first
    if (uiMode === "solo" && isRunMode() && !runInProgress() && !tut.active) startRun();
    goFullscreen();
    lockPointer();
  }
  // Fullscreen with the keyboard locked (Chrome / Edge): keys like W, T and N stop reaching the browser, so Ctrl+W
  // (slide + forward) can't close the tab. Esc still leaves the game, and a second Esc leaves fullscreen.
  function goFullscreen() {
    if (!SETTINGS.fullscreen || window.__noFullscreen || document.fullscreenElement || !document.fullscreenEnabled) return;
    try {
      const p = document.documentElement.requestFullscreen({ navigationUI: "hide" });
      if (p && p.then) p.then(lockKeys, () => {});
    } catch (e) { /* not allowed here */ }
  }
  function lockKeys() {
    try {
      if (!navigator.keyboard || !navigator.keyboard.lock) return;
      const codes = new Set(["KeyW", "KeyT", "KeyN"]);
      for (const a of ACTION_IDS) for (const b of BINDS[a]) if (b && !isMouseInput(b) && b !== "Escape") codes.add(b);
      navigator.keyboard.lock([...codes]).catch(() => {});
    } catch (e) { /* not supported */ }
  }
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) { try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (e) { /* ignore */ } }
  });
  startBtn.addEventListener("click", requestPlay);
  blocker.addEventListener("click", requestPlay);

  // What's on screen, decided in one place. "play": the game (mouse captured); "menu"; "results" (Score
  // Attack's, over the menu); "replay" (the game view with the replay bar, mouse free for its buttons);
  // "resume" (the game view with "click to keep playing", after a replay closed by Esc).
  function showScreen(name) {
    blocker.style.display = name === "menu" || name === "results" ? "flex" : "none";
    hud.style.display = name === "play" || name === "replay" || name === "resume" ? "block" : "none";
    hud.classList.toggle("replaying", name === "replay");
    resumeEl.hidden = name !== "resume";
    replayEl.hidden = name !== "replay";
    if (name === "menu" || name === "results") { refreshModeUI(); refreshReplayButtons(); }
  }
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === domEl;
    if (pointerLocked) { hasPlayed = true; setSettingsPopup(false); showMapTip(); }
    if (!pointerLocked) { mouseHeld = false; attackPressed = false; vm.wantADS = false; saveStats(); refreshTutorialUI(); }
    if (replay.active) return;   // a replay frees the mouse on purpose and runs its own screens
    showScreen(pointerLocked ? "play" : resultsEl.hidden ? "menu" : "results");
    mpRefreshScoreboard();
  });

  document.addEventListener("mousemove", (e) => {
    if (!pointerLocked || replay.active) return;
    let dx = e.movementX, dy = e.movementY;
    const M = CFG.maxMouseDelta;
    if (dx > M) dx = M; else if (dx < -M) dx = -M;
    if (dy > M) dy = M; else if (dy < -M) dy = -M;

    // optional mouse acceleration: slow flicks turn slower than base,
    // fast flicks turn faster, with a smooth curve through the middle
    let accelMult = 1;
    if (SETTINGS.mouseAccel) {
      const mag = Math.hypot(dx, dy);
      const t = 1 - Math.exp(-mag / CFG.accelThreshold);
      const slow = 1 - 0.45 * SETTINGS.accelStrength;
      const fast = 1 + 1.2 * SETTINGS.accelStrength;
      accelMult = slow + (fast - slow) * t;
    }

    const cw = currentWeapon();
    const adsSens = cw.scope ? SETTINGS.scopedSensMult : (cw.adsZoom || 1);
    const scopeMult = 1 + (adsSens - 1) * easeInOut(vm.adsProgress);
    const s = CFG.baseSensitivity * scopeMult * accelMult;
    yawObject.rotation.y -= dx * s * SETTINGS.sensX;
    if (tut.active) tut.look += Math.abs(dx * s * SETTINGS.sensX);
    pitchObject.rotation.x -= dy * s * SETTINGS.sensY;
    pitchObject.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitchObject.rotation.x));
  });

  function padReleaseAll() {
    for (const [action] of PAD_ACTIONS) if (pad.held[action]) { pad.held[action] = false; if (onRelease[action]) onRelease[action](); }
    pad.start = false;
  }
  function pollGamepad(dt) {
    if (!SETTINGS.padOn || !navigator.getGamepads) { padReleaseAll(); return; }
    const gp = [...navigator.getGamepads()].find(Boolean);
    if (!gp || !pointerLocked || replay.active) { padReleaseAll(); return; }
    for (const [action, test] of PAD_ACTIONS) {
      const now = !!test(gp), was = !!pad.held[action];
      pad.held[action] = now;
      if (now && !was && onPress[action]) onPress[action]();
      if (!now && was && onRelease[action]) onRelease[action]();
    }
    const start = padBtn(gp, 9);
    if (start && !pad.start) document.exitPointerLock();   // Start opens the menu
    pad.start = start;
    // the right stick looks: a dead zone, then a curve so small nudges are fine and a full push is a fast turn
    const dz = 0.14, shape = (v) => { const a = Math.abs(v || 0); return a < dz ? 0 : Math.sign(v) * Math.pow((a - dz) / (1 - dz), 2); };
    const rx = shape(gp.axes[2]), ry = shape(gp.axes[3]);
    if (!rx && !ry) return;
    const cw = currentWeapon(), adsSens = cw.scope ? SETTINGS.scopedSensMult : (cw.adsZoom || 1);
    const rate = 3.2 * SETTINGS.padLook * (1 + (adsSens - 1) * easeInOut(vm.adsProgress));   // radians a second at a full push
    yawObject.rotation.y -= rx * rate * dt * SETTINGS.sensX;
    if (tut.active) tut.look += Math.abs(rx * rate * dt * SETTINGS.sensX);
    pitchObject.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitchObject.rotation.x - ry * rate * dt * SETTINGS.sensY));
  }

  // what's held right now, by binding (a wheel notch counts as a tap held for a moment)
  const inputHeld = (b) => (b === "Wheel" ? !!(keys.WheelUp || keys.WheelDown) : !!keys[b]);
  // ---- gamepad: the controller's buttons and sticks act as the same actions as the keys (a fixed layout; click the game once to start, as a
  // browser will not start the mouse capture from a controller) ----
  const pad = { held: {}, start: false };
  const padBtn = (g, i) => { const b = g.buttons[i]; return !!b && (b.pressed || b.value > 0.4); };
  const PAD_ACTIONS = [
    ["forward", (g) => (g.axes[1] || 0) < -0.35], ["back", (g) => (g.axes[1] || 0) > 0.35], ["left", (g) => (g.axes[0] || 0) < -0.35], ["right", (g) => (g.axes[0] || 0) > 0.35],
    ["jump", (g) => padBtn(g, 0)], ["slide", (g) => padBtn(g, 1)], ["reload", (g) => padBtn(g, 2)], ["swap", (g) => padBtn(g, 3)],
    ["grapple", (g) => padBtn(g, 4)], ["knife", (g) => padBtn(g, 5)], ["aim", (g) => padBtn(g, 6)], ["fire", (g) => padBtn(g, 7)],
    ["sprint", (g) => padBtn(g, 10)], ["inspect", (g) => padBtn(g, 12)], ["leaderboard", (g) => padBtn(g, 8)], ["map", (g) => padBtn(g, 14)], ["grenade", (g) => padBtn(g, 11)], ["satchel", (g) => padBtn(g, 13)],
  ];
  const held = (action) => BINDS[action].some((b) => b && inputHeld(b)) || !!pad.held[action];
  // Ctrl+D (bookmark), Ctrl+S and friends would fire mid-game while Ctrl is a game key, so they're blocked then
  const usesCtrl = () => ACTION_IDS.some((a) => BINDS[a].includes("ControlLeft"));

  // what each action does when its input goes down, and (for the ones that are held) comes up
  const onPress = {
    jump() { jumpQueued = true; jumpQueueTimer = 0.12; },
    reload() { startReload(); },
    inspect() { startInspect(); },
    grenade() { startFragCharge(); },
    satchel() { useSatchel(); },
    gun() { if (ggKnife()) return; switchWeapon(SETTINGS.loadout); },
    knife() { switchWeapon("knife"); },
    swap(e, wheel) { if (ggKnife()) return; switchWeapon((wheel ? vm.pending || vm.current : vm.current) === "knife" ? SETTINGS.loadout : "knife"); },
    fire() { mouseHeld = true; attackPressed = true; },
    aim() {
      if (currentWeapon().isMelee) { throwKnife(); return; }
      if (currentWeapon().canADS && !vm.wantADS) { playScopeSound(true); vm.adsStartTime = elapsedTime; }
      vm.wantADS = true;
    },
    replay(e) {
      if (!(lastClip || rec.pending.length) || net.active) return;
      finishAllClips();   // a hit from a moment ago may still be waiting for its "after" part
      if (lastClip) {
        const back = bindLabel("replay", false, true);
        startReplay(lastClip, "Last hit \u00B7 " + lastClip.meta.points + " points" + (back === "unbound" ? "" : "  (" + back + " to keep playing)"), "game");
        if (e) e.stopImmediatePropagation();   // the replay bar's own key handler must not see this same press
      }
    },
  };
  const onRelease = {
    grenade() { releaseFrag(); },
    fire() { mouseHeld = false; },
    aim() {
      if (vm.wantADS && currentWeapon().canADS) playScopeSound(false);
      vm.wantADS = false;
    },
  };
  function pressInput(id, e, wheel) { for (const a of actionsFor(id)) if (onPress[a]) onPress[a](e, wheel); }
  function releaseInput(id) { for (const a of actionsFor(id)) if (onRelease[a]) onRelease[a](); }

  window.addEventListener("keydown", (e) => {
    const id = normalizeInput(e.code);
    if (pointerLocked && (actionsFor(id).length || ((e.ctrlKey || e.metaKey) && usesCtrl()))) e.preventDefault();
    if (keys[id]) return;
    keys[id] = true;
    if ((id === "Tab" || actionsFor(id).includes("leaderboard")) && pointerLocked) { e.preventDefault(); mpRefreshScoreboard(); }
    if (!pointerLocked || replay.active) return;
    pressInput(id, e);
  });
  window.addEventListener("keyup", (e) => {
    const id = normalizeInput(e.code);
    keys[id] = false;
    if (id === "Tab" || actionsFor(id).includes("leaderboard")) mpRefreshScoreboard();
    releaseInput(id);
  });
  window.addEventListener("blur", () => {   // a key let go while the window wasn't looking would stay "held"
    for (const k in keys) keys[k] = false;
    mouseHeld = false;
  });

  const sideButton = (b) => b === 1 || b >= 3;   // middle / back / forward: keep the browser from scrolling or navigating
  domEl.addEventListener("mousedown", (e) => {
    if (!pointerLocked || replay.active) return;
    const id = "Mouse" + e.button;
    if (sideButton(e.button)) e.preventDefault();
    keys[id] = true;
    pressInput(id, e);
  });
  window.addEventListener("mouseup", (e) => {
    const id = "Mouse" + e.button;
    if (pointerLocked && sideButton(e.button)) e.preventDefault();
    keys[id] = false;
    releaseInput(id);
  });
  domEl.addEventListener("contextmenu", (e) => e.preventDefault());
  const wheelTimers = {};
  domEl.addEventListener("wheel", (e) => {
    if (!pointerLocked) return;
    e.preventDefault();
    if (!e.deltaY) return;
    const id = e.deltaY < 0 ? "WheelUp" : "WheelDown";
    keys[id] = true;
    clearTimeout(wheelTimers[id]);
    wheelTimers[id] = setTimeout(() => { keys[id] = false; }, 110);
    pressInput(id, null, true);
  }, { passive: false });

  // ---- Settings > Controls: shows the bindings and changes them ----
  const controlsListeners = [];   // other parts of the game that show key names refresh through this
  const controlsHintEl = document.getElementById("controls-hint");
  const bindListEl = document.getElementById("bind-list"), bindNoteEl = document.getElementById("bind-note");
  const autoSprintKeyEl = document.getElementById("as-key");
  let listening = null;      // { action, slot } while a box waits for an input
  let bindGuardUntil = 0;    // just after a mouse button was bound (Date.now() time), the rest of that click is swallowed

  for (const [id, name] of ACTIONS) {
    const row = document.createElement("div");
    row.className = "bind-row";
    row.innerHTML = '<span class="bind-name">' + esc(name) + "</span>" +
      [0, 1].map((i) => '<button type="button" class="bind-slot" data-action="' + id + '" data-slot="' + i + '"></button>').join("");
    bindListEl.appendChild(row);
  }
  const bindSlots = Array.from(bindListEl.querySelectorAll(".bind-slot"));

  function refreshControlsUI() {
    for (const el of bindSlots) {
      const a = el.dataset.action, i = +el.dataset.slot, b = BINDS[a][i];
      const waiting = !!listening && listening.action === a && listening.slot === i;
      el.textContent = waiting ? "Press a key…" : inputLabel(b);
      el.classList.toggle("listening", waiting);
      el.classList.toggle("empty", !b && !waiting);
    }
    // the menu's one-line summary of the controls
    const k = (s) => '<span class="key">' + esc(s) + "</span>";
    const L = (a) => bindLabel(a);
    const move = ["forward", "left", "back", "right"].map((a) => inputLabel(BINDS[a][0]));
    const gunKnife = Array.from(new Set([].concat(BINDS.gun, BINDS.knife, BINDS.swap).filter(Boolean))).map((b) => inputLabel(b)).join(" / ") || "unbound";
    const dot = " &nbsp;•&nbsp; ";
    controlsHintEl.innerHTML =
      k(move.every((l) => l.length === 1) ? move.join("") : move.join(" ")) + " move" + dot + k(L("jump")) + " jump" + dot +
      k(L("sprint")) + " sprint" + dot + k(L("slide")) + " slide" + dot + k(L("reload")) + " reload" + dot +
      k(L("inspect")) + " inspect" + dot + k(L("grapple")) + " grapple" + dot + k(L("replay")) + " replay last hit<br>" +
      k(L("fire")) + " attack" + dot + k(L("aim")) + " aim / throw knife" + dot + k(L("grenade")) + " grenade" + dot + k(L("satchel")) + " blast pack" + dot + k(gunKnife) + " gun / knife";
    loadoutWeapons().forEach((w, i) => {
      const el = hotbarSlots[w] && hotbarSlots[w].querySelector(".num");
      if (el) el.textContent = hotbarKey(i === 0 ? "gun" : "knife");
    });
    autoSprintKeyEl.textContent = inputLabel(BINDS.sprint.find(Boolean) || null);
    for (const fn of controlsListeners) fn();
  }

  function startListening(action, slot) {
    listening = { action, slot };
    bindNoteEl.textContent = "Press a key or a mouse button, or scroll the wheel. Esc cancels, Backspace clears the box.";
    refreshControlsUI();
  }
  function stopListening(note) {
    if (!listening) return;
    listening = null;
    bindNoteEl.textContent = note || "";
    refreshControlsUI();
  }
  // give the waiting box an input (null clears it); an input lives on one action only, so it's taken from any other
  function assignInput(id) {
    const { action, slot } = listening;
    let note = "", stolen = null;
    if (id) {
      for (const a of ACTION_IDS) {
        BINDS[a] = BINDS[a].map((b, i) => {
          if (a === action && i === slot) return b;
          if (b === id) { if (a !== action) { stolen = a; note = inputLabel(id) + " moves here from " + ACTION_NAMES[a] + "."; } return null; }
          if (b === "Wheel" && (id === "WheelUp" || id === "WheelDown")) return id === "WheelUp" ? "WheelDown" : "WheelUp";   // the wheel's other direction stays where it was
          return b;
        });
      }
      if (stolen && !BINDS[stolen].some(Boolean)) note += " " + ACTION_NAMES[stolen] + " has no input now.";
    }
    BINDS[action][slot] = id;
    listening = null;
    bindNoteEl.textContent = note;
    refreshControlsUI();
    saveSettings();
  }

  bindListEl.addEventListener("click", (e) => {
    const el = e.target.closest(".bind-slot");
    if (!el) return;
    el.blur();
    const a = el.dataset.action, i = +el.dataset.slot;
    if (listening && listening.action === a && listening.slot === i) stopListening(); else startListening(a, i);
  });
  document.getElementById("bind-reset").addEventListener("click", () => {
    listening = null;
    Object.assign(BINDS, defaultBinds());
    bindNoteEl.textContent = "Controls reset to the defaults.";
    refreshControlsUI();
    saveSettings();
  });

  // while a box is waiting, these run first and keep the input from reaching the game or the browser
  window.addEventListener("keydown", (e) => {
    if (!listening) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code === "Escape") { stopListening(); return; }
    if (e.code === "Backspace" || e.code === "Delete") { assignInput(null); return; }
    const id = normalizeInput(e.code);
    if (!validInput(id)) { bindNoteEl.textContent = inputLabel(id) + " can't be used here. Try another."; return; }
    assignInput(id);
  }, true);
  window.addEventListener("mousedown", (e) => {
    if (!listening) return;
    const inSettings = !!e.target.closest && !!e.target.closest("#settings");
    const onControls = !!e.target.closest && !!e.target.closest(".bind-slot, #bind-reset");
    if (e.button === 0 && (onControls || !inSettings)) { if (!inSettings) stopListening(); return; }   // using the boxes, or clicking away
    e.preventDefault(); e.stopImmediatePropagation();
    bindGuardUntil = Date.now() + 400;
    assignInput("Mouse" + e.button);
  }, true);
  for (const type of ["click", "auxclick", "contextmenu", "mouseup"]) {
    window.addEventListener(type, (e) => {
      if (Date.now() >= bindGuardUntil) return;
      if (type === "mouseup" && !sideButton(e.button)) return;
      e.preventDefault();
      if (type === "click") e.stopPropagation();
    }, true);
  }
  window.addEventListener("wheel", (e) => {
    if (!listening || !e.deltaY) return;
    e.preventDefault(); e.stopImmediatePropagation();
    assignInput(e.deltaY < 0 ? "WheelUp" : "WheelDown");
  }, { capture: true, passive: false });
  refreshControlsUI();

  // ======================================================================
  // AMMO / RELOAD
  // ======================================================================
  const reload = { active: false, timer: 0, elapsed: 0, cues: [], shells: false };
  let autoReloadTimer = 0;

  function updateAmmoHud() {
    const w = currentWeapon();
    if (!w.usesAmmo) {
      ammoCountEl.innerHTML = '<span class="max">MELEE</span>';
      ammoLabelEl.textContent = "NO AMMO";
      ammoLabelEl.classList.remove("reloading");
      ammoCountEl.classList.remove("low");
      return;
    }
    if (SETTINGS.unlimitedAmmo) {
      ammoCountEl.innerHTML = "\u221E";
      ammoLabelEl.textContent = "UNLIMITED";
      ammoLabelEl.classList.remove("reloading");
      ammoCountEl.classList.remove("low");
      return;
    }
    ammoCountEl.innerHTML = w.ammo + '<span class="max"> / ' + w.magSize + "</span>";
    ammoCountEl.classList.toggle("low", w.ammo <= Math.max(1, Math.floor(w.magSize / 6)));
    ammoLabelEl.textContent = reload.active ? "RELOADING" : (w.ammo === 1 ? "LAST ROUND" : w.ammoLabel);
    ammoLabelEl.classList.toggle("reloading", reload.active);
  }

  const RELOAD_BOLT_AT = WEAPONS.rifle.reload.time - BOLT.len - 0.02;
  const RELOAD_REST = { x: 0, y: 0, rx: 0, ry: 0, rz: 0 };
  const _rlPose = { x: 0, y: 0, rx: 0, ry: 0, rz: 0 };
  const _rlKeys = [0, 0, 0, 0, 0];

  // magazine reloads: the gun follows its keyframes while the mag slides out, drops
  // away, and a fresh one rises in and seats with a jolt
  function reloadPose(w, t) {
    const R = w.reload;
    sampleKeys(R.keys, t, _rlKeys);
    _rlPose.x = _rlKeys[0]; _rlPose.y = _rlKeys[1]; _rlPose.rx = _rlKeys[2]; _rlPose.ry = _rlKeys[3]; _rlPose.rz = _rlKeys[4];
    let magY = w.magRestY, magShown = true;
    const seatGap = R.travel * 0.12;
    if (t >= R.magOut && t < R.magDrop) {
      const x = (t - R.magOut) / (R.magDrop - R.magOut);
      magY = w.magRestY - R.travel * x * x;
    } else if (t >= R.magDrop && t < R.magUp) {
      magShown = false;
      if (!reload.magDropped) { reload.magDropped = true; if (!w.projectile) dropMagazine(w); }   // (a crossbow has no spent magazine to drop)
    } else if (t >= R.magUp && t < R.magSeat) {
      const x = (t - R.magUp) / (R.magSeat - R.magUp);
      magY = w.magRestY - R.rise * (1 - easeOut(Math.min(x / 0.85, 1))) - seatGap * (x < 0.85 ? 1 : 1 - (x - 0.85) / 0.15);
    }
    if (w.projectile && w.ammo <= 0 && t < R.magUp) magShown = false;   // the bolt is gone until the next one rises in
    w.mag.position.y = magY;
    w.mag.visible = magShown;
    if (t >= R.magSeat) {
      const j = Math.exp(-(t - R.magSeat) * 18);
      _rlPose.rx -= 0.05 * j;
      _rlPose.y += 0.01 * j;
    }
    return _rlPose;
  }

  // shotgun: tip it toward you and feed shells one at a time, with a push on each
  function shellReloadPose(t) {
    const R = WEAPONS.shotgun.reload;
    const inK = easeInOut(Math.min(t / 0.25, 1));
    const outK = reload.endAt !== undefined ? easeInOut(Math.min(Math.max((t - reload.endAt + R.end) / R.end, 0), 1)) : 0;
    const k = inK * (1 - outK);
    const push = reload.lastShellAt >= 0 ? Math.exp(-(t - reload.lastShellAt) * 16) : 0;
    _rlPose.x = -0.05 * k; _rlPose.y = (0.05 - 0.02 * push) * k; _rlPose.rx = (0.18 + 0.04 * push) * k; _rlPose.ry = 0.10 * k; _rlPose.rz = -0.55 * k;
    return _rlPose;
  }

  function cancelReload() {
    if (!reload.active) return;
    reload.active = false; reload.timer = 0;
    reload.cues.length = 0;
    stopBoltSound();
    boltMesh.position.z = 0.20;
    boltMesh.rotation.z = 0;
    for (const id of WEAPON_ORDER) {
      const g = WEAPONS[id];
      if (g.mag) { g.mag.position.y = g.magRestY; g.mag.visible = true; }
    }
    updateAmmoHud();
  }

  function startReload() {
    const w = currentWeapon();
    if (!w.usesAmmo || SETTINGS.unlimitedAmmo) return;
    if (reload.active || w.ammo >= w.magSize || vm.switchTimer > 0 || vm.grappleOut > 0.25) return;
    reload.active = true;
    reload.weapon = w.id;
    reload.elapsed = 0;
    reload.magDropped = false;
    vm.inspectTimer = 0;
    vm.wantADS = false;
    cancelBoltCycle();
    cancelPump();
    if (w.reload.style === "shells") {
      reload.shells = true;
      reload.timer = Infinity;
      reload.nextShell = w.reload.start;
      reload.lastShellAt = -1;
      reload.endAt = undefined;
      reload.needsPump = w.ammo === 0;   // empty chamber: pump once the tube is loaded
      reload.cues = [];
    } else {
      reload.shells = false;
      reload.timer = w.reload.time;
      reload.cues = [[w.reload.magOut, playMagOut], [w.reload.magSeat, playMagIn]];
      if (w.action === "bolt") {
        // the same recorded bolt as between shots, timed to finish as the reload does
        reload.cues.push([RELOAD_BOLT_AT, playBoltCycleSound], [RELOAD_BOLT_AT + BOLT.back[1], ejectSpentCasing]);
      }
      if (w.reload.charge) reload.cues.push([w.reload.charge, () => playActionClack("back", 1.5)], [w.reload.charge + 0.12, () => playActionClack("forward", 1.5)]);
      if (w.reload.slideRelease) reload.cues.push([w.reload.slideRelease, () => playActionClack("forward", 1.6)]);
      reload.cues.sort((a, b) => a[0] - b[0]);
    }
    updateAmmoHud();
  }

  function updateReload(dt) {
    if (!reload.active) return;
    const w = WEAPONS[reload.weapon];
    reload.elapsed += dt;
    if (reload.shells) {
      if (reload.endAt === undefined && reload.elapsed >= reload.nextShell) {
        if (w.ammo < w.magSize) {
          w.ammo++;
          reload.lastShellAt = reload.elapsed;
          reload.nextShell += w.reload.perShell;
          playShellInsert();
          updateAmmoHud();
        }
        if (w.ammo >= w.magSize) reload.endAt = reload.elapsed + w.reload.end;
      }
      if (reload.endAt !== undefined && reload.elapsed >= reload.endAt) {
        reload.active = false;
        reload.shells = false;
        if (reload.needsPump) startPump();
        updateAmmoHud();
      }
      return;
    }
    reload.timer -= dt;
    while (reload.cues.length && reload.elapsed >= reload.cues[0][0]) reload.cues.shift()[1]();
    if (reload.timer <= 0) {
      reload.active = false; reload.timer = 0;
      reload.cues.length = 0;
      w.ammo = w.magSize;
      updateAmmoHud();
    }
  }

  // ======================================================================
  // PLAYER
  // ======================================================================
  const ladderHintEl = document.getElementById("ladder-hint");
  const player = {
    velocity: new THREE.Vector3(),
    onGround: false,
    viewHeight: CFG.eyeHeight,
    sliding: false,
    slideTimer: 0, slideCooldown: 0, slideDustTimer: 0,
    wallContactTime: -1, wallBounceCooldown: 0,
    lastWallBounceAt: -99, lastLandTime: -99,
    lastYaw: 0, airSpinAccum: 0, airSpinNet: 0, feetY: 0.25,
    groundRise: 0,   // how fast the ramp under you is lifting you (m/s); becomes a launch off the top
    stepDist: 0,     // ground covered since the last footstep
    groundedAt: 0,   // last moment on the ground; also tells one jump from the next for air combos
    launch: null,    // "pad", "mega" or "ramp" while airborne from a launch, cleared on landing or a wall bounce
    launchRun: 0,    // horizontal speed when that launch fired
    blastKind: null, blastAirId: -1,   // the kind of blast that last threw you into the air, and which jump (groundedAt) it was: a rocket jump and its kin
    wallImpactSpeed: 0, wallImpactAt: -99,   // the last time a wall stopped us, and how fast we hit it
    viewRoll: 0,
    ladder: null, ladderCool: 0,   // the ladder being climbed
    portalCool: 0, boostCool: 0, lastPortalAt: -99, lastBoostAt: -99, onMover: false,   // (the last three are for achievements)
    hook: null,      // { anchor, len, flying, pos, dir } from the moment the hook is fired
    grappleWant: false,   // the grapple is out (or coming out) in the hand
    grappleCooldown: 0, grappleCooldownMax: 1, lastGrappleAt: -99, grappleWasHeld: false,
  };

  // ---- grappling hook: hold the key. The gun is put away and the grapple comes out; its hook flies to the
  // surface you're aiming at, sticks in, and reels you in. Let go and the gun comes back ----
  const grappleRay = new THREE.Ray();
  let grappleFloors = null;   // the floor and platform tops, built on first use
  const _gHit = new THREE.Vector3(), _gBest = new THREE.Vector3(), _gDir = new THREE.Vector3(), _gStart = new THREE.Vector3(), _gUp = new THREE.Vector3(0, 1, 0), _gTail = new THREE.Vector3();
  const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
  // the X-spear: a shaft with a pointed head and four fins in an X at the tail. The tip (+y) is what sticks in
  const SPEAR_LEN = 0.62;
  const spearSteel = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.8, roughness: 0.3 });
  const spearAccent = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.5, roughness: 0.4, emissive: 0x6a5200 });
  const hookHead = new THREE.Group();
  const spearShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, SPEAR_LEN - 0.12, 8), spearSteel);
  spearShaft.position.y = -0.06;
  const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 8), spearSteel);
  spearTip.position.y = SPEAR_LEN / 2 - 0.08;
  hookHead.add(spearShaft, spearTip);
  for (const ang of [Math.PI / 4, -Math.PI / 4]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.2, 0.008), spearAccent);
    fin.position.y = -SPEAR_LEN / 2 + 0.1;
    fin.rotation.y = ang;
    hookHead.add(fin);
  }
  ropeMesh.visible = hookHead.visible = false;
  ropeMesh.frustumCulled = false;
  scene.add(ropeMesh, hookHead);

  // where the rope leaves the grapple: just ahead of and below the camera, on the gun-hand side
  function ropeStart(out) {
    camera.getWorldPosition(out);
    camera.getWorldDirection(_gDir);
    out.addScaledVector(_gDir, 0.45).y -= 0.2;
    out.x += Math.cos(yawObject.rotation.y) * 0.22 * handSign();
    out.z += -Math.sin(yawObject.rotation.y) * 0.22 * handSign();
    return out;
  }

  function releaseHook(cooldown) {
    const had = !!player.hook;
    player.grappleWant = false;   // the grapple goes back in and the gun comes out
    player.hook = null;
    ropeMesh.visible = hookHead.visible = false;
    if (!had) return;
    player.lastGrappleAt = elapsedTime;
    noteTrick("grapple", "GRAPPLE");
    player.grappleCooldown = player.grappleCooldownMax = cooldown === undefined ? CFG.grappleCooldown : cooldown;
    playSfx("slide", 0.3, 1.8, 0.1, "volMove");
  }

  // the grapple is out: fire the hook along the view (a miss just puts it away again)
  function fireGrapple() {
    camera.getWorldPosition(grappleRay.origin);
    camera.getWorldDirection(grappleRay.direction);
    let best = CFG.grappleRange, found = false;
    if (!grappleFloors) grappleFloors = groundMeshes.map((m) => new THREE.Box3().setFromObject(m));
    for (const list of [wallBoxes, grappleFloors]) {
      for (const box of list) {
        if (!rayHitBox(grappleRay, box, _gHit)) continue;
        const d = _gHit.distanceTo(grappleRay.origin);
        if (d > 0.5 && d < best) { best = d; _gBest.copy(_gHit); found = true; }
      }
    }
    // targets can be hooked too (the rope follows a moving one)
    let hitTarget = null;
    const ro = grappleRay.origin, rd = grappleRay.direction;
    for (const t of targets) {
      if (!t.userData.alive) continue;
      const ox = t.position.x - ro.x, oy = t.position.y - ro.y, oz = t.position.z - ro.z;
      const proj = ox * rd.x + oy * rd.y + oz * rd.z;
      if (proj < 0.5 || proj >= best) continue;
      const cx = ox - rd.x * proj, cy = oy - rd.y * proj, cz = oz - rd.z * proj;
      if (Math.sqrt(cx * cx + cy * cy + cz * cz) < t.userData.hitRadius) { best = proj; hitTarget = t; found = true; }
    }
    if (hitTarget) _gBest.copy(hitTarget.position);
    // nothing in range: the spear still flies its full length, then reels back in empty
    if (!found) _gBest.copy(grappleRay.origin).addScaledVector(grappleRay.direction, CFG.grappleRange);
    const pos = ropeStart(new THREE.Vector3());
    const dir = _gBest.clone().sub(pos).normalize();
    player.hook = { anchor: _gBest.clone(), len: best, flying: true, miss: !found, target: hitTarget, pos, dir };
    playKnifeSwing();
  }

  // the hook flies out, then the rope pulls toward it and never gets longer
  function applyGrapple(dt) {
    const hk = player.hook;
    if (hk.target) {   // hooked onto a target: the rope follows it
      if (!hk.target.userData.alive) { releaseHook(); return; }
      hk.anchor.copy(hk.target.position);
      if (hk.flying) hk.dir.subVectors(hk.anchor, hk.pos).normalize();
    }
    if (hk.flying) {
      const left = hk.pos.distanceTo(hk.anchor), step = CFG.grappleFlightSpeed * dt;
      if (step < left) hk.pos.addScaledVector(hk.dir, step);
      else if (hk.miss) { hk.pos.copy(hk.anchor); hk.flying = false; hk.returning = true; playSfx("dryFire", 0.35, 1.4, 0.1, "volMove"); }
      else {
        hk.pos.copy(hk.anchor); hk.flying = false;
        hk.len = yawObject.position.distanceTo(hk.anchor);
        stat("grapples"); achProgress();
        playKnifeStick(hk.len); burst(hk.anchor, 0xffd24a, 4);
      }
      return;
    }
    if (hk.returning) {   // missed: the spear snaps back to the launcher
      ropeStart(_gStart);
      if (hk.pos.distanceTo(_gStart) < 0.8) { releaseHook(CFG.grappleMissCooldown); return; }
      hk.pos.addScaledVector(hk.dir, -Math.min(CFG.grappleFlightSpeed * 1.3 * dt, hk.pos.distanceTo(_gStart)));
      return;
    }
    _gDir.subVectors(hk.anchor, yawObject.position);
    const dist = _gDir.length();
    hk.pulled = (hk.pulled || 0) + dt;
    if (dist < CFG.grappleMinLen || hk.pulled > CFG.grappleMaxTime) { releaseHook(); return; }
    _gDir.divideScalar(dist);
    hk.len = Math.min(hk.len, dist);
    const along = player.velocity.dot(_gDir);
    if (along < CFG.grappleReel) player.velocity.addScaledVector(_gDir, Math.min(CFG.grappleAccel * dt, CFG.grappleReel - along));
    if (dist > hk.len + 0.05) {
      const out = player.velocity.dot(_gDir);
      if (out < 0) player.velocity.addScaledVector(_gDir, -out);   // taut: can't move further from the anchor
    }
    if (player.onGround && _gDir.y > 0.1) { player.onGround = false; player.sliding = false; }
  }

  // lay the rope and spear out from `start` to a spear at `pos` pointing along `dir`
  const _gRope = new THREE.Vector3(), _gRStart = new THREE.Vector3(), _gRPos = new THREE.Vector3(), _gRDir = new THREE.Vector3();
  function poseRopeOn(rope, head, start, pos, dir) {
    _gTail.copy(pos).addScaledVector(dir, -SPEAR_LEN);   // the rope ties on at the spear's tail
    _gRope.subVectors(_gTail, start);
    const len = _gRope.length();
    rope.position.copy(start).addScaledVector(_gRope, 0.5);
    rope.quaternion.setFromUnitVectors(_gUp, _gRope.divideScalar(len || 1));
    rope.scale.set(1, len, 1);
    head.quaternion.setFromUnitVectors(_gUp, dir);
    head.position.copy(pos).addScaledVector(dir, -SPEAR_LEN / 2);   // the tip is what sticks in
    rope.visible = head.visible = true;
  }
  function poseRope(start, pos, dir) { poseRopeOn(ropeMesh, hookHead, start, pos, dir); }
  function updateRopeVisual() {
    const hk = player.hook;
    if (!hk) return;
    poseRope(ropeStart(_gStart), hk.pos, hk.dir);
  }

  // maxTop lets callers ignore surfaces that are too far above the player's feet to step onto
  function currentGroundY(x, z, maxTop) {
    const cap = maxTop === undefined ? Infinity : maxTop;
    let best = -Infinity;
    for (const g of groundMeshes) {
      const ud = g.userData;
      if (Math.abs(x - ud.cx) <= ud.halfW && Math.abs(z - ud.cz) <= ud.halfD && ud.topY > best && ud.topY <= cap) best = ud.topY;
    }
    for (const r of ramps) {
      const h = rampHeight(r, x, z);
      if (h > best && h <= cap) best = h;
    }
    return best;
  }

  // push the player's circle out of every wall box it overlaps. `from` is where the centre
  // was a moment ago, so a centre that has ended up inside a wall goes back out the side
  // it came in through, never the far side.
  function resolveWalls(pos, feetY, from) {
    const r = CFG.playerRadius;
    const headY = feetY + CFG.playerHeight;
    for (const box of wallBoxes) {
      if (feetY >= box.max.y - CFG.stepHeight) continue;   // low enough to step up onto / already above
      if (headY <= box.min.y) continue;                    // passing underneath
      if (box.round) {   // a round rock: push out along the line from its centre
        const c = box.round, rr = c.r + r;
        let dx = pos.x - c.x, dz = pos.z - c.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        if (d2 < 1e-10) { const f = from || pos; dx = f.x - c.x; dz = f.z - c.z; if (dx * dx + dz * dz < 1e-10) dx = 1; }
        const dd = Math.hypot(dx, dz);
        pos.x = c.x + dx / dd * rr; pos.z = c.z + dz / dd * rr;
        continue;
      }
      const clx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
      const clz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
      const dx = pos.x - clx, dz = pos.z - clz;
      const distSq = dx * dx + dz * dz;
      if (distSq < 1e-10) {
        // centre inside the box: there's no nearest point to push away from
        const f = from || pos;
        if (f.x <= box.min.x) pos.x = box.min.x - r;
        else if (f.x >= box.max.x) pos.x = box.max.x + r;
        else if (f.z <= box.min.z) pos.z = box.min.z - r;
        else if (f.z >= box.max.z) pos.z = box.max.z + r;
        else {
          // came from inside too (shouldn't happen): leave by the shallowest side
          const out = [[pos.x - box.min.x, "x", box.min.x - r], [box.max.x - pos.x, "x", box.max.x + r],
            [pos.z - box.min.z, "z", box.min.z - r], [box.max.z - pos.z, "z", box.max.z + r]].sort((a, b) => a[0] - b[0])[0];
          pos[out[1]] = out[2];
        }
        continue;
      }
      if (distSq < r * r) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = r - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }
  }

  const _wallNormal = new THREE.Vector3();
  function nearestWallNormal(pos, maxDist) {
    let bestD = Infinity, found = false;
    for (const box of bounceBoxes) {
      if (pos.y < box.min.y - 0.2 || pos.y > box.max.y + 0.2) continue;
      if (box.round) {
        const c = box.round, rx = pos.x - c.x, rz = pos.z - c.z, rd = Math.hypot(rx, rz), gap = rd - c.r;
        if (gap < maxDist && gap > 0.001 && gap < bestD && rd > 1e-6) { bestD = gap; _wallNormal.set(rx / rd, 0, rz / rd); found = true; }
        continue;
      }
      const clx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
      const clz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
      const dx = pos.x - clx, dz = pos.z - clz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < maxDist && d > 0.001 && d < bestD) {
        bestD = d;
        _wallNormal.set(dx / d, 0, dz / d);
        found = true;
      }
    }
    return found ? _wallNormal : null;
  }

  function accelerate(velocity, wishDir, wishSpeed, accel, dt) {
    const currentSpeed = velocity.dot(wishDir);
    const addSpeed = wishSpeed - currentSpeed;
    if (addSpeed <= 0) return;
    let accelSpeed = accel * wishSpeed * dt;
    if (accelSpeed > addSpeed) accelSpeed = addSpeed;
    velocity.addScaledVector(wishDir, accelSpeed);
  }

  function clampSpeed() {
    const sp = Math.hypot(player.velocity.x, player.velocity.z);
    if (sp > CFG.maxSpeed) {
      const s = CFG.maxSpeed / sp;
      player.velocity.x *= s;
      player.velocity.z *= s;
    }
  }

  // Friction eases between the normal value and the reduced "momentum" value.
  // A hard switch at the threshold makes speed fall off a cliff the instant you
  // drop under it, which feels like snagging on something.
  function frictionAt(speed) {
    const lo = CFG.momentumThreshold - CFG.momentumRamp;
    if (speed <= lo) return CFG.friction;
    if (speed >= CFG.momentumThreshold) return CFG.momentumFriction;
    const t = (speed - lo) / CFG.momentumRamp;
    return CFG.friction + (CFG.momentumFriction - CFG.friction) * easeInOut(t);
  }

  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _wishDir = new THREE.Vector3();
  const _nextPos = new THREE.Vector3();
  const _stepFrom = new THREE.Vector3();
  const MOVE_STEP = 0.15;   // meters; well under the thinnest wall (0.2 m)

  function tryWallBounce() {
    if (player.wallBounceCooldown > 0) return false;
    const n = nearestWallNormal(yawObject.position, CFG.wallCheckDist);
    if (!n) return false;

    // only a real hit counts: how fast you're heading into the wall now, or how hard you hit
    // it in the last moment. Leaning on a wall and jumping isn't a bounce.
    const vx = player.velocity.x, vz = player.velocity.z;
    const dot = vx * n.x + vz * n.z;
    const recentHit = elapsedTime - player.wallImpactAt <= CFG.wallImpactMemory ? player.wallImpactSpeed : 0;
    const approach = Math.max(-dot, recentHit);
    if (approach < CFG.wallBounceMinSpeed) return false;

    const perfect = player.wallContactTime >= 0 && player.wallContactTime <= CFG.wallPerfectWindow;
    const restitution = perfect ? CFG.wallBounceRestitutionPerfect : CFG.wallBounceRestitutionNormal;

    // keep the speed you had along the wall and throw the into-the-wall part back out
    const tx = vx - dot * n.x, tz = vz - dot * n.z;
    const along = perfect ? 0.95 : 0.85;
    const out = approach * restitution + CFG.wallBouncePushOut;
    let rx = tx * along + n.x * out;
    let rz = tz * along + n.z * out;

    // that sets the direction. The speed never drops: a perfect bounce adds +5 from a jog, fading
    // to +2 at speed, up to the cap; a late one adds a few percent, less the later it is
    const inSpeed = Math.max(Math.hypot(vx, vz), approach);
    let target;
    if (perfect) {
      target = inSpeed + Math.max(CFG.wallBounceBonusMin, CFG.wallBounceBonusPerfect * (1 - inSpeed / CFG.wallBounceMaxSpeed));
    } else {
      const late = Math.max(0, player.wallContactTime - CFG.wallPerfectWindow);
      target = inSpeed * (1 + CFG.wallBounceBonusLate * Math.max(0, 1 - late / CFG.wallBounceLateWindow));
    }
    target = Math.max(inSpeed, Math.min(target, CFG.wallBounceMaxSpeed));
    const sp = Math.hypot(rx, rz) || 1;
    rx *= target / sp; rz *= target / sp;

    player.velocity.x = rx;
    player.velocity.z = rz;
    player.velocity.y = perfect ? CFG.wallBounceUpPerfect : CFG.wallBounceUpNormal;
    player.wallBounceCooldown = CFG.wallBounceCooldown;
    player.wallContactTime = -1;
    player.lastWallBounceAt = elapsedTime;
    noteTrick("bounce", perfect ? "PERFECT BOUNCE" : "WALL BOUNCE");
    player.wallImpactSpeed = 0;
    player.launch = null;   // rising off the bounce isn't a pad launch (WALL BOUNCE pays for it)

    playWallBounce(perfect);
    stat("wallBounces"); if (perfect) { stat("perfectBounces"); achProgress(); }
    if (perfect) burst(yawObject.position, 0x7CFC00, 5);
    return true;
  }

  // recent aim directions, for spotting a flick
  const aimHistory = [];
  function recordAim() {
    aimHistory.push({ t: elapsedTime, yaw: yawObject.rotation.y, pitch: pitchObject.rotation.x });
    while (aimHistory.length && aimHistory[0].t < elapsedTime - 0.5) aimHistory.shift();
  }
  // the biggest angle (degrees) between where you aim now and anywhere you aimed in the last `window` s
  function recentTurn(window) {
    const y = yawObject.rotation.y, p = pitchObject.rotation.x;
    const cx = Math.cos(p) * Math.sin(y), cy = Math.sin(p), cz = Math.cos(p) * Math.cos(y);
    let best = 0;
    for (const a of aimHistory) {
      if (a.t < elapsedTime - window) continue;
      const dot = cx * Math.cos(a.pitch) * Math.sin(a.yaw) + cy * Math.sin(a.pitch) + cz * Math.cos(a.pitch) * Math.cos(a.yaw);
      best = Math.max(best, Math.acos(Math.min(1, Math.max(-1, dot))));
    }
    return best * 180 / Math.PI;
  }

  function updatePlayer(dt) {
    recordAim();
    const yawDelta = yawObject.rotation.y - player.lastYaw;
    // track net rotation and keep its peak, so wiggling the mouse back and forth can't farm spins
    if (!player.onGround) {
      player.airSpinNet += yawDelta;
      player.airSpinAccum = Math.max(player.airSpinAccum, Math.abs(player.airSpinNet));
    } else {
      player.airSpinNet = 0; player.airSpinAccum = 0;
    }
    player.lastYaw = yawObject.rotation.y;

    if (player.slideCooldown > 0) player.slideCooldown -= dt;
    if (player.wallBounceCooldown > 0) player.wallBounceCooldown -= dt;
    if (jumpQueueTimer > 0) { jumpQueueTimer -= dt; if (jumpQueueTimer <= 0) jumpQueued = false; }
    if (player.grappleCooldown > 0) player.grappleCooldown -= dt;
    const grappleHeld = held("grapple");
    if (grappleHeld && !player.grappleWasHeld) {
      if (player.grappleWant) releaseHook();   // tap again to let go
      else if (player.grappleCooldown <= 0) {
        player.grappleWant = true;   // like a weapon switch, this ends a reload, a bolt cycle and an inspect
        cancelReload(); cancelBoltCycle(); cancelPump(); vm.inspectTimer = 0;
      }
    }
    player.grappleWasHeld = grappleHeld;
    // jumping lets go too, keeping the speed
    if (player.hook && !player.hook.flying && !player.hook.returning && jumpQueued) { jumpQueued = false; jumpQueueTimer = 0; releaseHook(); }
    if (player.grappleWant && !player.hook && vm.grappleOut >= 1) fireGrapple();
    if (player.hook) applyGrapple(dt);

    const shiftHeld = held("sprint");
    const sprinting = SETTINGS.autoSprint ? !shiftHeld : shiftHeld;
    const wantsCrouch = held("slide");

    _forward.set(-Math.sin(yawObject.rotation.y), 0, -Math.cos(yawObject.rotation.y));
    _right.set(Math.cos(yawObject.rotation.y), 0, -Math.sin(yawObject.rotation.y));

    let moveX = 0, moveZ = 0;
    if (held("forward")) moveZ += 1;
    if (held("back")) moveZ -= 1;
    if (held("right")) moveX += 1;
    if (held("left")) moveX -= 1;

    _wishDir.set(0, 0, 0).addScaledVector(_forward, moveZ).addScaledVector(_right, moveX);
    if (_wishDir.lengthSq() > 0) _wishDir.normalize();

    let horizSpeed = Math.hypot(player.velocity.x, player.velocity.z);

    // ---------------- SLIDE ----------------
    if (player.slideTimer > 0) player.slideTimer -= dt;
    const canStartSlide = player.onGround && wantsCrouch && !player.sliding &&
                          player.slideCooldown <= 0 && horizSpeed > CFG.slideMinSpeed;
    if (canStartSlide) {
      noteTrick("slide", "SLIDE");
      player.sliding = true;
      player.slideTimer = CFG.slideDuration;
      player.slideCooldown = CFG.slideDuration + CFG.slideCooldown;
      if (horizSpeed > 0.01) {
        const boosted = Math.min(horizSpeed + CFG.slideBoost, CFG.slideMaxSpeed);
        const s = boosted / horizSpeed;
        player.velocity.x *= s; player.velocity.z *= s;
        horizSpeed = boosted;
      }
      playSlideStart();
      stat("slides");
      // kick up a puff of dust at the start of the slide
      const gy = currentGroundY(yawObject.position.x, yawObject.position.z, player.feetY + CFG.stepHeight);
      for (let i = 0; i < 8; i++) {
        spawnParticle(
          new THREE.Vector3(yawObject.position.x + (Math.random() - 0.5), gy + 0.3, yawObject.position.z + (Math.random() - 0.5)),
          0xbfae8e, (Math.random() - 0.5) * 3, Math.random() * 1.8, (Math.random() - 0.5) * 3,
          0.5 + Math.random() * 0.4, 0.8, 0.35
        );
      }
    }
    if (player.sliding && (!wantsCrouch || player.slideTimer <= 0 || !player.onGround || horizSpeed < 1.5)) {
      player.sliding = false;
    }

    // continuous dust + scrape while sliding
    if (player.sliding) {
      player.slideDustTimer -= dt;
      if (player.slideDustTimer <= 0) {
        player.slideDustTimer = 0.045;
        const gy = currentGroundY(yawObject.position.x, yawObject.position.z, player.feetY + CFG.stepHeight);
        spawnParticle(
          new THREE.Vector3(yawObject.position.x + (Math.random() - 0.5) * 0.6, gy + 0.28, yawObject.position.z + (Math.random() - 0.5) * 0.6),
          0xcbbb98,
          -player.velocity.x * 0.18 + (Math.random() - 0.5) * 1.5,
          0.7 + Math.random() * 1.2,
          -player.velocity.z * 0.18 + (Math.random() - 0.5) * 1.5,
          0.45 + Math.random() * 0.35, 0.7, 0.3
        );
      }
    }

    // ---------------- PORTALS AND BOOST STRIPS ----------------
    if (player.portalCool > 0) player.portalCool -= dt;
    if (player.boostCool > 0) player.boostCool -= dt;
    if (portals.length) tryPortals();
    if (boosts.length) tryBoosts();

    // ---------------- LADDERS ----------------
    // walk up to one and hold forward to climb (forward and back move you along it); jump to leave it, or climb over the top
    if (player.ladderCool > 0) player.ladderCool -= dt;
    let ladderNear = null;
    {
      const px = yawObject.position.x, pz = yawObject.position.z, fy = player.feetY;
      for (const L of ladders) {
        const dx = px - L.x, dz = pz - L.z, out = dx * L.nx + dz * L.nz, tan = -dx * L.nz + dz * L.nx;
        if (out > 0.15 && out < 1.3 && Math.abs(tan) < 0.8 && fy > L.y0 - 0.5 && fy < L.y1 + 0.15) { ladderNear = L; break; }
      }
    }
    if (!player.ladder && ladderNear && player.ladderCool <= 0 && held("forward") && -(_forward.x * ladderNear.nx + _forward.z * ladderNear.nz) > 0.35) player.ladder = ladderNear;
    if (player.ladder && (ladderNear !== player.ladder || (player.onGround && !held("forward")))) player.ladder = null;
    ladderHintEl.hidden = !(ladderNear && !player.ladder);
    // ---------------- GROUND / AIR ----------------
    if (player.ladder) {
      const L = player.ladder, climb = (held("forward") ? 1 : 0) - (held("back") ? 1 : 0);
      player.velocity.x = -L.nx * 0.6; player.velocity.z = -L.nz * 0.6;   // hugging the wall
      player.velocity.y = climb * CFG.ladderSpeed;
      player.onGround = false; player.sliding = false;
      if (jumpQueued) {          // jump off, away from the wall
        jumpQueued = false; jumpQueueTimer = 0;
        player.velocity.x = L.nx * 4.5; player.velocity.z = L.nz * 4.5; player.velocity.y = 6;
        player.ladder = null; player.ladderCool = 0.35;
      } else if (player.feetY >= L.y1 - 0.1 && climb > 0) {   // over the top, onto the roof
        player.velocity.x = -L.nx * 3.5; player.velocity.z = -L.nz * 3.5; player.velocity.y = 3.2;
        player.ladder = null; player.ladderCool = 0.4;
      }
    } else if (player.onGround) {
      // bunnyhop: jumping on the same frame you land skips friction, so a chained hop carries
      // speed; each hop still bleeds some of what's above a sprint (see CFG.bhopKeep)
      const jumpHeld = held("jump");
      const bhopping = jumpHeld && (elapsedTime - player.lastLandTime) <= CFG.bhopWindow;

      if (!bhopping && !player.hook) {
        const fric = player.sliding ? CFG.slideFriction : frictionAt(horizSpeed);
        if (horizSpeed > 0.0001) {
          const drop = horizSpeed * fric * dt;
          const scale = Math.max(horizSpeed - drop, 0) / horizSpeed;
          player.velocity.x *= scale; player.velocity.z *= scale;
        }
      }

      if (!player.sliding) {
        // crouched without a slide: a slow, quiet crouch-walk (no sprinting)
        const walkMult = wantsCrouch ? CFG.crouchWalkMult : sprinting ? CFG.sprintMultiplier : 1;
        accelerate(player.velocity, _wishDir, CFG.groundMaxSpeed * walkMult, CFG.groundAccel, dt);
      } else {
        accelerate(player.velocity, _wishDir, 2.0, 6, dt);
      }

      if (jumpHeld) {
        if (bhopping) {
          const base = CFG.groundMaxSpeed * CFG.sprintMultiplier;
          const sp = Math.hypot(player.velocity.x, player.velocity.z);
          if (sp > base) {
            const keep = jumpQueued ? CFG.bhopKeep : CFG.bhopKeepHeld;   // jumpQueued: a fresh press, timed
            const s = (base + (sp - base) * keep) / sp;
            player.velocity.x *= s; player.velocity.z *= s;
          }
        }
        player.velocity.y = CFG.jumpSpeed + player.groundRise;   // jumping off a ramp adds its lift
        stat("jumps");
        if (bhopping) stat("bhops");
        if (player.groundRise > 2) { player.launch = "ramp"; player.launchRun = Math.hypot(player.velocity.x, player.velocity.z); }
        player.onGround = false;
        player.sliding = false;
        jumpQueued = false;
        player.wallContactTime = -1;
      }
      // jump pads fire you straight up and add a little to the speed you ran onto them with
      if (player.onGround) {
        for (const pad of jumpPads) {
          if (Math.hypot(yawObject.position.x - pad.x, yawObject.position.z - pad.z) < pad.r && Math.abs(player.feetY - pad.y) < 0.35) {
            player.velocity.y = pad.power;
            player.launch = pad.power > CFG.jumpPadPower + 1 ? "mega" : "pad";
            noteTrick("launch", pad.power > CFG.jumpPadPower + 1 ? "MEGA PAD" : "JUMP PAD");
            const run = Math.hypot(player.velocity.x, player.velocity.z);
            player.launchRun = run;   // bouncing in place on a pad still counts as standing still
            if (run > 1) {
              const s = Math.min(run + pad.boost, Math.max(run, CFG.maxSpeed)) / run;
              player.velocity.x *= s; player.velocity.z *= s;
            }
            player.onGround = false;
            player.sliding = false;
            player.wallContactTime = -1;
            pad.flash = 1;
            playPadLaunch(pad.power);
            stat("padLaunches");
            break;
          }
        }
      }
    } else {
      // right after a wall bounce the bounce carries you: holding the key that ran you into the
      // wall would otherwise cancel it in a tenth of a second. Steering fades back in after.
      const sinceBounce = elapsedTime - player.lastWallBounceAt;
      const steer = Math.min(Math.max((sinceBounce - CFG.wallBounceSteerLock) / CFG.wallBounceSteerFade, 0), 1);
      if (steer > 0) accelerate(player.velocity, _wishDir, CFG.airWishSpeedCap, CFG.airAccel * steer, dt);
      const touching = nearestWallNormal(yawObject.position, CFG.wallCheckDist) !== null;
      if (touching) player.wallContactTime = player.wallContactTime < 0 ? 0 : player.wallContactTime + dt;
      else player.wallContactTime = -1;
      if (jumpQueued && tryWallBounce()) { jumpQueued = false; jumpQueueTimer = 0; }
      player.velocity.y -= CFG.gravity * dt;
    }

    clampSpeed();

    // ---------------- INTEGRATE ----------------
    const prevFeet = player.feetY;
    // move in short steps, checking walls after each, so no speed or frame rate can carry
    // the player clean over a wall in one jump
    _nextPos.copy(yawObject.position);
    const travelX = player.velocity.x * dt, travelZ = player.velocity.z * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(travelX, travelZ) / MOVE_STEP));
    for (let i = 0; i < steps; i++) {
      _stepFrom.copy(_nextPos);
      _nextPos.x += travelX / steps;
      _nextPos.z += travelZ / steps;
      resolveWalls(_nextPos, prevFeet, _stepFrom);
      resolveWalls(_nextPos, prevFeet, _stepFrom);
    }
    // if a wall pushed us back, the push points along its normal: drop the part of our
    // velocity going into it (so we slide along instead of sticking) and remember how hard
    // we hit, which is what a wall bounce is judged on
    const pushX = _nextPos.x - (yawObject.position.x + travelX), pushZ = _nextPos.z - (yawObject.position.z + travelZ);
    const pushLen = Math.hypot(pushX, pushZ);
    if (pushLen > 1e-5) {
      const nx = pushX / pushLen, nz = pushZ / pushLen;
      const vn = player.velocity.x * nx + player.velocity.z * nz;
      if (vn < 0) {
        player.velocity.x -= vn * nx;
        player.velocity.z -= vn * nz;
        if (-vn >= player.wallImpactSpeed || elapsedTime - player.wallImpactAt > CFG.wallImpactMemory) {
          player.wallImpactSpeed = -vn;
          player.wallImpactAt = elapsedTime;
        }
      }
    }
    const B = CFG.arenaHalfSize - 0.6;
    _nextPos.x = Math.max(-B, Math.min(B, _nextPos.x));
    _nextPos.z = Math.max(-B, Math.min(B, _nextPos.z));
    const movedXZ = Math.hypot(_nextPos.x - yawObject.position.x, _nextPos.z - yawObject.position.z);
    stats.distance += movedXZ;
    statMax("topSpeed", Math.hypot(player.velocity.x, player.velocity.z));
    yawObject.position.x = _nextPos.x;
    yawObject.position.z = _nextPos.z;
    if (player.onGround && !player.sliding) {
      const speedXZ = Math.hypot(player.velocity.x, player.velocity.z);
      player.stepDist += movedXZ;
      if (speedXZ > 1.5 && player.stepDist >= 1.4 + speedXZ * 0.07) { player.stepDist = 0; playFootstep(speedXZ); }
    }
    yawObject.position.y += player.velocity.y * dt;
    player.feetY = prevFeet + player.velocity.y * dt;

    // ---------------- VIEW HEIGHT + ROLL ----------------
    let targetHeight = CFG.eyeHeight;
    if (player.sliding) targetHeight = CFG.slideHeight;
    else if (wantsCrouch && player.onGround) targetHeight = CFG.crouchHeight;
    player.viewHeight += (targetHeight - player.viewHeight) * Math.min(dt * CFG.heightLerpSpeed, 1);

    // camera roll: lean into strafes, and tilt harder into a slide
    let targetRoll = -moveX * 0.03;   // the lean into a strafe (was 0.022)
    if (player.sliding) targetRoll += 0.085 + Math.sin(elapsedTime * 22) * 0.006;
    if (SETTINGS.reduceMotion) targetRoll = 0;
    player.viewRoll += (targetRoll - player.viewRoll) * Math.min(dt * 8, 1);
    camera.rotation.z = player.viewRoll;

    // ---------------- GROUND SNAP ----------------
    const groundY = currentGroundY(yawObject.position.x, yawObject.position.z, prevFeet + CFG.stepHeight);
    const eyeTarget = groundY + player.viewHeight;
    if (player.velocity.y <= 0 && yawObject.position.y <= eyeTarget + CFG.groundSnapTolerance) {
      if (!player.onGround) {
        const fall = -player.velocity.y;
        if (fall > 3.5) playLanding((0.06 + 0.3 * Math.min((fall - 3.5) / 14, 1)) * (held("jump") || player.sliding ? 0.6 : 1));
        player.stepDist = 0.8;   // the next step comes a little after touching down
      }
      yawObject.position.y = eyeTarget;
      player.feetY = groundY;
      player.velocity.y = 0;
      if (!player.onGround) {
        player.wallContactTime = -1;
        player.lastLandTime = elapsedTime;
        player.launch = null;
      }
      player.onGround = true;
      const r = rampAt(yawObject.position.x, yawObject.position.z, groundY);
      player.groundRise = r ? Math.max(0, (r.along === "x" ? player.velocity.x : player.velocity.z) * r.dir * r.height / r.length) : 0;
      player.groundedAt = elapsedTime;
    } else {
      // running off the top of a ramp: the lift it was giving you becomes a launch
      if (player.onGround && player.groundRise > 0 && player.velocity.y <= 0) {
        player.velocity.y = player.groundRise;
        if (player.groundRise > 2) { player.launch = "ramp"; player.launchRun = Math.hypot(player.velocity.x, player.velocity.z); noteTrick("launch", "RAMP LAUNCH"); }
      }
      player.groundRise = 0;
      player.onGround = false;
      player.sliding = false;
    }
    updateRopeVisual();
  }

  // ======================================================================
  // COMBAT + SCORING
  // ======================================================================
  const raycaster = new THREE.Raycaster();
  let fireCooldown = 0, streak = 0, score = 0, hitStopTimer = 0;
  let bonusTagsTimer = null, feedTimer = null;

  function showFeed(text) {
    feedEl.textContent = text;
    feedEl.classList.add("show");
    clearTimeout(feedTimer);
    feedTimer = setTimeout(() => feedEl.classList.remove("show"), 1500);
  }
  // the best single shot so far, kept across sessions
  const BEST_KEY = "tsb-best-shot";
  const bestEl = document.getElementById("best");
  let bestShot = { points: 0, mult: 1, tags: [], pens: [] };
  try {
    const b = JSON.parse(localStorage.getItem(BEST_KEY));
    if (b && Number.isFinite(b.points) && Number.isFinite(b.mult) && Array.isArray(b.tags)) {
      const strs = (a) => (Array.isArray(a) ? a.filter((t) => typeof t === "string").slice(0, 12) : []);
      bestShot = { points: b.points, mult: b.mult, tags: strs(b.tags), pens: strs(b.pens), dist: Number.isFinite(b.dist) ? b.dist : undefined };
    }
  } catch (e) { /* storage blocked or empty */ }
  function saveBestShot() {
    try { localStorage.setItem(BEST_KEY, JSON.stringify(bestShot)); } catch (e) { /* ignore */ }
  }
  // personal records for each map: the best trickshot and the longest streak you have had there. Only on your own and in practice
  // (a shared room has other people's hits in it). A map that no longer exists is dropped when it loads.
  const MAP_REC_KEY = "tsb-map-records";
  let mapRecs = {};
  try {
    const raw = JSON.parse(localStorage.getItem(MAP_REC_KEY));
    const strs = (a) => (Array.isArray(a) ? a.filter((t) => typeof t === "string").slice(0, 12).map((t) => t.slice(0, 40)) : []);
    if (raw && typeof raw === "object") {
      for (const id of Object.keys(raw)) {
        const r = raw[id], sh = r && r.shot;
        if (!MAPS[id] || !r || typeof r !== "object") continue;
        mapRecs[id] = {
          shot: sh && Number.isFinite(sh.points) && sh.points > 0 && Number.isFinite(sh.mult)
            ? { points: sh.points, mult: sh.mult, tags: strs(sh.tags), pens: strs(sh.pens), dist: Number.isFinite(sh.dist) ? sh.dist : undefined } : null,
          streak: Number.isFinite(r.streak) && r.streak > 0 ? Math.floor(r.streak) : 0,
        };
      }
    }
  } catch (e) { /* storage blocked or empty */ }
  function saveMapRecs() {
    try { localStorage.setItem(MAP_REC_KEY, JSON.stringify(mapRecs)); } catch (e) { /* ignore */ }
  }
  const mapRecsOn = () => !!currentMap && (!net.active || net.practice);
  const mapRecFor = (id) => mapRecs[id] || (mapRecs[id] = { shot: null, streak: 0 });
  function showBestShot(isNew) {
    bestEl.hidden = bestShot.points <= 0;
    document.getElementById("best-val").textContent = bestShot.points;
    fillTagList(document.getElementById("best-tags"), bestShot.mult, bestShot.tags, bestShot.pens, bestShot.dist);
    if (isNew) { bestEl.classList.remove("new"); void bestEl.offsetWidth; bestEl.classList.add("new"); }
  }
  showBestShot(false);
  document.getElementById("best-clear").addEventListener("click", () => {
    bestShot = { points: 0, mult: 1, tags: [], pens: [] };
    saveBestShot();
    showBestShot(false);
    bestClip = null;
    try { localStorage.removeItem(REPLAY_KEY); } catch (e) { /* ignore */ }
    refreshReplayButtons();
  });

  // the multiplier on top, then each bonus, then any penalties in red
  function fillTagList(el, mult, tags, pens, dist) {
    el.textContent = "";
    const line = (text, cls) => { const d = document.createElement("div"); d.textContent = text; if (cls) d.className = cls; el.appendChild(d); };
    line(mult.toFixed(2) + "x" + (Number.isFinite(dist) ? " - " + Math.round(dist) + "m" : ""), "mult" + (mult < 1 ? " low" : ""));
    for (const t of tags) line(t);
    for (const t of pens) line(t, "pen");
  }
  function showBonusTags(mult, tags, pens, dist) {
    fillTagList(bonusTagsEl, mult, tags, pens, dist);
    bonusTagsEl.classList.add("show");
    clearTimeout(bonusTagsTimer);
    bonusTagsTimer = setTimeout(() => bonusTagsEl.classList.remove("show"), 4000);
  }
  // your hit landed: the crosshair flashes red, or an X or a ring pops at it (Settings > Crosshair > Hit marker)
  const hitmarkEl = document.getElementById("hitmark");
  const HIT_MARKS = {
    x: '<svg width="28" height="28" viewBox="-14 -14 28 28"><path d="M-9 -9L-3 -3M9 -9L3 -3M-9 9L-3 3M9 9L3 3" stroke="#ff3b3b" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
    ring: '<svg width="28" height="28" viewBox="-14 -14 28 28"><circle r="9" stroke="#ff3b3b" stroke-width="2.5" fill="none"/></svg>',
  };
  function flashCrosshair() {
    const style = SETTINGS.hitStyle;
    if (style === "off") return;
    if (HIT_MARKS[style]) {
      hitmarkEl.innerHTML = HIT_MARKS[style];
      hitmarkEl.classList.remove("show");
      void hitmarkEl.offsetWidth;   // restart the animation if hits come quickly
      hitmarkEl.classList.add("show");
      return;
    }
    crosshairEl.classList.add("hit");
    setTimeout(() => crosshairEl.classList.remove("hit"), 100);
  }

  // distance along the current ray to the nearest wall, pillar, platform or the floor
  const _occPoint = new THREE.Vector3();
  // (it also leaves the facing of the surface it found in _occNormal, for the bullet holes)
  const _occNormal = new THREE.Vector3(0, 1, 0), _occBest = new THREE.Vector3();
  function occluderDistance(maxDist) {
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    let best = maxDist, bestBox = null, floor = false;
    for (const box of wallBoxes) {
      const hit = rayHitBox(raycaster.ray, box, _occPoint);
      if (hit) { const dist = o.distanceTo(hit); if (dist < best) { best = dist; bestBox = box; _occBest.copy(hit); } }
    }
    if (d.y < 0) { const t = (o.y - 0.25) / -d.y; if (t > 0 && t < best) { best = t; floor = true; } }
    if (floor) _occNormal.set(0, 1, 0);
    else if (bestBox && bestBox.round && _occBest.y < bestBox.max.y - 0.02) _occNormal.set(_occBest.x - bestBox.round.x, 0, _occBest.z - bestBox.round.z).normalize();
    else if (bestBox) boxFaceNormal(bestBox, _occBest, _occNormal);
    return best;
  }

  // ---- bullet holes: a dark mark where a shot lands on a wall, the floor or a platform. One instanced mesh
  // (a single draw call); the oldest hole is the one that gets reused ----
  const DECAL_MAX = 100;
  const decalTex = canvasTexture(64, (g, n) => {
    const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, "rgba(6,6,6,1)"); grad.addColorStop(0.42, "rgba(10,10,10,0.96)");
    grad.addColorStop(0.68, "rgba(34,30,26,0.5)"); grad.addColorStop(1, "rgba(34,30,26,0)");
    g.fillStyle = grad; g.fillRect(0, 0, n, n);
  });
  decalTex.wrapS = decalTex.wrapT = THREE.ClampToEdgeWrapping;
  decalMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16),
    new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), DECAL_MAX);
  decalMesh.frustumCulled = false;
  decalMesh.visible = !!SETTINGS.bulletHoles;
  const _dM = new THREE.Matrix4(), _dQ = new THREE.Quaternion(), _dQ2 = new THREE.Quaternion(), _dS = new THREE.Vector3(), _dP = new THREE.Vector3(), _dZ = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < DECAL_MAX; i++) decalMesh.setMatrixAt(i, _dM.makeScale(0, 0, 0));
  scene.add(decalMesh);
  let decalNext = 0;
  function spawnDecal(point, normal, size) {
    if (!SETTINGS.bulletHoles) return;
    _dQ.setFromUnitVectors(_dZ, normal);
    _dQ.multiply(_dQ2.setFromAxisAngle(_dZ, Math.random() * Math.PI * 2));   // a random turn about its own axis
    _dP.copy(point).addScaledVector(normal, 0.012);                            // a hair off the surface
    decalMesh.setMatrixAt(decalNext, _dM.compose(_dP, _dQ, _dS.set(size, size, size)));
    decalMesh.instanceMatrix.needsUpdate = true;
    decalNext = (decalNext + 1) % DECAL_MAX;
  }

  function raycastTargets(maxDist) {
    let bestDist = Infinity, best = null;
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    for (const t of targets) {
      if (!t.userData.alive) continue;
      const ox = t.position.x - o.x, oy = t.position.y - o.y, oz = t.position.z - o.z;
      const proj = ox * d.x + oy * d.y + oz * d.z;
      if (proj < 0 || proj > maxDist) continue;
      const cx = ox - d.x * proj, cy = oy - d.y * proj, cz = oz - d.z * proj;
      if (Math.sqrt(cx * cx + cy * cy + cz * cz) < t.userData.hitRadius && proj < bestDist) {
        bestDist = proj; best = t;
      }
    }
    return { target: best, dist: bestDist };
  }

  // ---- tricks as they happen: the live feed, and the CHAIN count (different tricks within a few seconds) ----
  const trickLog = [];
  const trickFeedEl = document.getElementById("trick-feed"), trickChainEl = document.getElementById("trick-chain");
  function chainCount() {
    const now = elapsedTime;
    while (trickLog.length && now - trickLog[0].t > CFG.chainWindow) trickLog.shift();
    return new Set(trickLog.map((e) => e.type)).size;
  }
  function noteTrick(type, label) {
    const last = trickLog.slice().reverse().find((e) => e.type === type);
    if (last && elapsedTime - last.t < 0.5) return;   // the same trick twice in a flash is one trick
    trickLog.push({ type, t: elapsedTime });
    if (!SETTINGS.trickFeed || !pointerLocked) return;
    const line = document.createElement("div");
    line.className = "tf"; line.textContent = label;
    trickFeedEl.appendChild(line);
    while (trickFeedEl.children.length > 5) trickFeedEl.removeChild(trickFeedEl.children[1]);   // (child 0 is the chain line)
    setTimeout(() => line.remove(), 2400);
  }
  let lastChainShown = 0;
  function updateTrickFeed() {
    const n = SETTINGS.trickFeed ? chainCount() : 0;
    if (n === lastChainShown) return;
    lastChainShown = n;
    trickChainEl.textContent = n >= 2 ? "CHAIN x" + n : "";
  }
  const trickSeen = new Set();   // the tricks landed so far this run (each new one adds to the shot)
  const COLLECTABLE = new Set(["AIR", "180\u00b0", "SPIN", "NO-SCOPE", "QUICKSCOPE", "FLICK", "SNAP FLICK", "SLIDING", "WALL BOUNCE", "GRAPPLE", "LAUNCHED", "RAMP LAUNCH",
    "MEGA LAUNCH", "REVERSE", "QUICK SWITCH", "PORTAL SHOT", "STRIP SHOT", "PLATFORM SHOT", "ZERO-G", "CHAIN", "HANG TIME", "MICRO TARGET", "PINPOINT", "MOVING TARGET",
    "LAST ROUND", "DOUBLE", "TRIPLE", "LONG SHOT", "MEGA SNIPE", "BLAZING", "SONIC", "ROCKET JUMP", "LAUNCHER JUMP", "GRENADE JUMP", "PACK JUMP"]);
  const BLAST_JUMP = { rpg: ["ROCKET JUMP", "rocketJumpMult"], launcher: ["LAUNCHER JUMP", "launcherJumpMult"], frag: ["GRENADE JUMP", "grenadeJumpMult"], satchel: ["PACK JUMP", "packJumpMult"] };   // by blast kind: the tag, and its CFG value
  const collectKey = (tag) => { const k = trickKey(tag); return k && /SPIN$/.test(k) ? "SPIN" : k; };

  // what the player is doing right now, for scoring. A thrown knife takes this
  // snapshot when it leaves the hand, so the trick you threw it during is what counts.
  // flying fast away from where you're aiming, having turned round since takeoff: shooting back
  // over your shoulder. Just backpedalling doesn't count.
  function reversing() {
    if (player.onGround || player.airSpinAccum < Math.PI / 2) return false;
    const vx = player.velocity.x, vz = player.velocity.z, sp = Math.hypot(vx, vz);
    if (sp < CFG.reverseSpeed) return false;
    const y = yawObject.rotation.y;   // the camera looks down -z, turned by yaw
    return (-Math.sin(y) * vx - Math.cos(y) * vz) / sp < -0.5;
  }
  // distance: CLOSE scales the shot down, past distanceFrom it multiplies up with no cap
  function distanceFactor(d) {
    if (d >= CFG.distanceFrom) {
      const name = d >= 50 ? "MEGA SNIPE" : d >= 30 ? "LONG SHOT" : "MID RANGE";
      return [name, 1 + (d - CFG.distanceFrom) * CFG.distanceMultPerM];
    }
    const k = Math.min(Math.max((d - CFG.pointBlankMin) / (CFG.distanceFrom - CFG.pointBlankMin), 0), 1);
    return ["CLOSE", CFG.pointBlankMult + (1 - CFG.pointBlankMult) * k];
  }
  function speedFactor(sp) {
    if (sp < CFG.speedFrom + 0.5) return null;
    const name = sp >= 19 ? "SONIC" : sp >= 15 ? "BLAZING" : "FAST";
    return [name + " " + Math.round(sp) + " u/s", Math.min(1 + (sp - CFG.speedFrom) * CFG.speedMultPer, CFG.speedMultMax)];
  }
  let comboAirId = -1, comboCount = 0;

  function trickState() {
    return {
      onGround: player.onGround,
      spin: player.airSpinAccum,
      speed: Math.hypot(player.velocity.x, player.velocity.z),
      sliding: player.sliding,
      wallRide: elapsedTime - player.lastWallBounceAt <= CFG.wallRideScoreWindow,
      grapple: elapsedTime - player.lastGrappleAt <= CFG.grappleScoreWindow,
      portal: elapsedTime - player.lastPortalAt <= CFG.portalScoreWindow,
      strip: elapsedTime - player.lastBoostAt <= CFG.stripScoreWindow,
      onMover: player.onMover,
      zeroG: !player.onGround && CFG.gravity <= CFG.zeroGMaxGravity && elapsedTime - player.groundedAt >= CFG.zeroGAirTime,
      chain: chainCount(),
      airTime: player.onGround ? 0 : (elapsedTime - player.groundedAt) * Math.sqrt(CFG.gravity / BASE_PHYS.gravity),   // low gravity doesn't make hang time cheap
      airId: player.groundedAt,   // the same for every shot in one jump
      launch: !player.onGround && player.velocity.y > 0 ? player.launch : null,
      // anywhere in a pad or ramp flight you ran onto, so it isn't "standing still"
      launched: !player.onGround && !!player.launch && player.launchRun >= CFG.standingStillSpeed,
      blast: !player.onGround && player.blastKind && player.blastAirId === player.groundedAt ? player.blastKind : null,   // still in the air from your own blast
      flick: recentTurn(CFG.flickWindow),
      snapFlick: recentTurn(CFG.snapFlickWindow),
      quickSwitch: elapsedTime - vm.switchDoneAt <= CFG.quickSwitchWindow &&
        elapsedTime - (currentWeapon().lastFiredAt === undefined ? -99 : currentWeapon().lastFiredAt) > CFG.quickSwitchFreshGun,
      reverse: reversing(),
    };
  }

  // Every trick multiplies the shot. Tags read "NAME x1.40"; penalties (under 1) are kept apart
  // so the HUD can show them in red.
  function computeMultipliers(target, dist, isKnife, ammoBefore, snap, thrown, weapon) {
    const tags = [], pens = [];
    let mult = 1;
    const add = (name, f) => { mult *= f; (f < 1 ? pens : tags).push(name + " x" + f.toFixed(2)); };
    const st = snap || trickState();
    // standing still means not going anywhere: hopping in place counts, a pad or ramp flight you ran onto doesn't
    const still = !st.sliding && !st.launched && st.speed < CFG.standingStillSpeed;

    if (!st.onGround && !still) add("AIR", CFG.airMult);

    // spins: each full 360 multiplies again (up to spinMaxCount), a lone 180 gets a smaller one
    const fullSpins = Math.floor(st.spin / (Math.PI * 2));
    if (fullSpins >= 1) add(fullSpins * 360 + "° SPIN", Math.pow(CFG.spinMultPer360, Math.min(fullSpins, CFG.spinMaxCount)));
    else if (st.spin >= Math.PI) add("180°", CFG.spin180Mult);
    const spun = st.spin >= Math.PI;

    // distance: a knife swing is meant to be close, so it skips this
    if (!(isKnife && !thrown)) { const df = distanceFactor(dist); if (Math.abs(df[1] - 1) > 0.005) add(df[0], df[1]); }

    if (isKnife && !thrown && CFG.knifeMult !== 1) add("KNIFE", CFG.knifeMult);
    else if (isKnife) { if (CFG.thrownKnifeMult !== 1) add("THROWN KNIFE", CFG.thrownKnifeMult); }
    else {
      // the sniper's tags go by aiming, not by what is fitted: from the hip is a no-scope, iron sights or scope
      if (weapon && weapon.sniper && vm.adsProgress < 0.35 && dist >= CFG.noScopeMinDist) add("NO-SCOPE", CFG.noScopeMult);
      else if (weapon && weapon.sniper && vm.adsProgress >= 0.5 && (elapsedTime - vm.adsStartTime) <= CFG.quickscopeWindow) {
        add("QUICKSCOPE", CFG.quickscopeMult);   // scoped in and fired almost immediately
      }
      // the last round of a full magazine, once (a shotgun firing its one reloaded shell doesn't count)
      if (ammoBefore === 1 && weapon && weapon.lastRoundReady && !SETTINGS.unlimitedAmmo) add("LAST ROUND", CFG.lastRoundMult);
    }

    const spd = speedFactor(st.speed);
    if (spd) add(spd[0], spd[1]);
    const hang = Math.min(1 + (st.airTime - CFG.hangTimeFrom) * CFG.hangTimeMultPerSec, CFG.hangTimeMultMax);
    if (hang > 1.005) add("HANG TIME " + st.airTime.toFixed(1) + "s", hang);
    if (st.launch) add(st.launch === "mega" ? "MEGA LAUNCH" : st.launch === "ramp" ? "RAMP LAUNCH" : "LAUNCHED", st.launch === "mega" ? CFG.megaLaunchMult : CFG.launchMult);
    if (!spun) {   // a spin isn't paid twice
      if (st.snapFlick >= CFG.snapFlickAngle) add("SNAP FLICK " + Math.round(st.snapFlick) + "°", CFG.snapFlickMult);
      else if (st.flick >= CFG.flickAngle) add("FLICK " + Math.round(st.flick) + "°", CFG.flickMult);
    }
    if (st.quickSwitch) add("QUICK SWITCH", CFG.quickSwitchMult);
    if (st.reverse) add("REVERSE", CFG.reverseMult);
    if (st.blast && BLAST_JUMP[st.blast]) add(BLAST_JUMP[st.blast][0], CFG[BLAST_JUMP[st.blast][1]]);

    // air combo: every hit from the same jump counts up
    if (!st.onGround && st.airId !== undefined) {
      if (st.airId === comboAirId) comboCount++; else { comboAirId = st.airId; comboCount = 1; }
      if (comboCount >= 2) {
        add(["DOUBLE", "TRIPLE", "QUAD"][comboCount - 2] || comboCount + "-HIT COMBO", Math.min(1 + (comboCount - 1) * CFG.comboMultPer, CFG.comboMultMax));
      }
    }

    if (st.sliding) add("SLIDING", CFG.slideMult);
    if (st.wallRide) add("WALL BOUNCE", CFG.wallRideMult);
    if (st.grapple) add("GRAPPLE", CFG.grappleMult);
    if (st.portal) add("PORTAL SHOT", CFG.portalMult);
    if (st.strip) add("STRIP SHOT", CFG.stripMult);
    if (st.onMover) add("PLATFORM SHOT", CFG.platformMult);
    if (st.zeroG) add("ZERO-G", CFG.zeroGMult);
    if (st.chain >= 2) add("CHAIN " + st.chain, Math.min(1 + (st.chain - 1) * CFG.chainMultPer, CFG.chainMultMax));

    // target size: precision a knife swing at arm's length doesn't need
    const kind = target.userData.type;
    if (!(isKnife && !thrown)) {
      if (kind === "tiny") add("MICRO TARGET", CFG.tinyTargetMult);
      else if (kind === "small") add("PINPOINT", CFG.smallTargetMult);
    }
    if (target.userData.moving && kind !== "tiny") add("MOVING TARGET", CFG.movingTargetMult);

    if (streak > 0) add("STREAK " + (streak + 1), Math.min(1 + streak * CFG.streakMultPer, CFG.streakMultMax));

    {   // the first time this run for each trick: a bonus for variety
      const fresh = [];
      for (const t of tags) { const k = collectKey(t); if (k && COLLECTABLE.has(k) && !trickSeen.has(k) && !fresh.includes(k)) fresh.push(k); }
      for (const k of fresh) trickSeen.add(k);
      if (fresh.length) add("NEW " + fresh.length, Math.min(1 + fresh.length * CFG.newTrickMultPer, CFG.newTrickMultMax));
    }
    if (still) add("STANDING STILL", CFG.standingStillMult);
    if (!SETTINGS.realisticShooting) add("UNREALISTIC", CFG.unrealisticMult);   // perfect accuracy is worth less
    // spraying: a shot that follows the last one at the gun's full-auto rate (before this shot's recoil is added)
    if (weapon && weapon.auto && !isKnife) {
      const inSpray = elapsedTime - vm.lastShotAt < Math.max(weapon.fireRate * 1.8, 0.25);
      const n = inSpray ? vm.burstShots + 1 : 0;
      const f = CFG.sprayMults[Math.min(n, CFG.sprayMults.length - 1)];
      if (f < 1) add("SPRAY", f);
    }
    // the gun's share of a sniper's points is a multiplier too, so the total always equals points / 100
    if (weapon && weapon.scoreScale !== undefined && weapon.scoreScale < 1) add(weapon.name, weapon.scoreScale);

    return { mult, tags, pens, dist, scale: 1 };
  }

  // ---- the trickshot list: a popup from the menu, built from the values above so it never goes stale ----
  function buildGlossary() {
    const x = (n) => "x" + String(+n.toFixed(3));
    const C = CFG;
    const groups = [
      ["Movement", [
        ["AIR", x(C.airMult), "Any hit while you're off the ground and moving (a hop in place doesn't count)."],
        ["HANG TIME", "up to " + x(C.hangTimeMultMax), "After " + C.hangTimeFrom + " s in the air, +" + C.hangTimeMultPerSec + "x per extra second."],
        ["180° / 360° SPIN", x(C.spin180Mult) + " / " + x(C.spinMultPer360) + " each", "Turn around in the air before the shot; every full 360° multiplies again, up to " +
          C.spinMaxCount * 360 + "° (x" + Math.pow(C.spinMultPer360, C.spinMaxCount).toFixed(2) + "). A spin shot doesn't also count as a FLICK."],
        ["SLIDING", x(C.slideMult), "Hit while sliding."],
        ["WALL BOUNCE", x(C.wallRideMult), "Hit within " + C.wallRideScoreWindow + " s of a wall bounce."],
        ["GRAPPLE", x(C.grappleMult), "Hit within " + C.grappleScoreWindow + " s of letting go of the grappling hook (the gun is away while you are hooked on)."],
        ["LAUNCHED / RAMP LAUNCH", x(C.launchMult), "Hit while still rising off a jump pad or a kicker ramp (not after a wall bounce)."],
        ["MEGA LAUNCH", x(C.megaLaunchMult), "Hit while still rising off a mega (purple) pad."],
        ["FAST / BLAZING / SONIC", "up to " + x(Math.min(1 + (C.maxSpeed - C.speedFrom) * C.speedMultPer, C.speedMultMax)), "+" + C.speedMultPer + "x per u/s over " + C.speedFrom + " u/s; the tag shows your speed." +
          (MAPS.icelake && MAPS.icelake.physics.maxSpeed ? " Ice Lake lets you go faster (" + MAPS.icelake.physics.maxSpeed + " u/s), so its top is x" + MAPS.icelake.physics.speedMultMax.toFixed(2) + "." : "")],
        ["REVERSE", x(C.reverseMult), "In the air, having turned 90°+ since takeoff, flying at " + C.reverseSpeed + "+ u/s away from where you aim. Backpedalling doesn't count."],
        ["ROCKET / LAUNCHER / GRENADE / PACK JUMP", x(C.rocketJumpMult) + " / " + x(C.launcherJumpMult) + " / " + x(C.grenadeJumpMult) + " / " + x(C.packJumpMult),
          "Hit while still in the air from the shove of your own blast (RPG, launcher grenade, thrown grenade, blast pack). It has to throw you at least " + C.blastJumpMinPush + " u/s, so stand close."],
      ]],
      ["Aim", [
        ["MID RANGE / LONG SHOT / MEGA SNIPE", "no cap", "+" + C.distanceMultPerM + "x per meter past " + C.distanceFrom + " m: " +
          x(1 + 15 * C.distanceMultPerM) + " at 30 m, " + x(1 + 35 * C.distanceMultPerM) + " at 50 m, " + x(1 + 65 * C.distanceMultPerM) + " at 80 m."],
        ["NO-SCOPE", x(C.noScopeMult), "Sniper, fired from the hip (not aiming), from " + C.noScopeMinDist + " m or more. With Realistic shooting on, hip shots spread a little, and moving spreads every gun."],
        ["QUICKSCOPE", x(C.quickscopeMult), "Sniper, fired within " + C.quickscopeWindow + " s of aiming in (iron sights or a scope)."],
        ["FLICK", x(C.flickMult), "Turn your aim " + C.flickAngle + "° or more in the last " + C.flickWindow + " s before the hit."],
        ["SNAP FLICK", x(C.snapFlickMult), C.snapFlickAngle + "° or more in the last " + C.snapFlickWindow + " s: a faster, bigger flick (instead of FLICK)."],
        ["QUICK SWITCH", x(C.quickSwitchMult), "Hit within " + C.quickSwitchWindow + " s of finishing a weapon swap, with a gun that hadn't just fired."],
        ["LAST ROUND", x(C.lastRoundMult), "The final round of a full magazine (not with unlimited ammo)."],
      ]],
      ["Knife", [
        ["KNIFE SWING", x(C.knifeMult), "No multiplier of its own: a swing scores on its tricks (air, spins, speed, flicks, combos...). Swings skip the distance and target-size multipliers."],
        ["THROWN KNIFE", x(C.thrownKnifeMult), "No multiplier of its own either: a throw scores on its tricks and its distance."],
      ]],
      ["Targets", [
        ["MOVING TARGET", x(C.movingTargetMult), "Orange targets."],
        ["PINPOINT", x(C.smallTargetMult), "Small blue targets."],
        ["MICRO TARGET", x(C.tinyTargetMult), "Tiny purple targets, which also dart away when you get close."],
      ]],
      ["Combos", [
        ["DOUBLE / TRIPLE / QUAD", x(1 + C.comboMultPer) + " / " + x(1 + 2 * C.comboMultPer) + " / " + x(1 + 3 * C.comboMultPer), "Extra hits in the same jump, before you land (up to " + x(C.comboMultMax) + ")."],
        ["STREAK", "up to " + x(C.streakMultMax), "+" + C.streakMultPer + "x for each hit in a row. A gun shot or thrown knife that misses ends it."],
      ]],
      ["Penalties", [
        ["CLOSE", x(C.pointBlankMult) + " to x1", "Closer than " + C.distanceFrom + " m, harshest at " + C.pointBlankMin + " m. Knife swings are exempt."],
        ["STANDING STILL", x(C.standingStillMult), "Moving under " + C.standingStillSpeed + " u/s when you fire, hopping in place included. A pad or ramp flight you ran onto doesn't count."],
        ["PORTAL SHOT", x(C.portalMult), "A hit within " + C.portalScoreWindow + " s of coming out of a portal."],
        ["STRIP SHOT", x(C.stripMult), "A hit within " + C.stripScoreWindow + " s of a launch strip throwing you."],
        ["PLATFORM SHOT", x(C.platformMult), "A hit while riding a lift or the shuttle."],
        ["ZERO-G", x(C.zeroGMult), "A hit after " + C.zeroGAirTime + " s in the air on a low-gravity map."],
        ["CHAIN", x(1 + C.chainMultPer) + " to " + x(C.chainMultMax), "Different movement tricks (slide, wall bounce, grapple, pad or ramp launch, portal, launch strip, lift, blast jump) within " + C.chainWindow + " s: +" + C.chainMultPer + "x for each one after the first."],
        ["NEW", "+" + C.newTrickMultPer + "x each, up to " + x(C.newTrickMultMax), "The first time in a run you land a trick you haven't landed yet this run. Variety pays."],
        ["UNREALISTIC", x(C.unrealisticMult), "Realistic shooting is turned off in Settings > Gameplay, so every shot lands exactly where you aim."],
        ["SPRAY", x(C.sprayMults[1]) + " / " + x(C.sprayMults[2]), "Rifle and AK: the 2nd shot of a full-auto spray, then every shot after. Tap-firing doesn't count."],
      ], true],
      ["Your gun's share (the sniper scores in full)", GUNS.filter((id) => WEAPONS[id].scoreScale < 1).map((id) =>
        [WEAPONS[id].name, x(WEAPONS[id].scoreScale), "Multiplies every hit with this gun."]), true],
    ];
    document.getElementById("glossary-note").textContent = "Every trick multiplies the shot: AIR " + x(C.airMult) + " and FLICK " +
      x(C.flickMult) + " together make " + x(C.airMult * C.flickMult) + ". Penalties, in red, multiply it down. Points = 100 x the total.";
    const list = document.getElementById("glossary-list");
    for (const [title, rows, pen] of groups) {
      const h = document.createElement("h3");
      h.textContent = title;
      list.appendChild(h);
      for (const [name, val, how] of rows) {
        const row = document.createElement("div");
        row.className = "g-row" + (pen ? " pen" : "");
        for (const [cls, text] of [["g-name", name], ["g-val", val], ["g-how", how]]) {
          const c = document.createElement("div");
          c.className = cls; c.textContent = text;
          row.appendChild(c);
        }
        list.appendChild(row);
      }
    }
  }
  buildGlossary();
  const glossaryEl = document.getElementById("glossary");
  function setGlossary(open) { glossaryEl.hidden = !open; }
  document.getElementById("glossary-open").addEventListener("click", (e) => { e.stopPropagation(); setGlossary(true); });
  document.getElementById("glossary-close").addEventListener("click", () => setGlossary(false));
  glossaryEl.addEventListener("click", (e) => { if (e.target === glossaryEl) setGlossary(false); });   // the backdrop
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !glossaryEl.hidden) setGlossary(false); });

  // Settings: a popup over the menu
  const settingsPopupEl = document.getElementById("settings-popup");
  const settingsOpenBtn = document.getElementById("settings-open");
  let settingsSeen = false;
  try { settingsSeen = !!localStorage.getItem("tsb-settings-seen"); } catch (e) { /* ignore */ }
  settingsOpenBtn.classList.toggle("glow", !settingsSeen);   // until it has been opened once, so nobody hunts for it
  function setSettingsPopup(open) {
    settingsPopupEl.hidden = !open;
    if (!open) stopListening();
    else if (!settingsSeen) { settingsSeen = true; settingsOpenBtn.classList.remove("glow"); try { localStorage.setItem("tsb-settings-seen", "1"); } catch (e) { /* ignore */ } }
  }
  document.getElementById("settings-open").addEventListener("click", (e) => { e.stopPropagation(); setSettingsPopup(true); });
  document.getElementById("mp-settings-open").addEventListener("click", (e) => { e.stopPropagation(); setSettingsPopup(true); });   // (settings from inside a room too)
  document.getElementById("settings-close").addEventListener("click", () => setSettingsPopup(false));
  // Back up and restore: everything the game keeps in this browser as one file. An imported file is checked key by key and
  // value by value before it replaces anything (and the game's own loaders check again when it starts).
  const DATA_JSON_KEYS = ["tsb-tips", "tsb-settings", "tsb-best-shot", "tsb-best-replay", "tsb-stats", "tsb-achievements", "tsb-score-attack", "tsb-map-records"];
  const DATA_KEYS = DATA_JSON_KEYS.concat(["tsb-tutorial", "tsb-name", "tsb-settings-seen"]);
  const importNoteEl = document.getElementById("data-import-note"), importApplyEl = document.getElementById("data-import-apply");
  let importClean = null;
  function exportData() {
    const data = {};
    try { for (const k of DATA_KEYS) { const v = localStorage.getItem(k); if (typeof v === "string") data[k] = v; } } catch (e) { /* storage blocked */ }
    const blob = new Blob([JSON.stringify({ app: "trickshot-sandbox", v: 1, exported: new Date().toISOString().slice(0, 10), data })], { type: "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "trickshot-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    importNoteEl.textContent = "Saved a backup of " + Object.keys(data).length + " items.";
  }
  function checkImport(text) {   // returns the clean { key: string } or an error message
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return "That isn't a backup file (it isn't valid JSON)."; }
    if (!obj || typeof obj !== "object" || obj.app !== "trickshot-sandbox" || obj.v !== 1 || !obj.data || typeof obj.data !== "object") return "That isn't a Trickshot Sandbox backup.";
    const clean = {};
    for (const k of DATA_KEYS) {
      const v = obj.data[k];
      if (v === undefined) continue;
      if (typeof v !== "string" || v.length > 4800000) return "The file has a value for " + k + " that doesn't look right.";
      if (DATA_JSON_KEYS.includes(k)) { try { const j = JSON.parse(v); if (!j || typeof j !== "object") throw new Error("x"); } catch (e) { return "The file has a value for " + k + " that doesn't look right."; } }
      else if (k === "tsb-tutorial" && v !== "started" && v !== "done") return "The file has a value for " + k + " that doesn't look right.";
      else if (k === "tsb-settings-seen" && v !== "1") return "The file has a value for " + k + " that doesn't look right.";
      else if (k === "tsb-name" && !/^[\w \-]{0,14}$/.test(v)) return "The file has a value for " + k + " that doesn't look right.";
      clean[k] = v;
    }
    return Object.keys(clean).length ? clean : "The file has none of the game's saved data in it.";
  }
  // ---- About and help: the version, and a text a player can copy and send when something looks wrong ----
  const aboutLine = document.getElementById("about-line");
  if (aboutLine) aboutLine.textContent = "Trickshot Sandbox v" + GAME_VERSION + " \u00b7 three.js r" + THREE.REVISION;
  function debugInfo() {
    let storage = "yes";
    try { localStorage.setItem("tsb-probe", "1"); localStorage.removeItem("tsb-probe"); } catch (e) { storage = "blocked"; }
    const lines = [
      "Trickshot Sandbox v" + GAME_VERSION + " (three.js r" + THREE.REVISION + ")",
      "Page: " + location.origin + location.pathname,
      "Browser: " + navigator.userAgent,
      "Window: " + window.innerWidth + "x" + window.innerHeight + " at " + (window.devicePixelRatio || 1) + "x",
      "Graphics: " + SETTINGS.quality + (SETTINGS.quality === "auto" ? " (now " + gfxLevel + ")" : "") + ", about " + lastFps + " fps, field of view " + SETTINGS.fov,
      "Map: " + (currentMap ? currentMap.id : "?") + ", " + (net.active ? modeName() : "single player (" + SETTINGS.playMode + ")") + (net.practice ? " with " + net.botCount + " bots" : ""),
      "Sound: " + (audioFailed ? "unavailable in this browser" : audioCtx ? "on" : "not started yet") + ", saving: " + storage + ", gamepad: " + (navigator.getGamepads && Array.from(navigator.getGamepads()).some(Boolean) ? "connected" : "none"),
      "Errors: " + (problems.length ? "" : "none"),
    ];
    for (const p of problems) lines.push("  - " + p.msg + (p.where ? " (" + p.where + ")" : "") + (p.n > 1 ? " x" + p.n : ""));
    return lines.join("\n");
  }
  function copyText(text, done) {
    const fallback = () => { try { const t = document.getElementById("debug-info"); t.hidden = false; t.value = text; t.select(); done(document.execCommand && document.execCommand("copy")); } catch (e) { done(false); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), fallback); else fallback();
  }
  document.getElementById("debug-copy").addEventListener("click", (e) => {
    const text = debugInfo(), box = document.getElementById("debug-info"), btn = e.currentTarget;
    box.value = text; box.hidden = false;
    copyText(text, (ok) => { btn.textContent = ok ? "Copied" : "Copy it from the box"; setTimeout(() => { btn.textContent = "Copy debug info"; }, 2000); });
  });
  document.getElementById("problem-copy").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    copyText(debugInfo(), (ok) => { btn.textContent = ok ? "Copied" : "Copy failed"; setTimeout(() => { btn.textContent = "Copy details"; }, 2000); });
  });
  document.getElementById("problem-close").addEventListener("click", () => { problemDismissed = true; document.getElementById("problem-bar").hidden = true; });
  document.getElementById("data-export").addEventListener("click", exportData);
  document.getElementById("data-import").addEventListener("click", () => document.getElementById("data-import-file").click());
  document.getElementById("data-import-file").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    importApplyEl.hidden = true; importClean = null;
    if (!file) return;
    if (file.size > 6000000) { importNoteEl.textContent = "That file is too big to be a backup."; return; }
    const res = checkImport(await file.text());
    if (typeof res === "string") { importNoteEl.textContent = res; return; }
    importClean = res;
    importNoteEl.textContent = "This backup has " + Object.keys(res).length + " items. Replacing your data with it can't be undone.";
    importApplyEl.hidden = false;
  });
  importApplyEl.addEventListener("click", () => {
    if (!importClean) return;
    try { sessionStorage.setItem("tsb-import", JSON.stringify(importClean)); }
    catch (e) { try { for (const k of Object.keys(localStorage)) if (k.startsWith("tsb-")) localStorage.removeItem(k); for (const k of Object.keys(importClean)) localStorage.setItem(k, importClean[k]); } catch (e2) { /* ignore */ } }
    location.reload();
  });

  // Erase all data: ask twice, then everything saved in this browser for the game goes
  const eraseBtn = document.getElementById("erase-all");
  let eraseTimer = 0;
  function disarmErase() { clearTimeout(eraseTimer); eraseTimer = 0; eraseBtn.textContent = "Erase all data\u2026"; eraseBtn.classList.remove("armed"); }
  eraseBtn.addEventListener("click", () => {
    if (!eraseTimer) {
      eraseBtn.textContent = "Click again to erase everything"; eraseBtn.classList.add("armed");
      eraseTimer = setTimeout(disarmErase, 5000);
      return;
    }
    disarmErase();
    try { sessionStorage.setItem("tsb-wipe", "1"); }
    catch (e) { try { for (const k of Object.keys(localStorage)) if (k.startsWith("tsb-")) localStorage.removeItem(k); } catch (e2) { /* ignore */ } }
    location.reload();
  });
  settingsPopupEl.addEventListener("click", (e) => { if (e.target !== eraseBtn) disarmErase(); });
  settingsPopupEl.addEventListener("click", (e) => { if (e.target === settingsPopupEl) setSettingsPopup(false); });   // the backdrop
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !settingsPopupEl.hidden && !listening) setSettingsPopup(false); });

  // score, streak, HUD popups and feedback for any scoring hit (target or player)
  function awardPoints(res, silent) {   // silent: the caller plays its own hit sound
    const pointsGained = Math.round(CFG.basePoints * res.mult * (res.scale || 1));
    score += pointsGained;
    scoreEl.textContent = score;
    streak++;
    streakEl.textContent = streak;
    let mapBest = false;   // beat an earlier best on this map (the first shot on a map is not announced)
    if (mapRecsOn()) {
      const mr = mapRecFor(currentMap.id);
      let changed = false;
      if (streak > mr.streak) { mr.streak = streak; changed = true; }
      if (pointsGained > (mr.shot ? mr.shot.points : 0)) {
        mapBest = !!mr.shot;
        mr.shot = { points: pointsGained, mult: res.mult, tags: res.tags.slice(), pens: (res.pens || []).slice(), dist: res.dist };
        changed = true;
      }
      if (changed) saveMapRecs();
    }

    showBonusTags(res.mult, res.tags, res.pens || [], res.dist);
    flashCrosshair();
    hitStopTimer = SETTINGS.reduceMotion ? 0 : CFG.hitStopTime;
    if (!silent) playHitSound(Math.min(1 + (res.mult - 1) * 0.16, 2.4));
    showFeed("+" + pointsGained + "  " + res.mult.toFixed(2) + "x" + (mapBest ? "  \u2605 MAP BEST" : ""));
    statHit(res, pointsGained);
    tutHit(res);
    lastAward = { best: pointsGained > bestShot.points, runBest: false };
    if (run.state === "live") {
      run.hits++;
      if (!run.best || pointsGained > run.best.points) {
        lastAward.runBest = true;
        run.best = { points: pointsGained, mult: res.mult, tags: res.tags.slice(), pens: (res.pens || []).slice(), dist: res.dist };
      }
    }
    if (pointsGained > bestShot.points) {
      bestShot = { points: pointsGained, mult: res.mult, tags: res.tags.slice(), pens: (res.pens || []).slice(), dist: res.dist };
      saveBestShot();
      showBestShot(true);
    }
    return pointsGained;
  }

  function scoreHit(target, dist, isKnife, ammoBefore, snap, thrown, weapon) {
    if (run.state === "done" || run.state === "countdown") return;   // a knife still in the air when time runs out
    const res = computeMultipliers(target, dist, isKnife, ammoBefore, snap, thrown, weapon);
    target.userData.alive = false;
    knockOutTarget(target);
    burst(target.position, new THREE.Color(TARGET_TYPES[target.userData.type].color).getHex(), target.userData.small ? 8 : 6);
    const pointsGained = awardPoints(res);
    stats.kinds[target.userData.type] = (stats.kinds[target.userData.type] || 0) + 1;
    if (isKnife && !thrown) stat("knifeSwingHits");
    else { statMax("longestShot", dist); if (thrown) stat("knifeThrowHits"); else gunStat(weapon ? weapon.id : vm.current).points += pointsGained; }
    achHit(res, target.userData.type, isKnife, thrown, dist);
    recHit(target, dist, isKnife, thrown, res, pointsGained);
    target.userData.respawnTimer = 1.1;
    if (net.active) mpTargetHit(target, pointsGained);
  }

  // the knife's hit, landed at the swing's contact point, along wherever you're aiming then
  function meleeStrike() {
    const w = currentWeapon();
    if (!w.isMelee) return;
    camera.getWorldDirection(raycaster.ray.direction);
    raycaster.ray.origin.setFromMatrixPosition(camera.matrixWorld);
    raycaster.far = w.range;
    const occ = occluderDistance(w.range);
    const res = raycastTargets(w.range);
    if (res.dist >= occ) res.target = null;
    const propHits = raycaster.intersectObjects(activeProps(), false).filter((h) => h.distance < occ);
    const pres = raycastPlayers(w.range);
    let hit = true;
    if (pres.p && pres.dist < occ) {
      playKnifeHit();
      mpPvpHit(pres, true, 0);
    } else if (res.target && (!propHits.length || res.dist < propHits[0].distance)) {
      playKnifeHit();
      scoreHit(res.target, res.dist, true, 0);
    } else if (propHits.length) {
      const prop = props.find((p) => p.mesh === propHits[0].object);
      if (prop) {
        prop.velocity.addScaledVector(raycaster.ray.direction, CFG.shotForce * 1.6);
        prop.velocity.y += 3.5;
      }
      playKnifeHit();
      burst(propHits[0].point, 0xd2a679, 5);
      flashCrosshair();
    } else {
      hit = false;
    }
    if (hit) { vm.camKick = Math.max(vm.camKick, 0.35); vm.camKickYaw = vm.swingKind === "back" ? 1 : -1; }
  }

  const _muzzleWorld = new THREE.Vector3();
  const _impactPt = new THREE.Vector3();

  function attack() {
    if (run.state === "countdown" || run.state === "done") return;
    const w = currentWeapon();
    if (fireCooldown > 0 || vm.switchTimer > 0 || vm.grappleOut > 0.25) return;
    if (net.active && (localDead || net.phase !== "play" || countingDown())) return;

    if (w.usesAmmo && !SETTINGS.unlimitedAmmo) {
      if (reload.active) {
        if (reload.shells && w.ammo > 0) cancelReload();   // shotgun: fire to stop loading
        else return;
      }
      if (w.ammo <= 0) { playDryFire(); fireCooldown = 0.25; startReload(); return; }
    } else if (reload.active) {
      cancelReload();
    }

    fireCooldown = w.fireRate;
    vm.inspectTimer = 0;
    localProtectUntil = 0;

    camera.getWorldDirection(raycaster.ray.direction);
    raycaster.ray.origin.setFromMatrixPosition(camera.matrixWorld);

    if (w.isMelee) {
      vm.swingIndex = (vm.swingIndex + 1) % SWING_ORDER.length;
      vm.swingKind = SWING_ORDER[vm.swingIndex];
      vm.slashTimer = w.slashDuration;
      vm.meleePending = true;
      playKnifeSwing();
      if (net.active) sendToHost({ t: "swing" });
      return;
    }
    if (w.projectile === "grenade") { fireBlastGun("launcher", w); return; }
    if (w.projectile === "rocket") { fireBlastGun("rpg", w); return; }
    if (w.projectile) { fireBolt(w); return; }
    fireGun(w);
    if (w.burst) { vm.burstQueue = w.burst - 1; vm.burstTimer = w.burstGap; }   // the rest of the burst follows by itself
  }

  const _aimDir = new THREE.Vector3(), _pelletDir = new THREE.Vector3();

  // Recoil climbs the aim with every shot, more with each shot of a burst, and wanders sideways;
  // it settles back once you stop. Shots count as one burst while they come at the gun's rate.
  function addRecoil(w) {
    const R = w.recoilKick;
    if (!R) return;
    const inBurst = elapsedTime - vm.lastShotAt < Math.max(w.fireRate * 1.8, 0.25);
    vm.burstShots = inBurst ? vm.burstShots + 1 : 0;
    vm.lastShotAt = elapsedTime;
    let steady = 1 - 0.2 * easeInOut(vm.adsProgress);   // aiming down sights steadies it a little
    if (player.onGround && held("slide")) steady *= CFG.crouchRecoilMult * (w.bipodK || 1);   // and so does crouching (a bipod makes that much steadier)
    vm.recoilPitch = Math.min(vm.recoilPitch + (R.up + R.grow * vm.burstShots) * steady, R.max);
    const side = R.side * (1 + vm.burstShots * 0.15) * steady;
    vm.recoilYaw = Math.max(-R.max * 0.5, Math.min(R.max * 0.5, vm.recoilYaw + (Math.random() * 2 - 1) * side));
  }

  // a miss ends the streak (in deathmatch only dying does)
  function breakStreak() {
    if (net.active && net.sub === "dm") return;
    streak = 0; streakEl.textContent = streak;
  }

  function fireGun(w) {
    const ammoBefore = w.ammo;
    if (ammoBefore >= w.magSize) w.lastRoundReady = true;   // LAST ROUND needs a full magazine emptied
    if (!SETTINGS.unlimitedAmmo) { w.ammo--; updateAmmoHud(); }
    playShotSound(w.sound, w.soundMult || 1);
    vm.recoil = w.recoil;
    vm.camKick = w.kick;
    vm.camKickYaw = Math.random() * 2 - 1;
    vm.flashTimer = FLASH_TIME;
    muzzleFlash.rotation.z = Math.random() * Math.PI;
    const chambered = SETTINGS.unlimitedAmmo || w.ammo > 0;
    if (w.action === "bolt") {
      vm.spentCasing = true;
      if (chambered) startBoltCycle();   // an empty mag skips to the reload, which works the bolt itself
    } else if (w.action === "pump") {
      vm.spentCasing = true;
      if (chambered) startPump();
    }
    if (w.action === "slide") vm.slideTime = 0;
    if (w.ejectOnShot) ejectFrom(w);

    // aim, plus this gun's spread: tighter aiming down sights, wider while the AR blooms
    const ads = easeInOut(vm.adsProgress);
    let cone = (w.spread + (w.spreadAds - w.spread) * ads) + (w.bloomNow || 0);
    if (SETTINGS.realisticShooting) {
      if (w.sniper) cone += CFG.realisticHipSpread * (1 - ads);
      if (player.onGround) {
        const moveK = Math.min(Math.max((Math.hypot(player.velocity.x, player.velocity.z) - 0.5) / (CFG.realisticMoveFullSpeed - 0.5), 0), 1);
        cone += CFG.realisticMoveSpread * moveK * (1 - 0.5 * ads);
      } else {
        cone += CFG.realisticAirSpread + CFG.realisticMoveSpread * (1 - 0.5 * ads);   // worst in the air
      }
    }
    if (w.bloom) w.bloomNow = Math.min((w.bloomNow || 0) + w.bloom, w.bloomMax);
    const maxD = w.range || CFG.maxShootDistance;
    camera.getWorldDirection(_aimDir);
    // the view shows only part of the recoil, so bullets go the rest of the way past the crosshair
    const extraPitch = vm.recoilPitch - vm.viewRecoilPitch, extraYaw = vm.recoilYaw - vm.viewRecoilYaw;
    if (extraPitch || extraYaw) {
      _sprRight.set(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(_camQuat));
      _aimDir.applyAxisAngle(_sprRight, extraPitch).applyAxisAngle(_worldUp, extraYaw);
    }
    muzzleFlash.getWorldPosition(_muzzleWorld);
    muzzleSmoke(_muzzleWorld, _aimDir, w.smoke);

    const targetHits = new Map();   // a target hit by several pellets scores once
    let anyHit = false, pvp = null, puffs = 0, pvpN = 0, pvpH = 0;   // pvpN/pvpH: pellets that hit that player, and how many in the head
    for (let i = 0; i < w.pellets; i++) {
      spreadDirection(_aimDir, cone, _pelletDir);
      raycaster.ray.direction.copy(_pelletDir);
      raycaster.far = maxD;
      const occ = occluderDistance(maxD);
      const res = raycastTargets(maxD);
      if (res.dist >= occ) res.target = null;
      const propHits = raycaster.intersectObjects(activeProps(), false).filter((h) => h.distance < occ);
      const pres = raycastPlayers(maxD);
      const playerHit = pres.p && pres.dist < occ && (!propHits.length || pres.dist < propHits[0].distance);
      let impactDist = Math.min(occ, maxD);
      if (playerHit) impactDist = pres.dist;
      else if (res.target && (!propHits.length || res.dist < propHits[0].distance)) impactDist = res.dist;
      else if (propHits.length) impactDist = propHits[0].distance;
      // tracers from the muzzle to wherever the shot lands (a few per shotgun blast)
      if (i < 3) {
        spawnTracer(_muzzleWorld, _pelletDir, impactDist);
        recEvent({ type: "shot", w: vm.current, snd: i === 0, o: v3(_muzzleWorld), d: [r4(_pelletDir.x), r4(_pelletDir.y), r4(_pelletDir.z)], l: r2(impactDist) });
      }
      if (i === 0) lastShotOrigin.copy(_muzzleWorld);
      if (i === 0 && net.active) mpSendShot(_muzzleWorld, _pelletDir, impactDist);

      if (playerHit) {
        anyHit = true;
        if (!pvp) pvp = pres;
        if (pres.p === pvp.p) { pvpN++; if (pres.head) pvpH++; }
      } else if (res.target && (!propHits.length || res.dist < propHits[0].distance)) {
        anyHit = true;
        if (!targetHits.has(res.target) || targetHits.get(res.target) > res.dist) targetHits.set(res.target, res.dist);
      } else if (propHits.length) {
        anyHit = true;
        const prop = props.find((pp) => pp.mesh === propHits[0].object);
        if (prop) {
          prop.velocity.addScaledVector(_pelletDir, CFG.shotForce * (w.pellets > 1 ? 0.35 : 1));
          prop.velocity.y += w.pellets > 1 ? 0.6 : 2;
        }
        if (puffs++ < 4) burst(propHits[0].point, 0xd2a679, w.pellets > 1 ? 2 : 5);
      } else if (impactDist < maxD) {
        _impactPt.copy(raycaster.ray.origin).addScaledVector(_pelletDir, impactDist);
        spawnDecal(_impactPt, _occNormal, w.pellets > 1 ? 0.045 : w.sniper ? 0.085 : 0.06);
        if (puffs++ < 4) burst(_impactPt, 0xb8c0c8, w.pellets > 1 ? 2 : 4);
      }
    }

    if (pvp) mpPvpHit(pvp, false, ammoBefore, w, undefined, false, pvpN, pvpH);
    for (const [target, dist] of targetHits) scoreHit(target, dist, false, ammoBefore, undefined, false, w);
    if (anyHit && !targetHits.size && !pvp) flashCrosshair();
    if (!targetHits.size && !pvp) breakStreak();   // hitting only a crate or a wall is a miss
    if (run.state === "live") { run.shots++; if (targetHits.size) run.shotsHit++; }
    if (!net.active) {
      const gs = gunStat(vm.current);
      gs.shots++; stat("shots");
      if (targetHits.size) { gs.hits++; stat("shotsHit"); announceUnlocks(vm.current, gs.hits); }
    }
    if (ammoBefore === 1) w.lastRoundReady = false;
    w.lastFiredAt = elapsedTime;

    addRecoil(w);   // after the shot: the next one is what gets kicked
    if (!SETTINGS.unlimitedAmmo && w.ammo <= 0) autoReloadTimer = 0.25;
  }

  // ======================================================================
  // THROWN KNIVES (unlimited, on a cooldown; each sticks where it lands for a while)
  // ======================================================================
  const THROW_RELEASE = 0.09;   // seconds into the throw motion when the knife leaves the hand
  const KNIFE_SPIN = 24;        // end-over-end spin, radians per second
  const thrownPool = [];
  for (let i = 0; i < 14; i++) {
    const model = knifeGroup.clone();
    model.visible = true;
    model.position.set(0, 0, 0.06);   // spin about the knife's balance point
    const spin = new THREE.Group();
    spin.add(model);
    const boltModel = new THREE.Group();   // the crossbow's bolt shares the pool: it points down -Z like the knife
    addPart(boltModel, new THREE.BoxGeometry(0.014, 0.014, 0.4), metalMid, 0, 0, 0);
    addPart(boltModel, new THREE.ConeGeometry(0.014, 0.05, 8), metalMid, 0, 0, -0.225, -HALF_PI, 0, 0);
    addPart(boltModel, new THREE.BoxGeometry(0.06, 0.003, 0.06), accentMat, 0, 0, 0.17);
    addPart(boltModel, new THREE.BoxGeometry(0.003, 0.06, 0.06), accentMat, 0, 0, 0.17);
    boltModel.visible = false;
    spin.add(boltModel);
    const root = new THREE.Group();
    root.add(spin);
    root.visible = false;
    root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    scene.add(root);
    thrownPool.push({ root, spin, model, boltModel, bolt: false, vel: new THREE.Vector3(), from: new THREE.Vector3(), age: 0, state: "idle", snap: null });
  }

  const _thFwd = new THREE.Vector3(), _thRight = new THREE.Vector3(), _thLook = new THREE.Vector3();
  const BOLT_SPEED = 75, BOLT_GRAVITY = 4, BOLT_LIFE = 1.6, BOLT_CONVERGE = 40;   // metres a second, how hard it drops, seconds in the air (about 100 m), where the muzzle's aim meets the crosshair's
  const setThrownModel = (k, bolt) => { k.bolt = bolt; k.model.visible = !bolt; k.boltModel.visible = bolt; };
  const _boltDir = new THREE.Vector3(), _boltAim = new THREE.Vector3();
  function updateCrossbowDraw() {   // the string springs forward on a shot, comes back during a reload, and stays latched otherwise
    const w = WEAPONS.crossbow;
    if (!w.group.visible) return;
    const tf = elapsedTime - (w.lastFiredAt === undefined ? -99 : w.lastFiredAt), clamp = (x) => Math.min(Math.max(x, 0), 1);
    const spring = (t) => (t < 0.03 ? 1 - t / 0.03 : -0.2 * Math.exp(-(t - 0.03) * 14) * Math.sin((t - 0.03) * 44));   // snaps forward, overshoots, settles
    let d = 1;
    if (reload.active && reload.weapon === "crossbow") d = easeInOut(clamp((reload.elapsed - 0.15) / 0.6));
    else if (w.ammo <= 0 && !SETTINGS.unlimitedAmmo) d = tf < 0.6 ? spring(tf) : 0;
    else if (tf < 0.95) d = tf < 0.35 ? spring(tf) : easeInOut(clamp((tf - 0.35) / 0.55));   // (unlimited ammo: it draws itself again)
    if (Math.abs(d - w.drawNow) > 0.002) { w.drawNow = d; setCrossbowDraw(d); }
  }
  function playBoltShot() {   // the string's twang and a short clack
    tone("triangle", 260, 70, 0.34 * SETTINGS.volGuns, 0.22, 0, 0.3);
    tone("sawtooth", 90, 55, 0.12 * SETTINGS.volGuns, 0.1, 0, 0.2);
    noiseHit(2600, 1.2, 0.18 * SETTINGS.volGuns, 0.05, "highpass", 0, 0.2);
  }
  function fireBolt(w) {
    if (!SETTINGS.unlimitedAmmo) { w.ammo--; updateAmmoHud(); if (w.mag) w.mag.visible = false; }
    playBoltShot();
    vm.recoil = w.recoil; vm.camKick = w.kick; vm.camKickYaw = Math.random() * 2 - 1;
    const ads = easeInOut(vm.adsProgress);
    let cone = w.spread + (w.spreadAds - w.spread) * ads;
    if (SETTINGS.realisticShooting) {
      if (player.onGround) {
        const moveK = Math.min(Math.max((Math.hypot(player.velocity.x, player.velocity.z) - 0.5) / (CFG.realisticMoveFullSpeed - 0.5), 0), 1);
        cone += CFG.realisticMoveSpread * moveK * (1 - 0.5 * ads);
      } else cone += CFG.realisticAirSpread + CFG.realisticMoveSpread * (1 - 0.5 * ads);
    }
    camera.getWorldDirection(_aimDir);
    const extraPitch = vm.recoilPitch - vm.viewRecoilPitch, extraYaw = vm.recoilYaw - vm.viewRecoilYaw;
    if (extraPitch || extraYaw) {
      _sprRight.set(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(_camQuat));
      _aimDir.applyAxisAngle(_sprRight, extraPitch).applyAxisAngle(_worldUp, extraYaw);
    }
    spreadDirection(_aimDir, cone, _pelletDir);
    camera.getWorldPosition(_boltAim).addScaledVector(_pelletDir, BOLT_CONVERGE);
    muzzleFlash.getWorldPosition(_muzzleWorld);
    _boltDir.copy(_boltAim).sub(_muzzleWorld).normalize();   // from the muzzle, toward where the crosshair points
    launchBolt(w, _muzzleWorld, _boltDir);
    if (run.state === "live") run.shots++;
    if (!net.active) { const gs = gunStat("crossbow"); gs.shots++; stat("shots"); }
    w.lastFiredAt = elapsedTime;
    addRecoil(w);
    if (!SETTINGS.unlimitedAmmo && w.ammo <= 0) autoReloadTimer = 0.25;
  }
  function launchBolt(w, origin, dir) {
    const k = thrownPool.find((q) => q.state === "idle") || thrownPool.reduce((a, b) => (a.age > b.age ? a : b));
    if (k.root.parent !== scene) scene.add(k.root);
    k.root.position.copy(origin);
    k.from.copy(origin);
    k.vel.copy(dir).multiplyScalar(BOLT_SPEED).add(player.velocity);
    k.snap = trickState();
    k.remote = false; k.weapon = w; k.age = 0; k.state = "flying";
    setThrownModel(k, true);
    k.root.visible = true;
    k.root.scale.setScalar(1);
    k.spin.rotation.set(0, 0, 0);
    faceAlongVelocity(k);
    recEvent({ type: "throw", b: 1 });
    lastShotOrigin.copy(origin);
    if (net.active) { mpSendShot(origin, dir, 120); mpSendThrow(k.root.position, k.vel, true); }   // the shot message is what lets the host believe a hit; the throw is the bolt others see
  }

  // ======================================================================
  // BLASTS: the launcher's grenade, the thrown grenade (G) and the RPG's rocket. A grenade flies in an arc, bounces off walls and floors and
  // goes off after its fuse or on touching a target or a player; a rocket flies nearly straight and goes off on anything. The blast hurts
  // everything inside its radius (full in the middle, less at the edge, DAMAGE[kind]), shoves you away (a blast jump) and never hurts you.
  // Only the thrower works out who it hit; the host checks the claim ("blast" message) and does the damage itself.
  // ======================================================================
  const BLAST = {
    launcher: { speed: 26, gravity: 16, fuse: 1.8, bounce: 0.45, push: 15 },
    frag: { speed: 22, gravity: 16, fuse: 2.2, bounce: 0.5, push: 12 },
    rpg: { speed: 44, gravity: 1.5, fuse: 4, rocket: true, push: 18 },
    satchel: { speed: 22, gravity: 14, fuse: 4, sticky: true, push: 24 },   // the blast pack (C): sticks where it lands, goes off when you press C again (or after 4 s)
  };
  const BLAST_CODE = { launcher: 2, frag: 3, rpg: 4, satchel: 5 }, BLAST_KIND = { 2: "launcher", 3: "frag", 4: "rpg", 5: "satchel" };   // how a blast travels over the network
  const GREN_RADIUS = 0.12, FRAG_COOLDOWN = 9, PACK_COOLDOWN = 6;
  const grenades = [];
  const grenGeo = new THREE.SphereGeometry(1, 14, 10), grenMat = new THREE.MeshStandardMaterial({ color: 0x4a6342, roughness: 0.6, metalness: 0.3 });
  grenGeo.scale(0.085, 0.13, 0.085); grenGeo.computeVertexNormals();   // an egg: longer than it is wide, like the real thing (the hit sphere stays round)
  const grenBand = new THREE.MeshStandardMaterial({ color: 0xd9b43a, roughness: 0.6 });
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(grenGeo, grenMat);
    const nade = new THREE.Group();   // what sits on the egg: grooves round it, a fuse cap on top and the safety lever down one side
    for (const y of [-0.06, 0, 0.06]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085 * Math.sqrt(1 - (y / 0.13) * (y / 0.13)) + 0.002, 0.008, 6, 14), y === 0 ? grenBand : metalDark);
      ring.rotation.x = HALF_PI; ring.position.y = y; nade.add(ring);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.05, 10), metalMid); cap.position.y = 0.135; nade.add(cap);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.141, 0.026), metalMid); lever.position.set(0.0575, 0.065, 0); lever.rotation.z = 0.4; nade.add(lever);
    mesh.add(nade);
    const rocket = new THREE.Group();   // a rocket points down -Z
    const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 10), metalMid); rb.rotation.x = HALF_PI; rocket.add(rb);
    const rn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 10), accentMat); rn.rotation.x = -HALF_PI; rn.position.z = -0.29; rocket.add(rn);
    for (const rot of [0, HALF_PI]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.1), metalDark); fin.position.z = 0.2; fin.rotation.z = rot; rocket.add(fin); }
    rocket.visible = false; mesh.add(rocket);
    const pack = new THREE.Group();   // the blast pack: a flat yellow box with a dark strap and a red light
    const pb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.16), new THREE.MeshStandardMaterial({ color: 0xd9b43a, roughness: 0.6 })); pack.add(pb);
    const ps = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.095, 0.165), metalDark); pack.add(ps);
    const pl = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); pl.position.set(0.07, 0.055, 0); pack.add(pl);
    pack.visible = false; mesh.add(pack);
    mesh.visible = false; mesh.frustumCulled = false;
    scene.add(mesh);
    grenades.push({ mesh, rocket, pack, stuck: false, spin: new THREE.Vector3(), rollAt: 0, vel: new THREE.Vector3(), from: new THREE.Vector3(), age: 0, state: "idle", remote: false, snap: null, kind: "launcher", smokeT: 0 });
  }
  const blastFx = [];   // expanding balls of light
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffa530, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    mesh.visible = false; mesh.frustumCulled = false;
    scene.add(mesh);
    blastFx.push({ mesh, age: 99, r: 4.5 });
  }
  function retireGrenade(g) { g.state = "idle"; g.mesh.visible = false; g.rocket.visible = false; g.pack.visible = false; g.stuck = false; }
  function dressGrenade(g, kind) {   // which model: a ball, a rocket or a blast pack
    const B = BLAST[kind];
    g.mesh.children[0].visible = !B.rocket && !B.sticky; g.rocket.visible = !!B.rocket; g.pack.visible = !!B.sticky;
    g.mesh.geometry = B.rocket || B.sticky ? emptyGeo : grenGeo;
    g.mesh.rotation.set(0, 0, 0); g.stuck = false;
    g.rollAt = 0;
    if (B.rocket || B.sticky) g.spin.set(0, 0, 0);
    else g.spin.set(g.vel.z, 0, -g.vel.x).multiplyScalar(0.35);   // end over end, about the line across the throw: a faster throw turns faster
  }
  function playBlastSound(pos, r) {
    const d = pos.distanceTo(yawObject.position), lvl = (1 / (1 + d / 22)) * (r > 5 ? 1.15 : 1);
    noiseHit(260, 0.7, 0.95 * SETTINGS.volGuns * lvl, 0.55, "lowpass", 0, 0.4, true);
    tone("sine", 120, 28, 0.85 * SETTINGS.volGuns * lvl, 0.5, 0, 0.3);
    noiseHit(2400, 1.0, 0.25 * SETTINGS.volGuns * lvl, 0.12, "highpass", 0, 0.2);
  }
  function showBlast(pos, r) {
    r = r || 4.5;
    burst(pos, 0xffa020, 26); burst(pos, 0xffe08a, 10); burst(pos, 0x555555, 12);
    const fx = blastFx.reduce((a, b) => (a.age > b.age ? a : b));
    fx.age = 0; fx.r = r; fx.mesh.position.copy(pos); fx.mesh.visible = true;
    playBlastSound(pos, r);
  }
  function updateBlastFx(dt) {
    for (const fx of blastFx) {
      if (!fx.mesh.visible) continue;
      fx.age += dt;
      const t = fx.age / 0.35;
      if (t >= 1) { fx.mesh.visible = false; continue; }
      fx.mesh.scale.setScalar(fx.r * (0.25 + 0.75 * Math.sqrt(t)));
      fx.mesh.material.opacity = 0.55 * (1 - t) * (1 - t);
    }
  }
  const blastDamage = (d, kind) => { const b = DAMAGE[kind] || DAMAGE.launcher; return b.max - (b.max - b.min) * Math.min(Math.max(d / b.radius, 0), 1); };
  function launchBlast(kind, origin, dir, speed) {
    const B = BLAST[kind];
    const g = grenades.find((q) => q.state === "idle") || grenades.reduce((a, b) => (a.age > b.age ? a : b));
    g.kind = kind; g.mesh.position.copy(origin); g.from.copy(origin);
    g.vel.copy(dir).multiplyScalar(speed || B.speed);
    if (!B.rocket) g.vel.add(player.velocity);
    g.snap = trickState(); g.remote = false; g.age = 0; g.smokeT = 0; g.state = "flying";
    g.mesh.visible = true; dressGrenade(g, kind);
    if (B.rocket) g.mesh.lookAt(_gLookAt.copy(origin).add(dir));
    if (net.active) mpSendThrow(g.mesh.position, g.vel, BLAST_CODE[kind]);
    return g;
  }
  const emptyGeo = new THREE.BufferGeometry(), _gLookAt = new THREE.Vector3();
  function fireBlastGun(kind, w) {   // the launcher and the RPG
    if (!SETTINGS.unlimitedAmmo) { w.ammo--; updateAmmoHud(); if (w.mag && w.magSize === 1) w.mag.visible = false; }
    playShotSound(w.sound, w.soundMult || 1);
    vm.recoil = w.recoil; vm.camKick = w.kick; vm.camKickYaw = Math.random() * 2 - 1;
    vm.flashTimer = FLASH_TIME;
    const ads = easeInOut(vm.adsProgress);
    camera.getWorldDirection(_aimDir);
    const extraPitch = vm.recoilPitch - vm.viewRecoilPitch, extraYaw = vm.recoilYaw - vm.viewRecoilYaw;
    if (extraPitch || extraYaw) {
      _sprRight.set(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(_camQuat));
      _aimDir.applyAxisAngle(_sprRight, extraPitch).applyAxisAngle(_worldUp, extraYaw);
    }
    spreadDirection(_aimDir, w.spread + (w.spreadAds - w.spread) * ads, _pelletDir);
    camera.getWorldPosition(_boltAim).addScaledVector(_pelletDir, kind === "rpg" ? 60 : 30);
    muzzleFlash.getWorldPosition(_muzzleWorld);
    _boltDir.copy(_boltAim).sub(_muzzleWorld).normalize();   // from the muzzle, toward where the crosshair points
    launchBlast(kind, _muzzleWorld, _boltDir);
    if (kind === "rpg") { player.velocity.addScaledVector(_boltDir, -6.5); if (player.velocity.y > 2.5) { player.onGround = false; player.sliding = false; } }   // the backblast shoves you the other way
    if (run.state === "live") run.shots++;
    if (!net.active) { const gs = gunStat(kind); gs.shots++; stat("shots"); }
    w.lastFiredAt = elapsedTime;
    addRecoil(w);
    if (!SETTINGS.unlimitedAmmo && w.ammo <= 0) autoReloadTimer = 0.25;
  }
  // the thrown grenade (G): an overarm lob on a cooldown, whatever you are holding
  let fragCd = 0, fragCharge = -1;   // fragCharge: seconds G has been held (-1: not charging); the longer you hold it, the further it goes, and from halfway the fuse burns too (cooking)
  const FRAG_CHARGE_TIME = 1.1, FRAG_MIN_SPEED = 6, FRAG_MAX_SPEED = 36;
  const FRAG_COOK_FROM = FRAG_CHARGE_TIME / 2;   // the pin is out from here: a full-power throw has burned 0.55 s of its 2.2 s fuse, so it still has 1.65 s in the air; held past 2.75 s it goes off in your hand
  function fragAllowed() { return !(replay.active || localDead || (net.active && (net.phase !== "play" || countingDown() || net.gungame))); }
  function startFragCharge() { if (fragCd <= 0 && fragAllowed()) fragCharge = 0; }
  function releaseFrag() {
    if (fragCharge < 0) return;
    const power = Math.min(fragCharge / FRAG_CHARGE_TIME, 1), cooked = Math.max(0, fragCharge - FRAG_COOK_FROM);
    fragCharge = -1;
    throwFrag(FRAG_MIN_SPEED + (FRAG_MAX_SPEED - FRAG_MIN_SPEED) * power, cooked);
  }
  function throwFrag(speed, cooked) {
    if (fragCd > 0 || !fragAllowed()) return;
    fragCd = FRAG_COOLDOWN;
    camera.getWorldDirection(_thFwd);
    camera.getWorldQuaternion(_camQuat);
    _thRight.set(1, 0, 0).applyQuaternion(_camQuat);
    camera.getWorldPosition(_gLookAt).addScaledVector(_thFwd, 0.5).addScaledVector(_thRight, 0.12 * handSign());
    _gLookAt.y -= 0.12;
    _boltDir.copy(_thFwd); _boltDir.y += 0.14; _boltDir.normalize();   // a little lob
    launchBlast("frag", _gLookAt, _boltDir, speed || BLAST.frag.speed).age = cooked || 0;   // (a cooked grenade has already burned part of its fuse)
    tone("triangle", 330, 120, 0.12 * SETTINGS.volGear, 0.14, 0, 0.1);
    noiseHit(1800, 1.0, 0.10 * SETTINGS.volGear, 0.09, "highpass", 0, 0.1);
    if (run.state === "live") run.shots++;
  }
  function updateNadeChip(dt) {
    if (fragCd > 0) fragCd = Math.max(0, fragCd - dt);
    if (fragCharge >= 0) {
      if (!pointerLocked || !fragAllowed() || fragCd > 0) fragCharge = -1;
      else {
        const before = fragCharge;
        fragCharge += dt;
        if (before < FRAG_COOK_FROM && fragCharge >= FRAG_COOK_FROM) tone("square", 1100, 1100, 0.05 * SETTINGS.volGear, 0.05, 0, 0.1);   // the pin is out
        if (fragCharge - FRAG_COOK_FROM >= BLAST.frag.fuse) { fragCharge = -1; throwFrag(FRAG_MIN_SPEED, BLAST.frag.fuse); }   // held too long: it goes off in your hand
      }
    }
    const show = fragAllowed(), charging = show && fragCharge >= 0;
    setAb(abEls.nade, !show ? "" : charging ? "charging" : fragCd > 0 ? "cool" : "ready", "grenade");
    if (tbEls.box.hidden === charging) tbEls.box.hidden = !charging;   // the bars under the crosshair: how far it will go, then how long the fuse has left
    if (charging) {
      const cook = Math.max(0, fragCharge - FRAG_COOK_FROM), left = Math.max(0, 1 - cook / BLAST.frag.fuse);
      tbEls.dist.style.width = (Math.min(fragCharge / FRAG_CHARGE_TIME, 1) * 100).toFixed(1) + "%";
      if (tbEls.cookBox.hidden === (cook > 0)) tbEls.cookBox.hidden = !(cook > 0);
      tbEls.cook.style.width = (left * 100).toFixed(1) + "%";
      tbEls.cookBox.classList.toggle("low", left < 0.25);
    }
  }
  // the blast pack (C): throw it, it sticks where it lands, press C again to set it off. It launches you hard and only bruises others (no damage to you).
  let packCd = 0, packOut = null;
  function useSatchel() {
    if (!fragAllowed()) return;
    if (packOut && packOut.state === "flying" && !packOut.remote) { explodeGrenade(packOut); return; }
    if (packCd > 0) return;
    camera.getWorldDirection(_thFwd);
    camera.getWorldQuaternion(_camQuat);
    _thRight.set(1, 0, 0).applyQuaternion(_camQuat);
    camera.getWorldPosition(_gLookAt).addScaledVector(_thFwd, 0.5).addScaledVector(_thRight, 0.1 * handSign());
    _gLookAt.y -= 0.1;
    _boltDir.copy(_thFwd); _boltDir.y += 0.08; _boltDir.normalize();
    packOut = launchBlast("satchel", _gLookAt, _boltDir);
    tone("triangle", 260, 110, 0.12 * SETTINGS.volGear, 0.12, 0, 0.1);
  }
  function updatePackChip(dt) {
    if (packCd > 0) packCd = Math.max(0, packCd - dt);
    if (packOut && (packOut.state === "idle" || packOut.kind !== "satchel")) packOut = null;
    if (packOut && !fragAllowed()) { retireGrenade(packOut); packOut = null; }   // (dying or a new round: it is gone, nothing goes off)
    const show = fragAllowed();
    setAb(abEls.pack, !show ? "" : packOut ? "armed" : packCd > 0 ? "cool" : "ready", "satchel");
    if (show && packOut) abFuseEl.style.transform = "scaleX(" + Math.max(0, 1 - packOut.age / BLAST.satchel.fuse).toFixed(2) + ")";   // (a line that burns down while it waits)
  }
  function spawnRemoteGrenade(o, v, kind) {
    const g = grenades.find((q) => q.state === "idle") || grenades.reduce((a, b) => (a.age > b.age ? a : b));
    const B = BLAST[kind] || BLAST.launcher;
    g.kind = BLAST[kind] ? kind : "launcher";
    g.mesh.position.set(o[0], o[1], o[2]); g.from.copy(g.mesh.position);
    g.vel.set(v[0], v[1], v[2]);
    g.snap = null; g.remote = true; g.age = 0; g.smokeT = 0; g.state = "flying";
    g.mesh.visible = true; dressGrenade(g, g.kind);
    if (B.rocket) g.mesh.lookAt(_gLookAt.copy(g.mesh.position).add(g.vel));
  }
  // the blast, for the thrower: what it hurts, scores and claims
  const _blastC = new THREE.Vector3();
  function explodeGrenade(g) {
    const pos = g.mesh.position.clone(), kind = g.kind, D = DAMAGE[kind], R = D.radius, B = BLAST[kind];
    retireGrenade(g);
    if (kind === "satchel") { packCd = PACK_COOLDOWN; packOut = null; }
    showBlast(pos, R);
    const w = WEAPONS[kind] || WEAPONS.launcher;   // (a thrown grenade scores like the launcher's)
    let hitCount = 0;
    // you: shoved away from the middle of the blast
    _blastC.set(yawObject.position.x, player.feetY + 0.9, yawObject.position.z).sub(pos);
    const pd = _blastC.length();
    if (pd < R * 1.4 && !localDead) {
      _blastC.y += (kind === "satchel" ? 0.8 : 0.35) * Math.max(pd, 0.5); _blastC.normalize();
      const push = B.push * (1 - pd / (R * 1.4));
      player.velocity.addScaledVector(_blastC, push);
      if (player.velocity.y > 2.5) { player.onGround = false; player.sliding = false; }
      if (push >= CFG.blastJumpMinPush && player.velocity.y > 2.5 && BLAST_JUMP[kind]) {   // a blast jump: a trick for whatever you hit while you are still flying
        player.blastKind = kind; player.blastAirId = player.groundedAt;
        noteTrick("blast", BLAST_JUMP[kind][0]);
        if (g.snap) g.snap.blast = kind;   // (this blast's own hits count it too)
      }
    }
    // targets in the single player and race games
    if (!net.active || net.sub === "race") {
      for (const t of targets) {
        if (!t.userData.alive) continue;
        const dist = t.position.distanceTo(pos);
        if (dist - t.userData.hitRadius > R || !botLineClear(pos.x, pos.y, pos.z, t.position.x, t.position.y, t.position.z)) continue;
        hitCount++;
        if (run.state === "live") run.shotsHit++;
        stat("shotsHit");
        scoreHit(t, g.from.distanceTo(t.position), false, 0, g.snap, false, w);
      }
    }
    if (!net.active) {
      for (const pr of props) {   // crates get thrown about
        const d = pr.mesh.position.distanceTo(pos);
        if (d < R) { _blastC.copy(pr.mesh.position).sub(pos).normalize(); pr.velocity.addScaledVector(_blastC, 12 * (1 - d / R)); pr.velocity.y += 4; }
      }
      if (hitCount && WEAPONS[kind]) { const gs = gunStat(kind); gs.hits++; announceUnlocks(kind, gs.hits); }
    }
    // other players: claimed to the host, which works out the damage itself
    if (net.active) {
      const hits = [];
      if (net.sub === "dm" && net.phase === "play") {
        const me = localPlayer();
        if (kind !== "satchel" && !localDead && Math.hypot(yawObject.position.x - pos.x, player.feetY + 0.9 - pos.y, yawObject.position.z - pos.z) <= R
          && botLineClear(pos.x, pos.y, pos.z, yawObject.position.x, player.feetY + 0.9, yawObject.position.z)) hits.push({ v: net.id, pts: 0, tags: [] });   // your own blast hurts you like anyone
        for (const q of net.players.values()) {
          if (q.id === net.id || !q.alive) continue;
          if (net.teams && me && q.team === me.team) continue;
          const d = Math.hypot(q.x - pos.x, q.y + 0.9 - pos.y, q.z - pos.z);
          if (d > R || !botLineClear(pos.x, pos.y, pos.z, q.x, q.y + 0.9, q.z)) continue;
          const res = computeMultipliers(_pseudoTarget, g.from.distanceTo(_blastC.set(q.x, q.y + 0.9, q.z)), false, 0, g.snap, false, w);
          pendingRes.set(q.id, res);
          burst(_blastC, 0xff5555, 8);
          hits.push({ v: q.id, pts: Math.round(CFG.basePoints * res.mult * (res.scale || 1)), tags: res.tags });
          hitCount++;
        }
      }
      sendToHost({ t: "blast", k: kind, o: [r2(pos.x), r2(pos.y), r2(pos.z)], h: hits });
    }
    if (!hitCount) breakStreak();
    else flashCrosshair();
  }
  const _grRay = new THREE.Ray(), _grStep = new THREE.Vector3(), _grHit = new THREE.Vector3(), _grTmp = new THREE.Vector3(), _grNormal = new THREE.Vector3();
  const _grAxis = new THREE.Vector3(), _grSlide = new THREE.Vector3(), _grQ = new THREE.Quaternion();
  const ROLL_DRAG = 2.2, ROLL_SPIN_MAX = 25;   // a grenade on the floor rolls on (it loses a bit over two tenths of its speed each tenth of a second) and rolls down a slope; the turn it shows is capped so it still reads
  function updateGrenades(dt) {
    updateBlastFx(dt);
    updateNadeChip(dt);
    updatePackChip(dt);
    if (!groundBoxes) groundBoxes = groundMeshes.map((m) => new THREE.Box3().setFromObject(m));
    for (const g of grenades) {
      if (g.state === "idle") continue;
      const B = BLAST[g.kind];
      g.age += dt;
      if (g.remote) { if (g.age > B.fuse + 0.5) { retireGrenade(g); continue; } }   // (the thrower's blast message normally ends it)
      else if (g.age >= B.fuse) { explodeGrenade(g); continue; }
      if (g.stuck) continue;   // a blast pack waits where it stuck
      g.vel.y -= B.gravity * dt;
      _grStep.copy(g.vel).multiplyScalar(dt);
      const len = _grStep.length();
      if (len < 1e-6) continue;
      const o = g.mesh.position;
      _grRay.origin.copy(o); _grRay.direction.copy(_grStep).divideScalar(len);
      const d = _grRay.direction;
      const rad = B.rocket ? 0.05 : GREN_RADIUS;
      let hitDist = len + rad, kind = null;
      for (const list of [wallBoxes, groundBoxes]) for (const box of list) {
        const p = rayHitBox(_grRay, box, _grTmp);
        if (!p) continue;
        const dist = o.distanceTo(p);
        if (dist < hitDist) { hitDist = dist; kind = "wall"; _grHit.copy(p); if (box.round && p.y < box.max.y - 0.02) _grNormal.set(p.x - box.round.x, 0, p.z - box.round.z).normalize(); else boxFaceNormal(box, p, _grNormal); }
      }
      if (d.y < 0) {
        const t = (o.y - 0.25) / -d.y;
        if (t >= 0 && t < hitDist) { hitDist = t; kind = "wall"; _grHit.copy(o).addScaledVector(d, t); _grNormal.set(0, 1, 0); }
      }
      if (!g.remote && !B.sticky) {   // a direct hit sets it off at once
        let direct = false;
        for (const t of targets) {
          if (!t.userData.alive || (net.active && net.sub !== "race")) continue;
          if (t.position.distanceTo(o) < t.userData.hitRadius + rad + len) {
            const ox = t.position.x - o.x, oy = t.position.y - o.y, oz = t.position.z - o.z, proj = Math.min(Math.max(ox * d.x + oy * d.y + oz * d.z, 0), len);
            if (Math.hypot(ox - d.x * proj, oy - d.y * proj, oz - d.z * proj) < t.userData.hitRadius + rad && proj < hitDist) { direct = true; hitDist = proj; }
          }
        }
        if (net.active && net.sub === "dm" && net.phase === "play") {
          raycaster.ray.origin.copy(o); raycaster.ray.direction.copy(d);
          const pres = raycastPlayers(Math.min(hitDist, len + rad));
          if (pres.p && pres.dist < hitDist) { direct = true; hitDist = pres.dist; }
        }
        if (direct) { o.addScaledVector(d, Math.max(hitDist, 0)); explodeGrenade(g); continue; }
      }
      if (kind === "wall" && hitDist <= len + rad) {
        if (B.sticky) {   // a blast pack sticks to the wall or floor, its back to the surface
          o.copy(_grHit).addScaledVector(_grNormal, 0.05);
          g.vel.set(0, 0, 0); g.stuck = true;
          g.mesh.lookAt(_gLookAt.copy(o).add(_grNormal));
          continue;
        }
        if (B.rocket) {   // a rocket goes off on whatever it touches
          o.copy(_grHit).addScaledVector(_grNormal, 0.15);
          if (g.remote) retireGrenade(g); else explodeGrenade(g);
          continue;
        }
        o.copy(_grHit).addScaledVector(_grNormal, rad + 0.01);   // a grenade bounces
        const vn = g.vel.dot(_grNormal);
        if (vn < 0) {
          if (_grNormal.y > 0.6 && Math.abs(vn) < 2.2) {   // too slow to bounce: it rolls (and what gravity adds along a slope stays, so it rolls downhill)
            g.vel.addScaledVector(_grNormal, -vn).multiplyScalar(Math.max(0, 1 - ROLL_DRAG * Math.min(g.age - g.rollAt, 0.12)));   // (it touches down every few frames: the drag is for the time since the last touch)
          } else {
            // an egg does not bounce true: how it lands, its long axis against the surface, sets how much it keeps and which way it kicks
            _grAxis.set(0, 1, 0).applyQuaternion(g.mesh.quaternion);
            const an = _grAxis.dot(_grNormal);   // 1: on an end, 0: flat on its side
            _grAxis.addScaledVector(_grNormal, -an);   // the long axis along the surface
            g.vel.addScaledVector(_grNormal, -(1 + B.bounce * (1 - 0.3 * (1 - an * an))) * vn);
            g.vel.addScaledVector(_grAxis, -vn * an * 0.8);
            _grSlide.copy(g.vel).addScaledVector(_grNormal, -g.vel.dot(_grNormal));   // the sliding part
            g.vel.addScaledVector(_grSlide, -0.2);
          }
          g.rollAt = g.age;
          _grSlide.copy(g.vel).addScaledVector(_grNormal, -g.vel.dot(_grNormal));
          g.spin.crossVectors(_grNormal, _grSlide).multiplyScalar(1 / GREN_RADIUS).clampLength(0, ROLL_SPIN_MAX);   // it turns the way it travels along the surface
        }
        continue;
      }
      o.add(_grStep);
      if (B.rocket) {
        g.mesh.lookAt(_gLookAt.copy(o).add(g.vel));
        g.smokeT -= dt;
        if (g.smokeT <= 0) { g.smokeT = 0.03; spawnSmoke(o, 0, 0.3, 0, 0.9, 0.18, 0.8, 0.4); }
      } else if (B.sticky) { g.mesh.rotation.y += dt * 6; }
      else if (g.spin.lengthSq() > 1e-6) {
        const w = g.spin.length();
        g.mesh.quaternion.premultiply(_grQ.setFromAxisAngle(_grAxis.copy(g.spin).divideScalar(w), w * dt));
      }
    }
  }

  function throwKnife() {
    if (vm.throwTimer > 0 || vm.switchTimer > 0 || vm.grappleOut > 0.25) return;
    if (run.state === "countdown" || run.state === "done") return;
    if (run.state === "live") run.shots++;
    stat("knifeThrows"); stat("shots");
    if (net.active && (localDead || net.phase !== "play" || countingDown())) return;
    vm.throwTimer = CFG.knifeThrowCooldown;
    localProtectUntil = 0;
    vm.throwReleased = false;
    vm.inspectTimer = 0;
    vm.slashTimer = 0;
    vm.meleePending = false;
    fireCooldown = Math.max(fireCooldown, CFG.knifeThrowCooldown * 0.75);   // no slashing with an empty hand
    playKnifeSwing();
  }

  // called by the viewmodel when the throw motion reaches the release point
  function releaseKnife() {
    const k = thrownPool.find((q) => q.state === "idle") || thrownPool.reduce((a, b) => (a.age > b.age ? a : b));
    camera.getWorldDirection(_thFwd);
    camera.getWorldQuaternion(_camQuat);
    _thRight.set(1, 0, 0).applyQuaternion(_camQuat);
    if (k.root.parent !== scene) scene.add(k.root);
    camera.getWorldPosition(k.root.position);
    k.root.position.addScaledVector(_thFwd, 0.35).addScaledVector(_thRight, 0.08 * handSign());
    k.from.copy(k.root.position);
    k.vel.copy(_thFwd).multiplyScalar(CFG.knifeThrowSpeed).add(player.velocity);
    k.snap = trickState();
    k.remote = false;
    k.age = 0;
    k.state = "flying";
    setThrownModel(k, false);
    k.root.visible = true;
    recEvent({ type: "throw" });
    if (net.active) mpSendThrow(k.root.position, k.vel);
    k.root.scale.setScalar(1);
    k.spin.rotation.set(0, 0, 0);
    faceAlongVelocity(k);
  }

  function faceAlongVelocity(k) {
    // the blade points down -Z, so aim +Z backwards along the flight path
    _thLook.copy(k.root.position).sub(k.vel);
    k.root.lookAt(_thLook);
  }

  function retireKnife(k) {
    k.state = "idle";
    k.root.visible = false;
    if (k.root.parent !== scene) scene.add(k.root);
  }

  // which face of an axis-aligned box a point on its surface lies on
  function boxFaceNormal(box, p, out) {
    const faces = [
      [Math.abs(p.x - box.min.x), -1, 0, 0], [Math.abs(p.x - box.max.x), 1, 0, 0],
      [Math.abs(p.y - box.min.y), 0, -1, 0], [Math.abs(p.y - box.max.y), 0, 1, 0],
      [Math.abs(p.z - box.min.z), 0, 0, -1], [Math.abs(p.z - box.max.z), 0, 0, 1],
    ];
    faces.sort((a, b) => a[0] - b[0]);
    return out.set(faces[0][1], faces[0][2], faces[0][3]);
  }

  let groundBoxes = null;   // platforms you can stand on, built once on first use
  const _kRay = new THREE.Ray(), _kStep = new THREE.Vector3(), _kTmp = new THREE.Vector3();
  const _kHit = new THREE.Vector3(), _kNormal = new THREE.Vector3(), _kStickDir = new THREE.Vector3();
  const _kRaycaster = new THREE.Raycaster();

  function updateThrownKnives(dt) {
    if (!groundBoxes) groundBoxes = groundMeshes.map((m) => new THREE.Box3().setFromObject(m));
    for (const k of thrownPool) {
      if (k.state === "idle") continue;
      k.age += dt;

      if (k.state === "stuck") {
        const left = CFG.knifeStickTime - k.age;
        if (left < 0.4) k.root.scale.setScalar(Math.max(left / 0.4, 0.01));
        if (left <= 0) retireKnife(k);
        continue;
      }

      if (k.age > (k.bolt ? BOLT_LIFE : 4)) { retireKnife(k); if (!k.remote) breakStreak(); continue; }   // flew off without hitting anything
      k.vel.y -= (k.bolt ? BOLT_GRAVITY : CFG.knifeThrowGravity) * dt;
      _kStep.copy(k.vel).multiplyScalar(dt);
      const len = _kStep.length();
      if (len < 1e-6) continue;
      const o = k.root.position;
      _kRay.origin.copy(o);
      _kRay.direction.copy(_kStep).divideScalar(len);
      const d = _kRay.direction;

      // find the nearest thing along this frame's path
      let hitDist = len, kind = null, hitTarget = null, hitProp = null, hitPlayer = null;
      for (const t of targets) {
        if (k.remote || !t.userData.alive) continue;
        const ox = t.position.x - o.x, oy = t.position.y - o.y, oz = t.position.z - o.z;
        const proj = ox * d.x + oy * d.y + oz * d.z;
        if (proj < 0 || proj > hitDist + t.userData.hitRadius) continue;
        const cx = ox - d.x * proj, cy = oy - d.y * proj, cz = oz - d.z * proj;
        if (Math.sqrt(cx * cx + cy * cy + cz * cz) < t.userData.hitRadius) { hitDist = Math.max(proj, 0); kind = "target"; hitTarget = t; }
      }
      for (const list of [wallBoxes, groundBoxes]) {
        for (const box of list) {
          const p = rayHitBox(_kRay, box, _kTmp);
          if (!p) continue;
          const dist = o.distanceTo(p);
          if (dist < hitDist) { hitDist = dist; kind = "wall"; _kHit.copy(p); if (box.round && p.y < box.max.y - 0.02) _kNormal.set(p.x - box.round.x, 0, p.z - box.round.z).normalize(); else boxFaceNormal(box, p, _kNormal); }
        }
      }
      if (d.y < 0) {
        const t = (o.y - 0.25) / -d.y;
        if (t >= 0 && t < hitDist) { hitDist = t; kind = "wall"; _kHit.copy(o).addScaledVector(d, t); _kNormal.set(0, 1, 0); }
      }
      const propList = activeProps();
      if (propList.length) {
        _kRaycaster.set(o, d);
        _kRaycaster.far = hitDist;
        const ph = _kRaycaster.intersectObjects(propList, false);
        if (ph.length && ph[0].face) {
          hitDist = ph[0].distance; kind = "prop"; hitProp = ph[0].object; _kHit.copy(ph[0].point);
          _kNormal.copy(ph[0].face.normal).transformDirection(ph[0].object.matrixWorld);
        }
      }

      if (net.active && !k.remote) {   // deathmatch: the knife can hit another player (raycastPlayers reads the shared ray)
        raycaster.ray.origin.copy(o); raycaster.ray.direction.copy(d);
        const pres = raycastPlayers(hitDist);
        if (pres.p && pres.dist < hitDist) { hitDist = pres.dist; kind = "player"; hitPlayer = pres; }
      }

      if (kind === "player") {
        o.addScaledVector(d, hitDist);
        playKnifeHit();
        lastShotOrigin.copy(k.from);
        hitPlayer.dist = k.from.distanceTo(o);   // how far it was thrown, not just this frame's step
        if (k.bolt) mpPvpHit(hitPlayer, false, 0, k.weapon, k.snap, false);   // a bolt is scored and claimed as a gun hit
        else mpPvpHit(hitPlayer, true, 0, undefined, k.snap, true);
        retireKnife(k);
        continue;
      }
      if (kind === "target") {
        o.addScaledVector(d, hitDist);
        playKnifeHit();
        if (run.state === "live") run.shotsHit++;
        stat("shotsHit");
        lastShotOrigin.copy(k.from);
        if (k.bolt) {
          const gs = gunStat("crossbow"); gs.hits++; announceUnlocks("crossbow", gs.hits);
          scoreHit(hitTarget, k.from.distanceTo(o), false, 0, k.snap, false, k.weapon);
        } else scoreHit(hitTarget, k.from.distanceTo(o), true, 0, k.snap, true);
        retireKnife(k);
        continue;
      }
      if (kind === "wall" || kind === "prop") {
        // stick in, tip first, leaning back toward where it came from
        _kStickDir.copy(_kNormal).multiplyScalar(0.65).addScaledVector(d, -0.35).normalize();
        o.copy(_kHit).addScaledVector(_kStickDir, 0.2);
        _thLook.copy(o).add(_kStickDir);
        k.root.lookAt(_thLook);
        k.root.rotateZ(Math.random() * Math.PI * 2);
        k.spin.rotation.set(0, 0, 0);
        k.state = "stuck";
        k.age = 0;
        if (!k.remote) breakStreak();   // a throw that misses ends the streak, like a missed shot
        playKnifeStick(o.distanceTo(yawObject.position));
        if (kind === "prop") {
          const prop = props.find((pr) => pr.mesh === hitProp);
          if (prop) {
            prop.velocity.addScaledVector(d, CFG.shotForce * 0.8);
            prop.mesh.attach(k.root);   // ride along with the crate
          }
          burst(_kHit, 0xd2a679, 4);
        } else {
          burst(_kHit, 0xb8c0c8, 3);
        }
        continue;
      }

      o.add(_kStep);
      faceAlongVelocity(k);
      if (!k.bolt) k.spin.rotation.x -= KNIFE_SPIN * dt;
    }
  }

  // ======================================================================
  // MULTIPLAYER
  //
  // Star topology over PeerJS (WebRTC data channels): one player hosts a room and
  // everyone else connects to them with a 5-letter code. The host is the authority
  // for round state, target spawns, the scoreboard and who is alive; each player
  // simulates their own movement and does their own hit-scan, then reports hits.
  // Two sub-modes share that plumbing:
  //   race - everyone shoots the same targets, highest trickscore wins
  //   dm   - targets are off, players eliminate each other (health, see DAMAGE)
  // ======================================================================
  const ROOM_PREFIX = "trickshot-sandbox-";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O/1/I to avoid misreads
  const ROUND_SECONDS = 180, RESULTS_SECONDS = 10, RESPAWN_MS = 3000, PROTECT_MS = 1000, MAX_PLAYERS = 8;
  // health: 100, healing starts after REGEN_DELAY ms with no damage taken and no shooting. The host works damage out
  // from the gun, so a client only ever says what it hit. Sniper and Deagle one-shot to the head; the sniper to the body too.
  const REGEN_DELAY = 10000, REGEN_PER_SEC = 10;
  const HEARTBEAT_MS = 12000;   // nothing heard from the other end for this long and the connection is treated as dead
  const DAMAGE = {
    rifle: { body: 100, head: 100 }, pistol: { body: 55, head: 100 },
    ak: { body: 34, head: 50 }, ar: { body: 26, head: 40 },
    smg: { body: 20, head: 30, near: 12, far: 35, farMult: 0.5 },   // full damage to 12 m, half by 35 m
    dmr: { body: 60, head: 100 },
    burst: { body: 28, head: 42 },   // per round, three rounds a pull
    lmg: { body: 24, head: 34 },
    launcher: { blast: 1, max: 100, min: 25, radius: 4.5 },
    rpg: { blast: 1, max: 100, min: 30, radius: 5.2 },
    frag: { blast: 1, max: 90, min: 20, radius: 4 },   // the thrown grenade (G), not a gun
    satchel: { blast: 1, max: 15, min: 5, radius: 4.5 },   // the blast pack (C): a launch for you, only a scratch for the others   // splash: full damage in the middle of the blast, a quarter at its edge (a ball 4.5 m wide each way)
    crossbow: { body: 55, head: 100 },   // like the Deagle: two body hits or one to the head; it flies, so it has to be led
    shotgun: { pellet: 11, headMult: 1.5, near: 8, far: 40, farMult: 0.25, pellets: 9 },   // per pellet, thinning with distance
  };
  const KNIFE_SWING_DMG = 100, KNIFE_THROW_DMG = 55, KNIFE_THROW_HEAD_DMG = 100;   // a thrown knife is like the Deagle: two body hits, or one to the head
  const GG_ORDER = ["smg", "ar", "ak", "burst", "lmg", "shotgun", "dmr", "crossbow", "pistol", "rifle"];   // gun game: ten guns, then the knife (level 11)
  const PLAYER_COLORS = [0xe5484d, 0x3e8ef7, 0x30a46c, 0xf5a524, 0x9d5bd2, 0x13b9b9, 0xe5589b, 0xa0a0a8];
  // spawn points on the open floor, clear of the walls, pillars and platforms
  // (the deathmatch spawn points, SPAWNS, come from the map)
  const SUB_NAMES = { race: "Score Race", dm: "Deathmatch" };
  function modeName() {
    if (net.sub === "dm" && net.br) return "Battle royale";
    if (net.sub === "dm" && net.ctf) return "Capture the flag";
    if (net.sub === "dm" && net.range) return "Shooting range";
    if (net.sub === "dm" && net.gungame) return "Gun game";
    if (net.sub === "dm" && net.koth) return net.teams ? "Team King of the Hill" : "King of the Hill";
    return net.sub === "dm" && net.teams ? "Team Deathmatch" : SUB_NAMES[net.sub];
  }
  // who has the hill, as a few words for the timer
  function hillText() {
    const [kind, who] = net.hs;
    if (kind === 2) return "hill contested";
    if (kind !== 1) return "hill empty";
    if (net.teams) return TEAM_NAMES[who] + " holds the hill";
    const p = net.players.get(who);
    return (who === net.id ? "you hold" : (p ? p.name : "someone") + " holds") + " the hill";
  }
  function updateHillVis() {
    if (!hillVis) return;
    hillVis.g.visible = net.active && net.koth;
    const [kind, who] = net.hs;
    let c = 0xe6e6e6;
    if (kind === 2) c = HILL_CONTESTED.c;
    else if (kind === 1) { const p = net.teams ? null : net.players.get(who); c = net.teams ? TEAM_COLORS[who] : p ? p.color : 0xffd23c; }
    setHillColor(c);
  }
  const teamKills = (t) => [...net.players.values()].filter((q) => q.team === t).reduce((a, q) => a + q.kills, 0);

  // STUN lets two browsers discover how to reach each other; TURN is a relay of last resort for networks
  // (mobile data, school/work, some home routers) that block direct connections. The TURN entry is a free,
  // shared public relay and may be slow or rate-limited. To use your own, replace it with your credentials.
  const PEER_OPTS = {
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"],
          username: "openrelayproject", credential: "openrelayproject" },
      ],
    },
  };

  const net = {
    active: false, role: null,            // role: "host" | "client"
    peer: null, hostConn: null, conns: new Map(),
    id: null, code: "", sub: "race", pendingSub: "race",
    map: "arena", pendingMap: "arena",
    teams: false, limit: 15, pendingTeams: false, pendingLimit: 15, botCount: 0,   // team deathmatch, and first to this many kills (0 = no limit)
    rules: { lowGrav: false, oneShot: false, headOnly: false, fastResp: false, siphon: false }, pendingRules: { lowGrav: false, oneShot: false, headOnly: false, fastResp: false, siphon: true },   // the host's match rules
    br: false, pendingBr: false, zc: [0, 0],   // battle royale: one life, and a safe zone that closes in (its centre; its size comes from the round clock)
    ctf: false, pendingCtf: false, flags: [{ s: 0, x: 0, y: 0, z: 0, c: null, t: 0 }, { s: 0, x: 0, y: 0, z: 0, c: null, t: 0 }], caps: [0, 0],   // capture the flag: each flag (s: 0 home, 1 carried, 2 dropped; where; who has it; the drop timer) and the captures
    gungame: false, pendingGun: false,   // gun game: every kill swaps your gun; a kill with the knife at the end wins
    range: false, pendingRange: false,   // the shooting range: dummies that stand still and never shoot back (practice only)
    koth: false, pendingKoth: false, hs: [0, -1], teamHill: [0, 0],   // King of the Hill: who holds the hill (0 empty, 1 held, 2 contested; who), and each team's time on it
    phase: "play", left: ROUND_SECONDS, leftRecv: 0, resultsLeft: 0, cd: 0, cdRecv: 0, ggp: "",   // cd: seconds of 3-2-1 left before a round starts
    players: new Map(), ttOffset: 0, ttSynced: false,
    lastTick: 0, boardTimer: 0, lastHostMsg: 0,
    practice: false,                      // a local room with bots in it: no network at all
  };
  let uiMode = "solo";
  let localDead = false;

  const mpEls = {
    tabs: document.querySelectorAll("#mode-tabs .tab"),
    panelSolo: document.getElementById("panel-solo"),
    panelMp: document.getElementById("panel-mp"),
    connect: document.getElementById("mp-connect"),
    room: document.getElementById("mp-room"),
    name: document.getElementById("mp-name"),
    code: document.getElementById("mp-code"),
    hostBtn: document.getElementById("mp-card-host"),
    practiceBtn: document.getElementById("mp-card-practice"),
    joinBtn: document.getElementById("mp-join-btn"),
    status: document.getElementById("mp-status"),
    roomCode: document.getElementById("mp-room-code"),
    roomMode: document.getElementById("mp-room-mode"),
    settingsBtn: document.getElementById("mp-room-settings"), nextLine: document.getElementById("mp-next-line"),
    players: document.getElementById("mp-players"),
    playBtn: document.getElementById("mp-play-btn"),
    leaveBtn: document.getElementById("mp-leave-btn"),
    copyBtn: document.getElementById("mp-copy-btn"),
    timer: document.getElementById("mp-timer"),
    timerVal: document.getElementById("mp-timer-val"),
    timerMode: document.getElementById("mp-timer-mode"),
    feed: document.getElementById("killfeed"),
    dead: document.getElementById("dead-screen"),
    deadBy: document.getElementById("dead-by"),
    board: document.getElementById("scoreboard"),
    boardTitle: document.getElementById("sb-title"),
    boardBody: document.getElementById("sb-body"),
    boardHead: document.getElementById("sb-head"),
    boardFoot: document.getElementById("sb-foot"),
  };

  const SUB_HINTS = {
    race: "Everyone shoots the same targets and the best trickscore when the timer ends wins. Players can't hurt each other.",
    tdm: "Two teams, blue and red. 100 health, no friendly fire, and the team with the most kills (or the first to the kill limit) wins. Only kills score.",
    koth: "A hill with a ring on top. Stand alone on it to score a point a second; with someone else on it, nobody scores. First to the score wins (the first-to number times 5). Kills only clear the hill. It always plays on the map with a hill.",
    tkoth: "King of the Hill with two teams: your team scores while only your team is on the hill. Kills only clear the hill.",
    range: "Stationary dummies stand at set distances and never shoot back. Every hit shows its damage, they heal fast and come back after a kill, and the corner shows what your gun does. Practice only.",
    br: "One life each. A safe circle closes in over the round and anyone outside it takes damage that gets worse; the last player standing wins. Kills still count, and there are no respawns.",
    ctf: "Two teams, a flag each. Touch their flag to pick it up and bring it back to your own flag while yours is home to score. Kill the carrier and it drops; touch your own dropped flag to send it home. First to the captures wins (the first-to number divided by 5).",
    gungame: "Everyone starts with the same gun and every kill gives you the next one: assault rifle, AK, shotgun, Deagle, sniper, then the knife. A kill with the knife wins. Get knifed and you drop a level.",
    dm: "Targets are off. 100 health: the sniper kills in one hit, other guns take a few, and health comes back slowly if you stay out of the fight. Only kills score, with your trick multipliers.",
  };
  // "race", "dm" or "tdm" (team deathmatch is deathmatch with teams), and a kill limit
  const cleanRules = (r) => ({ lowGrav: !!(r && r.lowGrav), oneShot: !!(r && r.oneShot), headOnly: !!(r && r.headOnly), fastResp: !!(r && r.fastResp), siphon: !!(r && r.siphon) });
  const siphonDefault = (modeId) => modeId === "dm" || modeId === "koth" || modeId === "gungame" || modeId === "br";   // on by default everywhere but the team modes (and the race and range, where nobody fights)
  function chooseRules(r) { net.pendingRules = cleanRules(r); }
  const RULE_NAMES = [["lowGrav", "low gravity"], ["oneShot", "one-shot kills"], ["headOnly", "headshots only"], ["fastResp", "fast respawn"], ["siphon", "siphon"]];
  const ruleText = (r) => RULE_NAMES.filter(([k]) => r && r[k]).map(([, n]) => n).join(", ");
  // the map's own physics, then low gravity on top when the room asks for it (everyone's physics runs on their own computer)
  function applyRulePhysics() {
    Object.assign(CFG, BASE_PHYS, (currentMap && currentMap.physics) || {});
    if (net.active && net.rules && net.rules.lowGrav) CFG.gravity *= 0.35;
  }
  function chooseMap(id) { net.pendingMap = id === "random" || MAPS[id] ? id : "arena"; }
  function chooseMode(value, limit) {
    net.pendingSub = value === "race" ? "race" : "dm";
    net.pendingTeams = value === "tdm" || value === "tkoth" || value === "ctf";
    net.pendingKoth = value === "koth" || value === "tkoth";
    net.pendingRange = value === "range";
    net.pendingCtf = value === "ctf";
    net.pendingBr = value === "br";
    net.pendingGun = value === "gungame";
    net.pendingLimit = Math.max(0, Math.min(parseInt(limit, 10) || 0, 999));
  }

  try { mpEls.name.value = localStorage.getItem("tsb-name") || ""; } catch (e) { /* storage can be blocked */ }
  function myName() {
    const n = mpEls.name.value.replace(/[^\w \-]/g, "").trim().slice(0, 14) || "Player" + Math.floor(Math.random() * 900 + 100);
    try { localStorage.setItem("tsb-name", mpEls.name.value.trim()); } catch (e) { /* ignore */ }
    return n;
  }

  // the panel and tab area sit inside the blocker, which treats any click as "play"
  mpEls.panelMp.addEventListener("click", (e) => e.stopPropagation());
  document.getElementById("mode-tabs").addEventListener("click", (e) => e.stopPropagation());
  mpEls.playBtn.addEventListener("click", (e) => { e.stopPropagation(); requestPlay(); });

  // Multiplayer is switched off for now: the mode tabs are hidden, invite links are
  // ignored and PeerJS is never loaded, so the game makes no connections beyond the
  // three.js download. Set to true to bring it all back.
  const MULTIPLAYER_ENABLED = true;
  const PEERJS_SRI = "sha512-iFU+yF1keEaLDC9HEwPfLMSRaS0unBHE14GEgx6pQKJXjp5v0tvX8xpfp2lgJ62XEjbYp/M5C3CAmej/PWXMyA==";
  if (MULTIPLAYER_ENABLED) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
    s.integrity = PEERJS_SRI;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    document.head.appendChild(s);
  } else {
    document.getElementById("mode-tabs").style.display = "none";
  }

  function setUiMode(mode) {
    if (net.active || (mode === "mp" && !MULTIPLAYER_ENABLED)) return;
    uiMode = mode;
    mpEls.tabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
    mpEls.panelSolo.hidden = mode !== "solo";
    mpEls.panelMp.hidden = mode !== "mp";
  }
  mpEls.tabs.forEach((t) => t.addEventListener("click", () => setUiMode(t.dataset.mode)));

  function mpStatus(text, ok) {
    mpEls.status.textContent = text || "";
    mpEls.status.classList.toggle("ok", !!ok);
  }

  // ---------------- shared helpers ----------------
  const nowMs = () => performance.now();
  const r2 = (v) => Math.round(v * 100) / 100;

  function mpTargetClock() { return nowMs() / 1000 + net.ttOffset; }

  function localPlayer() { return net.players.get(net.id); }

  function makePlayerRecord(id, name, color) {
    return {
      id, name, color, baseColor: color, team: -1, botIndex: -1, score: 0, kills: 0, deaths: 0, hill: 0, gg: 0, caps: 0, heads: 0, dmg: 0, best: 0, streak: 0, bstreak: 0, alive: true,
      x: 0, y: 0.25, z: 0, yaw: 0, pitch: 0, w: "rifle", sl: false,
      respawnAt: 0, protectUntil: 0, mesh: null, snap: true,
      hp: 100, lastDamageAt: -1e9, lastFireAt: -1e9,
      bot: false, ai: null,
      g: 0, rl: 0, at: "", atBuilt: "", gr: 0, gh: null, swingT: 0, lastSwingAt: -1e9, lastRecv: nowMs(), ropeSet: null,
      lastShot: null, lastShotAt: -1e9, lastThrowAt: -1e9, lastHitAt: -1e9, lastMeleeAt: -1e9, knivesUp: 0,   // for checking hit claims (host only)
    };
  }

  function disposeAvatar(p) {
    if (p.ropeSet) { scene.remove(p.ropeSet.rope, p.ropeSet.head); p.ropeSet = null; }   // (shared materials, nothing to free)
    if (!p.mesh) return;
    scene.remove(p.mesh);
    p.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    p.mesh = null;
  }

  // ---------------- remote avatars ----------------
  function makeNameTag(text, color) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 56;
    const g = c.getContext("2d");
    g.font = "bold 30px Segoe UI, Arial, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,0.85)";
    g.strokeText(text, 128, 30);
    g.fillStyle = "#" + color.toString(16).padStart(6, "0");
    g.fillText(text, 128, 30);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    spr.scale.set(1.7, 0.37, 1);
    spr.position.y = 2.35;
    return spr;
  }

  // simple per-gun shapes for other players: barrel runs along -z from the hand
  function makeAvatarGun(id, dark, steel, wood) {
    const g = new THREE.Group();
    const P = (geo, mat, x, y, z, rx) => { const m = addPart(g, geo, mat, x, y, z, rx || 0, 0, 0); m.userData.role = mat === dark ? "dark" : mat === steel ? "mid" : mat === wood ? "wood" : null; return m; };   // (the role is what a skin repaints)
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const HP = Math.PI / 2;
    if (id === "rifle") {            // sniper: long barrel, wooden stock, and a scope when one is fitted
      P(B(0.07, 0.09, 0.55), dark, 0, 0, -0.15); P(B(0.04, 0.04, 0.6), steel, 0, 0.01, -0.7);
      g.userData.scope = P(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10), steel, 0, 0.1, -0.25, HP); g.userData.stock = P(B(0.06, 0.1, 0.2), wood, 0, -0.02, 0.2);
      g.userData.scope.visible = false;   // only with a scope fitted
    } else if (id === "ar") {        // rifle: short and black
      P(B(0.065, 0.085, 0.7), dark, 0, 0, -0.3); P(B(0.025, 0.025, 0.25), steel, 0, 0.005, -0.75);
      P(B(0.03, 0.2, 0.05), steel, 0, -0.14, -0.2); P(B(0.05, 0.07, 0.2), dark, 0, 0, 0.15);
    } else if (id === "smg") {       // SMG: short, boxy, a straight magazine and a stub stock
      P(B(0.065, 0.085, 0.5), dark, 0, 0, -0.2); P(B(0.025, 0.025, 0.2), steel, 0, 0.005, -0.55);
      P(B(0.03, 0.18, 0.05), steel, 0, -0.14, -0.1); P(B(0.05, 0.07, 0.15), dark, 0, 0, 0.12);
    } else if (id === "dmr") {       // DMR: long and slim, a box magazine and a solid stock
      P(B(0.065, 0.085, 0.85), dark, 0, 0, -0.35); P(B(0.028, 0.028, 0.3), steel, 0, 0.005, -0.95);
      P(B(0.03, 0.14, 0.05), steel, 0, -0.12, -0.15); P(B(0.05, 0.08, 0.22), dark, 0, 0, 0.25);
    } else if (id === "burst") {     // burst rifle: like the rifle, with a straight magazine
      P(B(0.065, 0.085, 0.7), dark, 0, 0, -0.3); P(B(0.025, 0.025, 0.25), steel, 0, 0.005, -0.75);
      P(B(0.03, 0.2, 0.05), steel, 0, -0.14, -0.2); P(B(0.05, 0.07, 0.2), dark, 0, 0, 0.15);
    } else if (id === "lmg") {       // LMG: thick, a big box magazine and a long barrel
      P(B(0.075, 0.1, 0.75), dark, 0, 0, -0.3); P(B(0.03, 0.03, 0.3), steel, 0, 0.005, -0.85);
      P(B(0.12, 0.16, 0.2), steel, 0, -0.17, -0.15); P(B(0.05, 0.09, 0.25), dark, 0, 0, 0.2);
    } else if (id === "rpg") {       // RPG: a long tube with a warhead in the front
      P(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 12), dark, 0, 0.02, -0.15, HP); P(new THREE.ConeGeometry(0.05, 0.14, 12), steel, 0, 0.02, -0.66, -HP);
      P(B(0.04, 0.1, 0.05), steel, 0, -0.1, 0.1);
    } else if (id === "launcher") {  // launcher: a short body and one fat barrel
      P(B(0.065, 0.085, 0.55), dark, 0, 0, -0.1); P(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 12), steel, 0, 0.01, -0.55, HP);
      P(B(0.07, 0.06, 0.16), wood, 0, -0.06, -0.3); P(B(0.05, 0.09, 0.2), dark, 0, 0, 0.25);
    } else if (id === "crossbow") {  // crossbow: a stock, a wide prod across the front and a bolt on the rail
      P(B(0.06, 0.08, 0.8), dark, 0, 0, -0.1); P(B(0.7, 0.04, 0.05), steel, 0, 0, -0.55);
      P(B(0.02, 0.02, 0.5), steel, 0, 0.05, -0.3); P(B(0.05, 0.09, 0.2), dark, 0, 0, 0.3);
    } else if (id === "ak") {        // AK: wooden furniture and a curved magazine
      P(B(0.065, 0.085, 0.75), dark, 0, 0, -0.3); P(B(0.07, 0.07, 0.28), wood, 0, 0, -0.62);
      P(B(0.03, 0.22, 0.05), steel, 0, -0.15, -0.15, 0.35); P(B(0.05, 0.1, 0.25), wood, 0, -0.02, 0.2);
    } else if (id === "shotgun") {   // shotgun: fat barrel and a pump
      P(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 10), steel, 0, 0.02, -0.5, HP);
      P(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 10), dark, 0, -0.03, -0.4, HP);
      P(B(0.07, 0.06, 0.2), wood, 0, -0.05, -0.55); P(B(0.06, 0.1, 0.3), wood, 0, -0.02, 0.2);
    } else {                         // Deagle: a big pistol
      P(B(0.055, 0.05, 0.32), steel, 0, 0.02, -0.12); P(B(0.05, 0.08, 0.26), steel, 0, -0.01, -0.1);
      P(B(0.045, 0.12, 0.06), dark, 0, -0.09, 0.03, 0.2);
    }
    g.position.set(0.24, -0.25, -0.1);
    g.visible = false;
    return g;
  }

  // the rope and spear of another player's grapple, made when they first use it
  function ensureRope(p) {
    if (p.ropeSet) return p.ropeSet;
    const rope = ropeMesh.clone(), head = hookHead.clone(true);
    rope.visible = head.visible = false; rope.frustumCulled = false;
    scene.add(rope, head);
    return (p.ropeSet = { rope, head });
  }

  // Another player: boots and legs that swing as they run, a belted torso with a vest plate and shoulders in their colour, a helmet with a visor,
  // and two arms that reach for the gun (a two-bone solve each frame: see poseAvatarArms). The hit shape (capsule and head ball) is unchanged.
  const AV_HAND_HOLD = {   // where each hand goes on the thing they hold, in its own space (the barrel runs along -z); l: null = the left arm hangs
    default: { r: [0, -0.07, 0.1], l: [0, -0.05, -0.36] },
    rifle: { r: [0, -0.06, 0.05], l: [0, -0.04, -0.36] }, smg: { r: [0, -0.07, 0.08], l: [0, -0.05, -0.3] }, dmr: { r: [0, -0.06, 0.1], l: [0, -0.04, -0.46] },
    lmg: { r: [0, -0.08, 0.1], l: [0, -0.06, -0.46] }, shotgun: { r: [0, -0.06, 0.2], l: [0, -0.05, -0.55] }, pistol: { r: [0, -0.1, 0.06], l: [-0.01, -0.11, 0.05] },
    crossbow: { r: [0, -0.08, 0.28], l: [0, -0.05, -0.36] }, launcher: { r: [0, -0.07, 0.1], l: [0, -0.1, -0.3] }, rpg: { r: [0, -0.1, 0.1], l: [0, -0.1, -0.18] },
    knife: { r: [0, 0, 0.02], l: null }, grapple: { r: [0, -0.04, 0.02], l: null },
  };
  function makeAvatar(p) {
    const g = new THREE.Group();
    g.rotation.order = "YXZ";   // turn first, then tip: a hit player falls over backwards from the feet
    const suit = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe0b894, roughness: 0.8 });
    const boot = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.85 });
    const vest = new THREE.MeshStandardMaterial({ color: 0x3a3d45, roughness: 0.6, metalness: 0.2 });
    const legs = [];
    for (const sx of [-1, 1]) {   // each leg hangs from the hip so it can swing
      const hip = new THREE.Group(); hip.position.set(sx * 0.12, 0.74, 0); g.add(hip);
      addPart(hip, new THREE.BoxGeometry(0.2, 0.52, 0.22), dark, 0, -0.26, 0);
      addPart(hip, new THREE.BoxGeometry(0.22, 0.2, 0.3), boot, 0, -0.64, -0.03);
      legs.push(hip);
    }
    const torso = new THREE.Group(); torso.position.set(0, 0.74, 0); g.add(torso);
    addPart(torso, new THREE.BoxGeometry(0.5, 0.18, 0.3), dark, 0, 0.08, 0);                 // hips and belt line
    addPart(torso, new THREE.BoxGeometry(0.52, 0.04, 0.32), boot, 0, 0.19, 0);               // the belt
    addPart(torso, new THREE.BoxGeometry(0.56, 0.5, 0.32), suit, 0, 0.47, 0);                // chest, in their colour
    addPart(torso, new THREE.BoxGeometry(0.4, 0.36, 0.07), vest, 0, 0.47, -0.17);            // a vest plate on the front
    addPart(torso, new THREE.BoxGeometry(0.34, 0.4, 0.12), vest, 0, 0.45, 0.2);              // and a pack on the back
    for (const sx of [-1, 1]) addPart(torso, new THREE.BoxGeometry(0.16, 0.1, 0.26), suit, sx * 0.33, 0.68, 0);   // shoulders
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.5, 0);
    addPart(headPivot, new THREE.CylinderGeometry(0.075, 0.085, 0.1, 8), skin, 0, 0.0, 0);   // neck
    addPart(headPivot, new THREE.SphereGeometry(0.2, 12, 10), skin, 0, 0.14, 0);
    addPart(headPivot, new THREE.SphereGeometry(0.225, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), suit, 0, 0.15, 0);   // a cap in their colour
    addPart(headPivot, new THREE.BoxGeometry(0.3, 0.075, 0.07), dark, 0, 0.17, -0.175);       // a visor across the eyes: it shows which way they face
    const steel = new THREE.MeshStandardMaterial({ color: 0x4a4e57, roughness: 0.5, metalness: 0.5 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 });
    const guns = {};
    for (const id of GUNS) { guns[id] = makeAvatarGun(id, dark, steel, wood); headPivot.add(guns[id]); }
    const launcher = new THREE.Group();   // the grapple, while they have it out
    addPart(launcher, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 10), dark, 0, 0, -0.2, Math.PI / 2, 0, 0);
    addPart(launcher, new THREE.BoxGeometry(0.04, 0.1, 0.05), steel, 0, -0.07, 0.02);
    launcher.position.set(AV_GUN_X, -0.25, -0.1);
    launcher.visible = false;
    headPivot.add(launcher);
    const knife = new THREE.Group();
    addPart(knife, new THREE.BoxGeometry(0.035, 0.07, 0.3), metalMid, 0, 0, -0.2);
    knife.position.set(AV_GUN_X, -0.25, -0.1);
    knife.visible = false;
    headPivot.add(knife);
    for (const id of GUNS) guns[id].position.x = AV_GUN_X;
    g.add(headPivot);
    // two arms: an upper arm in their colour, a forearm and a glove
    const arms = [];
    for (const sx of [-1, 1]) {
      const upper = addPart(g, new THREE.BoxGeometry(0.11, 1, 0.11), suit, 0, 0, 0);
      const fore = addPart(g, new THREE.BoxGeometry(0.09, 1, 0.09), dark, 0, 0, 0);
      const hand = addPart(g, new THREE.SphereGeometry(0.055, 8, 6), skin, 0, 0, 0);
      arms.push({ sx, upper, fore, hand, shoulder: new THREE.Vector3(sx * 0.34, 1.38, 0) });
    }
    g.userData.pivot = headPivot;
    g.userData.guns = guns;
    g.userData.launcher = launcher;
    g.userData.knife = knife;
    g.userData.legs = legs;
    g.userData.torso = torso;
    g.userData.arms = arms;
    g.userData.reloadK = 0;
    g.userData.walk = 0; g.userData.spd = 0;
    g.userData.tag = makeNameTag(p.name, p.color);
    g.add(g.userData.tag);
    scene.add(g);
    return g;
  }
  const AV_GUN_X = 0.17, AV_DEATH_TIME = 2;   // seconds a player who has been shot lies there before they vanish   // the held thing sits this far right of the neck line
  // a two-bone arm: shoulder to hand, the elbow bending down and outwards
  const _avS = new THREE.Vector3(), _avH = new THREE.Vector3(), _avD = new THREE.Vector3(), _avE = new THREE.Vector3(), _avPole = new THREE.Vector3(), _avQ = new THREE.Quaternion(), _avUp = new THREE.Vector3(0, 1, 0), _avM = new THREE.Vector3();
  const AV_UPPER = 0.3, AV_FORE = 0.3;
  function placeLimb(mesh, from, to, thick) {
    _avD.subVectors(to, from);
    const len = _avD.length() || 1e-4;
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(_avUp, _avD.multiplyScalar(1 / len));
    mesh.scale.set(1, len, 1);
  }
  function poseArm(arm, target) {   // target: where the hand goes, in the avatar's space
    _avS.copy(arm.shoulder);
    _avH.copy(target).sub(_avS);
    let d = _avH.length();
    const reach = (AV_UPPER + AV_FORE) * 0.98;
    if (d > reach) { _avH.multiplyScalar(reach / d); d = reach; }
    if (d < 0.08) { _avH.multiplyScalar(0.08 / Math.max(d, 1e-4)); d = 0.08; }
    _avD.copy(_avH).multiplyScalar(1 / d);
    const along = (AV_UPPER * AV_UPPER - AV_FORE * AV_FORE + d * d) / (2 * d), h = Math.sqrt(Math.max(AV_UPPER * AV_UPPER - along * along, 0));
    _avPole.set(arm.sx * 0.6, -1, 0.25);
    _avPole.addScaledVector(_avD, -_avPole.dot(_avD)).normalize();
    _avE.copy(_avS).addScaledVector(_avD, along).addScaledVector(_avPole, h);
    _avM.copy(_avS).add(_avH);
    placeLimb(arm.upper, _avS, _avE);
    placeLimb(arm.fore, _avE, _avM);
    arm.hand.position.copy(_avM);
  }
  const _avHeld = new THREE.Vector3();
  function poseAvatarArms(m, held, name) {   // after the gun has been moved this frame
    const arms = m.userData.arms, hold = AV_HAND_HOLD[name] || AV_HAND_HOLD.default;
    m.updateMatrixWorld(true);
    for (const arm of arms) {
      const pt = arm.sx > 0 ? hold.r : hold.l;
      if (pt && held) { _avHeld.set(pt[0], pt[1], pt[2]); held.localToWorld(_avHeld); m.worldToLocal(_avHeld); poseArm(arm, _avHeld); }
      else poseArm(arm, _avHeld.set(arm.sx * 0.38, 0.98, -0.02));   // hanging at the side
    }
  }

  function ensureAvatar(p) {
    if (p.id === net.id) return;
    if (!p.mesh) { p.mesh = makeAvatar(p); p.snap = true; }
  }

  function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  // an avatar's attachments: parts added to the gun they belong to (the code is "gun:id,id")
  function refreshAvatarAttachments(p) {
    const ud = p.mesh && p.mesh.userData;
    if (!ud) return;
    p.atBuilt = p.at;
    for (const id of GUNS) {
      const g = ud.guns[id];
      if (g && g.userData.atGroup) { g.remove(g.userData.atGroup); g.userData.atGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); g.userData.atGroup = null; }
      if (g) applyGunSkin(g, "");
    }
    if (ud.guns.rifle.userData.scope) ud.guns.rifle.userData.scope.visible = false;
    if (ud.guns.rifle.userData.stock) ud.guns.rifle.userData.stock.visible = true;
    if (!p.at) return;
    const [gun, list] = p.at.split(":"), mount = AV_MOUNT[gun], target = ud.guns[gun];
    if (!target || !mount) return;
    const known = new Set(Object.values(ATTACHMENTS[gun] || {}).flat().map((o) => o.id));
    const sk = list.split(",").find((x) => x.startsWith("skin-")), skinId = sk && (GUN_SKINS[gun] || []).includes(sk.slice(5)) ? sk.slice(5) : "";
    if (skinId) applyGunSkin(target, skinId);
    const ids = list.split(",").filter((x) => known.has(x));
    if (!ids.length) return;
    if (gun === "rifle" && target.userData.scope) {
      const hi = ids.includes("scope-high");
      target.userData.scope.visible = hi || ids.includes("scope-low");
      target.userData.scope.scale.set(hi ? 1.2 : 0.85, hi ? 1.45 : 0.7, hi ? 1.2 : 0.85);   // the low-zoom scope is short and slim, the high-zoom one long and wide
    }
    if (gun === "rifle" && target.userData.stock) target.userData.stock.visible = !ids.includes("stock-light");
    target.userData.atGroup = attachParts(ids, mount);
    const mp = magParts(ids, mount);
    if (mp) target.userData.atGroup.add(mp);
    target.add(target.userData.atGroup);
  }
  const _avStart = new THREE.Vector3(), _avPos = new THREE.Vector3(), _avDir = new THREE.Vector3();
  function updateAvatars(dt) {
    const k = 1 - Math.exp(-dt * 18);
    for (const p of net.players.values()) {
      if (p.id === net.id || !p.mesh) continue;
      const m = p.mesh, fu = m.userData;
      if (!p.alive) {   // shot dead: they fall over backwards, lie there a moment, then go
        if (p.ropeSet) p.ropeSet.rope.visible = p.ropeSet.head.visible = false;
        if (fu.deadT === undefined) { fu.deadT = 0; fu.deadRoll = (Math.random() - 0.5) * 0.8; fu.tag.visible = false; }
        fu.deadT += dt;
        m.visible = fu.deadT < AV_DEATH_TIME;
        const u = Math.min(fu.deadT / 0.5, 1);
        m.rotation.x = 1.5 * (1 - (1 - u) * (1 - u)); m.rotation.z = fu.deadRoll * u;
        continue;
      }
      if (fu.deadT !== undefined) { fu.deadT = undefined; m.rotation.x = m.rotation.z = 0; fu.tag.visible = true; p.snap = true; }   // back on their feet, at the new spot
      m.visible = true;
      if (fu.lastHp !== undefined && p.hp < fu.lastHp - 0.5) fu.flinch = 1;   // a hit: the body jerks back and the head and gun kick up, then settle
      fu.lastHp = p.hp;
      fu.flinch = Math.max(0, (fu.flinch || 0) - dt * 4);
      if (p.snap) {
        m.position.set(p.x, p.y, p.z); m.rotation.y = p.yaw; p.snap = false;
      } else {
        m.position.x += (p.x - m.position.x) * k;
        m.position.y += (p.y - m.position.y) * k;
        m.position.z += (p.z - m.position.z) * k;
        m.rotation.y += wrapAngle(p.yaw - m.rotation.y) * k;
      }
      m.userData.pivot.rotation.x = p.pitch + fu.flinch * 0.3;
      if (p.atBuilt !== p.at) refreshAvatarAttachments(p);
      const squash = p.sl ? 0.62 : 1;
      m.scale.y += (squash - m.scale.y) * k;
      {   // legs: swing with how fast they are moving (the position we draw, over the time between frames)
        const ud2 = m.userData, mv = Math.hypot(m.position.x - (ud2.lx === undefined ? m.position.x : ud2.lx), m.position.z - (ud2.lz === undefined ? m.position.z : ud2.lz)) / Math.max(dt, 1e-3);
        ud2.lx = m.position.x; ud2.lz = m.position.z;
        ud2.spd += (Math.min(mv, 12) - ud2.spd) * Math.min(1, dt * 10);
        const run = p.sl ? 0 : Math.min(ud2.spd / 6, 1.2);
        ud2.walk += ud2.spd * dt * 1.7;
        ud2.legs[0].rotation.x = Math.sin(ud2.walk) * 0.75 * run;
        ud2.legs[1].rotation.x = -Math.sin(ud2.walk) * 0.75 * run;
        ud2.torso.rotation.x = -0.12 * run + fu.flinch * 0.45;   // a lean into the run, and a jerk back when hit
      }
      const ud = m.userData, gid = WEAPON_ORDER[p.g] || "rifle", grap = p.gr > 0;
      for (const id of GUNS) ud.guns[id].visible = !grap && gid === id;
      ud.knife.visible = !grap && gid === "knife";
      ud.launcher.visible = grap;
      // reloading: the gun drops and tilts; knife swing: a quick arc
      ud.reloadK += ((p.rl && !grap ? 1 : 0) - ud.reloadK) * k;
      const held = ud.guns[gid];
      if (held) { held.rotation.x = ud.reloadK * 0.8; held.position.y = -0.25 - ud.reloadK * 0.1; }
      if (p.swingT > 0) {
        p.swingT -= dt;
        const u = 1 - Math.max(p.swingT, 0) / 0.32;
        ud.knife.rotation.x = -1.2 + 2.4 * u; ud.knife.position.z = -0.1 - 0.25 * Math.sin(u * Math.PI);
      } else { ud.knife.rotation.x = 0; ud.knife.position.z = -0.1; }
      poseAvatarArms(m, grap ? ud.launcher : gid === "knife" ? ud.knife : held, grap ? "grapple" : gid);
      // grapple: the rope runs from their hand to the spear
      if (p.gr === 2 && p.gh) {
        const set = ensureRope(p);
        m.updateMatrixWorld(true);
        ud.launcher.getWorldPosition(_avStart);
        _avPos.set(p.gh[0], p.gh[1], p.gh[2]);
        _avDir.subVectors(_avPos, _avStart);
        if (_avDir.lengthSq() > 0.01) poseRopeOn(set.rope, set.head, _avStart, _avPos, _avDir.normalize());
      } else if (p.ropeSet) p.ropeSet.rope.visible = p.ropeSet.head.visible = false;
    }
  }

  // ---------------- player hit-scan (deathmatch) ----------------
  const _rsV = new THREE.Vector3(), _rsW = new THREE.Vector3(), _rsA = new THREE.Vector3(), _rsB = new THREE.Vector3();

  // closest approach between the shot ray and a vertical capsule axis a->b
  function rayAxisDistance(o, d, a, b) {
    _rsV.subVectors(b, a);
    _rsW.subVectors(o, a);
    const B = d.dot(_rsV), C = _rsV.dot(_rsV), D = d.dot(_rsW), E = _rsV.dot(_rsW);
    const denom = C - B * B;
    let s = denom > 1e-6 ? (E - B * D) / denom : 0;
    s = Math.max(0, Math.min(1, s));
    let t = B * s - D;
    if (t < 0) { t = 0; s = Math.max(0, Math.min(1, E / C)); }
    const dx = _rsW.x + d.x * t - _rsV.x * s, dy = _rsW.y + d.y * t - _rsV.y * s, dz = _rsW.z + d.z * t - _rsV.z * s;
    return { t, dist: Math.sqrt(dx * dx + dy * dy + dz * dz) };
  }

  function raycastPlayers(maxDist) {
    const none = { p: null, dist: Infinity, head: false, point: null };
    if (!net.active || net.sub !== "dm" || net.phase !== "play") return none;
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    let best = none;
    for (const p of net.players.values()) {
      if (p.id === net.id || !p.alive || !p.mesh) continue;
      if (net.teams && localPlayer() && p.team === localPlayer().team) continue;   // shots pass through teammates
      const f = p.mesh.position;
      const c = p.sl ? 0.62 : 1;
      let hit = null, head = false;

      // head first: a small sphere on top of the body
      const hx = f.x - o.x, hy = f.y + 1.62 * c - o.y, hz = f.z - o.z;
      const ht = hx * d.x + hy * d.y + hz * d.z;
      if (ht > 0 && ht < maxDist) {
        const px = hx - d.x * ht, py = hy - d.y * ht, pz = hz - d.z * ht;
        if (px * px + py * py + pz * pz < 0.27 * 0.27) { hit = ht; head = true; }
      }
      if (hit === null) {
        _rsA.set(f.x, f.y + 0.4 * c, f.z);
        _rsB.set(f.x, f.y + 1.35 * c, f.z);
        const r = rayAxisDistance(o, d, _rsA, _rsB);
        if (r.dist < 0.42 && r.t > 0 && r.t < maxDist) hit = r.t;
      }
      if (hit !== null && hit < best.dist) {
        best = { p, dist: hit, head, point: new THREE.Vector3().copy(o).addScaledVector(d, hit) };
      }
    }
    return best;
  }

  // ---------------- events: what actually happens on every peer ----------------
  const KILL_VERBS = { rifle: "sniped", ar: "shot", ak: "sprayed", smg: "riddled", dmr: "dropped", burst: "tapped", lmg: "mowed", crossbow: "bolted", launcher: "exploded", rpg: "rocketed", frag: "fragged", shotgun: "blasted", pistol: "popped", knife: "knifed", knifeThrow: "pinned" };
  function feedLine(html) {
    const el = document.createElement("div");
    el.innerHTML = html;
    mpEls.feed.appendChild(el);
    while (mpEls.feed.children.length > 5) mpEls.feed.firstChild.remove();
    setTimeout(() => el.remove(), 6000);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function syncPlayers(list) {
    if (!Array.isArray(list)) return;
    const seen = new Set();
    for (const raw of list) {
      // everything here came over the network and ends up in the page: force plain types and ranges
      if (!raw || typeof raw !== "object") continue;
      const num = (v) => (Number.isFinite(v) ? v : 0);
      const e = {
        id: String(raw.id).slice(0, 64), name: String(raw.name).replace(/[^\w \-]/g, "").slice(0, 14) || "Player",
        color: Number.isInteger(raw.color) && raw.color >= 0 && raw.color <= 0xffffff ? raw.color : 0xa0a0a8,
        score: num(raw.score), kills: num(raw.kills), deaths: num(raw.deaths), hill: Math.max(0, num(raw.hill)), gg: Math.max(0, Math.min(num(raw.gg), 9)), caps: Math.max(0, Math.min(num(raw.caps), 99)), at: typeof raw.at === "string" && AT_CODE_OK.test(raw.at) ? raw.at : "", heads: Math.max(0, num(raw.heads)), dmg: Math.max(0, num(raw.dmg)), best: Math.max(0, num(raw.best)), bstreak: Math.max(0, num(raw.bstreak)), alive: raw.alive === true,
        hp: Math.max(0, Math.min(Number.isFinite(raw.hp) ? raw.hp : 100, 100)),
        team: raw.team === 0 || raw.team === 1 ? raw.team : -1,
      };
      seen.add(e.id);
      let p = net.players.get(e.id);
      if (!p) { p = makePlayerRecord(e.id, e.name, e.color); net.players.set(e.id, p); }
      const recolored = p.color !== e.color;
      p.name = e.name; p.color = e.color; p.score = e.score; p.kills = e.kills; p.deaths = e.deaths; p.hp = e.hp; p.team = e.team;
      if (net.role !== "host") { p.hill = e.hill; p.gg = e.gg; p.caps = e.caps; if (e.id !== net.id) p.at = e.at; p.heads = e.heads; p.dmg = e.dmg; p.best = e.best; p.bstreak = e.bstreak; }
      if (recolored && p.mesh && e.id !== net.id) disposeAvatar(p);   // a new team colour: the model is rebuilt below
      if (e.id !== net.id) {
        if (net.role === "client") p.alive = e.alive;
        ensureAvatar(p);
      } else {
        score = e.score;
        scoreEl.textContent = score;
      }
    }
    for (const id of [...net.players.keys()]) {
      if (!seen.has(id)) { disposeAvatar(net.players.get(id)); net.players.delete(id); }
    }
    mpRefreshRoomUI();
    mpRefreshScoreboard();
    ggSync();
  }

  // damage numbers: what you just did to someone, floating up from them (white for the body, gold and bigger for the
  // head, red for the hit that kills). They stay attached to the player while they fade.
  const dmgNumsEl = document.getElementById("dmg-numbers");
  const dmgNums = [], _dn = new THREE.Vector3();
  function spawnDamageNumber(p, dmg, head, kill) {
    if (!SETTINGS.damageNumbers || !p || !p.mesh || !(dmg > 0) || dmgNums.length >= 14) return;
    const el = document.createElement("span");
    el.textContent = Math.round(dmg);
    el.className = kill ? "kill" : head ? "head" : "";
    dmgNumsEl.appendChild(el);
    dmgNums.push({ el, p, age: 0, dx: (Math.random() - 0.5) * 36 });
  }
  function updateDamageNumbers(dt) {
    for (let i = dmgNums.length - 1; i >= 0; i--) {
      const n = dmgNums[i];
      n.age += dt;
      if (n.age > 0.95 || !n.p.mesh) { n.el.remove(); dmgNums.splice(i, 1); continue; }
      _dn.copy(n.p.mesh.position); _dn.y += 2.25;
      _dn.project(camera);
      const visible = _dn.z < 1 && _dn.z > -1;
      n.el.style.display = visible ? "block" : "none";
      n.el.style.left = ((_dn.x + 1) / 2 * window.innerWidth + n.dx) + "px";
      n.el.style.top = ((1 - _dn.y) / 2 * window.innerHeight - n.age * 70) + "px";
      n.el.style.opacity = Math.max(0, 1 - Math.pow(n.age / 0.95, 2)).toFixed(2);
    }
  }

  // a red flash that fades, and an arrow toward whoever hit you
  const dmgFlashEl = document.getElementById("dmg-flash"), dmgDirEl = document.getElementById("dmg-dir");
  let dmgFadeTimer = 0;
  function showDamage(byId, lost) {
    dmgFlashEl.style.transition = "none";
    dmgFlashEl.style.opacity = Math.min(0.2 + lost / 100 * 0.6, 0.75).toFixed(2);
    const by = net.players.get(byId);
    if (by && by.mesh) {
      const dx = by.mesh.position.x - yawObject.position.x, dz = by.mesh.position.z - yawObject.position.z;
      const yaw = yawObject.rotation.y;
      const fwd = dx * -Math.sin(yaw) + dz * -Math.cos(yaw), right = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
      dmgDirEl.style.transition = "none";
      dmgDirEl.style.transform = "rotate(" + Math.atan2(right, fwd).toFixed(3) + "rad)";
      dmgDirEl.style.opacity = 1;
    }
    clearTimeout(dmgFadeTimer);
    dmgFadeTimer = setTimeout(() => {
      dmgFlashEl.style.transition = "opacity 0.9s"; dmgFlashEl.style.opacity = 0;
      dmgDirEl.style.transition = "opacity 1.1s"; dmgDirEl.style.opacity = 0;
    }, 60);
  }

  // an arrow round the crosshair pointing at where someone else's shot came from (Settings > Accessibility)
  const soundCuesEl = document.getElementById("sound-cues");
  function soundCue(x, z) {
    const dx = x - yawObject.position.x, dz = z - yawObject.position.z, yaw = yawObject.rotation.y;
    const fwd = dx * -Math.sin(yaw) + dz * -Math.cos(yaw), right = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
    const el = document.createElement("i");
    el.style.transform = "rotate(" + Math.atan2(right, fwd).toFixed(3) + "rad)";
    el.style.transformOrigin = "9px 118px";
    soundCuesEl.appendChild(el);
    while (soundCuesEl.children.length > 6) soundCuesEl.removeChild(soundCuesEl.firstChild);
    setTimeout(() => el.remove(), 1150);
  }

  // When you're killed you watch the player who did it (through their eyes) until you respawn; if they die too, you move on
  // to someone who is still alive. Their model is hidden so you're not inside their head.
  let spec = null;
  const deadSpecEl = document.getElementById("dead-spec");
  function endSpectate() { spec = null; viewmodelRoot.visible = true; if (deadSpecEl) deadSpecEl.textContent = ""; }
  function updateSpectate(dt) {
    if (!localDead || !spec) return;
    let t = net.players.get(spec.id);
    if (!t || !t.alive || t.id === net.id) {
      t = [...net.players.values()].find((q) => q.alive && q.id !== net.id) || null;   // the killer is gone: whoever is next
      spec.id = t ? t.id : null;
    }
    viewmodelRoot.visible = false;
    if (!t) { deadSpecEl.textContent = "Nobody left to watch"; return; }
    const k = 1 - Math.exp(-dt * 16);
    _specTo.set(t.x, t.y + 1.6, t.z);
    yawObject.position.lerp(_specTo, k);
    yawObject.rotation.y += wrapAngle(t.yaw - yawObject.rotation.y) * k;
    pitchObject.rotation.x += (t.pitch - pitchObject.rotation.x) * k;
    camera.rotation.z = 0;
    if (t.mesh) t.mesh.visible = false;
    const gun = WEAPONS[WEAPON_ORDER[t.g]];
    deadSpecEl.textContent = "Watching " + t.name + (gun ? " \u00b7 " + gun.name : "") + " \u00b7 " + Math.ceil(t.hp) + " HP";
  }
  const _specTo = new THREE.Vector3();

  // what happened in this life, for the recap when you die: damage you did to each player, damage and hits you took from each
  const lifeLog = { dealt: new Map(), taken: new Map(), hits: new Map() };
  function lifeLogReset() { lifeLog.dealt.clear(); lifeLog.taken.clear(); lifeLog.hits.clear(); }
  function deathRecap(k, m) {
    const lines = [];
    const gun = WEAPONS[m.w] ? WEAPONS[m.w].name : m.w === "frag" ? "Grenade" : m.knife ? "Knife" : "";
    let dist = null;
    if (k) dist = Math.hypot(k.x - yawObject.position.x, k.z - yawObject.position.z);
    lines.push((gun ? gun : "A hit") + (m.head && !m.knife ? " (headshot)" : "") + (dist !== null ? " from " + Math.round(dist) + " m" : ""));
    const took = lifeLog.taken.get(m.k) || 0, hits = (lifeLog.hits.get(m.k) || 0) + 1;   // (the killing hit is the last one)
    if (hits > 1) lines.push("They hit you " + hits + " times for " + Math.round(took + (Number(m.dmg) || 0)) + " in all");
    const dealt = lifeLog.dealt.get(m.k) || 0;
    lines.push(dealt > 0 ? "You hit them for " + Math.round(dealt) : "You didn't land a hit on them");
    if (k && k.alive && k.hp > 0) lines.push("They have " + Math.round(k.hp) + " health left");
    return lines;
  }
  function setLocalDead(by, killerId, recapLines) {
    localDead = true;
    spec = { id: killerId || null };
    player.velocity.set(0, 0, 0);
    player.sliding = false;
    mouseHeld = false; vm.wantADS = false;
    cancelReload();
    streak = 0; streakEl.textContent = 0;
    mpEls.deadBy.textContent = by ? "by " + by : "";
    document.getElementById("dead-recap").innerHTML = (recapLines || []).map((l) => "<div>" + esc(l) + "</div>").join("");
    mpEls.dead.hidden = false;
  }

  function teleportLocal(x, z) {
    yawObject.position.set(x, 0.25 + player.viewHeight, z);
    yawObject.rotation.y = Math.atan2(x, z);        // face the middle of the arena
    pitchObject.rotation.x = 0;
    player.lastYaw = yawObject.rotation.y;
    player.feetY = 0.25;
    player.velocity.set(0, 0, 0);
    player.onGround = false; player.sliding = false;
    releaseHook(0);
    player.airSpinAccum = 0; player.airSpinNet = 0;
  }

  function resetLocalRound() {
    trickSeen.clear(); trickLog.length = 0;
    lifeLogReset();
    localDead = false;
    endSpectate();
    mpEls.dead.hidden = true;
    streak = 0; streakEl.textContent = 0;
    score = 0; scoreEl.textContent = 0;
    cancelReload();
    refillAmmo();
    updateAmmoHud();
  }

  // who holds the hill, from a round or board message (a host keeps its own, exact numbers)
  function applyHill(m) {
    if (net.role === "host") { updateHillVis(); return; }
    net.hs = Array.isArray(m.hs) ? [m.hs[0] === 1 || m.hs[0] === 2 ? m.hs[0] : 0, typeof m.hs[1] === "string" ? m.hs[1].slice(0, 64) : m.hs[1] === 0 || m.hs[1] === 1 ? m.hs[1] : -1] : [0, -1];
    const th = Array.isArray(m.th) ? m.th : [0, 0];
    net.teamHill = [Math.max(0, Number(th[0]) || 0), Math.max(0, Number(th[1]) || 0)];
    updateHillVis();
  }
  // the flag state from a round or board message (a host keeps its own)
  function applyCtf(m) {
    if (net.role === "host") return;
    if (Array.isArray(m.fl)) {
      for (const t of [0, 1]) {
        const a = m.fl[t];
        if (!Array.isArray(a)) continue;
        net.flags[t] = { s: a[0] === 1 || a[0] === 2 ? a[0] : 0, x: Number(a[1]) || 0, y: Number(a[2]) || 0, z: Number(a[3]) || 0, c: typeof a[4] === "string" ? a[4].slice(0, 64) : null, t: 0 };
      }
    }
    if (Array.isArray(m.cp)) net.caps = [Math.max(0, Number(m.cp[0]) || 0), Math.max(0, Number(m.cp[1]) || 0)];
  }
  function applyRound(m) {
    if (typeof m.map === "string" && MAPS[m.map]) { net.map = m.map; loadMap(m.map); }   // build the host's map first
    net.sub = m.sub;
    net.teams = m.teams === true;
    net.koth = m.koth === true;
    net.br = m.br === true;
    if (Array.isArray(m.zc)) net.zc = [Number(m.zc[0]) || 0, Number(m.zc[1]) || 0];
    net.ctf = m.ctf === true;
    applyCtf(m);
    net.rules = cleanRules(m.rules);
    applyRulePhysics();
    applyHill(m);
    net.limit = Math.max(0, Math.min(Number(m.limit) || 0, 999));
    net.phase = m.phase;
    net.left = m.left; net.leftRecv = nowMs();
    net.cd = Math.max(0, Math.min(Number(m.cd) || 0, 10)); net.cdRecv = nowMs();
    net.ggp = typeof m.gp === "string" ? m.gp.slice(0, 800) : "";
    net.resultsLeft = m.rl || 0;
    if (m.targets) {
      m.targets.forEach((d, i) => { if (targets[i]) { applyTargetData(targets[i], d); targets[i].userData.respawnTimer = 1.1; } });
    } else {
      for (const t of targets) { t.userData.alive = false; t.visible = false; t.userData.respawnTimer = Infinity; }
    }
    if (m.fresh) resetLocalRound();
    syncPlayers(m.p);
    mpRefreshHud();
  }

  function applyEvent(m) {
    switch (m.t) {
      case "round": applyRound(m); break;

      case "board": {
        net.phase = m.phase; net.left = m.left; net.leftRecv = nowMs(); net.resultsLeft = m.rl || 0;
        if (net.role === "client") { net.cd = Math.max(0, Math.min(Number(m.cd) || 0, 10)); net.cdRecv = nowMs(); }
        const off = m.tt - nowMs() / 1000;
        net.ttOffset = net.ttSynced ? net.ttOffset + (off - net.ttOffset) * 0.25 : off;
        net.ttSynced = true;
        if (net.role === "client") net.sub = m.sub;
        applyHill(m);
        applyCtf(m);
        syncPlayers(m.p);
        mpRefreshHud();
        break;
      }

      case "phase":
        net.phase = m.phase; net.resultsLeft = m.rl || 0;
        if (m.phase === "results") { mpEls.dead.hidden = true; mouseHeld = false; endSpectate(); }
        syncPlayers(m.p);
        if (m.phase === "results") achKothResult();
        mpRefreshHud();
        break;

      case "states":
        if (!Array.isArray(m.s)) break;
        for (const s of m.s.slice(0, MAX_PLAYERS + 8)) {
          if (!Array.isArray(s) || s.length < 8 || !s.slice(1, 6).every(Number.isFinite)) continue;
          if (s[0] === net.id) continue;
          const p = net.players.get(s[0]);
          if (!p) continue;
          p.x = s[1]; p.y = s[2]; p.z = s[3]; p.yaw = s[4]; p.pitch = s[5]; p.w = s[6] ? "knife" : "rifle"; p.sl = !!s[7];
          p.g = Number.isInteger(s[8]) && s[8] >= 0 && s[8] < WEAPON_ORDER.length ? s[8] : 0;
          p.rl = s[9] ? 1 : 0;
          p.gr = s[10] === 2 ? 2 : s[10] === 1 ? 1 : 0;
          p.gh = p.gr === 2 && s.length >= 14 && s.slice(11, 14).every(Number.isFinite) ? [s[11], s[12], s[13]] : null;
        }
        break;

      case "swing": {
        const p = net.players.get(m.id);
        if (p && m.id !== net.id) p.swingT = 0.32;
        break;
      }

      case "throw": {
        const o = vec3(m.o, 1000), v = vec3(m.v, 200);
        if (m.id !== net.id && o && v) {
          if (BLAST_KIND[m.b]) { spawnRemoteGrenade(o, v, BLAST_KIND[m.b]); if (WEAPONS[BLAST_KIND[m.b]]) playRemoteShot(BLAST_KIND[m.b], _tmpV1.set(o[0], o[1], o[2]).distanceTo(yawObject.position)); }
          else spawnRemoteKnife(o, v, m.b === 1);
        }
        break;
      }

      case "blast": {
        const o = vec3(m.o, 1000);
        if (!o || m.id === net.id) break;
        showBlast(_tmpV1.set(o[0], o[1], o[2]), DAMAGE[m.k] && DAMAGE[m.k].blast ? DAMAGE[m.k].radius : 4.5);
        for (const g of grenades) if (g.state === "flying" && g.remote && g.mesh.position.distanceTo(_tmpV1) < 3) { retireGrenade(g); break; }
        break;
      }

      case "shot":
        if (m.id === net.id) break;
        {
          const o = vec3(m.o, 1000), d = vec3(m.d, 2), l = Number(m.l);
          if (!o || !d || !Number.isFinite(l)) break;
          _tmpV1.set(o[0], o[1], o[2]);
          _tmpV2.set(d[0], d[1], d[2]);
          const proj = !!(WEAPONS[m.g] && WEAPONS[m.g].projectile);   // a bolt flies as its own object: no instant tracer or mark
          if (!proj) spawnTracer(_tmpV1, _tmpV2, Math.max(0, Math.min(l, 2000)));
          if (!proj && SETTINGS.bulletHoles && l > 0 && l < 249) {   // it ended on a wall or the floor: leave the mark
            raycaster.ray.origin.copy(_tmpV1); raycaster.ray.direction.copy(_tmpV2).normalize();
            const hit = occluderDistance(l + 0.5);
            if (Math.abs(hit - l) < 0.2) spawnDecal(_dP2.copy(_tmpV1).addScaledVector(raycaster.ray.direction, hit), _occNormal, 0.06);
          }
        }
        playRemoteShot(m.g, _tmpV1.distanceTo(yawObject.position));
        if (SETTINGS.soundCues) soundCue(_tmpV1.x, _tmpV1.z);
        break;

      case "tkill": {
        const t = targets[m.i];
        if (!t) break;
        const wasAlive = t.userData.alive;
        t.userData.alive = false; t.visible = false; t.userData.respawnTimer = 1.1;
        if (wasAlive && m.by !== net.id) {
          burst(t.position, t.userData.small ? 0x22d3ee : 0xffd24a, 10);
          playHitSound(0.8);
        }
        break;
      }

      case "tspawn": {
        const t = targets[m.i];
        if (t && m.d && vec3(m.d.b, 1000)) applyTargetData(t, m.d);
        break;
      }

      case "hp": {
        const p = net.players.get(m.id);
        const hp = Math.max(0, Math.min(Number(m.hp) || 0, 100));
        if (m.by === net.id) { spawnDamageNumber(p, Math.max(0, Math.min(Number(m.dmg) || 0, 999)), !!m.head, false); lifeLog.dealt.set(m.id, (lifeLog.dealt.get(m.id) || 0) + (Number(m.dmg) || 0)); }
        if (p) {
          const lost = Math.max(0, p.hp - hp);
          p.hp = hp;
          if (m.id === net.id) { lifeLog.taken.set(String(m.by), (lifeLog.taken.get(String(m.by)) || 0) + lost); lifeLog.hits.set(String(m.by), (lifeLog.hits.get(String(m.by)) || 0) + 1); }
          if (m.id === net.id && lost > 0) showDamage(String(m.by), lost);
        }
        if (m.by === net.id) { flashCrosshair(); playPlayerHit(!!m.head); }   // your hit landed
        break;
      }

      case "kill": {
        if (m.k === net.id && WEAPONS[m.w] && WEAPONS[m.w].usesAmmo) { const kgs = gunStat(m.w); kgs.hits++; announceUnlocks(m.w, kgs.hits); }   // a kill online counts as a hit toward unlocks
        if (m.w === "zone") {   // caught outside the safe zone
          const zv = net.players.get(m.v);
          if (zv) { zv.alive = false; zv.hp = 0; }
          feedLine("<b>" + esc(zv ? zv.name : "?") + "</b> was caught outside the zone");
          if (m.v === net.id) { setLocalDead("the zone", null, ["You were caught outside the safe zone"]); lifeLogReset(); }
          break;
        }
        const k = net.players.get(m.k), v = net.players.get(m.v);
        if (v) { v.alive = false; v.hp = 0; }
        if (m.self || m.k === m.v) {   // caught in their own blast
          feedLine("<b>" + esc(v ? v.name : "?") + "</b> blew themselves up");
          if (m.v === net.id) { setLocalDead("your own blast", null, ["You were caught in your own blast"]); lifeLogReset(); }
          else if (v && v.mesh) burst(v.mesh.position, 0xff5555, 8);
          break;
        }
        if (m.k === net.id) { const res = pendingRes.get(m.v); if (res) awardPoints(res, true); playPlayerHit(!!m.head); spawnDamageNumber(v, Math.max(0, Math.min(Number(m.dmg) || 0, 999)), !!m.head, true); }   // the kill pays out
        pendingRes.delete(m.v);
        const tags = (Array.isArray(m.tags) ? m.tags : []).slice(0, 3).map((t) => String(t).slice(0, 40)).join(" · ");
        feedLine("<b>" + esc(k ? k.name : "?") + "</b> " + ((Object.prototype.hasOwnProperty.call(KILL_VERBS, m.w) ? KILL_VERBS[m.w] : m.knife ? "knifed" : "shot") + (m.head && !m.knife ? " (headshot)" : "")) +
          " <b>" + esc(v ? v.name : "?") + "</b><i>+" + (Number(m.pts) || 0) + (tags ? " " + esc(tags) : "") + "</i>");
        if (m.k === net.id) {
          lifeLog.dealt.delete(m.v);
          showKillBanner("ELIMINATED " + (v ? v.name.toUpperCase() : ""), "+" + (Number(m.pts) || 0), false);
          playKillSound();
          if (net.gungame) setTimeout(() => { if (!killBannerEl.hidden) killBannerEl.querySelector(".kb-sub").innerHTML = ggLevelHtml(); }, 280);   // (the board with your new level arrives a moment later)
        }
        if (m.v === net.id && net.gungame && m.w === "knife") showKillBanner("KNIFED", "back a level", true);
        if (m.v === net.id) { setLocalDead(k ? k.name : "", m.k, deathRecap(k, m)); lifeLogReset(); }
        else if (m.k !== net.id) { playPlayerHit(!!m.head, 0.5); if (v && v.mesh) burst(v.mesh.position, 0xff5555, 8); }
        break;
      }

      case "ctf": {   // a flag was taken, dropped, returned or captured
        if (typeof m.e !== "string") break;
        const who = net.players.get(m.id), nm = who ? esc(who.name) : "someone", team = m.tm === 0 || m.tm === 1 ? m.tm : 0;
        const flagName = TEAM_NAMES[team] + " flag";
        const text = m.e === "pick" ? "<b>" + nm + "</b> took the " + flagName : m.e === "drop" ? "The " + flagName + " was dropped" :
          m.e === "return" ? "The " + flagName + " is back" + (who ? " (<b>" + nm + "</b>)" : "") : m.e === "cap" ? "<b>" + nm + "</b> captured the " + flagName + "!" : "";
        if (text) feedLine(text);
        if (m.e === "cap" || m.e === "pick") playHitSound(m.e === "cap" ? 1.8 : 1.2);
        break;
      }

      case "respawn": {
        const p = net.players.get(m.id);
        if (!Array.isArray(m.pos) || !Number.isFinite(m.pos[0]) || !Number.isFinite(m.pos[1])) break;
        if (p) { p.alive = true; p.hp = 100; p.x = m.pos[0]; p.y = 0.25; p.z = m.pos[1]; p.snap = true; }
        if (m.id === net.id) {
          localDead = false;
          lifeLogReset();
          endSpectate();
          mpEls.dead.hidden = true;
          teleportLocal(m.pos[0], m.pos[1]);
          cancelReload(); refillAmmo(); updateAmmoHud();
          localProtectUntil = net.sub === "dm" && !net.range && m.op !== 1 ? nowMs() + PROTECT_MS : 0;
          localSpawn = [m.pos[0], m.pos[1]];
        }
        break;
      }
    }
  }
  const spawnProtEl = document.getElementById("spawn-prot");
  let localSpawn = [0, 0];
  let localProtectUntil = 0;   // (the host decides; this only drives the SPAWN PROTECTED label)
  const _tmpV1 = new THREE.Vector3(), _tmpV2 = new THREE.Vector3(), _dP2 = new THREE.Vector3();

  // someone else's shot: the recording of that gun, quieter and a touch further back the further away they are
  function playRemoteShot(gun, dist) {
    const g = typeof gun === "string" && WEAPONS[gun] && !WEAPONS[gun].isMelee ? gun : "rifle";
    const level = Math.max(0.12, Math.min(1 / (1 + (dist || 0) / 16), 0.85));
    playShotSound(WEAPONS[g].sound, level);
  }

  // ---------------- local actions that need to reach the host ----------------
  function sendToHost(msg) {
    if (net.role === "host") hostHandle(net.id, msg);
    else if (net.hostConn && net.hostConn.open) net.hostConn.send(msg);
  }
  function mpSendShot(origin, dir, dist) {
    sendToHost({ t: "shot", g: vm.current, o: [r2(origin.x), r2(origin.y), r2(origin.z)], d: [r2(dir.x * 1000) / 1000, r2(dir.y * 1000) / 1000, r2(dir.z * 1000) / 1000], l: r2(dist) });
  }
  function mpSendThrow(pos, vel, bolt) {
    sendToHost({ t: "throw", o: [r2(pos.x), r2(pos.y), r2(pos.z)], v: [r2(vel.x), r2(vel.y), r2(vel.z)], b: typeof bolt === "number" ? bolt : bolt ? 1 : 0 });
  }
  // a thrown knife from another player: it flies and sticks on every screen, but only its owner scores with it
  function spawnRemoteKnife(o, v, bolt) {
    const k = thrownPool.find((q) => q.state === "idle") || thrownPool.reduce((a, b) => (a.age > b.age ? a : b));
    if (k.root.parent !== scene) scene.add(k.root);
    k.root.position.set(o[0], o[1], o[2]);
    k.from.copy(k.root.position);
    k.vel.set(v[0], v[1], v[2]);
    k.snap = null; k.remote = true; k.age = 0; k.state = "flying";
    setThrownModel(k, !!bolt);
    k.root.visible = true;
    k.root.scale.setScalar(1);
    k.spin.rotation.set(0, 0, 0);
    faceAlongVelocity(k);
  }
  function mpTargetHit(target, pts) { sendToHost({ t: "hit", i: target.userData.idx, pts }); }

  const _pseudoTarget = { userData: { small: false, moving: false } };
  const pendingRes = new Map();   // victim id -> the score of the latest hit on them, paid out only if that hit turns out to be the kill
  function mpPvpHit(pres, isKnife, ammoBefore, weapon, snap, thrown, pellets, heads) {
    const res = computeMultipliers(_pseudoTarget, pres.dist, isKnife, ammoBefore, snap, !!thrown, weapon);
    if (pres.head && !isKnife) { res.mult *= 1.5; res.tags.push("HEADSHOT x1.50"); }
    pendingRes.set(pres.p.id, res);
    burst(pres.point, 0xff5555, 8);
    sendToHost({ t: "hurt", v: pres.p.id, pts: Math.round(CFG.basePoints * res.mult * (res.scale || 1)), tags: res.tags, head: !!pres.head,
      knife: !!isKnife, thr: !!thrown, n: pellets || 1, h: heads || 0 });
  }

  // ---------------- host logic ----------------
  function boardList() {
    return [...net.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, kills: p.kills, deaths: p.deaths, hill: Math.round(p.hill * 10) / 10, gg: p.gg, caps: p.caps, at: p.at, heads: p.heads, dmg: Math.round(p.dmg), best: p.best, bstreak: p.bstreak, alive: p.alive, hp: Math.round(p.hp), team: p.team }));
  }
  function hostSendRaw(m) { for (const c of net.conns.values()) if (c.open) c.send(m); }
  function hostBroadcast(m) { hostSendRaw(m); applyEvent(m); }
  function hostBoardMsg() {
    return { t: "board", p: boardList(), sub: net.sub, left: net.left, cd: net.cd, phase: net.phase, rl: net.resultsLeft, tt: mpTargetClock(), fl: net.flags.map((f) => [f.s, Math.round(f.x * 100) / 100, Math.round(f.y * 100) / 100, Math.round(f.z * 100) / 100, f.c]), cp: net.caps, hs: net.hs, th: [Math.round(net.teamHill[0] * 10) / 10, Math.round(net.teamHill[1] * 10) / 10] };
  }
  function hostBroadcastBoard() { hostBroadcast(hostBoardMsg()); }
  function roundMsg(fresh) {
    return {
      t: "round", cd: net.cd, gp: net.ggp, map: net.map, sub: net.sub, teams: net.teams, koth: net.koth, br: net.br, zc: net.zc, ctf: net.ctf, fl: net.flags.map((f) => [f.s, f.x, f.y, f.z, f.c]), cp: net.caps, rules: net.rules, hs: net.hs, th: net.teamHill, limit: net.limit, left: net.left, phase: net.phase, rl: net.resultsLeft, fresh: !!fresh, p: boardList(),
      targets: net.sub === "race" ? targets.map(serializeTarget) : null, tt: mpTargetClock(),
    };
  }

  function mpAnnounceSpawn(t) { hostBroadcast({ t: "tspawn", i: t.userData.idx, d: serializeTarget(t) }); }

  // Spawning. Each map has a list of open spots. A new spawn is chosen by score: far from anyone who could shoot you (never next to an
  // enemy if there is another choice), never on top of anyone, not where someone spawned in the last few seconds, and in a team mode
  // near your team without being right on top of them. At the start of a team round each team takes its own end of the map.
  function spawnSides() {   // the two ends of the map: the farthest pair of spawn points, and every spawn goes to the nearer one
    let a = SPAWNS[0], b = SPAWNS[1] || SPAWNS[0], far = -1;
    for (let i = 0; i < SPAWNS.length; i++) for (let k = i + 1; k < SPAWNS.length; k++) {
      const d = Math.hypot(SPAWNS[i][0] - SPAWNS[k][0], SPAWNS[i][1] - SPAWNS[k][1]);
      if (d > far) { far = d; a = SPAWNS[i]; b = SPAWNS[k]; }
    }
    const sides = [[], []];
    for (const s of SPAWNS) sides[Math.hypot(s[0] - a[0], s[1] - a[1]) <= Math.hypot(s[0] - b[0], s[1] - b[1]) ? 0 : 1].push(s);
    return sides;
  }
  function pickSpawn(exceptId, opening) {
    const me = net.players.get(exceptId), teamed = net.teams && me && me.team >= 0;
    let pool = SPAWNS;
    if (opening && teamed) {
      if (net.ctf && currentMap.flags) { const b = ctfBase(me.team); pool = SPAWNS.slice().sort((a, c) => Math.hypot(a[0] - b.x, a[1] - b.z) - Math.hypot(c[0] - b.x, c[1] - b.z)).slice(0, 6); }
      else pool = spawnSides()[me.team];
      if (!pool.length) pool = SPAWNS;
    } else if (teamed && net.ctf && currentMap.flags) {   // capture the flag, a respawn: only on your own side of the map, or in the neutral middle band
      const mine = ctfBase(me.team), theirs = ctfBase(1 - me.team), band = Math.hypot(mine.x - theirs.x, mine.z - theirs.z) * 0.2;
      const own = SPAWNS.filter((s) => Math.hypot(s[0] - mine.x, s[1] - mine.z) - Math.hypot(s[0] - theirs.x, s[1] - theirs.z) <= band);
      if (own.length) pool = own;
    }
    const now = nowMs();
    net.recentSpawns = (net.recentSpawns || []).filter((r) => now - r.t < 6000);
    let best = pool[0], bestScore = -1e9;
    for (const s of pool) {
      let dEnemy = 99, dMate = 99, dAny = 99;
      for (const q of net.players.values()) {
        if (q.id === exceptId || !q.alive) continue;
        const d = Math.hypot(q.x - s[0], q.z - s[1]);
        dAny = Math.min(dAny, d);
        if (teamed && q.team === me.team) dMate = Math.min(dMate, d); else dEnemy = Math.min(dEnemy, d);
      }
      let sc = Math.min(dEnemy, 40) * 1.5;
      if (dEnemy < 10) sc -= 60;
      if (dAny < 3.5) sc -= 80;
      if (teamed && dMate < 99) sc += 14 - Math.min(Math.abs(dMate - 9), 14);
      for (const r of net.recentSpawns) if (Math.hypot(r.x - s[0], r.z - s[1]) < 8) sc -= 30;
      sc += Math.random() * 5;
      if (sc > bestScore) { bestScore = sc; best = s; }
    }
    net.recentSpawns.push({ x: best[0], z: best[1], t: now });
    return best;
  }

  function hostRespawn(p, opening) {
    const spots = currentMap.rangeSpots;
    const s = net.range && p.bot && spots ? spots[Math.max(0, p.botIndex) % spots.length] : pickSpawn(p.id, opening);
    p.alive = true; p.x = s[0]; p.y = 0.25; p.z = s[1]; p.spawnX = s[0]; p.spawnZ = s[1];
    p.hp = 100; p.lastDamageAt = -1e9;
    if (p.bot) botReset(p, s);
    p.protectUntil = net.sub === "dm" && !net.range && !opening ? nowMs() + PROTECT_MS : 0;   // safe for a second after a respawn, or until you shoot (the first spawn of a round has the 3-2-1 instead)
    hostBroadcast({ t: "respawn", id: p.id, pos: s, op: opening ? 1 : 0 });
  }

  function hostStartRound() {
    net.botBolts = [];   // (a bot's crossbow bolts still in the air)
    let mapId = net.pendingMap === "random" ? pickRandomMap(currentMap.id) : MAPS[net.pendingMap] ? net.pendingMap : "arena";
    if (net.pendingKoth && net.pendingSub !== "race" && !MAPS[mapId].hill) mapId = MAP_ORDER.find((i) => MAPS[i].hill) || mapId;   // King of the Hill needs a hill
    if (net.pendingRange) mapId = "range";   // and the range is its own map
    if (net.pendingCtf && net.pendingSub !== "race" && !MAPS[mapId].flags) mapId = MAP_ORDER.find((i) => MAPS[i].flags) || mapId;   // capture the flag needs flag bases
    net.map = mapId;
    loadMap(net.map);   // (does nothing if it is already the map)
    net.sub = net.pendingSub;
    net.teams = net.sub === "dm" && net.pendingTeams;
    net.koth = net.sub === "dm" && net.pendingKoth;
    net.range = net.sub === "dm" && net.pendingRange;
    net.gungame = net.sub === "dm" && net.pendingGun;
    net.ggp = net.gungame ? makeGgPreset() : "";
    net.br = net.sub === "dm" && net.pendingBr;
    net.zc = net.br ? [(Math.random() * 2 - 1) * CFG.arenaHalfSize * 0.25, (Math.random() * 2 - 1) * CFG.arenaHalfSize * 0.25] : [0, 0];
    net.ctf = net.sub === "dm" && net.pendingCtf && !!currentMap.flags;
    ctfReset();
    net.rules = cleanRules(net.pendingRules);
    applyRulePhysics();
    net.hs = [0, -1]; net.teamHill = [0, 0];
    updateHillVis();
    net.limit = net.sub === "dm" && !net.range && !net.gungame && !net.br ? net.pendingLimit : 0;
    net.teams = net.teams || net.ctf;
    let slot = 0;
    for (const q of net.players.values()) {   // teams: you with the first half of the bots in practice, otherwise alternating as people joined
      const was = q.color;
      if (net.teams) { q.team = net.practice ? (q.bot ? (q.botIndex < Math.floor(net.botCount / 2) ? 0 : 1) : 0) : (slot++ % 2); q.color = TEAM_COLORS[q.team]; }
      else { q.team = -1; q.color = q.baseColor; }
      if (q.color !== was && q.mesh) disposeAvatar(q);   // the model and the name tag are rebuilt in the new colour
      ensureAvatar(q);
    }
    net.phase = "play";
    net.cd = net.range ? 0 : 3;   // the 3-2-1 (the range has none: it is practice)
    net.left = net.range ? 3599 : ROUND_SECONDS;
    net.resultsLeft = 0;
    for (const p of net.players.values()) { p.score = 0; p.kills = 0; p.deaths = 0; p.hill = 0; p.gg = 0; p.caps = 0; p.heads = 0; p.dmg = 0; p.best = 0; p.streak = 0; p.bstreak = 0; p.alive = true; p.hp = 100; p.lastDamageAt = -1e9; }
    if (net.sub === "race") for (const t of targets) { respawnTarget(t); t.userData.respawnTimer = 1.1; }
    hostBroadcast(roundMsg(true));
    net.recentSpawns = [];
    for (const p of net.players.values()) p.alive = false;   // nobody counts as standing somewhere until they are placed
    for (const p of net.players.values()) hostRespawn(p, true);
  }

  function hostEndRound() {
    net.phase = "results";
    net.resultsLeft = RESULTS_SECONDS;
    hostBroadcast({ t: "phase", phase: "results", rl: net.resultsLeft, p: boardList() });
  }

  const teamCount = (t) => [...net.players.values()].filter((q) => q.team === t).length;
  function hostAddPlayer(conn, hello) {
    const used = new Set([...net.players.values()].map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0];
    const name = String(hello.name || "Player").replace(/[^\w \-]/g, "").trim().slice(0, 14) || "Player";
    const p = makePlayerRecord(conn.peer, name, color);
    if (net.teams) { p.team = teamCount(0) <= teamCount(1) ? 0 : 1; p.color = TEAM_COLORS[p.team]; }
    net.players.set(conn.peer, p);
    ensureAvatar(p);
    conn.send(roundMsg(false));
    hostRespawn(p);
    hostBroadcastBoard();
  }

  function hostRemovePlayer(id) {
    net.conns.delete(id);
    const p = net.players.get(id);
    if (!p) return;
    disposeAvatar(p);
    net.players.delete(id);
    feedLine("<b>" + esc(p.name) + "</b> left");
    hostBroadcastBoard();
  }

  // three finite numbers, each within +-limit, or null (network data is never trusted to be well formed)
  function vec3(a, limit) {
    if (!Array.isArray(a) || a.length !== 3) return null;
    for (const n of a) if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > limit) return null;
    return [a[0], a[1], a[2]];
  }

  // The host can't see the shots, so it checks that a claimed kill is believable against what it did see: a
  // gun kill needs that player's shot message just before it, aimed near the victim; a knife swing needs them close;
  // a thrown knife needs a throw in the last few seconds. Lag makes the host's picture of a moving player
  // a little old, so the aim check is generous (it still rules out a kill from across the map).
  const AIM_SLACK = 5, SWING_SLACK = 6, SHOT_WINDOW = 1500, THROW_WINDOW = 6000, MSG_BURST = 80, MSG_PER_SEC = 50, MSG_KICK = 300;
  // returns what the claim was made with ("knife", "knifeThrow" or a gun id), or null if it isn't believable
  function checkClaim(p, v, m, now) {
    if (m.knife && m.thr) {
      if (p.knivesUp <= 0 || now - p.lastThrowAt > THROW_WINDOW) return null;
      p.knivesUp--;
      return "knifeThrow";
    }
    if (m.knife) {
      if (now - p.lastMeleeAt < 250) return null;
      if (Math.hypot(p.x - v.x, p.z - v.z) > SWING_SLACK || Math.abs(p.y - v.y) > SWING_SLACK) return null;
      p.lastMeleeAt = now; p.lastFireAt = now;
      return "knife";
    }
    const sh = p.lastShot;
    if (!sh || now - p.lastShotAt > SHOT_WINDOW) return null;
    p.lastShot = null;   // one shot, one claim
    const len = Math.hypot(sh.d[0], sh.d[1], sh.d[2]) || 1;
    const dx = sh.d[0] / len, dy = sh.d[1] / len, dz = sh.d[2] / len;
    const qx = v.x - sh.o[0], qy = v.y + 0.9 - sh.o[1], qz = v.z - sh.o[2];
    const t = qx * dx + qy * dy + qz * dz;
    if (t < 0 || t > sh.l + AIM_SLACK) return null;
    return Math.hypot(qx - dx * t, qy - dy * t, qz - dz * t) <= AIM_SLACK ? sh.g : null;
  }
  function hostDamage(p, v, m, g) {
    if (g === "knife") return KNIFE_SWING_DMG;
    if (g === "knifeThrow") return m.head ? KNIFE_THROW_HEAD_DMG : KNIFE_THROW_DMG;
    const d = DAMAGE[g];
    if (!d) return 0;
    if (g === "shotgun") {
      const n = Math.max(1, Math.min(Math.floor(Number(m.n)) || 1, d.pellets)), h = Math.max(0, Math.min(Math.floor(Number(m.h)) || 0, n));
      const dist = Math.hypot(p.x - v.x, p.z - v.z);
      const f = dist <= d.near ? 1 : Math.max(d.farMult, 1 - (1 - d.farMult) * (dist - d.near) / (d.far - d.near));
      return d.pellet * f * (n - h + h * d.headMult);
    }
    const base = m.head ? d.head : d.body;
    if (d.far) {   // a single-shot gun whose damage fades with distance
      const dist = Math.hypot(p.x - v.x, p.z - v.z);
      return base * (dist <= d.near ? 1 : Math.max(d.farMult, 1 - (1 - d.farMult) * (dist - d.near) / (d.far - d.near)));
    }
    return base;
  }
  // a connection may send this many messages: a burst, then a steady rate (normal play is about 20 a second)
  function takeToken(b, now) {
    b.tok = Math.min(MSG_BURST, b.tok + (now - b.t) / 1000 * MSG_PER_SEC);
    b.t = now;
    if (b.tok < 1) return false;
    b.tok -= 1;
    return true;
  }

  // damage lands on a player: the hit marker, or the kill if it was the last of their health. `info` carries
  // the points of the shot (paid only on a kill) and whether it was a headshot or a knife
  function hostDealDamage(p, v, dmg, info) {
    const rules = net.rules || {}, self = p === v;   // (self: caught in your own blast)
    if (self && (rules.oneShot || rules.headOnly)) return;
    if (rules.headOnly && !info.head && !info.knife) return;   // only headshots (and the knife) count
    if (rules.oneShot) dmg = Math.max(dmg, 1000);
    if (!self) p.dmg += Math.min(dmg, Math.max(v.hp, 0));   // damage actually dealt
    v.hp -= dmg; v.lastDamageAt = nowMs();
    if (v.hp > 0) { hostBroadcast({ t: "hp", id: v.id, hp: Math.round(v.hp), by: self ? "" : p.id, head: !!info.head, dmg: Math.round(dmg) }); return; }
    v.hp = 0;
    if (self) {   // blown up by your own blast: a death, but nobody scores
      v.alive = false; v.diedAt = nowMs(); v.deaths++; v.respawnAt = net.br ? Infinity : nowMs() + (rules.fastResp ? 1000 : net.range ? 1200 : RESPAWN_MS); v.streak = 0;
      hostBroadcast({ t: "kill", k: p.id, v: v.id, w: typeof info.g === "string" ? info.g : "", dmg: Math.round(dmg), pts: 0, tags: [], head: false, knife: false, self: 1 });
      hostBroadcastBoard();
      return;
    }
    const pts = Math.max(0, Math.min(Number(info.pts) || 0, 20000));   // only a kill scores
    v.alive = false; v.diedAt = nowMs(); v.deaths++; v.respawnAt = net.br ? Infinity : nowMs() + (rules.fastResp ? 1000 : net.range ? 1200 : RESPAWN_MS);
    p.kills++; p.score += pts;
    if (info.head) p.heads++;
    p.best = Math.max(p.best, pts); p.streak++; p.bstreak = Math.max(p.bstreak, p.streak); v.streak = 0;
    if (rules.siphon && p.alive && p !== v) { p.hp = 100; hostBroadcast({ t: "hp", id: p.id, hp: 100, by: "", head: false, dmg: 0 }); }   // siphon: a kill refills your health
    let ggWin = false;
    if (net.gungame) {
      if (info.knife && v.gg > 0) v.gg--;   // knifed: back a level
      if (p.gg >= GG_ORDER.length) { ggWin = !!info.knife; if (ggWin) p.gg = GG_ORDER.length + 1; }   // on the knife: a knife kill wins (bots too: they run up and stab), and that kill is the last of the 11
      else { p.gg++; ggBotGun(p); }
    }
    hostBroadcast({ t: "kill", k: p.id, v: v.id, w: typeof info.g === "string" ? info.g : "", dmg: Math.round(dmg), pts, tags: Array.isArray(info.tags) ? info.tags.slice(0, 6).map((t) => String(t).slice(0, 40)) : [], head: !!info.head, knife: !!info.knife });
    hostBroadcastBoard();
    if (ggWin && net.phase === "play") hostEndRound();
    if (net.limit && !net.koth && !net.ctf && net.phase === "play" && (net.teams ? teamKills(p.team) : p.kills) >= net.limit) hostEndRound();   // the kill limit is reached
  }

  function hostHandle(fromId, m) {
    const p = net.players.get(fromId);
    if (!p || !m || typeof m !== "object") return;
    p.lastRecv = nowMs();
    switch (m.t) {
      case "st":
        if (p.alive && Number.isFinite(m.x + m.y + m.z + m.yaw + m.pitch)) {
          p.x = m.x; p.y = m.y; p.z = m.z; p.yaw = m.yaw; p.pitch = m.pitch; p.w = m.w ? "knife" : "rifle"; p.sl = !!m.sl;
          if (p.protectUntil && p.spawnX !== undefined && (Math.hypot(m.x - p.spawnX, m.z - p.spawnZ) > 0.4 || Math.abs(m.y - 0.25) > 0.3)) p.protectUntil = 0;   // moving ends spawn protection
          p.g = Number.isInteger(m.g) && m.g >= 0 && m.g < WEAPON_ORDER.length ? m.g : 0;
          p.rl = m.rl ? 1 : 0;
          p.at = typeof m.at === "string" && AT_CODE_OK.test(m.at) ? m.at : "";
          p.gr = m.gr === 2 ? 2 : m.gr === 1 ? 1 : 0;
          p.gh = p.gr === 2 ? vec3(m.gh, 1000) : null;
        }
        break;

      case "swing":
        if (p.alive && nowMs() - p.lastSwingAt >= 150) { p.lastSwingAt = nowMs(); p.protectUntil = 0; hostBroadcast({ t: "swing", id: fromId }); }
        break;

      case "shot": {
        const o = vec3(m.o, 1000), d = vec3(m.d, 2), l = Number(m.l);
        const g = typeof m.g === "string" && WEAPONS[m.g] && !WEAPONS[m.g].isMelee ? m.g : null;
        const now = nowMs();
        if (p.alive && o && d && Number.isFinite(l) && g && now - p.lastFireAt >= WEAPONS[g].fireRate * 500) {   // faster than the gun can fire: dropped
          const len = Math.max(0, Math.min(l, 2000));
          p.lastShot = { o, d, l: len, g }; p.lastShotAt = now; p.lastFireAt = now; p.protectUntil = 0;   // shooting ends spawn protection
          hostBroadcast({ t: "shot", id: fromId, g, o, d, l: len });
        }
        break;
      }

      case "throw": {
        const o = vec3(m.o, 1000), v = vec3(m.v, 200);
        const now = nowMs();
        const nade = m.b >= 2 && m.b <= 5;
        if (p.alive && o && v && now - p.lastThrowAt >= WEAPONS.knife.throwGap && !(m.b === 3 && (net.gungame || now - (p.lastFragAt || -1e9) < 6000)) && !(m.b === 5 && (net.gungame || now - (p.lastPackAt || -1e9) < 2500))) {
          if (now - p.lastThrowAt > THROW_WINDOW) p.knivesUp = 0;
          if (m.b !== 1 && !nade) p.knivesUp = Math.min(p.knivesUp + 1, 4);   // (a crossbow bolt is claimed through its shot message, a grenade through its blast, not as a knife)
          if (nade) { p.grenades = Math.min((p.grenades || 0) + 1, 4); p.lastGrenadeAt = now; p.lastGrenadeO = o; if (m.b === 3) p.lastFragAt = now; if (m.b === 5) p.lastPackAt = now; }
          p.lastThrowAt = now; p.lastFireAt = now; p.protectUntil = 0;
          hostBroadcast({ t: "throw", id: fromId, o, v, b: nade || m.b === 1 ? m.b : 0 });
        }
        break;
      }

      case "hit": {
        if (net.sub !== "race" || net.phase !== "play" || net.cd > 0) break;
        const t = targets[m.i];
        if (!t || (fromId !== net.id && !t.userData.alive)) break;   // someone beat them to it
        if (nowMs() - p.lastHitAt < 120) break;                      // nobody hits two targets in a blink
        p.lastHitAt = nowMs();
        const pts = Math.max(0, Math.min(Number(m.pts) || 0, 20000));
        p.score += pts; p.kills++;
        hostBroadcast({ t: "tkill", i: m.i, by: fromId });
        hostBroadcastBoard();
        break;
      }

      case "blast": {   // a grenade went off: the thrower says where and who was in it; the host believes it if a grenade was really thrown and works the damage out from where the victims are
        const o = vec3(m.o, 1000), now = nowMs();
        if (!o || net.sub !== "dm" || net.phase !== "play" || net.cd > 0) break;
        if (!p.alive && now - (p.diedAt || 0) > 2500) break;
        if (!(p.grenades > 0) || now - p.lastGrenadeAt > 8000) break;
        const L = p.lastGrenadeO;
        if (L && Math.hypot(o[0] - L[0], o[1] - L[1], o[2] - L[2]) > 160) break;
        p.grenades--;
        const bk = m.k === "frag" || m.k === "rpg" || m.k === "satchel" ? m.k : "launcher";
        hostBroadcast({ t: "blast", id: fromId, o, k: bk });
        const done = new Set();
        for (const h of (Array.isArray(m.h) ? m.h : []).slice(0, 8)) {
          const v = h && net.players.get(h.v);
          if (!v || !v.alive || done.has(v.id) || (v === p && bk === "satchel")) continue;   // (your own blast hurts you, except the blast pack)
          done.add(v.id);
          if (net.teams && v.team === p.team && v !== p) continue;
          if (now < v.protectUntil) continue;
          const d = Math.hypot(v.x - o[0], v.y + 0.9 - o[1], v.z - o[2]);
          if (d > DAMAGE[bk].radius + 2) continue;   // (a little slack: the host's picture of a moving player is a bit old)
          hostDealDamage(p, v, blastDamage(Math.min(d, DAMAGE[bk].radius), bk), { g: bk, pts: Math.max(0, Math.min(Number(h.pts) || 0, 20000)), tags: Array.isArray(h.tags) ? h.tags : [], head: false });
        }
        break;
      }

      case "hurt": {
        const v = net.players.get(m.v);
        if (net.sub !== "dm" || net.phase !== "play" || net.cd > 0 || !v || v === p || !v.alive) break;
        if (!p.alive && nowMs() - (p.diedAt || 0) > 2500) break;   // (a bolt or a knife already flying when its thrower died still counts)
        if (net.teams && v.team === p.team) break;   // no friendly fire
        if (nowMs() < v.protectUntil) break;
        const g = checkClaim(p, v, m, nowMs());
        if (!g) break;
        const dmg = hostDamage(p, v, m, g);
        if (dmg <= 0) break;
        hostDealDamage(p, v, dmg, Object.assign({}, m, { g }));
        break;
      }
    }
  }

  function localStateMsg() {
    return {
      t: "st", x: r2(yawObject.position.x), y: r2(player.feetY), z: r2(yawObject.position.z),
      yaw: r2(yawObject.rotation.y * 100) / 100, pitch: r2(pitchObject.rotation.x * 100) / 100,
      w: vm.current === "knife" ? 1 : 0, sl: player.sliding ? 1 : 0,
      g: WEAPON_ORDER.indexOf(vm.current), rl: reload.active ? 1 : 0, at: attachCode(),
      gr: player.hook ? 2 : player.grappleWant ? 1 : 0,
      gh: player.hook ? [r2(player.hook.pos.x), r2(player.hook.pos.y), r2(player.hook.pos.z)] : null,
    };
  }

  // Capture the flag. Each map has `flags: [[x, z, y], [x, z, y]]`: the bases of team 0 and team 1. A flag is home (0), carried (1) or dropped (2).
  const CTF_PICKUP = 1.7, CTF_DROP_SECONDS = 15;
  function ctfBase(t) { const b = currentMap && currentMap.flags && currentMap.flags[t]; return b ? { x: b[0], z: b[1], y: b[2] === undefined ? FLOOR_Y : b[2] } : { x: 0, z: 0, y: FLOOR_Y }; }
  // the highest floor, roof, deck or crate top under a point that is no higher than the point (a flag dropped in mid-air falls to this)
  function surfaceBelow(x, y, z) {
    if (!groundBoxes) groundBoxes = groundMeshes.map((m) => new THREE.Box3().setFromObject(m));
    let best = FLOOR_Y;
    for (const list of [wallBoxes, groundBoxes]) for (const b of list) {
      if (b.gate || x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
      if (b.max.y <= y && b.max.y > best) best = b.max.y;
    }
    return best;
  }
  function ctfSendHome(t) { const b = ctfBase(t), f = net.flags[t]; f.s = 0; f.x = b.x; f.y = b.y; f.z = b.z; f.c = null; f.t = 0; }
  function ctfReset() { net.caps = [0, 0]; ctfSendHome(0); ctfSendHome(1); for (const p of net.players.values()) p.caps = 0; }
  const ctfNeed = () => Math.max(1, Math.round(net.limit / 5)) || 3;
  function hostCtfTick(dt) {
    if (!currentMap || !currentMap.flags) return;
    for (const t of [0, 1]) {
      const f = net.flags[t];
      if (f.s === 1) {   // carried: it goes where its carrier goes, and drops if they die or leave
        const c = net.players.get(f.c);
        if (!c || !c.alive) { f.s = 2; f.t = CTF_DROP_SECONDS; if (c) { f.x = c.x; f.y = c.y; f.z = c.z; } f.y = surfaceBelow(f.x, f.y + 0.4, f.z); hostBroadcast({ t: "ctf", e: "drop", id: f.c, tm: t }); f.c = null; }
        else { f.x = c.x; f.y = c.y; f.z = c.z; }
      } else {
        if (f.s === 2) { f.t -= dt; if (f.t <= 0) { ctfSendHome(t); hostBroadcast({ t: "ctf", e: "return", id: null, tm: t }); continue; } }
        for (const p of net.players.values()) {
          if (!p.alive || Math.hypot(p.x - f.x, p.z - f.z) > CTF_PICKUP || Math.abs(p.y - f.y) > 2.4) continue;
          if (p.team === t) { if (f.s === 2) { ctfSendHome(t); hostBroadcast({ t: "ctf", e: "return", id: p.id, tm: t }); } }   // your own dropped flag goes home when you touch it
          else { f.s = 1; f.c = p.id; hostBroadcast({ t: "ctf", e: "pick", id: p.id, tm: t }); break; }
        }
      }
    }
    // a carrier who is back at their own base, with their own flag home, scores
    for (const t of [0, 1]) {
      const f = net.flags[t];
      if (f.s !== 1) continue;
      const c = net.players.get(f.c), own = 1 - t, base = ctfBase(own);
      if (!c || !c.alive || net.flags[own].s !== 0) continue;
      if (Math.hypot(c.x - base.x, c.z - base.z) > CTF_PICKUP + 0.6 || Math.abs(c.y - base.y) > 2.4) continue;
      net.caps[own]++; c.caps++; c.score += 0;
      ctfSendHome(t);
      hostBroadcast({ t: "ctf", e: "cap", id: c.id, tm: t });
      hostBroadcastBoard();
      if (net.limit > 0 && net.caps[own] >= ctfNeed()) hostEndRound();
    }
  }

  // Battle royale: a circle that closes in on a timetable (the same on every computer: it reads the round clock)
  // [starts at (s), shrinks for (s), to this fraction of the half-size, damage a second outside while it is the current stage]
  const BR_STAGES = [[10, 18, 0.62, 10], [38, 18, 0.34, 10], [66, 18, 0.14, 10], [94, 16, 0.05, 10]];   // a faster closing: it is all shut by 110 s
  const BR_TICK = 0.5, BR_TICK_DAMAGE = 10;   // outside the circle: 10 damage every half second
  function brZoneAt(t) {
    const half = CFG.arenaHalfSize;
    let prev = half * 1.45, dps = 3;
    for (let i = 0; i < BR_STAGES.length; i++) {
      const [start, dur, frac, d] = BR_STAGES[i], end = frac * half;
      if (t < start) return { r: prev, dps, status: "wait", in: start - t, stage: i };
      if (t < start + dur) return { r: prev + (end - prev) * (t - start) / dur, dps: d, status: "shrink", in: 0, stage: i };
      prev = end; dps = d;
    }
    return { r: prev, dps, status: "final", in: 0, stage: BR_STAGES.length };
  }
  const brNow = () => brZoneAt(ROUND_SECONDS - (net.role === "host" ? net.left : leftNow()));
  function hostBrTick(dt) {
    if (net.phase !== "play") return;
    const z = brNow(), now = nowMs();
    for (const p of net.players.values()) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - net.zc[0], p.z - net.zc[1]) <= z.r) { p.zoneAcc = 0; continue; }
      p.lastDamageAt = now; p.zoneAcc = (p.zoneAcc || 0) + dt;
      while (p.zoneAcc >= BR_TICK && p.alive) {   // a flat hit every tick
        p.zoneAcc -= BR_TICK; p.hp -= BR_TICK_DAMAGE;
        if (p.hp <= 0) {
          p.hp = 0; p.alive = false; p.deaths++; p.respawnAt = Infinity;
          hostBroadcast({ t: "kill", k: "", v: p.id, w: "zone", dmg: 0, pts: 0, tags: [], head: false, knife: false });
          hostBroadcastBoard();
        } else hostBroadcast({ t: "hp", id: p.id, hp: Math.round(p.hp), by: "zone", head: false, dmg: BR_TICK_DAMAGE });
      }
    }
    const alive = [...net.players.values()].filter((p) => p.alive).length;
    if (net.players.size >= 2 && alive <= 1) hostEndRound();   // the last one standing
  }

  // King of the Hill: whoever is alone on the hilltop scores for as long as they are
  function hostHillTick(dt) {
    const h = currentMap && currentMap.hill;
    if (!h) return;
    const on = [];
    for (const p of net.players.values()) if (p.alive && Math.hypot(p.x - h.x, p.z - h.z) <= h.r && Math.abs(p.y - h.y) < 2.2) on.push(p);
    let kind = 0, who = -1;
    if (on.length) {
      if (net.teams) {
        const t0 = on.some((p) => p.team === 0), t1 = on.some((p) => p.team === 1);
        if (t0 && t1) kind = 2; else { kind = 1; who = t0 ? 0 : 1; }
      } else if (on.length > 1) kind = 2;
      else { kind = 1; who = on[0].id; }
    }
    net.hs = [kind, who];
    updateHillVis();
    if (kind !== 1) return;
    for (const p of on) p.hill += dt;
    if (net.teams) net.teamHill[who] += dt;
    const need = net.limit * 5;
    if (need > 0 && (net.teams ? net.teamHill[who] : on[0].hill) >= need) hostEndRound();
  }

  function hostTick(dt) {
    const now = nowMs();
    if (net.practice && (!pointerLocked || replay.active)) return;   // practice pauses with the menu
    const counting = net.phase === "play" && net.cd > 0;
    if (counting) net.cd = Math.max(0, net.cd - dt);
    if (net.phase === "play") {
      if (!counting) net.left -= dt;
      if (net.left <= 0) { net.left = 0; hostEndRound(); }
    } else {
      net.resultsLeft -= dt;
      if (net.resultsLeft <= 0) hostStartRound();
    }
    if (net.phase === "play" && net.sub === "dm" && !counting) {
      if (net.practice) for (let left = dt; left > 0; left -= 0.05) botsThink(Math.min(left, 0.05), now);
      hostBotBolts(now);
      if (net.koth) hostHillTick(dt);
      if (net.ctf) hostCtfTick(dt);
      if (net.br) hostBrTick(dt);
      for (const p of net.players.values()) if (!p.alive && now >= p.respawnAt) hostRespawn(p);
      for (const p of net.players.values()) {   // slow healing, only once they've stayed out of the fight
        const regenDelay = net.range ? 1500 : REGEN_DELAY;
        if (p.alive && p.hp < 100 && now - p.lastDamageAt > regenDelay && now - p.lastFireAt > regenDelay) p.hp = Math.min(100, p.hp + (net.range ? 80 : REGEN_PER_SEC) * dt);
      }
    }

    if (!localDead) hostHandle(net.id, localStateMsg());
    for (const p of [...net.players.values()]) {   // anyone who has gone silent has dropped, even if the browser hasn't noticed yet
      if (p.id === net.id || p.bot || now - p.lastRecv <= HEARTBEAT_MS) continue;
      const c = net.conns.get(p.id);
      try { if (c) c.close(); } catch (e) { /* ignore */ }
      hostRemovePlayer(p.id);
    }
    const s = [];
    for (const p of net.players.values()) {
      if (p.alive) s.push([p.id, p.x, p.y, p.z, p.yaw, p.pitch, p.w === "knife" ? 1 : 0, p.sl ? 1 : 0, p.g || 0, p.rl ? 1 : 0, p.gr || 0].concat(p.gr === 2 && p.gh ? p.gh : []));
    }
    hostSendRaw({ t: "states", s });

    net.boardTimer -= dt;
    if (net.boardTimer <= 0) { net.boardTimer = 0.5; hostBroadcastBoard(); }
  }

  function mpTick() {
    const now = nowMs();
    const dt = Math.min((now - net.lastTick) / 1000, 0.5);
    net.lastTick = now;
    if (!net.active) return;
    if (net.role === "host") hostTick(dt);
    else if (net.hostConn && net.hostConn.open) {
      net.hostConn.send(localDead ? { t: "ping" } : localStateMsg());   // (a dead player still says they're there)
      if (now - net.lastHostMsg > HEARTBEAT_MS) mpLeave("Lost the connection to the host.");
    }
  }
  // a timer rather than requestAnimationFrame so a backgrounded host keeps the room alive
  setInterval(mpTick, 50);

  // ======================================================================
  // PRACTICE BOTS: AI players for an offline deathmatch. It is an ordinary deathmatch room with no network, so the
  // bots go through the same health, damage, regeneration, kill feed and scoreboard as real players do.
  // Their positions are moved here; a shot is resolved by working out where its aim lands on the target.
  // ======================================================================
  const BOT_GUNS = GUNS.filter((id) => id !== "launcher" && id !== "rpg");   // (bots do not fire blast weapons)
  const BOT_NAMES = ["Rex", "Nova", "Blitz", "Echo", "Vega"];
  // react: seconds before a bot starts shooting at something it sees; err: aim error in degrees; turn: rad/s;
  // head: how often it goes for the head; speed: u/s; burst: shots per burst for automatics; pause: seconds between bursts
  const BOT_LEVELS = {
    easy:   { react: 0.65, err: 5.0, turn: 3.0, head: 0.06, speed: 5.0, burst: [2, 4], pause: [0.8, 1.6] },
    medium: { react: 0.40, err: 3.0, turn: 4.8, head: 0.14, speed: 5.9, burst: [3, 6], pause: [0.4, 1.0] },
    hard:   { react: 0.22, err: 1.6, turn: 7.5, head: 0.24, speed: 6.6, burst: [4, 8], pause: [0.2, 0.55] },
  };
  // hop: hops a second while strafing in a fight
  BOT_LEVELS.easy.hop = 0; BOT_LEVELS.medium.hop = 0.12; BOT_LEVELS.hard.hop = 0.3;
  // sprint: the speed bonus a bot takes while it is travelling (to a target, a flag, the hill, a perch) and not in a burst of fire; it walks in a fight
  BOT_LEVELS.easy.sprint = 1.15; BOT_LEVELS.medium.sprint = 1.25; BOT_LEVELS.hard.sprint = 1.3;
  // lag: how far behind a moving target a bot's aim trails, in seconds. A shot misses by (the target's sideways speed x this x a random share), so
  // standing still or running straight at a bot is easy to hit, strafing is hard, and flat-out strafing and jumping is only rarely hit
  BOT_LEVELS.easy.lag = 0.30; BOT_LEVELS.medium.lag = 0.20; BOT_LEVELS.hard.lag = 0.13;
  BOT_LEVELS.dummy = { react: 9999, err: 90, turn: 0, head: 0, speed: 0, burst: [1, 1], pause: [99, 99], hop: 0 };   // the range: stands still, never fires
  const BOT_PREFER = { rifle: 34, ar: 18, ak: 18, shotgun: 7, pistol: 14, smg: 11, dmr: 28, burst: 24, lmg: 20, crossbow: 32, knife: 1.6 };   // the distance each gun likes to fight at (the knife: right up close)
  // What a mode asks of its bots, on top of their level (L3). Hill bots defend the hill harder: on it they react and aim a fifth better.
  // Battle royale bots are more cautious: they get well inside the circle early, hang back from fights, and fall back when hurt.
  const BOT_MODE = { koth: { holdReact: 0.8, holdErr: 0.8 }, br: { margin: 12, prefer: 1.3, retreatHp: 45 } };
  // A light personality (L4), only in the modes where it fits: a deathmatch, a team deathmatch, a battle royale. Most bots have none. Each
  // one nudges a few numbers a little (prefer: how far it likes to fight, err: aim error, perch: how often it goes up high, retreat: backs
  // off from a fight below this health). Where everyone wants the same thing (the hill, the flag, a gun ladder, the range) there are none.
  const BOT_TRAITS = {
    rusher: { prefer: 0.65, speed: 1.05, hop: 1.6 },
    marksman: { prefer: 1.45, speed: 0.96, err: 0.85, perch: 0.5 },
    careful: { react: 0.9, retreat: 40 },
  };
  function botTraitFor(p) {
    if (net.range || net.koth || net.ctf || net.gungame || net.sub === "race") return null;
    const pool = net.br ? ["careful", "careful", null, "rusher"] : ["rusher", "marksman", "careful", null, null];
    return pool[Math.max(0, p.botIndex) % pool.length];
  }
  const BOT_RELOAD = 2.3;
  const _botRay = new THREE.Ray(), _botHit = new THREE.Vector3(), _botPos = new THREE.Vector3(), _botFrom = new THREE.Vector3();
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function gauss() { return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()); }

  function addBot(i, level) {
    const p = makePlayerRecord("bot" + i, "Bot " + BOT_NAMES[i % BOT_NAMES.length], PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length]);
    p.bot = true;
    p.ai = { lvl: BOT_LEVELS[level] || BOT_LEVELS.medium, gun: "ar", ammo: 30, reloadT: 0, fireT: 1, burstLeft: 0, seeT: 0, strafe: 1, strafeT: 0,
      stuckT: 0, aimYaw: 0, aimPitch: 0, tspd: 0, tx: 0, tz: 0, vy: 0, path: [], pi: 0, repath: 0, climb: null, perch: null, perchT: 0, perchWait: 6 + Math.random() * 14 };
    net.players.set(p.id, p);
    ensureAvatar(p);
    return p;
  }
  // a fresh life: a gun picked at random, a full magazine, looking at the middle of the arena
  // gun game: a bot uses the gun of its level (it has no knife, so it stays on the last gun)
  function ggBotGun(p) {
    if (!p.bot) return;
    const g = p.gg >= GG_ORDER.length ? "knife" : GG_ORDER[p.gg];   // (past the last gun a bot takes the knife and goes for the win)
    p.ai.gun = g; p.g = WEAPON_ORDER.indexOf(g); p.rl = 0; p.ai.ammo = g === "knife" ? 999 : baseMag(g); p.ai.reloadT = 0; p.at = randomAttachCode(g);
  }
  function botReset(p, spawn) {
    const ai = p.ai;
    ai.gun = net.gungame ? (p.gg >= GG_ORDER.length ? "knife" : GG_ORDER[p.gg]) : BOT_GUNS[Math.floor(Math.random() * BOT_GUNS.length)];
    p.g = WEAPON_ORDER.indexOf(ai.gun); p.rl = 0;
    ai.ammo = baseMag(ai.gun); ai.reloadT = 0; ai.fireT = 1 + Math.random(); ai.burstLeft = 0; ai.seeT = 0;
    p.at = randomAttachCode(ai.gun);
    ai.aimYaw = p.yaw = net.range ? Math.PI : Math.atan2(spawn[0], spawn[1]); ai.aimPitch = p.pitch = 0;   // (a dummy faces the firing line)
    ai.vy = 0; ai.path = []; ai.pi = 0; ai.repath = 0; ai.climb = null; ai.perch = null; ai.perchWait = 6 + Math.random() * 14;
    ai.lift = null; ai.boost = null; ai.seen = null;
  }
  function botUse(ai, what) { ai.uses = ai.uses || {}; ai.uses[what] = (ai.uses[what] || 0) + 1; }   // (a count for testing: which shortcuts it took on purpose)

  function botLineClear(ax, ay, az, bx, by, bz) {
    _botRay.origin.set(ax, ay, az);
    _botRay.direction.set(bx - ax, by - ay, bz - az);
    const dist = _botRay.direction.length();
    _botRay.direction.divideScalar(dist || 1);
    for (const box of wallBoxes) {
      if (rayHitBox(_botRay, box, _botHit) && _botHit.distanceTo(_botRay.origin) < dist - 0.3) return false;
    }
    return true;
  }

  // The arena as grids of 1 m cells, one grid for each level a player can stand on (the floor, each roof, each deck). A cell is
  // blocked if a wall, pillar, tower leg or ramp is in the way of a player standing at that level. Bots plan a route across
  // the grids (A*) whenever the target is far, out of sight or on another level. Ramps, ladders and drops off an edge are links
  // from one level to another, so a bot can climb to a roof and come back down.
  const NAV_CELL = 1;   // metres per cell: fine enough that a 3 m wall does not close a 10 m street
  let NAV_N = 40, navHalf = 40, navBlocked = null, navLv = [], navLinks = new Map();
  function navBuild() {
    navHalf = CFG.arenaHalfSize; NAV_N = Math.ceil(navHalf * 2 / NAV_CELL);
    const N = NAV_N, NN = N * N, pad = CFG.playerRadius + 0.15;
    const cellC = (i) => -navHalf + (i + 0.5) * NAV_CELL;
    const isFloorish = (g) => !g.userData.wall && !movers.some((m) => m.mesh === g);   // crate tops and moving platforms are not levels
    const hs = [];
    for (const g of groundMeshes) {
      if (!isFloorish(g)) continue;
      const h = Math.round(g.userData.topY * 20) / 20;
      if (!hs.includes(h)) hs.push(h);
    }
    hs.sort((x, y) => x - y);
    navLv = hs.map((h) => ({ h, surf: new Uint8Array(NN), blocked: new Uint8Array(NN).fill(1), strip: new Uint8Array(NN) }));
    for (const g of groundMeshes) {
      if (!isFloorish(g)) continue;
      const ud = g.userData, lv = navLv.find((l) => Math.abs(l.h - ud.topY) < 0.03);
      if (!lv) continue;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        if (Math.abs(cellC(i) - ud.cx) <= ud.halfW - 0.2 && Math.abs(cellC(j) - ud.cz) <= ud.halfD - 0.2) { lv.surf[j * N + i] = 1; lv.blocked[j * N + i] = 0; }
      }
    }
    const block = (arr, x0, x1, z0, z1, m) => {   // m: how far round the box a cell is still blocked
      m = m === undefined ? pad : m;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const cx0 = -navHalf + i * NAV_CELL - m, cx1 = -navHalf + (i + 1) * NAV_CELL + m, cz0 = -navHalf + j * NAV_CELL - m, cz1 = -navHalf + (j + 1) * NAV_CELL + m;
        if (x1 > cx0 && x0 < cx1 && z1 > cz0 && z0 < cz1) arr[j * N + i] = 1;
      }
    };
    for (const lv of navLv) {
      for (const b of wallBoxes) if (!b.gate && lv.h < b.max.y - CFG.stepHeight && lv.h + CFG.playerHeight > b.min.y) block(lv.blocked, b.min.x, b.max.x, b.min.z, b.max.z);
      for (const r of ramps) block(lv.blocked, r.cx - r.halfW, r.cx + r.halfW, r.cz - r.halfD, r.cz + r.halfD, 0);   // the ramp itself (its side rails are boxes, padded as usual)
    }
    navBlocked = navLv.length ? navLv[0].blocked : new Uint8Array(NN);   // the floor, for the code that only cares about the floor
    // launch strips: a cell on one remembers which (1-based), so a route that runs along it counts as quicker
    for (let k = 0; k < boosts.length; k++) {
      const b = boosts[k], lv = navLv.find((l) => Math.abs(l.h - b.y) < 0.3);
      if (!lv) continue;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = cellC(i) - b.x, z = cellC(j) - b.z;
        if (Math.abs(x * b.dx + z * b.dz) <= b.l / 2 && Math.abs(-x * b.dz + z * b.dx) <= b.w / 2) lv.strip[j * N + i] = k + 1;
      }
    }

    // links between levels
    navLinks = new Map();
    const link = (from, l) => { const arr = navLinks.get(from); if (arr) arr.push(l); else navLinks.set(from, [l]); };
    const levelAt = (h) => navLv.findIndex((l) => Math.abs(l.h - h) < 0.3);
    const nodeNear = (l, x, z, maxR) => {
      if (l < 0) return -1;
      const ci = navCell(x), cj = navCell(z), blocked = navLv[l].blocked;
      for (let r = 0; r <= maxR; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (i >= 0 && j >= 0 && i < N && j < N && !blocked[j * N + i]) return l * NN + j * N + i;
      }
      return -1;
    };
    for (const r of ramps) {   // a ramp up to a roof or deck (a kicker ramp that ends in the air links nowhere)
      const ax = r.along === "x", c = ax ? r.cx : r.cz;
      const at = (v) => ax ? [v, r.cz] : [r.cx, v];
      const e = at(c - r.dir * (r.length / 2 + 0.9)), x = at(c + r.dir * (r.length / 2 + 1.0)), hl = levelAt(r.base + r.height), ll = levelAt(r.base);
      if (hl <= 0 || ll < 0 || hl <= ll) continue;
      const lo = nodeNear(ll, e[0], e[1], 4), hi = nodeNear(hl, x[0], x[1], 3);
      if (lo < 0 || hi < 0) continue;
      const cost = r.length * 1.3 + 1;
      link(lo, { to: hi, cost, type: 0, pre: e }); link(hi, { to: lo, cost, type: 0, pre: x });   // pre: the mouth of the ramp, reached exactly before going up it
    }
    for (const L of ladders) {
      const l0 = levelAt(L.y0), l1 = levelAt(L.y1);
      if (l0 < 0 || l1 <= l0) continue;
      const base = [L.x + L.nx * 0.9, L.z + L.nz * 0.9], land = [L.x - L.nx * 1.0, L.z - L.nz * 1.0];
      const nb = nodeNear(l0, base[0], base[1], 3), nt = nodeNear(l1, land[0], land[1], 2);
      if (nb < 0 || nt < 0) continue;
      const cost = (L.y1 - L.y0) * 1.5 + 2;
      link(nb, { to: nt, cost, type: 1, lad: L, up: true, px: base[0], pz: base[1] });
      link(nt, { to: nb, cost, type: 1, lad: L, up: false, px: land[0], pz: land[1] });
    }
    // portals (on the floor): from the cells in front of one end to the cells in front of the other
    for (const P of portals) {
      const Q = P.pair, l = levelAt(FLOOR_Y), fr = [P.x + P.nx * 1.6, P.z + P.nz * 1.6], ex = [Q.x + Q.nx * 1.6, Q.z + Q.nz * 1.6];
      const a = nodeNear(l, fr[0], fr[1], 3), b = nodeNear(l, ex[0], ex[1], 3);
      if (a >= 0 && b >= 0) link(a, { to: b, cost: 3, type: 3, pts: [fr, [P.x, P.z]], portal: P });
    }
    // jump pads: from the pad to the nearest spot on each higher level a bot could steer onto before it comes back down
    for (const pad of jumpPads) {
      const l0 = levelAt(pad.y - 0.16);
      if (l0 < 0 || navLv[l0].blocked[navCell(pad.z) * N + navCell(pad.x)]) continue;   // (one buried in a wall can't be reached)
      const from = nodeNear(l0, pad.x, pad.z, 1);
      if (from < 0) continue;
      for (let l = l0 + 1; l < navLv.length; l++) {
        const dh = navLv[l].h + 0.3 - pad.y, disc = pad.power * pad.power - 2 * CFG.gravity * dh;
        if (dh <= 0 || disc < 0) continue;
        const reach = BOT_LEVELS.easy.speed * ((pad.power + Math.sqrt(disc)) / CFG.gravity) * 0.8;   // the slowest bot, with a margin
        let best = -1, bestD = Infinity;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          if (navLv[l].blocked[j * N + i]) continue;
          const d = Math.hypot(cellC(i) - pad.x, cellC(j) - pad.z);
          if (d >= 1.5 && d <= reach && d < bestD) { bestD = d; best = l * NN + j * N + i; }
        }
        if (best >= 0) link(from, { to: best, cost: 4 + bestD * 0.5, type: 4, pts: [[pad.x, pad.z]], pad });
      }
    }
    // lifts (platforms that go up and down): wait beside it, ride it, step off at the other end
    for (const mv of movers) {
      if (mv.axis !== "y") continue;
      const lo = levelAt(mv.base.y - mv.range + 0.25), hi = levelAt(mv.base.y + mv.range + 0.25);
      if (lo < 0 || hi <= lo) continue;
      const a = nodeNear(lo, mv.base.x, mv.base.z, 4), b = nodeNear(hi, mv.base.x, mv.base.z, 4);
      if (a < 0 || b < 0) continue;
      const cost = (navLv[hi].h - navLv[lo].h) * 1.5 + 8;   // (it may have to wait for it)
      link(a, { to: b, cost, type: 5, lift: mv, fromL: lo, toL: hi });
      link(b, { to: a, cost, type: 5, lift: mv, fromL: hi, toL: lo });
    }
    // dropping off the edge of a roof or deck onto a lower level
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let l = 1; l < navLv.length; l++) {
      const lv = navLv[l];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const c = j * N + i;
        if (lv.blocked[c]) continue;
        for (const [di, dj] of dirs) {
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= N || nj >= N || lv.surf[nj * N + ni]) continue;   // only a real edge
          let done = false;
          for (let k = 1; k <= 3 && !done; k++) {
            const mi = i + di * k, mj = j + dj * k;
            if (mi < 0 || mj < 0 || mi >= N || mj >= N) break;
            for (let l2 = l - 1; l2 >= 0; l2--) {
              if (lv.h - navLv[l2].h < 1.0 || navLv[l2].blocked[mj * N + mi]) continue;
              link(l * NN + c, { to: l2 * NN + mj * N + mi, cost: 2 + k + (lv.h - navLv[l2].h) * 0.4, type: 2 });
              done = true; break;
            }
          }
        }
      }
    }
  }
  const navCell = (v) => Math.max(0, Math.min(NAV_N - 1, Math.floor((v + navHalf) / NAV_CELL)));
  const navFree = (i, j, l) => i >= 0 && j >= 0 && i < NAV_N && j < NAV_N && !navLv[l || 0].blocked[j * NAV_N + i];
  // the level someone at this height is standing on (the highest one at or just above their feet)
  function navLevelFor(y) {
    if (!navBlocked) navBuild();
    let k = 0;
    for (let l = 0; l < navLv.length; l++) if (navLv[l].h <= y + 0.7) k = l;
    return k;
  }
  // a straight line between two points on one level that stays out of blocked cells
  function navClear(ax, az, bx, bz, l) {
    if (!navBlocked) navBuild();
    const d = Math.hypot(bx - ax, bz - az), steps = Math.ceil(d / 0.5);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      if (!navFree(navCell(ax + (bx - ax) * t), navCell(az + (bz - az) * t), l)) return false;
    }
    return true;
  }
  // a route as points [x, z, level, kind, link]: kind 0 walk, 1 a point to reach exactly (the far end of a ramp or a drop, a portal, a pad),
  // 2 the foot of a ladder, 3 the spot beside a lift, 4 a portal (left only by going through it)
  function navPath(sx, sz, sl, gx, gz, gl) {
    if (!navBlocked) navBuild();
    const N = NAV_N, NN = N * N, total = NN * navLv.length;
    const nearest = (x, z, l0) => {   // the cell on that level, or the closest free one (any level, nearest in height first)
      const order = navLv.map((_, i) => i).sort((p, q) => Math.abs(navLv[p].h - navLv[l0].h) - Math.abs(navLv[q].h - navLv[l0].h));
      for (const l of order) {
        const ci = navCell(x), cj = navCell(z);
        for (let r = 0; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) === r && navFree(ci + di, cj + dj, l)) return l * NN + (ci + di) + (cj + dj) * N;
        }
      }
      return -1;
    };
    const s0 = nearest(sx, sz, sl), t0 = nearest(gx, gz, gl);
    if (s0 < 0 || t0 < 0) return null;
    const tl = (t0 / NN) | 0, tc = t0 - tl * NN, tI = tc % N, tJ = (tc / N) | 0;
    const g = new Float32Array(total).fill(Infinity), from = new Int32Array(total).fill(-1), done = new Uint8Array(total), via = new Map();
    const heap = [];
    const push = (f, idx) => {
      heap.push([f, idx]);
      let c = heap.length - 1;
      while (c > 0) { const q = (c - 1) >> 1; if (heap[q][0] <= heap[c][0]) break; [heap[q], heap[c]] = [heap[c], heap[q]]; c = q; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = 2 * c + 1, r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
        }
      }
      return top;
    };
    g[s0] = 0; push(0, s0);
    while (heap.length) {
      const cur = pop()[1];
      if (done[cur]) continue;
      done[cur] = 1;
      if (cur === t0) break;
      const cl = (cur / NN) | 0, cc = cur - cl * NN, ci = cc % N, cj = (cc / N) | 0;
      const relax = (n, cost, lk) => {
        if (cost >= g[n]) return;
        g[n] = cost; from[n] = cur;
        if (lk) via.set(n, lk); else via.delete(n);
        const nl = (n / NN) | 0, nc = n - nl * NN;
        push(cost + Math.hypot(tI - (nc % N), tJ - ((nc / N) | 0)), n);
      };
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!navFree(ni, nj, cl)) continue;
        if (di && dj && (!navFree(ci + di, cj, cl) || !navFree(ci, cj + dj, cl))) continue;   // no cutting a corner
        let step = di && dj ? 1.414 : 1;
        const sk = navLv[cl].strip[nj * N + ni];
        if (sk && (di * boosts[sk - 1].dx + dj * boosts[sk - 1].dz) / step > 0.7) step *= 0.35;   // along a launch strip: it throws you down it
        relax(cl * NN + ni + nj * N, g[cur] + step, null);
      }
      const links = navLinks.get(cur);
      if (links) for (const lk of links) relax(lk.to, g[cur] + lk.cost, lk);
    }
    if (from[t0] < 0 && t0 !== s0) return null;
    const chain = [];
    for (let c = t0; c !== s0 && c >= 0; c = from[c]) chain.push(c);
    chain.reverse();
    const out = [];
    for (const n of chain) {
      const lk = via.get(n), l = (n / NN) | 0, c = n - l * NN;
      if (lk && lk.type === 1) out.push([lk.px, lk.pz, (from[n] / NN) | 0, 2, lk]);
      else if (lk && lk.pre) out.push([lk.pre[0], lk.pre[1], (from[n] / NN) | 0, 1]);
      else if (lk && lk.pts) lk.pts.forEach((q, k) => out.push([q[0], q[1], (from[n] / NN) | 0, lk.portal && k === lk.pts.length - 1 ? 4 : 1, lk]));   // a portal's mouth, the portal itself (done once through it), or a pad, reached exactly
      else if (lk && lk.type === 5) { const fc = from[n] - lk.fromL * NN; out.push([-navHalf + ((fc % N) + 0.5) * NAV_CELL, -navHalf + (((fc / N) | 0) + 0.5) * NAV_CELL, lk.fromL, 3, lk]); }   // beside a lift: wait for it there
      out.push([-navHalf + ((c % N) + 0.5) * NAV_CELL, -navHalf + (((c / N) | 0) + 0.5) * NAV_CELL, l, lk ? 1 : 0]);
    }
    return out;
  }

  function botsThink(dt, now) {
    for (const p of net.players.values()) if (p.bot && p.alive) botUpdate(p, dt, now);
  }

  function botUpdate(p, dt, now) {
    const ai = p.ai, L = ai.lvl, g = ai.gun, w = WEAPONS[g];
    if (p.protectUntil && p.spawnX !== undefined && Math.hypot(p.x - p.spawnX, p.z - p.spawnZ) > 0.4) p.protectUntil = 0;   // a bot that moves loses it too
    // the nearest living player is who it goes after
    let tgt = null, dist = Infinity, bestScore = Infinity;
    for (const q of net.players.values()) {
      if (q === p || !q.alive || (net.teams && q.team === p.team)) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z), score = d + Math.abs(q.y - p.y) * 1.5;   // someone on another level counts as further away
      if (score < bestScore) { bestScore = score; dist = d; tgt = q; }
    }
    if (!tgt) return;
    // how this bot differs from its level right now: its personality, and what the mode asks of it
    if (ai.trait === undefined) ai.trait = botTraitFor(p);
    const T = ai.trait ? BOT_TRAITS[ai.trait] : null;
    let reactK = (T && T.react) || 1, errK = (T && T.err) || 1, preferK = (T && T.prefer) || 1, retreatHp = (T && T.retreat) || 0;
    const perchK = (T && T.perch) || 1;
    ai.speedK = (T && T.speed) || 1; ai.sprintK = (T && T.sprint) || 1; ai.hopK = (T && T.hop) || 1;
    if (net.koth && currentMap.hill && Math.hypot(p.x - currentMap.hill.x, p.z - currentMap.hill.z) < currentMap.hill.r * 1.1) { reactK *= BOT_MODE.koth.holdReact; errK *= BOT_MODE.koth.holdErr; }
    if (net.br) { preferK *= BOT_MODE.br.prefer; retreatHp = Math.max(retreatHp, BOT_MODE.br.retreatHp); }
    ai.reactK = reactK; ai.errK = errK;
    const dx = tgt.x - p.x, dz = tgt.z - p.z, eyeY = p.y + 1.6, aimY = tgt.y + 1.15;
    const los = botLineClear(p.x, eyeY, p.z, tgt.x, aimY, tgt.z);
    // what it knows: where it last saw the target, or heard it fire. Out of sight it goes there, not straight to where the target
    // really is; once that trail is cold (it got there and found nobody, or a while passed) it goes back to hunting
    if (!ai.seen || ai.seen.id !== tgt.id) ai.seen = { id: tgt.id, x: tgt.x, y: tgt.y, z: tgt.z, t: now, reachedAt: 0 };
    const sn = ai.seen;
    if (los || (now - tgt.lastFireAt < 1500 && dist < 45)) { sn.x = tgt.x; sn.y = tgt.y; sn.z = tgt.z; sn.t = now; sn.reachedAt = 0; }
    else if (!sn.reachedAt && Math.hypot(sn.x - p.x, sn.z - p.z) < 2 && Math.abs(sn.y - p.y) < 2) sn.reachedAt = now;
    const cold = now - sn.t > 9000 || (sn.reachedAt && now - sn.reachedAt > 2500);
    const goX = los || cold ? tgt.x : sn.x, goZ = los || cold ? tgt.z : sn.z, goY = los || cold ? tgt.y : sn.y;
    const range = g === "knife" ? 140 : (w.range || 140);   // (a bot on the knife still sees you from afar and runs at you)
    ai.seeT = los && dist < range ? ai.seeT + dt : 0;
    // how fast the target is moving (what makes it hard to hit), smoothed
    const inst = Math.hypot(tgt.x - ai.tx, tgt.z - ai.tz) / dt;
    ai.tspd += (Math.min(inst, 30) - ai.tspd) * 0.15;
    if (ai.ty === undefined || ai.tid !== tgt.id) { ai.ty = tgt.y; ai.tvx = ai.tvz = ai.tvy = ai.tlat = 0; ai.tid = tgt.id; ai.tx = tgt.x; ai.tz = tgt.z; }
    {
      const lim = (v) => Math.max(-30, Math.min(30, v));
      ai.tvx += (lim((tgt.x - ai.tx) / dt) - ai.tvx) * 0.3; ai.tvz += (lim((tgt.z - ai.tz) / dt) - ai.tvz) * 0.3; ai.tvy += (lim((tgt.y - ai.ty) / dt) - ai.tvy) * 0.3;
      ai.tlat = Math.abs(ai.tvx * dz - ai.tvz * dx) / (dist || 1);   // the part of the target's movement across the line of fire
    }
    ai.tx = tgt.x; ai.tz = tgt.z; ai.ty = tgt.y;

    // far or out of sight: follow a route round the walls to the target (re-planned a bit more than once a second)
    const prefer = (BOT_PREFER[g] || 18) * preferK;
    // now and then a bot heads for a roof or deck to fight from up there (when the map has one)
    if (!navBlocked) navBuild();
    if (net.br) {   // battle royale: get inside the circle (with a margin), then fight whoever is closest
      const bz = brNow(), bd = Math.hypot(p.x - net.zc[0], p.z - net.zc[1]);
      if (bd > bz.r - BOT_MODE.br.margin) { ai.perch = { x: net.zc[0], z: net.zc[1], l: 0 }; ai.perchT = 5; }
      else if (ai.perch && ai.perch.brZone) ai.perch = null;
      if (ai.perch) ai.perch.brZone = true;
    }
    if (net.ctf && currentMap.flags) {   // capture the flag: carry it home, hunt the carrier, or go for their flag (half of them stay near their own)
      const myT = p.team, enemyT = 1 - myT, fMine = net.flags[myT], fTheirs = net.flags[enemyT];
      let goal = null;
      if (fTheirs.s === 1 && fTheirs.c === p.id) { const b = ctfBase(myT); goal = [b.x, b.z, b.y]; }
      else if (fMine.s === 1) { goal = [fMine.x, fMine.z, fMine.y]; }
      else if (fMine.s === 2) { goal = [fMine.x, fMine.z, fMine.y]; }
      else if (p.botIndex % 2 === 0 || fTheirs.s === 2) { goal = [fTheirs.x, fTheirs.z, fTheirs.y]; }
      else { const b = ctfBase(myT); goal = [b.x, b.z, b.y]; }
      ai.perch = { x: goal[0], z: goal[1], l: navLevelFor(goal[2]) }; ai.perchT = 5;
    }
    if (net.koth && currentMap.hill) { const hh = currentMap.hill; ai.perch = { x: hh.x, z: hh.z, l: navLevelFor(hh.y) }; ai.perchT = 5; }   // King of the Hill: they all want the hill
    if (navLv.length > 1) {
      if (ai.perch) { ai.perchT -= dt; if (ai.perchT <= 0) { ai.perch = null; ai.perchWait = rnd(15, 35) * perchK; } }
      else if ((ai.perchWait -= dt) <= 0) {
        ai.perchWait = rnd(15, 35) * perchK;
        const pl = 1 + Math.floor(Math.random() * (navLv.length - 1)), lv = navLv[pl];
        let pick = null;   // somewhere it can stand, an edge that looks out over the level below if it finds one
        for (let k = 0; k < 60; k++) {
          const i = Math.floor(Math.random() * NAV_N), j = Math.floor(Math.random() * NAV_N);
          if (!lv.surf[j * NAV_N + i] || lv.blocked[j * NAV_N + i]) continue;
          const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const a = i + di * 2, b = j + dj * 2; return a < 0 || b < 0 || a >= NAV_N || b >= NAV_N || !lv.surf[b * NAV_N + a]; });
          if (!pick || edge) pick = [i, j];
          if (edge) break;
        }
        if (pick) { ai.perch = { x: -navHalf + (pick[0] + 0.5) * NAV_CELL, z: -navHalf + (pick[1] + 0.5) * NAV_CELL, l: pl }; ai.perchT = rnd(20, 35); ai.repath = 0; }
      }
    }
    const perchD = ai.perch ? Math.hypot(ai.perch.x - p.x, ai.perch.z - p.z) : 0;
    const perching = !!ai.perch && perchD > 2.5 && !(los && dist < 14);
    const kothHill = net.koth && currentMap.hill ? currentMap.hill : null;
    const holding = !!ai.perch && perchD <= (kothHill ? kothHill.r * 1.1 : net.ctf ? 1.2 : 2.5);   // up there: stay and shoot what it sees
    const retreating = retreatHp > 0 && p.hp < retreatHp && los && dist < 45;   // hurt and in a fight: back off rather than push
    const navigating = !!ai.lift || perching || (!holding && !retreating && (!los || dist > prefer + 4 || Math.abs(tgt.y - p.y) > 2.2));   // also when the target is on another level
    ai.repath -= dt;
    const myLv = navLevelFor(p.y);
    // halfway up a ramp or in the air it keeps to the route it has, so it does not turn round on the slope
    const between = ai.vy !== 0 || Math.abs(p.y - navLv[myLv].h) > 0.3;
    ai.betweenT = between ? (ai.betweenT || 0) + dt : 0;
    if (navigating && ai.repath <= 0 && !ai.climb && !ai.lift && (!between || ai.betweenT > 5)) { const route = perching ? navPath(p.x, p.z, myLv, ai.perch.x, ai.perch.z, ai.perch.l) : navPath(p.x, p.z, myLv, goX, goZ, navLevelFor(goY));
      if (perching && !route) { ai.perch = null; ai.perchWait = rnd(15, 35) * perchK; }   // no way up there
      ai.path = route || []; ai.pi = 0; ai.repath = rnd(0.6, 0.9); }
    let wx = goX, wz = goZ, stay = false;   // where it is heading right now (stay: stand still, waiting for or riding a lift)
    if (navigating && ai.path.length && !ai.climb) {
      const P = ai.path;
      while (ai.pi < P.length - 1 && P[ai.pi][3] < 2 && Math.hypot(P[ai.pi][0] - p.x, P[ai.pi][1] - p.z) < (P[ai.pi][3] ? 0.7 : 1.3)) ai.pi++;
      while (ai.pi < P.length - 1 && P[ai.pi][3] === 0 && P[ai.pi + 1][3] === 0 && P[ai.pi + 1][2] === myLv &&
        navClear(p.x, p.z, P[ai.pi + 1][0], P[ai.pi + 1][1], myLv)) ai.pi++;   // cut the corners
      const pt = P[ai.pi];
      wx = pt[0]; wz = pt[1];
      if (pt[3] === 3 && !ai.lift && Math.hypot(pt[0] - p.x, pt[1] - p.z) < 0.9) ai.lift = { lk: pt[4], phase: 0, t: 0 };   // beside a lift
      if (pt[3] === 2 && Math.hypot(pt[0] - p.x, pt[1] - p.z) < 0.6 && Math.abs(p.y - navLv[pt[2]].h) < 1) {   // at the foot of a ladder: start climbing
        const lk = pt[4], L = lk.lad;
        ai.climb = lk.up ? { lad: L, dir: 1, toY: L.y1, ex: L.x - L.nx * 1.0, ez: L.z - L.nz * 1.0 } : { lad: L, dir: -1, toY: L.y0, ex: L.x + L.nx * 0.9, ez: L.z + L.nz * 0.9 };
      }
    }
    if (ai.lift) {   // a lift: wait beside it until it is level with this floor, step on, ride it, step off at the other end (it still fights)
      const lf = ai.lift, ud = lf.lk.lift.mesh.userData, top = ud.topY, fromH = navLv[lf.lk.fromL].h, toH = navLv[lf.lk.toL].h;
      const onIt = Math.abs(p.x - ud.cx) < ud.halfW - 0.2 && Math.abs(p.z - ud.cz) < ud.halfD - 0.2 && Math.abs(p.y - top) < 0.4;
      lf.t += dt;
      if (lf.phase === 0) { stay = true; if (Math.abs(top - fromH) < 0.35) lf.phase = 1; }
      if (lf.phase === 1) { wx = ud.cx; wz = ud.cz; stay = false; if (onIt) lf.phase = 2; else if (Math.abs(top - fromH) > 0.6) lf.phase = 0; }   // (missed it: wait again)
      if (lf.phase === 2) {
        wx = ud.cx; wz = ud.cz; stay = Math.hypot(ud.cx - p.x, ud.cz - p.z) < 0.4;
        if (Math.abs(top - toH) < 0.3) { ai.lift = null; ai.pi = Math.min(ai.pi + 1, ai.path.length - 1); ai.repath = 0.6; botUse(ai, "lift"); stay = false; }
        else if (!onIt && p.y < top - 1) { ai.lift = null; ai.path = []; ai.repath = 0; }   // fell off
      }
      if (ai.lift && lf.t > 25) { ai.lift = null; ai.path = []; ai.repath = 0; }   // never came: plan again
    }
    if (ai.climb) {   // on a ladder: nothing else until it gets to the other end
      const c = ai.climb, L = c.lad;
      p.x = L.x + L.nx * 0.45; p.z = L.z + L.nz * 0.45; p.sl = false;
      p.y += c.dir * CFG.ladderSpeed * 0.85 * dt; ai.vy = 0;
      ai.aimYaw = p.yaw = Math.atan2(L.nx, L.nz); ai.aimPitch = p.pitch = 0;
      if (c.dir > 0 ? p.y >= c.toY : p.y <= c.toY) {
        p.x = c.ex; p.z = c.ez; p.y = c.toY; ai.climb = null; ai.pi++; ai.repath = 0.2; ai.stuckT = 0;
      }
      return;
    }

    // turn toward the target (or, with no line of sight, where it is heading), no faster than this level can
    const lookDx = los ? dx : wx - p.x, lookDz = los ? dz : wz - p.z;
    const wantYaw = Math.atan2(-lookDx, -lookDz), wantPitch = los ? Math.atan2(aimY - eyeY, Math.max(dist, 0.1)) : 0;
    const maxTurn = L.turn * dt;
    ai.aimYaw += Math.max(-maxTurn, Math.min(maxTurn, wrapAngle(wantYaw - ai.aimYaw)));
    ai.aimPitch += Math.max(-maxTurn, Math.min(maxTurn, wantPitch - ai.aimPitch));
    p.yaw = ai.aimYaw; p.pitch = ai.aimPitch;
    const fx = dx / (dist || 1), fz = dz / (dist || 1);

    // move: close in or back off to the distance this gun likes, strafing around the target
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? 1 : -1; ai.strafeT = rnd(0.6, 1.8); }
    let mx = 0, mz = 0;
    const along = navigating ? 1 : g === "knife" && dist > 1.2 ? 1 : retreating ? -1 : (kothHill || ai.perch) && holding ? 0 : dist < prefer - 4 ? -0.8 : 0;   // (on the hill or a perch it does not back away: that walks it off the edge)
    const hx = wx - p.x, hz = wz - p.z, hl = Math.hypot(hx, hz) || 1;   // toward the next point on the route
    if (along > 0) { mx += hx / hl; mz += hz / hl; } else { mx += fx * along; mz += fz * along; }
    const side = !navigating ? (holding && ai.perch && !kothHill ? 0.4 : 0.9) : los ? 0.4 : 0;
    mx += fz * ai.strafe * side; mz += -fx * ai.strafe * side;
    if (kothHill && holding && !navigating) {   // on the hill it strafes and fights, and drifts back to the middle if it wanders to the rim
      const hx2 = kothHill.x - p.x, hz2 = kothHill.z - p.z, hd2 = Math.hypot(hx2, hz2) || 1;
      const pull = Math.max(0, (hd2 - kothHill.r * 0.55) / (kothHill.r * 0.55)) * 2.2;
      mx = mx * 0.6 + (hx2 / hd2) * pull; mz = mz * 0.6 + (hz2 / hd2) * pull;
    }
    if (stay) { mx = 0; mz = 0; }
    const ml = Math.hypot(mx, mz) || 1;
    const sprinting = navigating && !stay && ai.burstLeft <= 0 && !(los && dist < prefer + 4);   // (running to somewhere, not strafing in a fight)
    const speed = L.speed * ai.speedK * (ai.burstLeft > 0 ? 0.75 : sprinting ? (L.sprint || 1) * ai.sprintK : 1);
    _botFrom.set(p.x, p.y, p.z);
    _botPos.set(p.x + (mx / ml) * speed * dt, p.y, p.z + (mz / ml) * speed * dt);
    if (ai.boost) {   // thrown down a launch strip: a burst of speed that fades
      const k = ai.boost.t / 0.8;
      _botPos.x += ai.boost.dx * 13 * k * dt; _botPos.z += ai.boost.dz * 13 * k * dt;
      if ((ai.boost.t -= dt) <= 0) ai.boost = null;
    }
    resolveWalls(_botPos, p.y, _botFrom); resolveWalls(_botPos, p.y, _botFrom);
    const B = CFG.arenaHalfSize - 0.8;
    _botPos.x = Math.max(-B, Math.min(B, _botPos.x)); _botPos.z = Math.max(-B, Math.min(B, _botPos.z));
    const moved = Math.hypot(_botPos.x - p.x, _botPos.z - p.z);
    p.x = _botPos.x; p.z = _botPos.z; p.sl = false;
    if (portals.length && (ai.portalCool = (ai.portalCool || 0) - dt) <= 0) for (const P of portals) {   // walked into a portal: out of the other end
      const ox = p.x - P.x, oz = p.z - P.z;
      if (Math.abs(ox * P.nx + oz * P.nz) > 0.55 || Math.abs(-ox * P.nz + oz * P.nx) > 1.05 || p.y > FLOOR_Y + 2.6) continue;
      if ((mx * P.nx + mz * P.nz) / ml > -0.3) continue;   // only when heading into it
      const Q = P.pair;
      p.x = Q.x + Q.nx * 1.05; p.z = Q.z + Q.nz * 1.05; p.snap = true; ai.portalCool = 0.6;
      const at = ai.path[ai.pi];
      if (at && at[4] && at[4].portal === P) { ai.pi = Math.min(ai.pi + 1, ai.path.length - 1); botUse(ai, "portal"); }
      ai.repath = Math.min(ai.repath, 0.4);
      break;
    }
    // vertical: it stands on whatever is under it (the floor, a ramp, a roof), a jump pad it runs over throws it up, and in a fight
    // it hops now and then while strafing. Walking off an edge is a fall.
    const gy = currentGroundY(p.x, p.z, p.y + CFG.stepHeight);
    if (ai.vy <= 0 && p.y <= gy + 0.35) {
      p.y = gy; ai.vy = 0;
      for (const pad of jumpPads) if (Math.hypot(p.x - pad.x, p.z - pad.z) < pad.r && Math.abs(p.y - pad.y) < 0.4) {
        ai.vy = pad.power;
        const at = ai.path[ai.pi], was = ai.path[ai.pi - 1];
        if (at && at[4] && at[4].pad === pad) { ai.pi = Math.min(ai.pi + 1, ai.path.length - 1); botUse(ai, "pad"); }   // meant to: on to where it lands
        else if (was && was[4] && was[4].pad === pad) botUse(ai, "pad");
        break;
      }
      if ((ai.boostCool = (ai.boostCool || 0) - dt) <= 0) for (const b of boosts) {
        const ox = p.x - b.x, oz = p.z - b.z;
        if (Math.abs(ox * b.dx + oz * b.dz) > b.l / 2 || Math.abs(-ox * b.dz + oz * b.dx) > b.w / 2 || Math.abs(p.y - b.y) > 0.6) continue;
        ai.boost = { dx: b.dx, dz: b.dz, t: 0.8 }; ai.vy = Math.max(ai.vy, b.pop); ai.boostCool = 0.6; botUse(ai, "strip");
        break;
      }
      if (!ai.vy && los && dist < 40 && Math.random() < dt * (L.hop || 0) * ai.hopK) ai.vy = CFG.jumpSpeed;
    }
    if (ai.vy > 0 || p.y > gy + 0.35) {
      ai.vy -= CFG.gravity * dt;
      p.y += ai.vy * dt;
      const land = currentGroundY(p.x, p.z, p.y + CFG.stepHeight);
      if (ai.vy <= 0 && p.y <= land) { p.y = land; ai.vy = 0; }
    }
    // wedged against something: go the other way for a bit
    ai.stuckT = moved < speed * dt * 0.25 ? ai.stuckT + dt : 0;
    if (ai.stuckT > 0.4) { ai.strafe = -ai.strafe; ai.strafeT = 1.2; ai.stuckT = 0; }

    // reloading, then shooting
    if (ai.reloadT > 0) {
      ai.reloadT -= dt;
      if (ai.reloadT <= 0) { ai.ammo = baseMag(g); p.rl = 0; }
      return;
    }
    ai.fireT -= dt;
    const aimErr = Math.abs(wrapAngle(wantYaw - ai.aimYaw)) + Math.abs(wantPitch - ai.aimPitch);
    if (ai.seeT > L.react * ai.reactK && aimErr < 0.1 && ai.fireT <= 0 && nowMs() >= tgt.protectUntil) botFire(p, tgt, dist, now);
  }

  // where a shot aimed at `y` (height above the target's feet) really goes: an error angle in both directions,
  // then does that land in the head, the body, or nowhere? Returns "head", "body" or null
  function botShotLands(dist, errRad, aimHeight, lag) {   // lag: [sideways, vertical] metres of lag at most (the share that applies is random)
    const sgn = () => (Math.random() < 0.5 ? -1 : 1);
    const hx = gauss() * errRad * dist + (lag ? lag[0] * Math.random() * sgn() : 0), vy = aimHeight + gauss() * errRad * dist + (lag ? lag[1] * Math.random() * sgn() : 0);
    if (Math.hypot(hx, vy - 1.62) < 0.27) return "head";
    if (Math.abs(hx) < 0.42 && vy > 0.35 && vy < 1.38) return "body";
    return null;
  }

  // a bot's crossbow bolt: everyone sees it fly, and it only lands if the target is still where it was aimed when it arrives (so it can be dodged)
  function botLaunchBolt(p, tgt, dist, errRad, aimHeight, ox, oy, oz, tx, ty, tz, now, lag) {
    const land = botShotLands(dist, errRad, aimHeight, lag);
    const flight = Math.max(0.05, Math.hypot(tx, ty, tz) / BOLT_SPEED);
    let vx = tx / flight, vz = tz / flight;
    if (!land) { const side = (Math.random() < 0.5 ? -1 : 1) * rnd(0.8, 1.6) / flight, len = Math.hypot(tx, tz) || 1; vx += -tz / len * side; vz += tx / len * side; }   // a miss goes wide
    hostBroadcast({ t: "throw", id: p.id, o: [r2(ox), r2(oy), r2(oz)], v: [r2(vx), r2((ty + 0.5 * BOLT_GRAVITY * flight * flight) / flight), r2(vz)], b: 1 });
    if (land) (net.botBolts = net.botBolts || []).push({ at: now + flight * 1000, p, v: tgt, ax: tgt.x, az: tgt.z, head: land === "head", dist });
  }
  function hostBotBolts(now) {
    const list = net.botBolts;
    if (!list || !list.length) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (now < b.at) continue;
      list.splice(i, 1);
      const v = b.v;
      if (!v.alive || Math.hypot(v.x - b.ax, v.z - b.az) > 0.9 || now < v.protectUntil) continue;   // it moved, died or is protected
      const dmg = hostDamage(b.p, v, { head: b.head, n: 1, h: b.head ? 1 : 0 }, "crossbow");
      if (dmg <= 0) continue;
      const pts = Math.round(CFG.basePoints * (1 + Math.max(0, b.dist - CFG.distanceFrom) * CFG.distanceMultPerM) * (b.head ? 1.5 : 1));
      hostDealDamage(b.p, v, dmg, { pts, tags: [], head: b.head, knife: false });
    }
  }

  function botFire(p, tgt, dist, now) {
    const ai = p.ai, L = ai.lvl, g = ai.gun, w = WEAPONS[g];
    if (g === "knife") {   // the gun game's last level: a bot only stabs once it is next to you
      if (dist > 2.8) { ai.fireT = 0.08; return; }
      p.lastFireAt = now; p.protectUntil = 0;
      ai.fireT = w.fireRate * 1.1 + rnd(0, 0.15);
      hostBroadcast({ t: "swing", id: p.id });
      if (Math.random() < 0.85) hostDealDamage(p, tgt, KNIFE_SWING_DMG, { pts: 100, tags: [], head: false, knife: true, g: "knife" });
      return;
    }
    ai.ammo--; p.lastFireAt = now; p.protectUntil = 0;
    let gap = w.fireRate * 1.08;
    if (w.burst) {   // three quick rounds, then the gun's own pause
      if (ai.burstLeft <= 0) ai.burstLeft = w.burst;
      ai.burstLeft--;
      gap = ai.burstLeft > 0 ? w.burstGap * 1.08 : w.fireRate * 1.08 + rnd(0.05, 0.3) * (L.react / 0.4);
    } else if (w.auto) {
      if (ai.burstLeft <= 0) ai.burstLeft = randInt(L.burst[0], L.burst[1]);
      ai.burstLeft--;
      if (ai.burstLeft <= 0) gap = rnd(L.pause[0], L.pause[1]);
    } else gap += rnd(0.05, 0.3) * (L.react / 0.4);
    ai.fireT = gap;
    if (ai.ammo <= 0) { ai.reloadT = BOT_RELOAD; p.rl = 1; ai.fireT = 0.4; }

    // everyone sees and hears the shot
    const ox = p.x, oy = p.y + 1.6, oz = p.z;
    const aimHeight = Math.random() < L.head ? 1.55 : 1.15;
    const tx = tgt.x - ox, ty = tgt.y + aimHeight - oy, tz = tgt.z - oz, tl = Math.hypot(tx, ty, tz) || 1;
    hostBroadcast({ t: "shot", id: p.id, g, o: [r2(ox), r2(oy), r2(oz)], d: [r2(tx / tl * 1000) / 1000, r2(ty / tl * 1000) / 1000, r2(tz / tl * 1000) / 1000], l: r2(tl) });

    // aim error: worse against a moving target and the longer an automatic keeps firing
    const burstK = w.auto ? 1 + 0.12 * Math.min(ai.burstLeft === 0 ? 0 : (L.burst[1] - ai.burstLeft), 8) : 1;
    const errRad = L.err * (ai.errK || 1) * Math.PI / 180 * (1 + ai.tspd / 24) * (Math.abs(ai.tvy) > 1.5 ? 1.35 : 1) * burstK * (g === "rifle" ? 0.55 : g === "dmr" ? 0.75 : 1);
    const lag = [ai.tlat * (L.lag || 0.2), Math.abs(ai.tvy) * (L.lag || 0.2) * 1.3];
    if (w.projectile) { botLaunchBolt(p, tgt, dist, errRad, aimHeight, ox, oy, oz, tx, ty, tz, now, lag); return; }
    let n = 0, h = 0;
    if (g === "shotgun") {
      for (let i = 0; i < DAMAGE.shotgun.pellets; i++) {
        const spread = 0.065 * Math.sqrt(Math.random());
        const land = botShotLands(dist, Math.hypot(errRad, spread * 0.55), aimHeight, lag);
        if (land) { n++; if (land === "head") h++; }
      }
      if (!n) return;
    } else {
      const land = botShotLands(dist, errRad, aimHeight, lag);
      if (!land) return;
      n = 1; h = land === "head" ? 1 : 0;
    }
    const m = { head: h > 0 && g !== "shotgun", n, h };
    const dmg = hostDamage(p, tgt, m, g);
    if (dmg <= 0) return;
    const pts = Math.round(CFG.basePoints * (1 + Math.max(0, dist - CFG.distanceFrom) * CFG.distanceMultPerM) * (h > 0 ? 1.5 : 1));
    hostDealDamage(p, tgt, dmg, { pts, tags: [], head: h > 0, knife: false });
  }

  // the shooting range: dummies at set distances, started from the single player menu (it runs as a practice room with the dummies as bots)
  let rangeFromMenu = false;
  function startRange() {
    const kept = setup.practice;
    setup.practice = Object.assign({}, kept, { mode: "range", bots: 4, rules: Object.assign({}, NO_RULES) });
    setUiMode("mp");
    rangeFromMenu = true;
    mpBots();
    setup.practice = kept;
    requestPlay();
  }
  document.getElementById("range-start").addEventListener("click", (e) => { e.stopPropagation(); startRange(); });
  // how many bots a practice game may have: 7 on most maps, 11 on the big ones, 4 more in a battle royale (15 at most); the range keeps 5 dummies
  function botCap(mapChoice, modeId) {
    if (modeId === "range") return 5;
    const m = MAPS[mapChoice], base = (m && m.maxBots) || 7;
    return modeId === "br" ? Math.min(15, base + 4) : base;
  }
  function mpBots() {
    const count = Math.max(1, Math.min(setup.practice.bots, botCap(setup.practice.map, setup.practice.mode)));
    const level = setup.practice.mode === "range" ? "dummy" : setup.practice.level;
    chooseMode(setup.practice.mode, setup.practice.limit); chooseMap(setup.practice.map); chooseRules(setup.practice.rules); net.id = "you"; net.practice = true; net.botCount = count;
    mpEnter("host", "BOTS");
    net.lastTick = nowMs();
    for (let i = 0; i < count; i++) addBot(i, level).botIndex = i;
    mpEls.roomCode.textContent = "Practice";
    mpEls.copyBtn.hidden = true; mpEls.settingsBtn.hidden = true;
    hostStartRound();
    mpRefreshRoomUI();
  }

  // ======================================================================
  // PLAY SETUP: the window for starting a practice match or a room (and for changing the next round of a room).
  // The modes are a list: a new mode only needs an entry here (and its rules in the host code), not a new menu.
  // ======================================================================
  const SETUP_KEY = "tsb-mp-setup";
  const MODES = [
    { id: "race", name: "Score Race", short: "Everyone shoots the same targets", practice: false },
    { id: "dm", name: "Deathmatch", short: "Free for all, first to the kill limit" },
    { id: "tdm", name: "Team Deathmatch", short: "Blue against red" },
    { id: "koth", name: "King of the Hill", short: "Hold the hilltop alone", hill: true },
    { id: "tkoth", name: "Team King of the Hill", short: "Your team holds the hill", hill: true },
    { id: "br", name: "Battle royale", short: "One life, a closing zone, last one standing" },
    { id: "ctf", name: "Capture the flag", short: "Take their flag home", flags: true },
    { id: "gungame", name: "Gun game", short: "Every kill swaps your gun; finish with the knife" },
    { id: "range", name: "Shooting range", short: "Dummies at set distances: every hit shows its damage", host: false },
  ];
  const modeById = (id) => MODES.find((m) => m.id === id) || MODES[1];
  const LIMITS = [5, 10, 15, 25, 50, 0];
  const BOT_LEVEL_IDS = ["easy", "medium", "hard"];
  const NO_RULES = { lowGrav: false, oneShot: false, headOnly: false, fastResp: false, siphon: false };
  const setup = { practice: { mode: "dm", map: "arena", limit: 15, bots: 3, level: "medium", rules: Object.assign({}, NO_RULES, { siphon: true }) }, host: { mode: "dm", map: "arena", limit: 15, rules: Object.assign({}, NO_RULES, { siphon: true }) } };
  (function loadSetup() {   // the last choices come back (each value is checked, so a damaged save can't break the menu)
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SETUP_KEY)); } catch (e) { /* none saved */ }
    if (!saved || typeof saved !== "object") return;
    for (const kind of ["practice", "host"]) {
      const s = saved[kind], d = setup[kind];
      if (!s || typeof s !== "object") continue;
      if (MODES.some((m) => m.id === s.mode) && !(kind === "practice" && s.mode === "race") && s.mode !== "range") d.mode = s.mode;
      if (s.map === "random" || MAPS[s.map]) d.map = s.map;
      if (LIMITS.includes(s.limit)) d.limit = s.limit;
      if (s.rules && typeof s.rules === "object") { d.rules = cleanRules(s.rules); if (s.rules.siphon === undefined) d.rules.siphon = siphonDefault(d.mode); }
      if (kind === "practice") {
        if (Number.isInteger(s.bots) && s.bots >= 1 && s.bots <= 15) d.bots = s.bots;
        if (BOT_LEVEL_IDS.includes(s.level)) d.level = s.level;
      }
    }
  })();
  function saveSetup() { try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)); } catch (e) { /* ignore */ } }
  const mapNameOf = (id) => (id === "random" ? "Random map" : MAPS[id] ? MAPS[id].name : "Arena");
  const hillMapId = () => MAP_ORDER.find((i) => MAPS[i].hill);
  const limitText = (mode, limit) => (mode.id === "race" || mode.id === "range" || mode.id === "gungame" || mode.id === "br" ? "" : mode.flags ? (limit ? "first to " + Math.max(1, Math.round(limit / 5)) + " capture" + (Math.max(1, Math.round(limit / 5)) === 1 ? "" : "s") : "no limit") : limit ? "first to " + (mode.hill ? limit * 5 + " s" : limit) : "no limit");
  function refreshMpCards() {   // the three big choices say what they are, nothing about the last match you set up
    document.getElementById("mp-card-practice-sub").textContent = "Play offline against AI players";
    document.getElementById("mp-card-host-sub").textContent = "Start a room and share the code";
  }
  function pendingModeValue() { return net.pendingBr ? "br" : net.pendingCtf ? "ctf" : net.pendingGun ? "gungame" : net.pendingRange ? "range" : net.pendingKoth ? (net.pendingTeams ? "tkoth" : "koth") : net.pendingTeams ? "tdm" : net.pendingSub; }
  function refreshLobbyLine() {   // in a hosted room: what the next round will be
    if (!mpEls.nextLine) return;
    const m = modeById(pendingModeValue());
    const lt = limitText(m, net.pendingLimit), rt = ruleText(net.pendingRules);
    mpEls.nextLine.textContent = net.role === "host" && !net.practice ? "Next round: " + m.name + " \u00b7 " + mapNameOf(net.pendingMap) + (lt ? " \u00b7 " + lt : "") + (rt ? " \u00b7 " + rt : "") : "";
  }

  const psEl = document.getElementById("play-setup");
  let ps = null;   // { kind: "practice" | "host" | "room", draft }
  const isKothMode = (id) => !!modeById(id).hill;
  function fixHillMap() {   // King of the Hill is only played where there is a hill, and the range on the range
    const d = ps.draft;
    if (d.mode === "ctf" && !(MAPS[d.map] && MAPS[d.map].flags)) { d.map = MAP_ORDER.find((i) => MAPS[i].flags) || d.map; return; }
    if (d.mode === "range") { d.map = "range"; return; }
    if (d.map === "range") d.map = "arena";
    if (isKothMode(d.mode) && !(MAPS[d.map] && MAPS[d.map].hill)) d.map = hillMapId() || d.map;
  }
  function openSetup(kind) {
    const base = kind === "practice" ? setup.practice : kind === "host" ? setup.host : { mode: pendingModeValue(), map: net.pendingMap, limit: net.pendingLimit, rules: net.pendingRules };
    ps = { kind, draft: Object.assign({}, base, { rules: Object.assign({}, base.rules) }) };
    if (kind === "practice" && ps.draft.mode === "race") ps.draft.mode = "dm";
    fixHillMap();
    renderSetup();
    psEl.hidden = false;
  }
  function closeSetup() { psEl.hidden = true; ps = null; }
  function renderSetup() {
    const d = ps.draft, mode = modeById(d.mode);
    document.getElementById("ps-title").textContent = ps.kind === "practice" ? "Practice vs bots" : ps.kind === "host" ? "Host a room" : "Next round";
    // the modes
    const modesEl = document.getElementById("ps-modes");
    modesEl.textContent = "";
    for (const m of MODES) {
      if (m.id === "range") continue;   // the range starts from the single player menu
      if (ps.kind === "practice" && m.practice === false) continue;   // a score race needs real people
      if (ps.kind !== "practice" && m.host === false) continue;   // and the range is for practice
      const b = document.createElement("button");
      b.type = "button"; b.className = "ps-card" + (m.id === d.mode ? " active" : ""); b.dataset.mode = m.id;
      b.innerHTML = "<b>" + m.name + "</b><span>" + m.short + "</span>";
      b.addEventListener("click", () => { d.mode = m.id; d.rules.siphon = siphonDefault(m.id); fixHillMap(); renderSetup(); });
      modesEl.appendChild(b);
    }
    document.getElementById("ps-mode-desc").textContent = SUB_HINTS[d.mode] || "";
    // the maps
    const mapsEl = document.getElementById("ps-maps");
    mapsEl.textContent = "";
    for (const id of MAP_ORDER.concat(["random"])) {
      if (id === "range" && mode.id !== "range") continue;   // the range is only for the range mode
      const b = document.createElement("button");
      const off = (isKothMode(d.mode) && !(MAPS[id] && MAPS[id].hill)) || (mode.id === "range" && id !== "range") || (mode.id === "ctf" && !(MAPS[id] && MAPS[id].flags));
      b.type = "button"; b.dataset.map = id; b.className = (id === d.map ? "active" : "") + (off ? " off" : "");
      const c = document.createElement("canvas"); c.width = c.height = 64;
      if (id === "random") { const g = c.getContext("2d"); g.fillStyle = "#1c1d22"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#ffd24a"; g.font = "bold 36px sans-serif"; g.textAlign = "center"; g.fillText("?", 32, 46); }
      else drawMapThumb(c, MAPS[id]);
      b.appendChild(c); b.appendChild(document.createTextNode(id === "random" ? "Random" : MAPS[id].name));
      b.addEventListener("click", () => { if (off) return; d.map = id; renderSetup(); });
      mapsEl.appendChild(b);
    }
    const pv = document.getElementById("ps-preview"), pg = pv.getContext("2d");
    if (d.map === "random") { pg.fillStyle = "#1c1d22"; pg.fillRect(0, 0, 200, 200); pg.fillStyle = "#ffd24a"; pg.font = "bold 90px sans-serif"; pg.textAlign = "center"; pg.fillText("?", 100, 130); }
    else drawMapThumb(pv, MAPS[d.map]);
    document.getElementById("ps-map-name").textContent = mapNameOf(d.map);
    document.getElementById("ps-map-note").textContent = d.map === "random" ? "A different map each round." : MAPS[d.map].blurb;
    // the rules
    const limitRow = document.getElementById("ps-limit-row");
    limitRow.hidden = mode.id === "race" || mode.id === "range" || mode.id === "gungame" || mode.id === "br";
    document.getElementById("ps-limit").value = String(d.limit);
    document.getElementById("ps-limit-unit").textContent = mode.flags ? "(divided by 5: " + (d.limit ? Math.max(1, Math.round(d.limit / 5)) + " capture" + (Math.max(1, Math.round(d.limit / 5)) === 1 ? "" : "s") + ")" : "no limit)") : mode.hill ? "(times 5 seconds on the hill" + (d.limit ? ": " + d.limit * 5 + " s)" : ")") : "kills";
    document.getElementById("ps-bots-row").hidden = ps.kind !== "practice";
    document.getElementById("ps-level-row").hidden = ps.kind !== "practice" || mode.id === "range";
    document.getElementById("ps-bots-label").textContent = mode.id === "range" ? "Dummies" : "Bots";
    if (ps.kind === "practice") {
      const cap = botCap(d.map, d.mode), sel = document.getElementById("ps-bots");
      if (d.bots > cap) d.bots = cap;
      if (sel.options.length !== cap) { sel.textContent = ""; for (let i = 1; i <= cap; i++) sel.add(new Option(String(i))); }
      sel.value = String(d.bots); document.getElementById("ps-level").value = d.level;
    }
    const race = mode.id === "race" || mode.id === "range";   // (no fighting there: only gravity matters)
    for (const [id, key] of [["ps-r-lowgrav", "lowGrav"], ["ps-r-oneshot", "oneShot"], ["ps-r-headonly", "headOnly"], ["ps-r-fastresp", "fastResp"], ["ps-r-siphon", "siphon"]]) {
      document.getElementById(id).checked = !!d.rules[key];
      if (key !== "lowGrav") document.getElementById(id).parentElement.hidden = race;
    }
    const sum = [limitText(mode, d.limit)];
    if (ps.kind === "practice") sum.push(mode.id === "range" ? d.bots + " dummies" : d.bots + " bot" + (d.bots === 1 ? "" : "s"), mode.id === "range" ? "" : d.level);
    if (ruleText(d.rules)) sum.push(ruleText(d.rules));
    document.getElementById("ps-go").textContent = ps.kind === "practice" ? "Start practice" : ps.kind === "host" ? "Create room" : "Use for the next round";
  }
  for (const [id, key] of [["ps-r-lowgrav", "lowGrav"], ["ps-r-oneshot", "oneShot"], ["ps-r-headonly", "headOnly"], ["ps-r-fastresp", "fastResp"], ["ps-r-siphon", "siphon"]]) {
    document.getElementById(id).addEventListener("change", (e) => { if (ps) { ps.draft.rules[key] = e.target.checked; renderSetup(); } });
  }
  document.getElementById("ps-limit").addEventListener("change", (e) => { if (ps) { ps.draft.limit = parseInt(e.target.value, 10); renderSetup(); } });
  document.getElementById("ps-bots").addEventListener("change", (e) => { if (ps) { ps.draft.bots = parseInt(e.target.value, 10); renderSetup(); } });
  document.getElementById("ps-level").addEventListener("change", (e) => { if (ps) { ps.draft.level = e.target.value; renderSetup(); } });
  document.getElementById("ps-go").addEventListener("click", () => {
    if (!ps) return;
    const d = ps.draft, kind = ps.kind;
    if (kind === "practice") { Object.assign(setup.practice, d); saveSetup(); closeSetup(); refreshMpCards(); mpBots(); }
    else if (kind === "host") { Object.assign(setup.host, { mode: d.mode, map: d.map, limit: d.limit, rules: d.rules }); saveSetup(); closeSetup(); refreshMpCards(); mpHost(); }
    else { chooseMode(d.mode, d.limit); chooseMap(d.map); chooseRules(d.rules); closeSetup(); refreshLobbyLine(); }
  });
  document.getElementById("ps-close").addEventListener("click", closeSetup);
  psEl.addEventListener("click", (e) => { if (e.target === psEl) closeSetup(); });
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !psEl.hidden) closeSetup(); });
  mpEls.practiceBtn.addEventListener("click", () => openSetup("practice"));
  mpEls.hostBtn.addEventListener("click", () => { if (typeof Peer === "undefined") { mpStatus("Multiplayer library failed to load (check your connection)."); return; } openSetup("host"); });
  mpEls.settingsBtn.addEventListener("click", () => openSetup("room"));
  refreshMpCards();

  // ---------------- connecting ----------------
  function randomCode() {
    let c = "";
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
  }

  function mpEnter(role, code) {
    net.active = true; net.role = role; net.code = code;
    net.players.clear(); net.ttSynced = false; net.ttOffset = 0;
    net.phase = "play"; net.left = ROUND_SECONDS; net.leftRecv = nowMs(); net.lastHostMsg = nowMs();
    const name = myName();
    const me = makePlayerRecord(net.id, name, PLAYER_COLORS[0]);
    net.players.set(net.id, me);
    setPropsEnabled(false);
    for (const t of targets) { t.userData.alive = false; t.visible = false; t.userData.respawnTimer = Infinity; }
    resetLocalRound();
    mpEls.tabs.forEach((t) => (t.disabled = true));
    mpEls.connect.hidden = true;
    mpEls.room.hidden = false;
    mpEls.timer.hidden = false;
    mpEls.roomCode.textContent = code;
    mpEls.settingsBtn.hidden = role !== "host";
    mpEls.copyBtn.hidden = false;
    refreshLobbyLine();
    mpStatus("");
    mpRefreshRoomUI();
    mpRefreshHud();
  }

  function mpTeardown() {
    for (const p of net.players.values()) disposeAvatar(p);
    net.players.clear();
    try { for (const c of net.conns.values()) c.close(); } catch (e) { /* ignore */ }
    net.conns.clear();
    try { if (net.hostConn) net.hostConn.close(); } catch (e) { /* ignore */ }
    try { if (net.peer) net.peer.destroy(); } catch (e) { /* ignore */ }
    net.peer = null; net.hostConn = null; net.id = null; net.role = null; net.active = false; net.practice = false;
    net.koth = net.ctf = net.gungame = net.range = net.br = false;   // (a new room must not start out as the last one's mode)
  }

  function mpLeave(message) {
    const wasActive = net.active;
    mpTeardown();
    if (!wasActive) { setConnectBusy(false); mpStatus(message || ""); return; }
    document.exitPointerLock();
    setPropsEnabled(true);
    loadMap(resolveMapChoice(SETTINGS.map));   // back to the map picked in the menu
    applyRulePhysics();
    ggRestore();
    ctfDispose();
    brDispose();
    for (const t of targets) respawnTarget(t);
    resetLocalRound();
    mpEls.tabs.forEach((t) => (t.disabled = false));
    if (rangeFromMenu) { rangeFromMenu = false; setUiMode("solo"); }   // the range was started from single player: go back there
    mpEls.connect.hidden = false;
    mpEls.room.hidden = true;
    mpEls.timer.hidden = true;
    mpEls.board.hidden = true;
    mpEls.feed.innerHTML = "";
    setConnectBusy(false);
    mpStatus(message || "");
  }

  function setConnectBusy(busy) { mpEls.hostBtn.disabled = busy; mpEls.joinBtn.disabled = busy; }

  function mpHost() {
    if (typeof Peer === "undefined") { mpStatus("Multiplayer library failed to load (check your connection)."); return; }
    setConnectBusy(true);
    mpStatus("Creating room…", true);
    chooseMode(setup.host.mode, setup.host.limit);
    chooseMap(setup.host.map);
    chooseRules(setup.host.rules);
    let attempts = 0, opened = false;

    const open = () => {
      const code = randomCode();
      const peer = new Peer(ROOM_PREFIX + code, PEER_OPTS);
      peer.on("open", (id) => {
        opened = true;
        net.peer = peer; net.id = id;
        mpEnter("host", code);
        net.lastTick = nowMs();
        hostStartRound();
        peer.on("connection", hostOnConnection);
      });
      peer.on("disconnected", () => { if (opened && net.peer === peer && !peer.destroyed) peer.reconnect(); });
      peer.on("error", (err) => {
        if (!opened) {
          peer.destroy();
          if (err.type === "unavailable-id" && attempts++ < 5) { open(); return; }
          setConnectBusy(false);
          mpStatus("Couldn't create a room (" + err.type + "). Try again.");
        } else {
          feedLine("Network warning: " + esc(err.type));
        }
      });
    };
    open();
  }

  let hostPending = 0;   // connections still opening or waiting to say hello
  function hostOnConnection(conn) {
    // a limit on connections that haven't joined yet, so a flood of them can't pile up
    if (net.conns.size + hostPending >= MAX_PLAYERS + 2) { conn.on("open", () => conn.close()); return; }
    hostPending++;
    let counted = true;
    const uncount = () => { if (counted) { counted = false; hostPending--; } };
    const bucket = { tok: MSG_BURST, t: nowMs(), over: 0 };
    let hello = null;
    conn.on("open", () => {
      if (net.players.size >= MAX_PLAYERS) { uncount(); conn.send({ t: "full" }); setTimeout(() => conn.close(), 300); return; }
      net.conns.set(conn.peer, conn);
      hello = setTimeout(() => { if (!net.players.has(conn.peer)) conn.close(); }, 6000);   // say hello or go
    });
    conn.on("data", (m) => {
      if (!net.conns.has(conn.peer)) return;
      if (!takeToken(bucket, nowMs())) { if (++bucket.over > MSG_KICK) conn.close(); return; }   // flooding
      if (m && m.t === "hello" && !net.players.has(conn.peer)) { uncount(); hostAddPlayer(conn, m); }
      else hostHandle(conn.peer, m);
    });
    const gone = () => { uncount(); clearTimeout(hello); hostRemovePlayer(conn.peer); };
    conn.on("close", gone);
    conn.on("error", gone);
  }

  function mpJoin() {
    if (typeof Peer === "undefined") { mpStatus("Multiplayer library failed to load (check your connection)."); return; }
    const code = mpEls.code.value.trim().toUpperCase();
    if (code.length !== 5) { mpStatus("Enter the 5-character room code."); return; }
    setConnectBusy(true);
    mpStatus("Connecting…", true);
    const peer = new Peer(PEER_OPTS);
    const fail = (msg) => {
      clearTimeout(timeout);
      if (net.active) return;
      mpTeardownPending(peer);
      mpLeave(msg);
    };
    const timeout = setTimeout(() => fail("Couldn't connect to that room. Check the code and that the host's tab is still open. " +
      "If it keeps failing, one of your networks may be blocking direct connections."), 25000);
    net.peer = peer;

    peer.on("open", (id) => {
      net.id = id;
      const conn = peer.connect(ROOM_PREFIX + code, { reliable: true, serialization: "json" });
      net.hostConn = conn;
      // surface a blocked direct connection right away instead of waiting out the timer
      setTimeout(() => {
        const pc = conn.peerConnection;
        if (pc) pc.addEventListener("iceconnectionstatechange", () => {
          if (pc.iceConnectionState === "failed") fail("Couldn't make a connection. One of your networks is blocking direct connections to the host.");
        });
      }, 0);
      conn.on("open", () => conn.send({ t: "hello", name: myName() }));
      conn.on("data", (m) => {
        if (!m) return;
        if (m.t === "full") { fail("That room is full."); return; }
        net.lastHostMsg = nowMs();
        if (!net.active && m.t === "round") { clearTimeout(timeout); mpEnter("client", code); net.lastTick = nowMs(); }
        if (net.active) { try { applyEvent(m); } catch (e) { /* a malformed message from the host is dropped */ } }
      });
      conn.on("close", () => { if (net.active) mpLeave("The host closed the room."); else fail("The host closed the connection."); });
      conn.on("error", (err) => fail("Connection failed (" + (err && err.type || "error") + ")."));
    });
    peer.on("error", (err) => {
      if (net.active) { feedLine("Network warning: " + esc(err.type)); return; }
      if (err.type === "peer-unavailable") fail("Room not found. Check the code, and make sure the host's room is still open (their tab must stay open).");
      else if (["network", "server-error", "socket-error", "socket-closed"].includes(err.type)) fail("Couldn't reach the matchmaking server (" + err.type + "). Try again in a moment.");
      else fail("Connection failed (" + err.type + ").");
    });
  }
  function mpTeardownPending(peer) { try { peer.destroy(); } catch (e) { /* ignore */ } net.peer = null; net.hostConn = null; }

  mpEls.joinBtn.addEventListener("click", mpJoin);
  mpEls.code.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") mpJoin(); });
  mpEls.name.addEventListener("keydown", (e) => e.stopPropagation());
  mpEls.leaveBtn.addEventListener("click", () => mpLeave(""));
  mpEls.copyBtn.addEventListener("click", () => {
    const link = /^https?:/.test(location.protocol) ? location.origin + location.pathname + "?room=" + net.code : net.code;
    const done = () => { mpEls.copyBtn.textContent = "Copied"; setTimeout(() => (mpEls.copyBtn.textContent = "Copy"), 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => {});
  });
  window.addEventListener("beforeunload", () => { if (net.active) mpTeardown(); });

  // an invite link (?room=CODE) drops straight into the join box
  (function readInvite() {
    if (!MULTIPLAYER_ENABLED) return;
    const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().slice(0, 5);
    if (code) { mpEls.code.value = code; setUiMode("mp"); }
  })();

  // ---------------- UI ----------------
  function mpRefreshRoomUI() {
    if (!net.active) return;
    mpEls.roomMode.textContent = modeName();
    mpEls.players.innerHTML = "";
    for (const p of net.players.values()) {
      const li = document.createElement("li");
      const hex = "#" + p.color.toString(16).padStart(6, "0");
      li.innerHTML = '<span class="dot" style="background:' + hex + '"></span>' + esc(p.name) +
        (p.id === net.id ? ' <span class="tag">YOU</span>' : "") + (p.bot ? ' <span class="tag">BOT</span>' : "");
      mpEls.players.appendChild(li);
    }
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }
  // the 3-2-1 before every round: nobody moves, shoots or takes damage until it ends (the host counts it; everyone else counts from the last message)
  function cdNow() { return net.role === "host" ? Math.max(0, net.cd) : Math.max(0, net.cd - (nowMs() - net.cdRecv) / 1000); }
  const countingDown = () => net.active && net.phase === "play" && cdNow() > 0;
  function leftNow() {
    return net.role === "host" ? net.left : net.left - (nowMs() - net.leftRecv) / 1000;
  }

  function mpRefreshHud() {
    if (!net.active) return;
    mpEls.timerVal.textContent = net.phase === "results" ? "0:00" : fmtTime(leftNow());
    let label = modeName();
    if (net.sub === "dm" && net.koth) {
      if (net.limit) label += " \u00b7 first to " + net.limit * 5;
      if (ruleText(net.rules)) label += " \u00b7 " + ruleText(net.rules);
    } else {
      if (net.sub === "dm" && net.limit) label += " \u00b7 first to " + net.limit;
      if (ruleText(net.rules)) label += " \u00b7 " + ruleText(net.rules);
      if (net.sub === "dm" && net.teams) label += " \u00b7 " + TEAM_NAMES[0] + " " + teamKills(0) + " \u2013 " + teamKills(1) + " " + TEAM_NAMES[1];
    }
    if (net.sub === "dm" && net.br) label = "Battle royale" + (ruleText(net.rules) ? " \u00b7 " + ruleText(net.rules) : "");
    if (net.sub === "dm" && net.ctf) label = "Capture the flag \u00b7 " + (net.limit ? "first to " + ctfNeed() : "no limit") + (ruleText(net.rules) ? " \u00b7 " + ruleText(net.rules) : "");
    if (net.sub === "dm" && net.gungame) { const me = localPlayer(); label = "Gun game · " + (me ? Math.min(me.gg, GG_ORDER.length + 1) : 0) + " / " + (GG_ORDER.length + 1) + " guns" + (ruleText(net.rules) ? " · " + ruleText(net.rules) : ""); }
    mpEls.timerMode.textContent = net.phase === "results" ? "Round over" : label;
    mpEls.roomMode.textContent = modeName();
    updateKothBar();
    updateRangeInfo();
  }
  // the shooting range: what the gun in your hand does, in the corner
  const rangeInfoEl = document.getElementById("range-info");
  let rangeInfoFor = "";
  function updateRangeInfo() {
    const on = net.active && net.range && net.phase === "play";
    rangeInfoEl.hidden = !on;
    if (!on || rangeInfoFor === vm.current) return;
    rangeInfoFor = vm.current;
    const id = vm.current, w = WEAPONS[id], d = DAMAGE[id];
    let html = "<b>" + (w ? w.name : id) + "</b><br>";
    if (d && d.pellet) html += "per pellet " + d.pellet + " (" + Math.round(d.pellet * d.headMult) + " head) \u00b7 " + d.pellets + " pellets<br>full damage to " + d.near + " m, " + Math.round(d.farMult * 100) + "% by " + d.far + " m";
    else if (d && d.blast) html += "blast " + d.max + " in the middle, " + d.min + " at " + d.radius + " m" + (BLAST[id] && BLAST[id].rocket ? "<br>flies fast and goes off on anything it touches" : "<br>goes off after about " + (BLAST[id] || BLAST.launcher).fuse + " s or on a direct hit");
    else if (d) html += "body " + d.body + " \u00b7 head " + d.head + "<br>" + Math.ceil(100 / d.body) + " body hit" + (Math.ceil(100 / d.body) === 1 ? "" : "s") + " or " + Math.ceil(100 / d.head) + " head hit" + (Math.ceil(100 / d.head) === 1 ? "" : "s") + " to kill" + (d.far ? "<br>full damage to " + d.near + " m, " + Math.round(d.farMult * 100) + "% by " + d.far + " m" : "");
    else if (id === "knife") html += "swing " + KNIFE_SWING_DMG + " \u00b7 throw " + KNIFE_THROW_DMG + " body, " + KNIFE_THROW_HEAD_DMG + " head";
    rangeInfoEl.innerHTML = html;
  }

  // gun game: your gun follows your level (the knife at the end); everything goes back when you leave
  let ggApplied = "", ggSaved = null, ggForcing = false;
  const ggKnife = () => net.active && net.gungame && ggApplied === "knife";
  function ggSync() {
    if (!net.active || !net.gungame) { if (ggSaved !== null) ggRestore(); return; }   // (the next round is another mode: your own gun comes back)
    const gp = net.ggp || "";
    if (gp !== ggPresetKey) { ggPresetKey = gp; ggPresetMap = ggParsePreset(gp); if (ggOn) applyAttachments(); }   // a new game, a new setup
    const me = localPlayer();
    if (!me) return;
    const t = me.gg >= GG_ORDER.length ? "knife" : GG_ORDER[me.gg];
    if (ggApplied === t) return;
    ggApplied = t;
    const first = ggSaved === null;
    if (first) { ggSaved = SETTINGS.loadout; ggOn = true; }
    ggForcing = true;
    try { if (t === "knife") { switchWeapon("knife"); updateAmmoHud(); } else setLoadout(t); } finally { ggForcing = false; }
    if (first) { applyAttachments(); renderLoadout(); }   // stock guns, and the loadout buttons lock
  }
  function ggRestore() {
    ggApplied = ""; ggOn = false;
    if (ggSaved) { const g = ggSaved; ggSaved = null; ggForcing = true; try { setLoadout(g); } finally { ggForcing = false; } }
    applyAttachments(); renderLoadout();
  }

  // the flags in the world: a pole with a cloth in the team colour, on its base, or on the shoulders of whoever has it
  let ctfObjs = null;
  function ctfDispose() { if (!ctfObjs) return; for (const g of ctfObjs) { scene.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); } ctfObjs = null; }
  function ctfBuild() {
    ctfDispose();
    ctfObjs = [0, 1].map((t) => {
      const g = new THREE.Group(), color = TEAM_COLORS[t];
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.5, roughness: 0.4 }));
      pole.position.y = 1.3;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      cloth.position.set(0.55, 2.2, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 8, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 7;
      g.add(pole, cloth, ring, beam);
      g.userData = { cloth, ring, beam };
      scene.add(g);
      return g;
    });
  }
  function updateCtfFlags(t) {
    const on = net.active && net.ctf && net.phase === "play" && currentMap && currentMap.flags;
    if (!on) { if (ctfObjs) for (const g of ctfObjs) g.visible = false; return; }
    if (!ctfObjs || ctfObjs[0].userData.cloth.material.color.getHex() !== TEAM_COLORS[0] || ctfObjs[1].userData.cloth.material.color.getHex() !== TEAM_COLORS[1]) ctfBuild();
    for (const tm of [0, 1]) {
      const g = ctfObjs[tm], f = net.flags[tm], base = ctfBase(tm);
      g.visible = true;
      let x = f.x, y = f.y, z = f.z, carried = false;
      if (f.s === 1) {
        const c = net.players.get(f.c);
        if (c && c.id === net.id) { x = yawObject.position.x; z = yawObject.position.z; y = player.feetY; carried = true; }
        else if (c && c.mesh) { x = c.mesh.position.x; y = c.mesh.position.y; z = c.mesh.position.z; carried = true; }
      }
      if (f.s === 2) {   // dropped: it falls to the floor under it
        const u = g.userData, dtf = Math.min(Math.max(t - (u.fallT === undefined ? t : u.fallT), 0), 0.1);
        u.fallT = t;
        if (u.curY === undefined) u.curY = y;
        u.fallV = (u.fallV || 0) + 22 * dtf;
        u.curY = Math.max(y, u.curY - u.fallV * dtf);
        y = u.curY;
      } else { g.userData.curY = carried ? y + 0.9 : y; g.userData.fallV = 0; g.userData.fallT = t; }
      g.position.set(x, y + (carried ? 0.9 : 0), z);
      g.userData.cloth.rotation.y = Math.sin(t * 3 + tm) * 0.35;
      g.userData.beam.visible = !carried || f.c === net.id;
      g.userData.ring.visible = !carried;
      g.scale.setScalar(carried ? 0.6 : 1);
      if (f.s === 0) g.position.set(base.x, base.y, base.z);
    }
  }

  // the safe zone in the world: a red wall of light on the edge, and a ring on the ground
  let brWall = null;
  function brDispose() { if (!brWall) return; scene.remove(brWall); brWall.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); brWall = null; }
  function updateBrZone() {
    const on = net.active && net.br && net.phase === "play";
    if (!on) { if (brWall) brWall.visible = false; return; }
    if (!brWall) {
      brWall = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 40, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      wall.position.y = 20;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0xff6a5e }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
      brWall.add(wall, ring);
      scene.add(brWall);
    }
    const z = brNow();
    brWall.visible = true;
    brWall.position.set(net.zc[0], 0, net.zc[1]);
    brWall.scale.set(z.r, 1, z.r);
    brWall.children[1].scale.y = brWall.children[1].scale.z = 1;   // (the ring keeps its thickness: scale only stretches x and z)
  }

  // King of the Hill: a bar across the top. Teams fill in from their own side towards the middle; alone, it is your own progress
  // with a tick for whoever is in front
  const kothBarEl = document.getElementById("koth-bar");
  function updateKothBar() {
    const on = net.active && (net.koth || net.ctf || net.br || (net.teams && !net.gungame && !net.range)) && net.sub === "dm" && net.phase === "play";
    kothBarEl.hidden = !on;
    if (!on) return;
    if (net.br) {   // battle royale: who is left, and what the zone is doing
      const z = brNow(), me = localPlayer(), alive = [...net.players.values()].filter((p) => p.alive).length;
      const fa = kothBarEl.querySelector(".kb-a"), fb = kothBarEl.querySelector(".kb-b"), mk = kothBarEl.querySelector(".kb-mark");
      fa.style.background = "#ff6a5e"; fa.style.width = Math.min(1, Math.max(0, 1 - z.r / (CFG.arenaHalfSize * 1.45))) * 100 + "%"; fb.style.width = "0"; mk.style.display = "none";
      const outside = me && me.alive && Math.hypot(yawObject.position.x - net.zc[0], yawObject.position.z - net.zc[1]) > z.r;
      document.getElementById("kb-left").textContent = alive + " alive";
      document.getElementById("kb-right").textContent = "zone " + Math.round(z.r) + " m";
      const mid = document.getElementById("kb-mid");
      mid.textContent = outside ? "Outside the zone: get in!" : z.status === "wait" ? "Zone closes in " + Math.ceil(z.in) + " s" : z.status === "shrink" ? "The zone is closing" : "Final circle";
      mid.style.color = outside ? "#ff6a5e" : "#e6e6e6";
      return;
    }
    if (net.ctf) {   // capture the flag: the captures, and what the flags are doing
      const need = ctfNeed(), fa = kothBarEl.querySelector(".kb-a"), fb = kothBarEl.querySelector(".kb-b"), mk = kothBarEl.querySelector(".kb-mark");
      fa.style.background = "#" + TEAM_COLORS[0].toString(16).padStart(6, "0"); fb.style.background = "#" + TEAM_COLORS[1].toString(16).padStart(6, "0");
      fa.style.width = Math.min(net.caps[0] / need, 1) * 50 + "%"; fb.style.width = Math.min(net.caps[1] / need, 1) * 50 + "%"; mk.style.left = "50%"; mk.style.display = "block";
      const me = localPlayer(), mine = me && me.team >= 0 ? me.team : 0, enemy = 1 - mine, f1 = net.flags[mine], f2 = net.flags[enemy];
      let msg = "";
      if (f2.s === 1 && f2.c === net.id) msg = "You have the flag: get it home";
      else if (f1.s === 1) msg = "Your flag is taken";
      else if (f2.s === 1) msg = "Your team has their flag";
      else if (f2.s === 2) msg = "Their flag is down";
      else if (f1.s === 2) msg = "Your flag is down: touch it";
      else msg = "Take their flag";
      document.getElementById("kb-left").textContent = TEAM_NAMES[0] + " " + net.caps[0];
      document.getElementById("kb-right").textContent = net.caps[1] + " " + TEAM_NAMES[1];
      const mid = document.getElementById("kb-mid"); mid.textContent = msg; mid.style.color = f1.s === 1 ? "#ff6a5e" : f2.s === 1 ? "#7cfc00" : "#e6e6e6";
      return;
    }
    if (!net.koth) {   // team deathmatch: each team's kills fill in from its own side towards the middle (the first to the limit wins)
      const k0 = teamKills(0), k1 = teamKills(1), need = net.limit > 0 ? net.limit : Math.max(10, k0, k1), fa = kothBarEl.querySelector(".kb-a"), fb = kothBarEl.querySelector(".kb-b"), mk = kothBarEl.querySelector(".kb-mark");
      fa.style.background = "#" + TEAM_COLORS[0].toString(16).padStart(6, "0"); fb.style.background = "#" + TEAM_COLORS[1].toString(16).padStart(6, "0");
      fa.style.width = Math.min(k0 / need, 1) * 50 + "%"; fb.style.width = Math.min(k1 / need, 1) * 50 + "%"; mk.style.left = "50%"; mk.style.display = "block";
      document.getElementById("kb-left").textContent = TEAM_NAMES[0] + " " + k0;
      document.getElementById("kb-right").textContent = k1 + " " + TEAM_NAMES[1];
      const mid = document.getElementById("kb-mid"); mid.textContent = net.limit > 0 ? "First to " + net.limit : "Most kills"; mid.style.color = "#e6e6e6";
      return;
    }
    kothBarEl.querySelector(".kb-mark").style.display = "";
    const need = net.limit > 0 ? net.limit * 5 : ROUND_SECONDS, me = localPlayer();
    const fillA = kothBarEl.querySelector(".kb-a"), fillB = kothBarEl.querySelector(".kb-b"), mark = kothBarEl.querySelector(".kb-mark");
    const left = document.getElementById("kb-left"), mid = document.getElementById("kb-mid"), right = document.getElementById("kb-right");
    const [kind, who] = net.hs;
    let midColor = "#e6e6e6";
    if (kind === 2) midColor = HILL_CONTESTED.css;
    else if (kind === 1) { const hp = net.teams ? null : net.players.get(who); midColor = "#" + (net.teams ? TEAM_COLORS[who] : hp ? hp.color : 0xffd23c).toString(16).padStart(6, "0"); }
    mid.textContent = hillText().replace(/ the hill$/, "");
    mid.style.color = midColor;
    if (net.teams) {
      const a = net.teamHill[0], b = net.teamHill[1];
      fillA.style.background = "#" + TEAM_COLORS[0].toString(16).padStart(6, "0"); fillB.style.background = "#" + TEAM_COLORS[1].toString(16).padStart(6, "0");
      fillA.style.width = Math.min(a / need, 1) * 50 + "%"; fillB.style.width = Math.min(b / need, 1) * 50 + "%";
      mark.style.left = "50%";
      left.textContent = TEAM_NAMES[0] + " " + Math.floor(a); right.textContent = Math.floor(b) + " " + TEAM_NAMES[1];
    } else {
      const mine = me ? me.hill : 0;
      let lead = null;
      for (const p of net.players.values()) if (p !== me && (!lead || p.hill > lead.hill)) lead = p;
      fillA.style.background = "#ffd24a"; fillB.style.width = "0";
      fillA.style.width = Math.min(mine / need, 1) * 100 + "%";
      mark.style.left = lead ? Math.min(lead.hill / need, 1) * 100 + "%" : "0%";
      mark.style.display = lead && lead.hill > 0 ? "block" : "none";
      left.textContent = "You " + Math.floor(mine) + " / " + need;
      right.textContent = lead && lead.hill > 0 ? lead.name + " " + Math.floor(lead.hill) : "";
    }
  }

  // hold the leaderboard key on your own: this map's Score Attack top 5 and your best trickshot
  function soloRecords() {
    const tops = runTopsFor("sa60");
    mpEls.boardTitle.textContent = "Records \u00b7 " + (currentMap ? currentMap.name : "");
    mpEls.boardHead.innerHTML = "<th>#</th><th>Score Attack 1:00</th><th>Score</th><th>Hits</th><th>Acc</th>";
    mpEls.boardBody.innerHTML = tops.length
      ? tops.map((e, i) => "<tr><td>" + (i + 1) + "</td><td>" + esc(e.gun || "") + " \u00b7 " + esc(e.date || "") + "</td><td>" + Math.round(e.score).toLocaleString() + "</td><td>" + (e.hits || 0) + "</td><td>" + Math.round((e.acc || 0) * 100) + "%</td></tr>").join("")
      : '<tr><td></td><td>No Score Attack runs on this map yet</td><td></td><td></td><td></td></tr>';
    const mr = currentMap && mapRecs[currentMap.id], parts = [];
    if (mr && mr.shot) parts.push("Best trickshot here: " + mr.shot.points.toLocaleString() + " points (" + mr.shot.mult.toFixed(2) + "x)");
    if (mr && mr.streak) parts.push("longest streak here: " + mr.streak);
    if (bestShot.points) parts.push("overall best: " + bestShot.points.toLocaleString() + " points (" + bestShot.mult.toFixed(2) + "x)");
    mpEls.boardFoot.textContent = parts.join(" \u00b7 ");
  }

  function mpRefreshScoreboard() {
    const results = net.active && net.phase === "results";
    const lbHeld = pointerLocked && (keys["Tab"] || held("leaderboard"));
    mpEls.board.hidden = !(results || lbHeld);
    if (mpEls.board.hidden) return;
    if (!net.active) { soloRecords(); return; }   // on your own there is no scoreboard: show your records for this map
    const dm = net.sub === "dm", koth = dm && net.koth, ggm = dm && net.gungame;
    const rows = [...net.players.values()].sort(dm && net.br ? (a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0) || b.kills - a.kills || b.dmg - a.dmg : dm && net.ctf ? (a, b) => b.caps - a.caps || b.kills - a.kills : ggm ? (a, b) => b.gg - a.gg || b.kills - a.kills : koth ? (a, b) => b.hill - a.hill || b.kills - a.kills : dm ? (a, b) => b.kills - a.kills || b.score - a.score : (a, b) => b.score - a.score || b.kills - a.kills);
    let title = modeName();
    if (dm && net.ctf) title += " \u00b7 " + TEAM_NAMES[0] + " " + net.caps[0] + " \u2013 " + net.caps[1] + " " + TEAM_NAMES[1];
    else if (koth && net.teams) title += " \u00b7 " + TEAM_NAMES[0] + " " + Math.floor(net.teamHill[0]) + " \u2013 " + Math.floor(net.teamHill[1]) + " " + TEAM_NAMES[1];
    else if (dm && net.teams) title += " \u00b7 " + TEAM_NAMES[0] + " " + teamKills(0) + " \u2013 " + teamKills(1) + " " + TEAM_NAMES[1];
    if (results && rows.length) {
      if (dm && net.ctf) { const a = net.caps[0], b = net.caps[1]; title = a === b ? "Round over \u2014 a draw, " + a + " each" : "Round over \u2014 " + TEAM_NAMES[a > b ? 0 : 1] + " team wins, " + Math.max(a, b) + " to " + Math.min(a, b); }
      else if (koth && net.teams) { const a = net.teamHill[0], b = net.teamHill[1]; title = Math.floor(a) === Math.floor(b) ? "Round over \u2014 a draw" : "Round over \u2014 " + TEAM_NAMES[a > b ? 0 : 1] + " team holds the hill, " + Math.floor(Math.max(a, b)) + " to " + Math.floor(Math.min(a, b)); }
      else if (dm && net.teams) { const a = teamKills(0), b = teamKills(1); title = a === b ? "Round over \u2014 a draw, " + a + " each" : "Round over \u2014 " + TEAM_NAMES[a > b ? 0 : 1] + " team wins, " + Math.max(a, b) + " to " + Math.min(a, b); }
      else title = "Round over \u2014 " + rows[0].name + " wins";
    }
    mpEls.boardTitle.textContent = title;
    // the columns depend on the mode: deathmatch shows the whole fight, King of the Hill leads with hill time
    const kd = (p) => (p.kills / Math.max(1, p.deaths)).toFixed(2), n = (v) => Math.round(v).toLocaleString();
    const cols = dm && net.br ? [["Status", (p) => (p.alive ? "alive" : "out")], ["Kills", (p) => p.kills], ["Dmg", (p) => n(p.dmg)]]
      : dm && net.ctf ? [["Caps", (p) => p.caps], ["Kills", (p) => p.kills], ["Deaths", (p) => p.deaths], ["K/D", kd], ["Dmg", (p) => n(p.dmg)]]
      : ggm ? [["Guns", (p) => Math.min(p.gg, GG_ORDER.length + 1) + " / " + (GG_ORDER.length + 1)], ["Kills", (p) => p.kills], ["Deaths", (p) => p.deaths], ["K/D", kd], ["Dmg", (p) => n(p.dmg)]]
      : koth ? [["Hill", (p) => Math.floor(p.hill)], ["Kills", (p) => p.kills], ["Deaths", (p) => p.deaths], ["Dmg", (p) => n(p.dmg)], ["Best", (p) => (p.best ? n(p.best) : "-")]]
      : dm ? [["Score", (p) => n(p.score)], ["Kills", (p) => p.kills], ["Deaths", (p) => p.deaths], ["K/D", kd], ["HS", (p) => p.heads], ["Dmg", (p) => n(p.dmg)], ["Best", (p) => (p.best ? n(p.best) : "-")], ["Streak", (p) => p.bstreak]]
      : [["Score", (p) => n(p.score)], ["Hits", (p) => p.kills]];
    mpEls.boardHead.innerHTML = "<th>#</th><th>Player</th>" + cols.map((c) => "<th>" + c[0] + "</th>").join("");
    mpEls.boardBody.innerHTML = rows.map((p, i) => {
      const hex = "#" + p.color.toString(16).padStart(6, "0");
      return '<tr class="' + (p.id === net.id ? "me" : "") + '"><td>' + (i + 1) + '</td><td><span class="dot" style="background:' + hex + '"></span>' +
        esc(p.name) + "</td>" + cols.map((c) => "<td>" + c[1](p) + "</td>").join("") + "</tr>";
    }).join("");
    mpEls.boardFoot.textContent = results ? "Next round in " + Math.max(0, Math.ceil(net.resultsLeft)) + "s" : "";
  }

  let mpUiTimer = 0;
  let lastCdShown = 0;
  function updateMpCountdown() {   // 3, 2, 1, GO in the middle of the screen
    const n = net.active && net.phase === "play" ? Math.ceil(cdNow()) : 0;
    if (n === lastCdShown) return;
    if (n > 0) { showRunCount(String(n)); runBeep(false); }
    else if (lastCdShown > 0) { showRunCount("GO!"); runBeep(true); }
    lastCdShown = n;
  }
  // the middle-of-the-screen banner when you eliminate someone (and, in a gun game, what you move up to)
  const killBannerEl = document.getElementById("kill-banner");
  let killBannerTimer = 0;
  function showKillBanner(top, sub, bad) {
    killBannerEl.querySelector(".kb-top").textContent = top;
    killBannerEl.querySelector(".kb-sub").innerHTML = sub || "";
    killBannerEl.classList.toggle("bad", !!bad);
    killBannerEl.hidden = false;
    killBannerEl.classList.remove("pop"); void killBannerEl.offsetWidth; killBannerEl.classList.add("pop");
    clearTimeout(killBannerTimer);
    killBannerTimer = setTimeout(() => { killBannerEl.hidden = true; }, 1900);
  }
  function playKillSound() {   // two quick rising notes
    const v = SETTINGS.volHits;
    if (v <= 0) return;
    tone("triangle", 660, 760, 0.16 * v, 0.1, 0, 0.1);
    tone("triangle", 990, 1240, 0.18 * v, 0.16, 0.09, 0.15);
  }
  function ggLevelHtml() {
    const me = localPlayer();
    if (!me) return "";
    const t = me.gg >= GG_ORDER.length ? "knife" : GG_ORDER[me.gg];
    if (me.gg > GG_ORDER.length) return (GG_ORDER.length + 1) + " / " + (GG_ORDER.length + 1) + " GUNS: YOU WIN";
    return me.gg + " / " + (GG_ORDER.length + 1) + " GUNS " + ' <span class="kb-gun">' + iconSVG(t) + "</span> " + (t === "knife" ? "KNIFE: one more kill wins" : WEAPONS[t].name);
  }
  function mpFrame(dt) {
    updateMpCountdown();
    updateAvatars(dt);
    updateSpectate(dt);
    updateDamageNumbers(dt);
    updateCtfFlags(elapsedTime);
    updateBrZone();
    // time on the hill (alone, or with only your team) counts toward an achievement
    const me = localPlayer();
    if (net.koth && net.phase === "play" && me && net.hs[0] === 1 && net.hs[1] === (net.teams ? me.team : net.id)) stat("hillTime", dt);
    mpUiTimer -= dt;
    if (mpUiTimer <= 0) {
      mpUiTimer = 0.25;
      if (net.phase === "results" && net.role === "client") net.resultsLeft = Math.max(0, net.resultsLeft - 0.25);
      mpRefreshHud();
      if (net.phase === "results") mpRefreshScoreboard();
    }
  }

  // ======================================================================
  // STATS: lifetime numbers, kept in this browser. Counted as things happen, saved every few seconds and
  // whenever the menu opens; the Stats popup in the menu shows them.
  // ======================================================================
  const STATS_KEY = "tsb-stats";
  const STAT_NUMBERS = ["time", "points", "hits", "shots", "shotsHit", "knifeSwingHits", "knifeThrows", "knifeThrowHits",
    "longestShot", "bestMult", "longestStreak", "bestCombo", "topSpeed", "distance", "jumps", "wallBounces",
    "perfectBounces", "slides", "padLaunches", "runs", "bhops", "grapples", "portals", "hillTime"];
  function freshStats() {
    const s = { since: new Date().toISOString().slice(0, 10), kinds: {}, guns: {}, tricks: {} };
    for (const k of STAT_NUMBERS) s[k] = 0;
    return s;
  }
  let stats = freshStats(), statsDirty = false, statsSaveTimer = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY));
    if (saved && typeof saved === "object") {
      for (const k of STAT_NUMBERS) if (Number.isFinite(saved[k])) stats[k] = saved[k];
      if (typeof saved.since === "string") stats.since = saved.since.slice(0, 10);
      const counts = (o) => { const out = {}; if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (Number.isFinite(v)) out[String(k).slice(0, 40)] = v; return out; };
      stats.kinds = counts(saved.kinds);
      stats.tricks = counts(saved.tricks);
      if (saved.guns && typeof saved.guns === "object") {
        for (const id of GUNS) {
          const g = saved.guns[id];
          if (g && typeof g === "object") stats.guns[id] = { shots: +g.shots || 0, hits: +g.hits || 0, points: +g.points || 0 };
        }
      }
    }
  } catch (e) { /* storage blocked or empty: start fresh */ }
  function saveStats() {
    if (!statsDirty) return;
    statsDirty = false;
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  }
  function stat(key, n) { stats[key] += n === undefined ? 1 : n; statsDirty = true; }
  function statMax(key, v) { if (v > stats[key]) { stats[key] = v; statsDirty = true; } }
  function announceUnlocks(gun, hits) {
    for (const opts of Object.values(ATTACHMENTS[gun] || {})) for (const o of opts) {
      if (o.need === hits) { achQueue.push({ name: "Unlocked: " + o.name, desc: WEAPONS[gun].name + " attachment" }); if (!achToastTimer) nextAchToast(); }
    }
    (GUN_SKINS[gun] || []).forEach((id, i) => {
      if (SKIN_NEED[i] === hits) { achQueue.push({ name: "Unlocked: " + SKIN_THEMES[id].name + " skin", desc: WEAPONS[gun].name + " skin" }); if (!achToastTimer) nextAchToast(); }
    });
  }
  function gunStat(id) { return stats.guns[id] || (stats.guns[id] = { shots: 0, hits: 0, points: 0 }); }
  // "FLICK 80° x1.40" -> "FLICK", "HANG TIME 1.4s x1.16" -> "HANG TIME"; spins keep their size; streaks are counted apart
  function trickKey(tag) {
    const name = tag.replace(/ x[\d.]+$/, "");
    if (/SPIN$/.test(name)) return name;
    if (/^STREAK /.test(name)) return null;
    if (/-HIT COMBO$/.test(name)) return "5+ HIT COMBO";
    return name.replace(/ \d.*$/, "");
  }
  // called from awardPoints for every scoring hit
  function statHit(res, points) {
    stat("hits"); stat("points", points);
    statMax("bestMult", res.mult);
    statMax("longestStreak", streak);
    for (const tag of res.tags) {
      const k = trickKey(tag);
      if (k) stats.tricks[k] = (stats.tricks[k] || 0) + 1;
      const combo = { DOUBLE: 2, TRIPLE: 3, QUAD: 4 }[k] || (k === "5+ HIT COMBO" ? parseInt(tag, 10) : 0);
      if (combo) statMax("bestCombo", combo);
    }
  }
  window.addEventListener("pagehide", saveStats);

  // ---- the popup ----
  const statsEl = document.getElementById("stats");
  function fmtDuration(sec) {
    const m = Math.floor(sec / 60), h = Math.floor(m / 60);
    return h ? h + " h " + (m % 60) + " min" : m + " min " + Math.floor(sec % 60) + " s";
  }
  const num = (n) => Math.round(n).toLocaleString();
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "-");
  function buildStats() {
    saveStats();
    const S = stats;
    const groups = [
      ["Overview", [
        ["Time played", fmtDuration(S.time), "since " + S.since],
        ["Points scored", num(S.points), ""],
        ["Targets hit", num(S.hits), ""],
        ["Accuracy", pct(S.shotsHit, S.shots), num(S.shotsHit) + " of " + num(S.shots) + " shots and throws hit"],
        ["Score Attack runs", num(S.runs), ""],
      ]],
      ["Records", [
        ["Best trickshot", bestShot.points ? num(bestShot.points) + " points" : "-", bestShot.points ? bestShot.mult.toFixed(2) + "x" + (Number.isFinite(bestShot.dist) ? " - " + Math.round(bestShot.dist) + "m" : "") : ""],
        ["Highest multiplier", S.bestMult ? S.bestMult.toFixed(2) + "x" : "-", ""],
        ["Longest shot", S.longestShot ? Math.round(S.longestShot) + " m" : "-", "a gun hit or a thrown knife"],
        ["Longest streak", num(S.longestStreak), ""],
        ["Biggest combo", S.bestCombo ? S.bestCombo + " hits" : "-", "hits in one jump"],
        ["Top speed", S.topSpeed.toFixed(1) + " u/s", ""],
      ]],
      ["Records by map", MAP_ORDER.concat(Object.keys(MAPS).filter((id) => !MAP_ORDER.includes(id))).filter((id) => mapRecs[id] && (mapRecs[id].shot || mapRecs[id].streak)).map((id) => {
        const r = mapRecs[id];
        return [MAPS[id].name, r.shot ? num(r.shot.points) + " pts" : "-", (r.shot ? r.shot.mult.toFixed(2) + "x" + (Number.isFinite(r.shot.dist) ? " - " + Math.round(r.shot.dist) + " m" : "") + ", " : "") + "longest streak " + r.streak];
      })],
      ["Targets", [["red", "normal"], ["orange", "moving"], ["blue", "small"], ["purple", "tiny"]].map(([c, k]) =>
        [c[0].toUpperCase() + c.slice(1), num(S.kinds[k] || 0), ""])],
      ["Guns", GUNS.map((id) => {
        const g = S.guns[id] || { shots: 0, hits: 0, points: 0 };
        return [WEAPONS[id].name, num(g.points) + " pts", num(g.hits) + " hits, " + pct(g.hits, g.shots) + " of " + num(g.shots) + " shots"];
      }).concat([["Knife", num(S.knifeSwingHits) + " swings", num(S.knifeThrowHits) + " of " + num(S.knifeThrows) + " throws hit"]])],
      ["Movement", [
        ["Distance travelled", S.distance >= 1000 ? (S.distance / 1000).toFixed(2) + " km" : num(S.distance) + " m", ""],
        ["Jumps", num(S.jumps), ""],
        ["Wall bounces", num(S.wallBounces), num(S.perfectBounces) + " perfect"],
        ["Slides", num(S.slides), ""],
        ["Pad launches", num(S.padLaunches), ""],
        ["Bunnyhops", num(S.bhops), "jumps the moment you land"],
        ["Grapples", num(S.grapples), "hooks that caught"],
      ]],
      ["Tricks landed", Object.entries(S.tricks).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, num(v), ""])],
    ];
    const list = document.getElementById("stats-list");
    list.textContent = "";
    for (const [title, rows] of groups) {
      const h = document.createElement("h3");
      h.textContent = title;
      list.appendChild(h);
      if (!rows.length) { const p = document.createElement("div"); p.className = "g-row"; p.textContent = "None yet."; list.appendChild(p); }
      for (const [name, val, how] of rows) {
        const row = document.createElement("div");
        row.className = "g-row";
        for (const [cls, text] of [["g-name", name], ["g-val", val], ["g-how", how]]) {
          const c = document.createElement("div");
          c.className = cls; c.textContent = text;
          row.appendChild(c);
        }
        list.appendChild(row);
      }
    }
  }
  function setStats(open) { if (open) buildStats(); statsEl.hidden = !open; }
  document.getElementById("stats-open").addEventListener("click", (e) => { e.stopPropagation(); setStats(true); });
  document.getElementById("stats-close").addEventListener("click", () => setStats(false));
  statsEl.addEventListener("click", (e) => { if (e.target === statsEl) setStats(false); });   // the backdrop
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !statsEl.hidden) setStats(false); });
  const statsResetBtn = document.getElementById("stats-reset");
  let statsResetArmed = 0;
  statsResetBtn.addEventListener("click", () => {
    if (!statsResetArmed) {   // a second click within 3 s confirms
      statsResetBtn.textContent = "Click again to reset all stats";
      statsResetArmed = setTimeout(() => { statsResetArmed = 0; statsResetBtn.textContent = "Reset stats"; }, 3000);
      return;
    }
    clearTimeout(statsResetArmed); statsResetArmed = 0;
    stats = freshStats(); statsDirty = true; saveStats();
    statsResetBtn.textContent = "Reset stats";
    buildStats();
  });

  // ======================================================================
  // ACHIEVEMENTS: goals that teach the tricks. Checked on every scoring hit, on wall bounces and at the end
  // of a Score Attack run; unlocks pop up as a toast and are kept in this browser.
  // ======================================================================
  const ACH_KEY = "tsb-achievements";
  // hit(h): h = { res, tags (names without values), kind, isKnife, thrown, dist, mult }
  const has = (h, name) => h.tags.includes(name);
  const ACHIEVEMENTS = [
    { id: "first", group: "Getting started", name: "First Blood", desc: "Hit a target.", hit: () => true },
    { id: "air", group: "Getting started", name: "Airborne", desc: "Hit a target while you're in the air.", hit: (h) => has(h, "AIR") },
    { id: "mega", group: "Getting started", name: "Liftoff", desc: "Hit a target while still rising off a mega pad.", hit: (h) => has(h, "MEGA LAUNCH") },
    { id: "noscope", group: "Tricks", name: "No Scope Needed", desc: "Land a no-scope from 40 m or more.", hit: (h) => has(h, "NO-SCOPE") && h.dist >= 40 },
    { id: "quickscope", group: "Tricks", name: "Quickdraw", desc: "Land a quickscope.", hit: (h) => has(h, "QUICKSCOPE") },
    { id: "spin", group: "Tricks", name: "Spin Doctor", desc: "Hit a target with a 360° spin.", hit: (h) => h.tags.some((t) => /SPIN$/.test(t)) },
    { id: "flick", group: "Tricks", name: "Flick of the Wrist", desc: "Land a FLICK.", hit: (h) => has(h, "FLICK") || has(h, "SNAP FLICK") },
    { id: "reverse", group: "Tricks", name: "Over the Shoulder", desc: "Land a REVERSE shot.", hit: (h) => has(h, "REVERSE") },
    { id: "double", group: "Tricks", name: "Double Trouble", desc: "Hit two targets in one jump.", hit: (h) => has(h, "DOUBLE") || has(h, "TRIPLE") || has(h, "QUAD") },
    { id: "triple", group: "Tricks", name: "Hat Trick", desc: "Hit three targets in one jump.", hit: (h) => has(h, "TRIPLE") || has(h, "QUAD") || has(h, "5+ HIT COMBO") },
    { id: "snitch", group: "Tricks", name: "Snitch Catcher", desc: "Hit a purple target.", hit: (h) => h.kind === "tiny" },
    { id: "far", group: "Tricks", name: "Long Distance", desc: "Hit a target from 80 m or more.", hit: (h) => (!h.isKnife || h.thrown) && h.dist >= 80 },
    { id: "sonic", group: "Tricks", name: "Speed Demon", desc: "Hit a target while moving at 19+ u/s.", hit: (h) => has(h, "SONIC") },
    { id: "ninja", group: "Tricks", name: "Ninja", desc: "Hit a target with a thrown knife from 30 m or more.", hit: (h) => h.thrown && h.dist >= 30 },
    { id: "airknife", group: "Tricks", name: "Death From Above", desc: "Hit a target with a knife swing while in the air.", hit: (h) => h.isKnife && !h.thrown && has(h, "AIR") },
    { id: "grapple", group: "Tricks", name: "Swinging In", desc: "Hit a target within a moment of letting go of the grapple.", hit: (h) => has(h, "GRAPPLE") },
    { id: "x10", group: "Big shots", name: "Trickshot", desc: "Land a 10x shot.", hit: (h) => h.mult >= 10 },
    { id: "x50", group: "Big shots", name: "Insane", desc: "Land a 50x shot.", hit: (h) => h.mult >= 50 },
    { id: "x100", group: "Big shots", name: "Legendary", desc: "Land a 100x shot.", hit: (h) => h.mult >= 100 },
    { id: "720", group: "Big shots", name: "720 No-Scope", desc: "The classic: a 720° spin and a no-scope in one shot.", hit: (h) => has(h, "NO-SCOPE") && h.tags.some((t) => /^(\d+)° SPIN$/.test(t) && parseInt(t, 10) >= 720) },
    { id: "streak20", group: "Big shots", name: "On Fire", desc: "Hit 20 targets in a row without a miss.", hit: () => streak >= 20 },
    { id: "run", group: "Score Attack", name: "On the Clock", desc: "Finish a Score Attack run.", run: () => true },
    { id: "run5k", group: "Score Attack", name: "High Roller", desc: "Score 5,000 or more in a 1:00 Score Attack.", run: (r) => r.mode === "sa60" && r.score >= 5000 },
    { id: "bounce10", group: "Grind", name: "Bounce House", desc: "10 perfect wall bounces.", goal: 10, progress: () => stats.perfectBounces },
    { id: "bounce100", group: "Grind", name: "Off the Walls", desc: "100 perfect wall bounces.", goal: 100, progress: () => stats.perfectBounces },
    { id: "grapple25", group: "Grind", name: "Spider-Man", desc: "Land 25 grapples.", goal: 25, progress: () => stats.grapples },
    { id: "marathon", group: "Grind", name: "Marathon", desc: "Travel 10 km.", goal: 10000, progress: () => stats.distance, unit: "m" },
    { id: "portalshot", group: "Maps", name: "Portal Shot", desc: "Hit a target within a moment of coming out of a portal.", hit: () => elapsedTime - player.lastPortalAt < 2.5 },
    { id: "portal25", group: "Maps", name: "Portal Hopper", desc: "Go through a portal 25 times.", goal: 25, progress: () => stats.portals },
    { id: "launchshot", group: "Maps", name: "Launch Control", desc: "Hit a target within a moment of leaving a launch strip.", hit: () => elapsedTime - player.lastBoostAt < 2.5 },
    { id: "moonhang", group: "Maps", name: "Moon Walker", desc: "Land a HANG TIME shot on Moonbase.", hit: (h) => !!currentMap && currentMap.id === "moonbase" && has(h, "HANG TIME") },
    { id: "liftshot", group: "Maps", name: "Elevator Pitch", desc: "Hit a target while riding a lift or the shuttle.", hit: () => player.onMover },
    { id: "ladderhit", group: "Maps", name: "Top Rung", desc: "Hit a target while on a ladder.", hit: () => !!player.ladder },
    { id: "summit", group: "Maps", name: "Summit Climber", desc: "Reach the top of the hill on Summit.", reached: true },
    { id: "hillhold", group: "King of the Hill", name: "Hill Holder", desc: "Hold the hill for 60 seconds in total.", goal: 60, progress: () => stats.hillTime, unit: "s" },
    { id: "kothwin", group: "King of the Hill", name: "King of the Hill", desc: "Win a King of the Hill round.", reached: true },
  ];
  let achDone = {};
  try {
    const saved = JSON.parse(localStorage.getItem(ACH_KEY));
    if (saved && typeof saved === "object") for (const a of ACHIEVEMENTS) if (typeof saved[a.id] === "string") achDone[a.id] = saved[a.id].slice(0, 10);
  } catch (e) { /* storage blocked or empty */ }
  const achToastEl = document.getElementById("ach-toast"), achCountEl = document.getElementById("ach-count");
  const achQueue = [];
  let achToastTimer = 0;
  function unlock(a) {
    if (achDone[a.id]) return;
    achDone[a.id] = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem(ACH_KEY, JSON.stringify(achDone)); } catch (e) { /* ignore */ }
    achQueue.push(a);
    if (!achToastTimer) nextAchToast();
    updateAchCount();
  }
  function nextAchToast() {
    const a = achQueue.shift();
    if (!a) { achToastTimer = 0; achToastEl.classList.remove("show"); return; }
    achToastEl.querySelector("b").textContent = a.name;
    achToastEl.querySelector("span").textContent = a.desc;
    achToastEl.classList.remove("show"); void achToastEl.offsetWidth; achToastEl.classList.add("show");
    if (SETTINGS.volHits > 0) { tone("triangle", 660, 990, 0.12 * SETTINGS.volHits, 0.14, 0, 0.2); tone("triangle", 990, 1320, 0.12 * SETTINGS.volHits, 0.2, 0.12, 0.25); }
    achToastTimer = setTimeout(() => { achToastEl.classList.remove("show"); achToastTimer = setTimeout(nextAchToast, 350); }, 3200);
  }
  function achHit(res, kind, isKnife, thrown, dist) {
    const h = { res, kind, isKnife, thrown, dist, mult: res.mult, tags: res.tags.concat(res.pens || []).map((t) => trickKey(t) || t.replace(/ x[\d.]+$/, "")) };
    for (const a of ACHIEVEMENTS) if (a.hit && !achDone[a.id] && a.hit(h)) unlock(a);
    achProgress();
  }
  // the ones with no check of their own: something else calls unlock() for them
  function achReach(id) { const a = ACHIEVEMENTS.find((x) => x.id === id); if (a && !achDone[id]) unlock(a); }
  function achSummitCheck() {   // standing on the hilltop of a map that has one
    const h = currentMap && currentMap.hill;
    if (!h || achDone.summit || !player.onGround) return;
    if (Math.hypot(yawObject.position.x - h.x, yawObject.position.z - h.z) <= h.r && Math.abs(player.feetY - h.y) < 0.6) achReach("summit");
  }
  function achKothResult() {   // the round just ended: did I win it?
    const me = localPlayer();
    if (!net.koth || !me) return;
    const won = net.teams ? (me.team === 0 ? net.teamHill[0] > net.teamHill[1] : net.teamHill[1] > net.teamHill[0])
      : me.hill > 0 && [...net.players.values()].every((p) => p === me || p.hill < me.hill);
    if (won) achReach("kothwin");
  }
  function achRun(r) { for (const a of ACHIEVEMENTS) if (a.run && !achDone[a.id] && a.run(r)) unlock(a); }
  function achProgress() { for (const a of ACHIEVEMENTS) if (a.goal && !achDone[a.id] && a.progress() >= a.goal) unlock(a); }
  function updateAchCount() { achCountEl.textContent = Object.keys(achDone).length + "/" + ACHIEVEMENTS.length; }

  const achEl = document.getElementById("achievements");
  function buildAchievements() {
    const list = document.getElementById("ach-list");
    list.textContent = "";
    let group = null;
    for (const a of ACHIEVEMENTS) {
      if (a.group !== group) {
        group = a.group;
        const h = document.createElement("h3");
        h.textContent = group;
        list.appendChild(h);
      }
      const done = achDone[a.id];
      const row = document.createElement("div");
      row.className = "ach-row" + (done ? " done" : "");
      const mark = document.createElement("div"); mark.className = "ach-mark"; mark.textContent = done ? "✓" : "";
      const body = document.createElement("div");
      const name = document.createElement("b"); name.textContent = a.name;
      const desc = document.createElement("span"); desc.textContent = a.desc;
      body.append(name, desc);
      if (a.goal && !done) {
        const p = Math.min(a.progress() / a.goal, 1);
        const bar = document.createElement("i"); bar.className = "ach-bar";
        const fill = document.createElement("i"); fill.style.width = (p * 100).toFixed(1) + "%";
        bar.appendChild(fill);
        const txt = document.createElement("small");
        txt.textContent = Math.floor(a.progress()).toLocaleString() + " / " + a.goal.toLocaleString() + (a.unit ? " " + a.unit : "");
        body.append(bar, txt);
      }
      const when = document.createElement("small"); when.className = "ach-when"; when.textContent = done || "";
      row.append(mark, body, when);
      list.appendChild(row);
    }
  }
  function setAchievements(open) { if (open) buildAchievements(); achEl.hidden = !open; }
  document.getElementById("ach-open").addEventListener("click", (e) => { e.stopPropagation(); setAchievements(true); });
  document.getElementById("ach-close").addEventListener("click", () => setAchievements(false));
  achEl.addEventListener("click", (e) => { if (e.target === achEl) setAchievements(false); });   // the backdrop
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !achEl.hidden) setAchievements(false); });
  achProgress();   // grind goals already met by the saved stats
  updateAchCount();

  // ======================================================================
  // SCORE ATTACK: a timed run. A 3-2-1 countdown (you can look around but not move or shoot), then the
  // clock runs; it pauses while the menu is open. At zero the results come up and the score goes on
  // your top-5 list for that length, kept in this browser.
  // ======================================================================
  const RUN_LENGTHS = { sa60: 60 };
  const RUN_KEY = "tsb-score-attack";
  const run = { state: "off", mode: null, left: 0, count: 0, shots: 0, shotsHit: 0, hits: 0, best: null };
  const runTimerEl = document.getElementById("mp-timer"), runTimerVal = document.getElementById("mp-timer-val");
  const runTimerMode = document.getElementById("mp-timer-mode"), runCountEl = document.getElementById("run-count");
  const resultsEl = document.getElementById("results");
  const isRunMode = () => Object.prototype.hasOwnProperty.call(RUN_LENGTHS, SETTINGS.playMode);
  const runInProgress = () => run.state === "countdown" || run.state === "live";
  const fmtClock = (sec) => { const t = Math.max(0, Math.ceil(sec)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };

  function loadRunTops() {
    try { const o = JSON.parse(localStorage.getItem(RUN_KEY)); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; }
  }
  const topsKey = (mode) => (currentMap && currentMap.id !== "arena" ? mode + "@" + currentMap.id : mode);   // each map has its own top 5
  function runTopsFor(mode) {
    const list = loadRunTops()[topsKey(mode)];
    return Array.isArray(list) ? list.filter((e) => e && Number.isFinite(e.score)).slice(0, 5) : [];
  }

  function startRun() {
    Object.assign(run, { state: "countdown", mode: SETTINGS.playMode, left: RUN_LENGTHS[SETTINGS.playMode], count: 3,
      shots: 0, shotsHit: 0, hits: 0, best: null, bestClip: null });
    score = 0; scoreEl.textContent = 0;
    streak = 0; streakEl.textContent = 0;
    trickSeen.clear(); trickLog.length = 0;
    if (SETTINGS.map === "random") loadMap(pickRandomMap(currentMap.id));   // Random: a new map for every run
    teleportLocal(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
    cancelReload(); refillAmmo(); updateAmmoHud();
    for (const t of targets) respawnTarget(t);   // a fresh, spread-out set for every run
    showRunCount("3");
    runBeep(false);
    updateRunHud();
  }

  function updateRun(dt) {
    if (run.state === "countdown") {
      const before = Math.ceil(run.count);
      run.count -= dt;
      if (run.count <= 0) { run.state = "live"; showRunCount("GO!"); runBeep(true); }
      else if (Math.ceil(run.count) !== before) { showRunCount(String(Math.ceil(run.count))); runBeep(false); }
    } else if (run.state === "live") {
      const before = Math.ceil(run.left);
      run.left -= dt;
      if (run.left <= 0) { run.left = 0; endRun(); }
      else if (run.left < 10 && Math.ceil(run.left) !== before) runBeep(false, 0.5);   // the last ten seconds tick
    }
    updateRunHud();
  }

  function updateRunHud() {
    if (net.active) return;   // in a multiplayer room that same box is the round timer (it was being hidden every frame)
    const show = runInProgress();
    runTimerEl.hidden = !show;
    if (!show) return;
    runTimerVal.textContent = fmtClock(run.state === "countdown" ? RUN_LENGTHS[run.mode] : run.left);
    runTimerMode.textContent = "Score Attack";
    runTimerEl.classList.toggle("low", run.state === "live" && run.left < 10);
  }
  function showRunCount(text) {
    runCountEl.textContent = text;
    runCountEl.classList.remove("pop"); void runCountEl.offsetWidth; runCountEl.classList.add("pop");
  }
  function runBeep(go, vol) {
    const v = (vol || 1) * SETTINGS.volHits;
    if (v > 0) tone("sine", go ? 1320 : 880, go ? 1320 : 880, (go ? 0.16 : 0.1) * v, go ? 0.28 : 0.12, 0, 0.05);
  }

  function endRun() {
    run.state = "done";
    finishAllClips();
    stat("runs");
    mouseHeld = false; attackPressed = false;
    const entry = { score, hits: run.hits, acc: run.shots ? run.shotsHit / run.shots : 0,
      gun: WEAPONS[SETTINGS.loadout].name, date: new Date().toISOString().slice(0, 10),
      notes: [SETTINGS.unlimitedAmmo ? "unlimited ammo" : "", SETTINGS.realisticShooting ? "realistic shooting" : ""].filter(Boolean) };
    const list = runTopsFor(run.mode);
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const rank = list.indexOf(entry) + 1;
    const tops = loadRunTops();
    tops[topsKey(run.mode)] = list.slice(0, 5);
    try { localStorage.setItem(RUN_KEY, JSON.stringify(tops)); } catch (e) { /* storage blocked */ }
    showResults(entry, rank, tops[topsKey(run.mode)]);
    achRun({ mode: run.mode, score: entry.score });
    runTimerEl.hidden = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function showResults(entry, rank, tops) {
    document.getElementById("r-title").textContent = "Time! Score Attack " + fmtClock(RUN_LENGTHS[run.mode]);
    document.getElementById("r-score").textContent = entry.score.toLocaleString();
    document.getElementById("r-rank").textContent = rank === 1 && tops.length > 1 ? "New best!" : rank === 1 ? "First run on the board!" : rank <= 5 ? "#" + rank + " on your top 5" : "";
    const stats = document.getElementById("r-stats");
    stats.textContent = "";
    for (const [label, value] of [["hits", entry.hits], ["shots fired", run.shots],
      ["accuracy", run.shots ? Math.round(entry.acc * 100) + "%" : "-"], ["gun", entry.gun]]) {
      const d = document.createElement("div");
      const b = document.createElement("b"); b.textContent = value;
      d.append(b, label);
      stats.appendChild(d);
    }
    const best = document.getElementById("r-best");
    if (run.best) {
      fillTagList(best, run.best.mult, run.best.tags, run.best.pens, run.best.dist);
      const pts = document.createElement("div");
      pts.textContent = "+" + run.best.points + " points";
      best.prepend(pts);
    } else {
      best.innerHTML = '<span class="none">No hits this run.</span>';
    }
    document.getElementById("r-top-title").textContent = "Your top 5 (" + fmtClock(RUN_LENGTHS[run.mode]) + ")";
    const ol = document.getElementById("r-top");
    ol.textContent = "";
    for (const e of tops) {
      const li = document.createElement("li");
      if (e === entry) li.className = "me";
      li.textContent = Number(e.score).toLocaleString() + "  ";
      const small = document.createElement("small");
      small.textContent = [String(e.gun || ""), String(e.date || "")].concat(Array.isArray(e.notes) ? e.notes.map(String) : []).filter(Boolean).join(" \u00B7 ");
      li.appendChild(small);
      ol.appendChild(li);
    }
    resultsEl.hidden = false;
    refreshReplayButtons();
  }
  function closeResults(again) {
    resultsEl.hidden = true;
    refreshModeUI();
    if (again) requestPlay();
  }
  document.getElementById("r-again").addEventListener("click", () => closeResults(true));
  document.getElementById("r-menu").addEventListener("click", () => closeResults(false));
  window.addEventListener("keydown", (e) => {
    if (resultsEl.hidden || replay.active) return;
    if (e.code === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); closeResults(true); }
    if (e.code === "Escape") closeResults(false);
  });

  // ---- the map picker in the menu: a thumbnail drawn from each map's own walls ----
  function drawMapThumb(canvas, m) {
    const n = canvas.width, g = canvas.getContext("2d"), k = n / (m.half * 2), px = (v) => (v + m.half) * k;
    const css = (hex) => "#" + new THREE.Color(hex).getHexString();
    g.fillStyle = (m.theme.surfaces && m.theme.surfaces[m.floor]) || (m.floor === "slab" ? "#4f565e" : "#6f9a52");
    g.fillRect(0, 0, n, n);
    const box = (x, z, w, d, fill) => { g.fillStyle = fill; g.fillRect(px(x - w / 2), px(z - d / 2), Math.max(1.5, w * k), Math.max(1.5, d * k)); };
    for (const b of m.buildings || []) box(b[0], b[1], b[2], b[3], b[4] > 8 ? "#d8dbe0" : "#aab0b8");
    for (const d of m.decks) box(d[0], d[2], d[3], d[4], "rgba(190,200,215,0.55)");
    for (const r of m.ramps) box(r[0], r[1], r[2] === "x" ? r[4] : r[3], r[2] === "x" ? r[3] : r[4], "#e3b53a");
    for (const w of m.walls.slice().sort((p, q) => p[4] - q[4])) { const l = 150 + Math.min(w[4], 12) * 8; box(w[0], w[2], w[3], w[5], w[4] < 2 ? "rgba(235,235,240,0.5)" : "rgb(" + l + "," + l + "," + l + ")"); }   // taller walls are lighter, so tiers read
    for (const b of m.boosts || []) { g.save(); g.translate(px(b[0]), px(b[1])); g.rotate(Math.atan2(b[3], b[2])); g.fillStyle = "#ffb42a"; g.fillRect(-b[5] * k / 2, -Math.max(1, b[4] * k / 2), b[5] * k, Math.max(2, b[4] * k)); g.restore(); }
    for (const a of m.movers || []) box(a[0], a[2], a[3], a[4], "rgba(255,255,255,0.7)");
    for (const a of m.gates || []) box(a[0], a[1], a[2], a[3], "#ffb42a");
    for (const p of m.pads) { g.fillStyle = p[2] === "mega" ? "#d23cff" : "#1bd6c8"; g.beginPath(); g.arc(px(p[0]), px(p[1]), Math.max(2, 1.4 * k), 0, 7); g.fill(); }
    for (const a of m.portals || []) { g.fillStyle = "#2f9bff"; g.beginPath(); g.arc(px(a[0]), px(a[1]), Math.max(2, 1.6 * k), 0, 7); g.fill(); g.fillStyle = "#ff8a2a"; g.beginPath(); g.arc(px(a[4]), px(a[5]), Math.max(2, 1.6 * k), 0, 7); g.fill(); }
    for (const l of m.ladders || []) { g.fillStyle = "#c7a548"; g.fillRect(px(l[0]) - Math.max(1, k * 0.5), px(l[1]) - Math.max(1, k * 0.5), Math.max(2, k), Math.max(2, k)); }
    for (const d of m.decor || []) {   // trees, boulders and ponds on the nature map
      if (d[0] === "tree") { g.fillStyle = "rgba(40,110,50,0.9)"; g.beginPath(); g.arc(px(d[1]), px(d[2]), Math.max(1.2, k * 1.1 * (d[3] || 1)), 0, 7); g.fill(); }
      else if (d[0] === "boulder") { g.fillStyle = "#b9b4a8"; g.beginPath(); g.arc(px(d[1]), px(d[2]), Math.max(1.2, k * (d[3] || 2) * 0.5), 0, 7); g.fill(); }
      else if (d[0] === "pond") { g.fillStyle = "#3d7fa6"; g.beginPath(); g.ellipse(px(d[1]), px(d[2]), d[3] * k, d[3] * 0.7 * k, 0, 0, 7); g.fill(); }
    }
    if (m.hill) { g.strokeStyle = "#ffd24a"; g.lineWidth = Math.max(1.5, k * 0.5); g.beginPath(); g.arc(px(m.hill.x), px(m.hill.z), Math.max(3, m.hill.r * k), 0, 7); g.stroke(); }
    g.strokeStyle = css(m.theme.skyHorizon); g.lineWidth = 2; g.strokeRect(1, 1, n - 2, n - 2);
  }
  // ---- the attachments window: a turnable 3D copy of the gun, and a card for every option ----
  const attachPopupEl = document.getElementById("attach-popup");
  let attachGun = SETTINGS.loadout;
  const AP = { ready: false, gun: null, holder: null, yaw: 0, el: 0.15, tYaw: 0, tEl: 0.15, zoom: 1, tZoom: 1, drag: false, lastTouch: 0, raf: 0,
    off: new THREE.Vector3(), tOff: new THREE.Vector3(), center: new THREE.Vector3(), size: new THREE.Vector3(1, 1, 1) };
  const AP_YAW0 = -Math.PI / 2;   // the muzzle points right, like the icons
  // where to look at the gun for each slot: [turn from the side view, how high the camera sits, how far in to zoom]
  const AP_VIEWS = { optic: [0.3, 0.5, 1.9], muzzle: [-0.85, 0.12, 1.8], barrel: [-0.85, 0.12, 1.8], stock: [0.85, 0.12, 1.5], grip: [0.1, -0.35, 1.8], mag: [0.1, -0.35, 1.8], sights: [0.25, -0.3, 1.8] };
  const AP_TURN = { crossbow: 0.6 };   // guns that read better from a three-quarter view (the crossbow's limbs are edge-on from the side)
  function apFocus(slot) {   // the part of the gun a slot is about, in the gun's own space
    const w = WEAPONS[attachGun], M = AT_MOUNT[attachGun] || {};
    if (slot === "optic") { if (attachGun === "rifle") return rifleScope.position.clone(); if (M.optic) return new THREE.Vector3(0, M.optic[1], M.optic[0]); }
    if ((slot === "muzzle" || slot === "barrel") && M.muzzle) return new THREE.Vector3(0, M.muzzle[1], M.muzzle[0] - M.muzzle[3] / 2);
    if (slot === "stock" && M.butt) return new THREE.Vector3(0, M.butt[1], M.butt[0] - M.butt[3] / 2);
    if ((slot === "grip" || slot === "sights") && M.under) return new THREE.Vector3(0, M.under[1], M.under[0]);
    if (slot === "mag") {
      if (M.tube) return new THREE.Vector3(0, M.tube[1], M.tube[0]);
      if (attachGun === "lmg") return w.mag.position.clone();
      if (M.mag && w.mag) return new THREE.Vector3(0, w.mag.position.y + M.mag[0] + 0.04, w.mag.position.z + M.mag[1]);
    }
    return null;
  }
  function apSetup() {
    const canvas = document.getElementById("attach-canvas");
    AP.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    AP.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    AP.scene = new THREE.Scene();
    AP.scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4a55, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(2, 3, 4); AP.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb4ff, 0.9); rim.position.set(-3, 1, -2); AP.scene.add(rim);
    AP.camera = new THREE.PerspectiveCamera(28, 1, 0.02, 20);
    AP.pivot = new THREE.Group(); AP.scene.add(AP.pivot);
    let lx = 0, ly = 0;
    canvas.addEventListener("pointerdown", (e) => { AP.drag = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => {
      if (!AP.drag) return;
      AP.yaw += (e.clientX - lx) * 0.012; AP.el = Math.max(-0.7, Math.min(0.9, AP.el + (e.clientY - ly) * 0.008));
      AP.tYaw = AP.yaw; AP.tEl = AP.el; lx = e.clientX; ly = e.clientY; AP.lastTouch = performance.now();
    });
    document.getElementById("attach-slots").addEventListener("mouseleave", () => apLook(""));   // back to the whole gun
    const up = () => { AP.drag = false; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    AP.ready = true;
  }
  function apVisible(o, root) { for (; o && o !== root; o = o.parent) if (!o.visible) return false; return true; }
  function apBuild() {   // a copy of the real gun model, with whatever is fitted to it right now
    if (!AP.ready) return;
    if (AP.gun) { AP.pivot.remove(AP.gun); AP.gun = null; }
    const w = WEAPONS[attachGun], flashWas = muzzleFlash.visible;
    muzzleFlash.visible = false;
    const copy = w.group.clone(true);
    muzzleFlash.visible = flashWas;
    copy.visible = true; copy.position.set(0, 0, 0); copy.rotation.set(0, 0, 0); copy.scale.set(1, 1, 1);
    copy.updateMatrixWorld(true);
    const box = new THREE.Box3();
    copy.traverse((o) => { if (o.isMesh && !o.userData.noFit && apVisible(o, copy)) box.union(new THREE.Box3().setFromObject(o)); });
    box.getCenter(AP.center); box.getSize(AP.size);
    copy.position.copy(AP.center).multiplyScalar(-1);
    const holder = new THREE.Group(); holder.add(copy);
    AP.gun = AP.holder = holder; AP.pivot.add(holder);
  }
  function apLook(slot) {   // turn and zoom to a slot's part of the gun (the whole gun for none)
    const v = AP_VIEWS[slot], f = v && apFocus(slot);
    AP.tYaw = AP_YAW0 + (AP_TURN[attachGun] || 0) + (v ? v[0] : 0); AP.tEl = (v ? v[1] : 0.15) + (AP_TURN[attachGun] ? 0.12 : 0);
    AP.tZoom = f ? v[2] : 1;
    AP.tOff.copy(f ? f.sub(AP.center) : new THREE.Vector3());
    let d = (AP.yaw - AP.tYaw) % (Math.PI * 2);   // take the short way round after a drag
    if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
    AP.yaw = AP.tYaw + d;
    AP.lastTouch = performance.now();
  }
  function apFrame() {
    AP.raf = 0;
    if (attachPopupEl.hidden) return;
    const canvas = AP.renderer.domElement, w = canvas.clientWidth, h = canvas.clientHeight, pr = AP.renderer.getPixelRatio();
    if (w && h && (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr))) {
      AP.renderer.setSize(w, h, false); AP.camera.aspect = w / h; AP.camera.updateProjectionMatrix();
    }
    if (!AP.drag) { AP.yaw += (AP.tYaw - AP.yaw) * 0.14; AP.el += (AP.tEl - AP.el) * 0.14; }
    AP.zoom += (AP.tZoom - AP.zoom) * 0.14; AP.off.lerp(AP.tOff, 0.14);
    if (AP.holder) AP.holder.position.copy(AP.off).multiplyScalar(-1);   // the part you are looking at sits in the middle
    const idle = performance.now() - AP.lastTouch > 3500 ? Math.sin(performance.now() / 1800) * 0.22 : 0;   // a slow sway when you leave it alone
    AP.pivot.rotation.y = AP.yaw + idle;
    // far enough back to fit the whole gun side-on, then closer by the zoom
    const vfov = AP.camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * AP.camera.aspect), sz = AP.size;
    const fit = Math.max((sz.z * 0.5 * 1.18) / Math.tan(hfov / 2), (sz.y * 0.5 * 1.35) / Math.tan(vfov / 2)) + sz.x * 0.5;
    const d = Math.max(0.12, fit / AP.zoom);
    AP.camera.position.set(0, Math.sin(AP.el) * d, Math.cos(AP.el) * d);
    AP.camera.lookAt(0, 0, 0);
    AP.renderer.render(AP.scene, AP.camera);
    AP.raf = requestAnimationFrame(apFrame);
  }
  function renderAttachStats() {
    const g = stats.guns[attachGun] || { shots: 0, hits: 0, points: 0 }, box = document.getElementById("attach-stats");
    const n = (v) => Math.round(v).toLocaleString();
    const tiles = [["Accuracy", g.shots ? Math.round(g.hits / g.shots * 100) + "%" : "-"], ["Hits", n(g.hits)], ["Shots", n(g.shots)], ["Points", n(g.points)]];
    const all = Object.values(ATTACHMENTS[attachGun] || {}).flat(), locked = all.filter((o) => !attachUnlocked(attachGun, o)).sort((x, y) => x.need - y.need);
    const next = locked[0];
    box.innerHTML = '<div class="as-tiles">' + tiles.map(([k, v]) => "<div><b>" + v + "</b><span>" + k + "</span></div>").join("") + "</div>" +
      '<div class="as-next">' + (next
        ? "<span>Next unlock: <strong>" + next.name + "</strong> at " + next.need + " hits</span><i class=\"at-bar\"><u style=\"width:" + Math.round(Math.min(1, g.hits / next.need) * 100) + '%"></u></i>'
        : "<span>Every attachment unlocked</span>") +
      "<em>" + (all.length - locked.length) + " of " + all.length + " attachments unlocked</em></div>";
  }
  function renderAttach() {
    const gunsEl = document.getElementById("attach-guns"), slotsEl = document.getElementById("attach-slots"), skinsEl = document.getElementById("attach-skins");
    gunsEl.textContent = ""; slotsEl.textContent = ""; skinsEl.textContent = "";
    for (const g of GUNS) {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.gun = g; b.className = "lo-gun" + (g === attachGun ? " active" : "");
      b.innerHTML = iconSVG(g) + WEAPONS[g].name;
      b.addEventListener("click", () => { attachGun = g; setLoadout(g); renderAttach(); apLook(""); });   // the gun you look at becomes your gun
      gunsEl.appendChild(b);
    }
    const hits = (stats.guns[attachGun] && stats.guns[attachGun].hits) || 0;
    document.getElementById("attach-name").textContent = WEAPONS[attachGun].name;
    renderAttachStats();
    const fitted = (SETTINGS.attach && SETTINGS.attach[attachGun]) || {};
    {   // the skins: the base look, then the gun's three skins (under the stats, apart from the attachments)
      const sec = document.createElement("div"); sec.className = "at-slot";
      sec.innerHTML = "<h3>Skin</h3>";
      const grid = document.createElement("div"); grid.className = "at-opts at-skins";
      const cur = chosenSkin(attachGun), list = GUN_SKINS[attachGun] || [];
      const mk = (id, name, sw, locked, need) => {
        const b = document.createElement("button");
        b.type = "button"; b.dataset.skin = id; b.className = "at-opt" + (id ? "" : " none") + (cur === id ? " active" : "") + (locked ? " locked" : "");
        b.innerHTML = '<b><i class="sk-sw" style="background:linear-gradient(135deg,' + (sw ? sw[0] + " 50%," + sw[1] + " 50%" : "#3c3f45 50%,#232427 50%") + ')"></i>' + name + "</b>" +
          (locked ? '<i class="at-bar"><u style="width:' + Math.round(Math.min(1, hits / need) * 100) + '%"></u></i><em>' + hits + " / " + need + " hits</em>" : "");
        b.addEventListener("mouseenter", () => apLook(""));
        b.addEventListener("click", () => {
          if (locked) return;
          SETTINGS.skin = SETTINGS.skin || {};
          if (id) SETTINGS.skin[attachGun] = id; else delete SETTINGS.skin[attachGun];
          saveSettings(); applyAttachments(); renderAttach(); apLook("");
        });
        grid.appendChild(b);
      };
      mk("", "Base", null, false, 0);
      list.forEach((id, i) => mk(id, SKIN_THEMES[id].name, SKIN_THEMES[id].sw, !skinUnlocked(attachGun, i), SKIN_NEED[i]));
      sec.appendChild(grid); skinsEl.appendChild(sec);
    }
    for (const [slot, opts] of Object.entries(ATTACHMENTS[attachGun] || {})) {
      const sec = document.createElement("div"); sec.className = "at-slot";
      sec.innerHTML = "<h3>" + (ATTACH_SLOTS[slot] || slot) + "</h3>";
      const grid = document.createElement("div"); grid.className = "at-opts";
      const mk = (id, name, text, locked, o) => {
        const b = document.createElement("button");
        b.type = "button"; b.dataset.opt = id; b.className = "at-opt" + (id ? "" : " none") + ((fitted[slot] || "") === id ? " active" : "") + (locked ? " locked" : "");
        b.innerHTML = "<b>" + name + "</b><span>" + text + "</span>" +
          (locked ? '<i class="at-bar"><u style="width:' + Math.round(Math.min(1, hits / o.need) * 100) + '%"></u></i><em>' + hits + " / " + o.need + " hits</em>" : "");
        b.addEventListener("mouseenter", () => apLook(slot));
        b.addEventListener("click", () => {
          if (locked) return;
          SETTINGS.attach = SETTINGS.attach || {};
          const cur = SETTINGS.attach[attachGun] = SETTINGS.attach[attachGun] || {};
          if (id) cur[slot] = id; else delete cur[slot];
          saveSettings(); applyAttachments(); renderAttach(); apLook(slot);
        });
        grid.appendChild(b);
      };
      mk("", "None", "Nothing fitted", false);
      for (const o of opts) { const open = attachUnlocked(attachGun, o); mk(o.id, o.name, o.text, !open, o); }
      sec.appendChild(grid); slotsEl.appendChild(sec);
    }
    apBuild();
  }
  function setAttachPopup(open) {
    if (open && ggOn) return;
    if (open) {
      attachGun = SETTINGS.loadout;
      attachPopupEl.hidden = false;   // visible before the 3D view is sized
      if (!AP.ready) { try { apSetup(); } catch (e) { AP.ready = false; } }
      renderAttach(); apLook("");
      AP.zoom = 1; AP.off.set(0, 0, 0);
      AP.yaw = AP.tYaw - 0.9;   // swings round into place
      if (AP.ready && !AP.raf) AP.raf = requestAnimationFrame(apFrame);
    } else attachPopupEl.hidden = true;
  }
  document.getElementById("attach-open").addEventListener("click", (e) => { e.stopPropagation(); setAttachPopup(true); });
  document.getElementById("attach-close").addEventListener("click", () => setAttachPopup(false));
  attachPopupEl.addEventListener("click", (e) => { if (e.target === attachPopupEl) setAttachPopup(false); });
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !attachPopupEl.hidden) setAttachPopup(false); });

  // ---- dev tools: press ` for a small window of test switches (nothing here is saved) ----
  const devPopupEl = document.getElementById("dev-popup");
  const DEV_TOOLS = [
    { id: "unlock", name: "Unlock all attachments", get on() { return devUnlockAll; },
      run() { devUnlockAll = !devUnlockAll; applyAttachments(); if (!attachPopupEl.hidden) renderAttach(); } },
  ];
  function renderDev() {
    const list = document.getElementById("dev-list");
    list.textContent = "";
    for (const t of DEV_TOOLS) {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.dev = t.id; b.className = "btn small" + (t.on ? " on" : "");
      b.textContent = t.name + (t.on ? ": ON" : ": off");
      b.addEventListener("click", () => { t.run(); renderDev(); });
      list.appendChild(b);
    }
  }
  function setDevPopup(open) {
    if (open) { renderDev(); if (document.pointerLockElement) document.exitPointerLock(); }
    devPopupEl.hidden = !open;
  }
  document.getElementById("dev-close").addEventListener("click", () => setDevPopup(false));
  devPopupEl.addEventListener("click", (e) => { if (e.target === devPopupEl) setDevPopup(false); });
  window.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.code === "Backquote") { e.preventDefault(); setDevPopup(devPopupEl.hidden); }
    else if (e.code === "Escape" && !devPopupEl.hidden) setDevPopup(false);
  });

  // ---- the bigger map: from the menu, and held in a game ----
  const mapPopupEl = document.getElementById("map-popup"), mapBigEl = document.getElementById("map-big"), mapBigCtx = mapBigEl.getContext("2d");
  const mapBaseCache = {};
  let mapPopupLive = false;
  function mapBaseFor(id) {
    if (!mapBaseCache[id]) { const c = document.createElement("canvas"); c.width = c.height = mapBigEl.width; drawMapThumb(c, MAPS[id]); mapBaseCache[id] = c; }
    return mapBaseCache[id];
  }
  function mapLegend(m) {
    const bits = [];
    if (m.ramps.length) bits.push("yellow: ramps");
    if (m.pads.length) bits.push("teal and purple: jump pads");
    if ((m.ladders || []).length) bits.push("tan squares: ladders");
    if ((m.portals || []).length) bits.push("blue and orange: portals");
    if ((m.boosts || []).length) bits.push("orange strips: launch strips");
    if ((m.movers || []).length) bits.push("white: lifts and the shuttle");
    if (m.hill) bits.push("gold ring: the hill");
    return bits.join(" · ");
  }
  function drawMapMarkers(m) {   // you, and your teammates in a team mode (never the other side)
    const k = mapBigEl.width / (m.half * 2), px = (v) => (v + m.half) * k;
    if (net.active && net.br) {   // the safe zone
      mapBigCtx.strokeStyle = "#ff6a5e"; mapBigCtx.lineWidth = 3;
      mapBigCtx.beginPath(); mapBigCtx.arc(px(net.zc[0]), px(net.zc[1]), brNow().r * k, 0, 7); mapBigCtx.stroke();
    }
    const me = localPlayer();
    if (net.active && net.teams && me) {
      for (const p of net.players.values()) {
        if (p === me || !p.alive || p.team !== me.team) continue;
        mapBigCtx.fillStyle = "#" + TEAM_COLORS[p.team].toString(16).padStart(6, "0");
        mapBigCtx.beginPath(); mapBigCtx.arc(px(p.x), px(p.z), 5, 0, 7); mapBigCtx.fill();
      }
    }
    mapBigCtx.save();
    mapBigCtx.translate(px(yawObject.position.x), px(yawObject.position.z));
    mapBigCtx.rotate(Math.atan2(-Math.cos(yawObject.rotation.y), -Math.sin(yawObject.rotation.y)));   // the way you face
    mapBigCtx.fillStyle = "#22d3ee"; mapBigCtx.strokeStyle = "#fff"; mapBigCtx.lineWidth = 1.5;
    mapBigCtx.beginPath(); mapBigCtx.moveTo(10, 0); mapBigCtx.lineTo(-7, 6); mapBigCtx.lineTo(-4, 0); mapBigCtx.lineTo(-7, -6); mapBigCtx.closePath();
    mapBigCtx.fill(); mapBigCtx.stroke();
    mapBigCtx.restore();
  }
  function showMapPopup(id, live) {
    const m = MAPS[id];
    if (!m) return;
    mapBigCtx.drawImage(mapBaseFor(id), 0, 0);
    if (live) drawMapMarkers(m);
    if (!live || mapPopupEl.hidden) {
      document.getElementById("map-popup-title").textContent = m.name;
      document.getElementById("map-popup-note").textContent = live ? "" : m.blurb;
      document.getElementById("map-popup-legend").textContent = mapLegend(m) + (live ? " · cyan arrow: you" : "");
    }
    mapPopupEl.classList.toggle("ingame", !!live);
    mapPopupEl.hidden = false;
    mapPopupLive = !!live;
  }
  function hideMapPopup() { mapPopupEl.hidden = true; mapPopupLive = false; }
  function updateMapPopup() {   // hold the map key in a game to see where you are
    const want = pointerLocked && !replay.active && !localDead && held("map") && !!currentMap;
    if (want) showMapPopup(currentMap.id, true);
    else if (mapPopupLive) hideMapPopup();
  }
  document.getElementById("map-popup-close").addEventListener("click", hideMapPopup);
  mapPopupEl.addEventListener("click", (e) => { if (e.target === mapPopupEl && !mapPopupLive) hideMapPopup(); });
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && !mapPopupEl.hidden && !mapPopupLive) hideMapPopup(); });
  const mapPickerEl = document.getElementById("map-picker");
  for (const id of MAP_ORDER) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.map = id; b.title = MAPS[id].blurb;
    const c = document.createElement("canvas"); c.width = c.height = 64;
    drawMapThumb(c, MAPS[id]);
    b.appendChild(c); b.appendChild(document.createTextNode(MAPS[id].name));
    b.addEventListener("click", (e) => { e.stopPropagation(); if (id === SETTINGS.map) showMapPopup(id, false); else setMap(id); });   // click the chosen map again for a bigger look
    mapPickerEl.appendChild(b);
  }
  {   // the Random choice, last in the row
    const b = document.createElement("button");
    b.type = "button"; b.dataset.map = "random"; b.title = "A different random map each Score Attack run and each online round.";
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#1c1d22"; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "#ffd24a"; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62);
    g.fillStyle = "#ffd24a"; g.font = "bold 44px Segoe UI, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 32, 35);
    b.appendChild(c); b.appendChild(document.createTextNode("Random"));
    b.addEventListener("click", (e) => { e.stopPropagation(); setMap("random"); });
    mapPickerEl.appendChild(b);
  }
  mapPickerEl.addEventListener("click", (e) => e.stopPropagation());
  function refreshMapUI() {
    if (!currentMap) return;
    mapPickerEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.map === SETTINGS.map));
    const note = document.getElementById("map-note");
    if (note) note.textContent = SETTINGS.map === "random" ? "Random: a different map each Score Attack run and each online round. Right now: " + currentMap.name + "." : currentMap.blurb;
  }
  // choose a map to play on (singleplayer): switching ends a Score Attack run, like switching mode does
  function setMap(id) {
    if (id !== "random" && (!MAPS[id] || (SETTINGS.map === id && currentMap.id === id))) return;
    if (runInProgress() || run.state === "done") quitRun();
    SETTINGS.map = id;
    saveSettings();
    loadMap(resolveMapChoice(id));
    refreshModeUI();
    refreshMapUI();
  }

  // ---- the mode buttons in the menu ----
  const modeButtons = document.querySelectorAll("#play-modes button[data-play-mode]");
  function refreshModeUI() {
    modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.playMode === SETTINGS.playMode));
    const note = document.getElementById("mode-note");
    const quit = document.getElementById("run-quit");
    if (!isRunMode()) {
      note.textContent = "Endless: targets keep coming back, play as long as you like.";
      startBtn.textContent = FIRST_VISIT && !tutOffered ? "Click to start (a short tutorial first)" : hasPlayed ? "Click to resume" : "Click to play";
    } else {
      const tops = runTopsFor(SETTINGS.playMode);
      note.textContent = fmtClock(RUN_LENGTHS[SETTINGS.playMode]) + " to score as much as you can. Esc pauses the clock." +
        (tops.length ? "  Best: " + Number(tops[0].score).toLocaleString() : "");
      startBtn.textContent = runInProgress() && run.mode === SETTINGS.playMode
        ? "Resume run (" + fmtClock(run.state === "countdown" ? RUN_LENGTHS[run.mode] : run.left) + " left)"
        : "Start Score Attack";
    }
    quit.hidden = !runInProgress();
  }
  function quitRun() {
    run.state = "off";
    score = 0; scoreEl.textContent = 0;
    streak = 0; streakEl.textContent = 0;
    updateRunHud();
  }
  modeButtons.forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();   // the menu backdrop starts the game
    if (b.dataset.playMode === SETTINGS.playMode) return;
    if (runInProgress() || run.state === "done") quitRun();
    SETTINGS.playMode = b.dataset.playMode;
    saveSettings();
    refreshModeUI();
  }));
  document.getElementById("run-quit").addEventListener("click", (e) => { e.stopPropagation(); quitRun(); refreshModeUI(); });
  document.getElementById("play-modes").addEventListener("click", (e) => e.stopPropagation());
  refreshModeUI();

  // ======================================================================
  // TUTORIAL: short goals one at a time, in free play, each ticked off the moment you do it.
  // Most are read from the stats counters (so they notice the real thing, however it happened).
  // ======================================================================
  const TUT_KEY = "tsb-tutorial";
  const tut = { active: false, step: 0, base: null, look: 0, doneTimer: 0, lastHit: null, sawMap: false, sawBoard: false };
  const tutDelta = (k) => stats[k] - tut.base[k];
  const keyOf = (a) => bindLabel(a);
  const either = (a, b) => [a, b].map(keyOf).filter((l) => l !== "unbound").join(" or ") || "unbound";
  const TUT_STEPS = [
    { title: "Look around", text: "Move the mouse to look around.", done: () => tut.look > Math.PI * 0.75 },
    { title: "Move", text: () => "Walk with " + ["forward", "left", "back", "right"].map((a) => inputLabel(BINDS[a][0])).join(" ") + ".", done: () => tutDelta("distance") > 6 },
    { title: "Sprint", text: () => SETTINGS.autoSprint ? "Auto sprint is on, so just keep moving. " + keyOf("sprint") + " would slow you to a walk." : "Hold " + keyOf("sprint") + " while you move to run faster.", done: () => Math.hypot(player.velocity.x, player.velocity.z) > 8.5 },
    { title: "Jump", text: () => "Press " + keyOf("jump") + " to jump.", done: () => tutDelta("jumps") >= 1 },
    { title: "Slide", text: () => "Sprint, then hold " + keyOf("slide") + " to slide: it keeps your speed. Under " + CFG.slideMinSpeed + " on the speed meter, " + keyOf("slide") + " only crouch-walks.", done: () => tutDelta("slides") >= 1 },
    { title: "Shoot", text: () => "Hit a target with " + keyOf("fire") + ". Smaller and faster targets are worth more.", done: () => tutDelta("hits") >= 1 },
    { title: "Aim", text: () => "Hold " + keyOf("aim") + " to aim down the sights, then hit a target.", done: () => tut.lastHit && tut.lastHit.aimed },
    { title: "Shoot in the air", text: "Hit a target while you're in the air. Every trick multiplies the shot.", done: () => tut.lastHit && tut.lastHit.tags.includes("AIR") },
    { title: "Jump pad", text: "Run onto a glowing jump pad. The purple ones throw you higher.", done: () => tutDelta("padLaunches") >= 1 },
    { title: "Bunnyhop", text: "Jump again the moment you land to keep your speed. Do it twice.", done: () => tutDelta("bhops") >= 2 },
    { title: "Wall bounce", text: () => "Run at a wall, jump, and press " + keyOf("jump") + " again as you reach it. Right on time is a perfect bounce.", done: () => tutDelta("wallBounces") >= 1 },
    { title: "Grapple", text: () => "Aim at a wall, the floor or a target and tap " + keyOf("grapple") + ". A hook flies out and zips you there. Tap " + keyOf("grapple") + " or " + keyOf("jump") + " to let go and keep your speed.", done: () => tutDelta("grapples") >= 1 },
    { title: "Knife", text: () => "Press " + either("knife", "swap") + " for the knife, then " + keyOf("aim") + " to throw it. " + either("gun", "swap") + " takes you back to the gun.", done: () => tutDelta("knifeThrows") >= 1 },
    { title: "Map and records", text: () => "Hold " + keyOf("map") + " to see the map and where you are, and " + keyOf("leaderboard") + " for your records on this map.", done: () => tut.sawMap && tut.sawBoard },
    { title: "Trickshot", text: "Put it together: land a 2x shot. Jump, spin, hit from far away...", done: () => tut.lastHit && tut.lastHit.mult >= 2 },
  ];
  const tutEl = document.getElementById("tutorial");
  function startTutorial() {
    if (runInProgress() || run.state === "done") quitRun();
    if (currentMap.id !== "arena") loadMap("arena");   // its steps use the arena's pads and walls
    tut.active = true; tut.step = 0; tut.doneTimer = 0;
    tutBegin();
    try { localStorage.setItem(TUT_KEY, "started"); } catch (e) { /* ignore */ }
    refreshTutorialUI();
    requestPlay();
  }
  function tutBegin() {
    tut.base = Object.assign({}, stats);
    tut.look = 0; tut.lastHit = null; tut.sawMap = false; tut.sawBoard = false;
    renderTutorial();
  }
  function endTutorial(finished) {
    tut.active = false;
    if (SETTINGS.map !== "random" && currentMap.id !== SETTINGS.map) loadMap(SETTINGS.map);
    tutEl.hidden = true;
    if (finished) try { localStorage.setItem(TUT_KEY, "done"); } catch (e) { /* ignore */ }
    refreshTutorialUI();
  }
  function renderTutorial() {
    const s = TUT_STEPS[tut.step];
    tutEl.hidden = !tut.active;
    if (!s) return;
    document.getElementById("tut-count").textContent = "Tutorial " + (tut.step + 1) + "/" + TUT_STEPS.length;
    document.getElementById("tut-title").textContent = s.title;
    document.getElementById("tut-text").textContent = typeof s.text === "function" ? s.text() : s.text;
    document.getElementById("tut-fill").style.width = (tut.step / TUT_STEPS.length * 100).toFixed(1) + "%";
    tutEl.classList.remove("done");
  }
  function tutNext() {
    tut.step++;
    if (tut.step >= TUT_STEPS.length) {
      document.getElementById("tut-count").textContent = "Tutorial complete";
      document.getElementById("tut-title").textContent = "You're ready";
      document.getElementById("tut-text").textContent = "Next: Score Attack is a 1:00 run for a high score. Attachments (in the menu, under More guns) add scopes, barrels and more as you land hits.\nMultiplayer > Practice has bots and modes: hill, flag, gun game, battle royale. Each round opens with a 3-2-1, and in free-for-alls a kill refills your health.\nMoonbase has portals, Foundry launch strips, Rooftops lifts and ladders. The Trickshot list shows every trick.";
      document.getElementById("tut-fill").style.width = "100%";
      tutEl.classList.add("done");
      tut.active = false;
      setTimeout(() => endTutorial(true), 15000);   // (a longer card to read)
      try { localStorage.setItem(TUT_KEY, "done"); } catch (e) { /* ignore */ }
      refreshTutorialUI();
      return;
    }
    tutBegin();
  }
  // every frame of play
  function updateTutorial(dt) {
    if (!tut.active) return;
    if (pointerLocked) { if (held("map")) tut.sawMap = true; if (held("leaderboard")) tut.sawBoard = true; }   // (the map and records step)
    if (tut.doneTimer > 0) {   // a short tick-off moment before the next step
      tut.doneTimer -= dt;
      if (tut.doneTimer <= 0) tutNext();
      return;
    }
    if (TUT_STEPS[tut.step].done()) {
      tut.doneTimer = 1.1;
      tutEl.classList.add("done");
      if (SETTINGS.volHits > 0) tone("triangle", 880, 1320, 0.1 * SETTINGS.volHits, 0.16, 0, 0.15);
    }
  }
  // from awardPoints: what the last hit was like
  function tutHit(res) {
    if (!tut.active) return;
    tut.lastHit = { mult: res.mult, aimed: vm.adsProgress > 0.6, tags: res.tags.map((t) => trickKey(t) || "") };
  }
  window.addEventListener("keydown", (e) => {
    if (!tut.active || !pointerLocked || replay.active) return;
    if (e.code === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); if (tut.doneTimer <= 0) { tut.doneTimer = 0.01; } }   // skip this step
  });

  // ---- the menu button ----
  const tutBtn = document.getElementById("tutorial-btn");
  function refreshTutorialUI() {
    let seen = null;
    try { seen = localStorage.getItem(TUT_KEY); } catch (e) { /* ignore */ }
    tutBtn.textContent = tut.active ? "Quit tutorial" : seen === "done" ? "Tutorial" : seen ? "Restart tutorial" : "New here? Start the tutorial";
    tutBtn.classList.toggle("glow", !seen && !tut.active);
  }
  tutBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (tut.active) { endTutorial(false); return; }
    startTutorial();
  });
  controlsListeners.push(() => { if (tut.active && tut.doneTimer <= 0) renderTutorial(); });
  refreshTutorialUI();

  // ======================================================================
  // REPLAYS: the game keeps a rolling recording of the last few seconds (your view every frame, where the
  // moving targets are, thrown knives, and shots, hits, knockouts and respawns as events). Every scoring
  // hit cuts a clip from it a moment after it lands: the last hit's clip, a Score Attack run's best shot,
  // and your best trickshot (also saved in this browser). Playback shows it from your eyes, slowing
  // down around the hit, with an optional bullet cam that rides the shot to the target.
  // ======================================================================
  const REPLAY_KEY = "tsb-best-replay";
  const REC_SECONDS = 7, CLIP_BEFORE = 5, CLIP_AFTER = 1.2;
  const rec = { t: 0, frames: [], events: [], pending: [], snapTimer: 0 };
  let lastClip = null, bestClip = null, lastScopeAlpha = 0, lastShotOrigin = new THREE.Vector3(), lastAward = { best: false, runBest: false };
  try {
    const c = JSON.parse(localStorage.getItem(REPLAY_KEY));
    if (c && c.v === 1 && Array.isArray(c.frames) && c.frames.length > 1 && Array.isArray(c.events)) bestClip = c;
  } catch (e) { /* none saved */ }
  const r3 = (n) => Math.round(n * 1000) / 1000, r4 = (n) => Math.round(n * 10000) / 10000;   // (r2, two decimals, is shared with the multiplayer code)
  const v3 = (v) => [r3(v.x), r3(v.y), r3(v.z)];
  const _rp = new THREE.Vector3(), _rq = new THREE.Quaternion();

  function recEvent(e) { if (net.active || replay.active) return; e.t = r3(rec.t); rec.events.push(e); }
  function recSnapshot() {
    recEvent({ type: "snap", s: targets.map((t) => [t.userData.type, r3(t.position.x), r3(t.position.y), r3(t.position.z), t.userData.alive ? 1 : 0]) });
  }
  // once per rendered frame of live play
  function recordFrame(realDt) {
    if (net.active) return;
    rec.t += realDt;
    rec.snapTimer -= realDt;
    if (rec.snapTimer <= 0 || !rec.events.some((e) => e.type === "snap")) { rec.snapTimer = 1; recSnapshot(); }
    camera.getWorldPosition(_rp); camera.getWorldQuaternion(_rq);
    const f = { t: r3(rec.t), c: [r3(_rp.x), r3(_rp.y), r3(_rp.z), r4(_rq.x), r4(_rq.y), r4(_rq.z), r4(_rq.w), r2(camera.fov), r2(lastScopeAlpha)], w: vm.current };
    // the weapon in your hand, posed as you saw it (bob, recoil, switch dip, knife swing...)
    const g = currentWeapon().group;
    f.vm = [r3(g.position.x), r3(g.position.y), r3(g.position.z), r3(g.rotation.x), r3(g.rotation.y), r3(g.rotation.z), g.visible ? 1 : 0];
    // and its moving parts: bolt (slide, twist), pump, slide, and the magazine (height, in or out)
    const mag = currentWeapon().mag;
    f.pt = [r3(boltMesh.position.z), r3(boltMesh.rotation.z), r3(shotgunPump.position.z), r3(pistolSlide.position.z),
      mag ? r3(mag.position.y) : 0, mag && !mag.visible ? 0 : 1];
    // the grapple in hand, and the rope and spear when one is out
    if (grappleGroup.visible) f.gl = [r3(grappleGroup.position.x), r3(grappleGroup.position.y), r3(grappleGroup.position.z), r3(grappleGroup.rotation.x), r3(grappleGroup.rotation.y), r3(grappleGroup.rotation.z)];
    if (player.hook) { const hk = player.hook; f.gh = [].concat(v3(ropeStart(_rp)), v3(hk.pos), v3(hk.dir)); }
    const tg = [];
    targets.forEach((t, i) => { if (t.userData.motion && t.userData.alive) tg.push([i, r3(t.position.x), r3(t.position.y), r3(t.position.z)]); });
    if (tg.length) f.tg = tg;
    const kn = [];
    for (const k of thrownPool) {
      if (k.state !== "flying" && k.state !== "stuck") continue;   // the ones stuck in walls too
      k.root.getWorldQuaternion(_rq);
      kn.push([r3(k.root.position.x), r3(k.root.position.y), r3(k.root.position.z), r4(_rq.x), r4(_rq.y), r4(_rq.z), r4(_rq.w), r2(k.spin.rotation.x), k.bolt ? 1 : 0]);
    }
    if (kn.length) f.kn = kn;
    rec.frames.push(f);
    // forget what's older than the buffer, but keep the last snapshot from before it so a clip can start anywhere
    const cut = rec.t - REC_SECONDS;
    while (rec.frames.length && rec.frames[0].t < cut) rec.frames.shift();
    let lastOldSnap = -1;
    for (let i = 0; i < rec.events.length && rec.events[i].t < cut; i++) if (rec.events[i].type === "snap") lastOldSnap = i;
    rec.events = rec.events.filter((e, i) => e.t >= cut || i === lastOldSnap);
    // cut any clips whose "after" time has passed
    for (const p of rec.pending.slice()) if (rec.t >= p.until) finishClip(p);
  }
  function finishClip(p) {
    rec.pending.splice(rec.pending.indexOf(p), 1);
    const start = p.hitT - CLIP_BEFORE, end = Math.min(rec.t, p.until);
    const frames = rec.frames.filter((f) => f.t >= start && f.t <= end);
    if (frames.length < 2) return;
    const t0 = frames[0].t;
    const snaps = rec.events.filter((e) => e.type === "snap" && e.t <= t0);
    const snap = snaps.length ? snaps[snaps.length - 1] : rec.events.find((e) => e.type === "snap");
    if (!snap) return;
    const shift = (o) => Object.assign({}, o, { t: r3(o.t - t0) });
    const clip = { v: 1, map: currentMap.id, snap: snap.s, hitT: r3(p.hitT - t0), meta: p.meta,
      frames: frames.map(shift), events: rec.events.filter((e) => e.type !== "snap" && e.t > t0 && e.t <= end).map(shift) };
    lastClip = clip;
    if (p.runBest) run.bestClip = clip;
    if (p.best) {
      bestClip = clip;
      try { localStorage.setItem(REPLAY_KEY, JSON.stringify(clip)); } catch (e) { /* too big or blocked: it still plays this session */ }
    }
    refreshReplayButtons();
  }
  function finishAllClips() { for (const p of rec.pending.slice()) finishClip(p); }
  // from scoreHit, after the points are in
  function recHit(target, dist, isKnife, thrown, res, points) {
    if (net.active) return;
    const from = isKnife && !thrown ? camera.getWorldPosition(_rp) : lastShotOrigin;
    recEvent({ type: "hit", i: targets.indexOf(target), o: v3(from), p: v3(target.position), knife: !!isKnife });
    rec.pending.push({ hitT: rec.t, until: rec.t + CLIP_AFTER, best: lastAward.best, runBest: lastAward.runBest,
      meta: { points, mult: res.mult, tags: res.tags.slice(), pens: (res.pens || []).slice(), dist: res.dist } });
  }

  // ---------------- playback ----------------
  const replay = { active: false, clip: null, time: 0, speed: 1, paused: false, bulletCam: true, slowMo: true,
    frameIdx: 0, evIdx: 0, phase: "play", flightT: 0, flightDur: 1, hit: null, saved: null, from: null, label: "" };
  const replayCam = new THREE.PerspectiveCamera(CFG.baseFov, window.innerWidth / window.innerHeight, 0.02, 500);
  scene.add(replayCam);   // so the gun riding on it gets drawn
  const replayEl = document.getElementById("replay"), replayTagsEl = document.getElementById("replay-tags");
  let replayKnives = null, bulletMesh = null;
  function replayProps() {
    if (!replayKnives) {
      replayKnives = thrownPool.map(() => { const k = thrownPool[0].root.clone(true); k.visible = false; scene.add(k); return k; });
      bulletMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      bulletMesh.geometry.rotateX(Math.PI / 2);   // long axis along z, so lookAt points it down the shot
      bulletMesh.visible = false;
      scene.add(bulletMesh);
    }
  }

  function startReplay(clip, label, from) {
    if (!clip || replay.active) return;
    replayProps();
    // put the live world aside (a grapple in use just ends)
    releaseHook(0); vm.grappleOut = 0;
    replay.saved = {
      targets: targets.map((t) => ({ pos: t.position.clone(), visible: t.visible })),
      knives: thrownPool.map((k) => k.root.visible),
      viewmodel: viewmodelRoot.visible,
      guns: WEAPON_ORDER.map((id) => WEAPONS[id].group.visible),
      parts: [boltMesh.position.z, boltMesh.rotation.z, shotgunPump.position.z, pistolSlide.position.z],
      debris: casingPool.concat(magDropPool).map((d) => d.mesh.visible),
      mags: WEAPON_ORDER.map((id) => WEAPONS[id].mag ? [WEAPONS[id].mag.position.y, WEAPONS[id].mag.visible] : null),
    };
    for (const d of casingPool.concat(magDropPool)) d.mesh.visible = false;   // live brass and magazines stay out of the replay
    // a clip from another map plays on that map, and the live map comes back afterwards
    replay.restoreMap = null;
    const clipMap = clip.map && MAPS[clip.map] ? clip.map : "arena";
    if (clipMap !== currentMap.id) { replay.restoreMap = currentMap.id; loadMap(clipMap, { keepPlayer: true }); }
    // the gun moves from the live camera onto the replay camera, holding whatever was in your hand
    replayCam.add(viewmodelRoot);
    for (const k of thrownPool) k.root.visible = false;
    Object.assign(replay, { active: true, clip, label, from, time: 0, paused: false, speed: 1, phase: "play", frameIdx: 0, evIdx: 0, hit: null });
    replay.hit = clip.events.find((e) => e.type === "hit" && Math.abs(e.t - clip.hitT) < 0.05) || null;
    // was the hit made through the scope? (the frame just before it)
    const pre = clip.frames.filter((f) => f.t <= clip.hitT);
    replay.scopedHit = !!(pre.length && pre[pre.length - 1].c[8] > 0.5);
    applySnapshot(clip.snap);
    resultsEl.hidden = true;
    showScreen("replay");
    if (document.pointerLockElement) document.exitPointerLock();   // a cursor, for the replay bar
    replayTagsEl.textContent = "";
    replayTagsEl.classList.remove("show");
    document.getElementById("replay-label").textContent = label;
    updateReplayBar();
  }
  function applySnapshot(snap) {
    snap.forEach((s, i) => {
      const t = targets[i];
      if (!t || !TARGET_TYPES[s[0]]) return;
      resetTargetParts(t);
      t.children[0].material = TARGET_LOOKS[s[0]];
      t.scale.setScalar(TARGET_TYPES[s[0]].scale);
      t.userData.replayScale = TARGET_TYPES[s[0]].scale;
      t.position.set(s[1], s[2], s[3]);
      t.visible = !!s[4];
    });
    for (let i = snap.length; i < targets.length; i++) targets[i].visible = false;
  }
  function stopReplay() {
    if (!replay.active) return;
    replay.active = false;
    if (replay.restoreMap) { loadMap(replay.restoreMap, { keepPlayer: true }); replay.restoreMap = null; }
    // the live world, as it was
    targets.forEach((t, i) => {
      const s = replay.saved.targets[i];
      resetTargetParts(t);
      t.children[0].material = TARGET_LOOKS[t.userData.type];
      t.scale.setScalar(t.userData.scale);
      if (s) { t.position.copy(s.pos); t.visible = s.visible; }
      if (!t.userData.alive) t.visible = false;
    });
    thrownPool.forEach((k, i) => { k.root.visible = replay.saved.knives[i]; });
    casingPool.concat(magDropPool).forEach((d, i) => { d.mesh.visible = replay.saved.debris[i]; });
    camera.add(viewmodelRoot);
    viewmodelRoot.visible = replay.saved.viewmodel;
    WEAPON_ORDER.forEach((id, i) => {
      WEAPONS[id].group.visible = replay.saved.guns[i];
      const m = replay.saved.mags[i];
      if (m) { WEAPONS[id].mag.position.y = m[0]; WEAPONS[id].mag.visible = m[1]; }
    });
    const sp = replay.saved.parts;
    boltMesh.position.z = sp[0]; boltMesh.rotation.z = sp[1]; shotgunPump.position.z = sp[2]; pistolSlide.position.z = sp[3];
    for (const k of replayKnives) k.visible = false;
    bulletMesh.visible = false;
    ropeMesh.visible = hookHead.visible = grappleGroup.visible = false;
    vm.grappleOut = 0;
    for (const p of particlePool) { p.active = false; p.mesh.visible = false; }
    for (const t of tracerPool) { t.active = false; t.mesh.visible = false; }
    scopeEl.style.opacity = 0; scopeLinesEl.style.opacity = 0;
    for (const k in keys) keys[k] = false;   // nothing held over from before the replay
    mouseHeld = false; attackPressed = false;
    if (replay.from === "game") {
      // straight back into the game: a key press or click lets the browser take the mouse again at once;
      // if it won't (Esc), the "click to keep playing" prompt stays up
      showScreen("resume");
      lockPointer();
    } else if (replay.from === "results") {
      showScreen("results");
      resultsEl.hidden = false;
    } else {
      showScreen("menu");
    }
  }

  // run the clip's events up to the current time
  // (untilImpact: stop before the hit itself, so the shot fires and then the bullet cam flies)
  function replayEvents(dt, untilImpact) {
    const ev = replay.clip.events;
    while (replay.evIdx < ev.length && ev[replay.evIdx].t <= replay.time) {
      if (untilImpact && (ev[replay.evIdx].type === "ko" || ev[replay.evIdx].type === "hit")) break;
      const e = ev[replay.evIdx++];
      const t = targets[e.i];
      if (e.type === "shot") {
        _tmpV1.fromArray(e.o); _tmpV2.fromArray(e.d);
        if (!untilImpact) spawnTracer(_tmpV1, _tmpV2, e.l);   // the trickshot's own bullet is the bullet cam's, not a tracer
        if (e.snd && WEAPONS[e.w]) playShotSound(WEAPONS[e.w].sound);
      } else if (e.type === "throw") {
        if (e.b) playBoltShot(); else playKnifeSwing();
      } else if (e.type === "ko" && t) {
        const ud = t.userData;
        ud.knockT = 0;
        ud.coreVel = ud.coreVel || new THREE.Vector3();
        ud.coreVel.fromArray(e.cv);
        ud.coreSpin = e.sp;
        burst(t.position, new THREE.Color(TARGET_TYPES[e.ty] ? TARGET_TYPES[e.ty].color : "#ffffff").getHex(), 6);
      } else if (e.type === "spawn" && t && TARGET_TYPES[e.ty]) {
        resetTargetParts(t);
        t.children[0].material = TARGET_LOOKS[e.ty];
        t.scale.setScalar(TARGET_TYPES[e.ty].scale);
        t.position.fromArray(e.p);
        t.visible = true;
      } else if (e.type === "hit") {
        playHitSound(Math.min(1 + ((e === replay.hit ? replay.clip.meta.mult : 1.5) - 1) * 0.16, 2.4));
        if (e === replay.hit) {
          fillTagList(replayTagsEl, replay.clip.meta.mult, replay.clip.meta.tags, replay.clip.meta.pens, replay.clip.meta.dist);
          replayTagsEl.classList.add("show");
        }
      }
    }
    // knockouts play out at replay speed
    for (const t of targets) if (t.userData.knockT >= 0 && t.userData.knockT !== undefined) {
      const sc = t.userData.scale; t.userData.scale = t.scale.x;   // animateKnockout reads the plate's scale
      animateKnockout(t, dt);
      t.userData.scale = sc;
    }
  }

  function updateReplay(realDt) {
    const clip = replay.clip, frames = clip.frames, end = frames[frames.length - 1].t;
    let dt = 0;
    if (replay.phase === "bullet") {
      // ride the shot: the world holds still while the camera flies from the muzzle to the target
      if (!replay.paused) replay.flightT += realDt;
      const h = replay.hit, k = Math.min(replay.flightT / replay.flightDur, 1), e = k * k * (3 - 2 * k);
      _tmpV1.fromArray(h.o); _tmpV2.fromArray(h.p);
      bulletMesh.position.lerpVectors(_tmpV1, _tmpV2, Math.min(e * 1.02, 0.985));
      bulletMesh.lookAt(_tmpV2);
      bulletMesh.visible = k < 1;
      const dir = _tmpV2.clone().sub(_tmpV1).normalize();
      replayCam.position.copy(bulletMesh.position).addScaledVector(dir, -0.9).add(_rp.set(0, 0.18, 0));
      replayCam.lookAt(_tmpV2);
      replayCam.fov = 62; replayCam.updateProjectionMatrix();
      viewmodelRoot.visible = false;   // the bullet cam is out ahead of you
      ropeMesh.visible = hookHead.visible = false;
      scopeEl.style.opacity = 0; scopeLinesEl.style.opacity = 0;
      if (k >= 1) { replay.phase = "impact"; bulletMesh.visible = false; }
    } else {
      if (replay.phase === "aimhold" && !replay.paused) {
        // a scoped shot: hold on the scope for a beat, then ride the bullet
        replay.holdT += realDt;
        if (replay.holdT >= 0.8) { replay.phase = "bullet"; replay.flightT = 0; }
      } else if (!replay.paused) {
        let s = replay.speed;
        if (replay.slowMo && replay.hit && replay.time > clip.hitT - (replay.scopedHit ? 1 : 0.45) && replay.time < clip.hitT + 0.9) s *= 0.3;
        dt = realDt * s;
        const next = Math.min(replay.time + dt, end);
        // reaching the hit with the bullet cam on: stop just short of it and fly
        if (replay.phase === "play" && replay.bulletCam && replay.hit && !replay.hit.knife && replay.time < clip.hitT && next >= clip.hitT) {
          replay.time = clip.hitT;
          replayEvents(0, true);   // the shot itself: the bang (the bullet cam is its bullet)
          replay.phase = replay.scopedHit ? "aimhold" : "bullet"; replay.flightT = 0; replay.holdT = 0;
          replay.flightDur = Math.min(Math.max(_tmpV1.fromArray(replay.hit.o).distanceTo(_tmpV2.fromArray(replay.hit.p)) / 40, 0.7), 1.6);
        } else {
          replay.time = next;
        }
      }
      if (replay.phase !== "bullet") {
        replayEvents(dt, replay.phase === "aimhold");   // holding on the scope: the hit lands after the bullet cam
        // targets that move: their recorded spot, interpolated
        while (replay.frameIdx < frames.length - 2 && frames[replay.frameIdx + 1].t <= replay.time) replay.frameIdx++;
        const a = frames[replay.frameIdx], b = frames[Math.min(replay.frameIdx + 1, frames.length - 1)];
        const u = b.t > a.t ? Math.min(Math.max((replay.time - a.t) / (b.t - a.t), 0), 1) : 0;
        if (a.tg) for (const [i, x, y, z] of a.tg) {
          const t = targets[i]; if (!t) continue;
          const nb = b.tg && b.tg.find((q) => q[0] === i);
          t.position.set(x, y, z);
          if (nb) t.position.lerp(_tmpV1.set(nb[1], nb[2], nb[3]), u);
        }
        // targets turn to face where you were standing in the recording (as they did live), with their sway
        const ex = a.c[0] + (b.c[0] - a.c[0]) * u, ez = a.c[2] + (b.c[2] - a.c[2]) * u;
        for (const t of targets) {
          if (!t.visible) continue;
          const ud = t.userData;
          t.rotation.y = Math.atan2(ex - t.position.x, ez - t.position.z) +
            Math.sin(replay.time * (t.scale.x < 1 ? 2.1 : 1.3) + (ud.motion ? ud.motion.phase : ud.idx)) * 0.22;
        }
        replayKnives.forEach((m, j) => {
          const ka = a.kn && a.kn[j];
          m.visible = !!ka;
          m.scale.setScalar(1);
          if (ka) { m.position.set(ka[0], ka[1], ka[2]); m.quaternion.set(ka[3], ka[4], ka[5], ka[6]); if (m.children[0]) { m.children[0].rotation.x = ka[7]; const parts = m.children[0].children; if (parts.length > 1) { parts[0].visible = !ka[8]; parts[1].visible = !!ka[8]; } } }
        });
        if (replay.phase === "impact" && replay.hit) {
          viewmodelRoot.visible = false;
          ropeMesh.visible = hookHead.visible = false;
          // after the bullet cam: watch the plate go, from just in front of it
          _tmpV1.fromArray(replay.hit.o); _tmpV2.fromArray(replay.hit.p);
          const dir = _tmpV2.clone().sub(_tmpV1).normalize();
          replayCam.position.copy(_tmpV2).addScaledVector(dir, -3.2).add(_rp.set(0, 0.5, 0));
          replayCam.lookAt(_tmpV2);
        } else {
          // your eyes: position, rotation, zoom and scope, interpolated between recorded frames
          replayCam.position.set(a.c[0], a.c[1], a.c[2]).lerp(_tmpV1.set(b.c[0], b.c[1], b.c[2]), u);
          replayCam.quaternion.set(a.c[3], a.c[4], a.c[5], a.c[6]).slerp(_rq.set(b.c[3], b.c[4], b.c[5], b.c[6]), u);
          replayCam.fov = a.c[7] + (b.c[7] - a.c[7]) * u;
          replayCam.updateProjectionMatrix();
          const sa = a.c[8] + (b.c[8] - a.c[8]) * u;
          scopeEl.style.opacity = sa; scopeLinesEl.style.opacity = sa;
          viewmodelRoot.visible = sa < 0.98;   // scoped in, the scope fills the view, as it did live
          // the grapple, if it was out: the launcher in the hand, and the rope and spear as they were
          grappleGroup.visible = !!a.gl;
          if (a.gl) { grappleGroup.position.fromArray(a.gl, 0); grappleGroup.rotation.set(a.gl[3], a.gl[4], a.gl[5]); }
          if (a.gh) poseRope(_gRStart.fromArray(a.gh, 0), _gRPos.fromArray(a.gh, 3), _gRDir.fromArray(a.gh, 6));
          else ropeMesh.visible = hookHead.visible = false;
          const held = a.w && WEAPONS[a.w] ? a.w : null;
          if (held) {
            for (const id of WEAPON_ORDER) WEAPONS[id].group.visible = id === held && (!a.vm || a.vm[6] === 1);
            if (a.vm) {   // the recorded pose, blended between frames while it's the same weapon
              const g = WEAPONS[held].group, bv = b.w === a.w && b.vm ? b.vm : a.vm;
              g.position.set(a.vm[0] + (bv[0] - a.vm[0]) * u, a.vm[1] + (bv[1] - a.vm[1]) * u, a.vm[2] + (bv[2] - a.vm[2]) * u);
              g.rotation.set(a.vm[3] + (bv[3] - a.vm[3]) * u, a.vm[4] + (bv[4] - a.vm[4]) * u, a.vm[5] + (bv[5] - a.vm[5]) * u);
            }
            if (a.pt) {
              const bp = b.w === a.w && b.pt ? b.pt : a.pt, mix = (i) => a.pt[i] + (bp[i] - a.pt[i]) * u;
              boltMesh.position.z = mix(0); boltMesh.rotation.z = mix(1);
              shotgunPump.position.z = mix(2); pistolSlide.position.z = mix(3);
              const mag = WEAPONS[held].mag;
              if (mag) { mag.position.y = mix(4); mag.visible = a.pt[5] === 1; }
            }
          }
          scopeEl.style.transform = "translate(-50%, -50%) scale(" + (1.2 - 0.2 * sa).toFixed(3) + ")";
        }
      }
    }
    updateParticles(dt || realDt * 0.3);
    updateTracers(dt || realDt * 0.3);
    replayCam.aspect = window.innerWidth / window.innerHeight;
    replayCam.updateProjectionMatrix();
    renderer.render(scene, replayCam);
    if (videoRec) composeVideoFrame();   // right after drawing, while the picture is still in the canvas
    updateReplayBar();
    stopVideoIfDone();
  }

  function restartReplay() {
    const r = replay;
    Object.assign(r, { time: 0, frameIdx: 0, evIdx: 0, phase: "play", paused: false });
    for (const t of targets) resetTargetParts(t);
    for (const p of particlePool) { p.active = false; p.mesh.visible = false; }
    for (const t of tracerPool) { t.active = false; t.mesh.visible = false; }
    bulletMesh.visible = false;
    replayTagsEl.classList.remove("show");
    applySnapshot(r.clip.snap);
  }
  function updateReplayBar() {
    const frames = replay.clip.frames, end = frames[frames.length - 1].t;
    document.getElementById("replay-progress").style.width = (Math.min(replay.time / end, 1) * 100).toFixed(1) + "%";
    document.getElementById("rp-pause").textContent = replay.time >= end ? "Play again (R)" : replay.paused ? "Play (Space)" : "Pause (Space)";
    document.getElementById("rp-speed").textContent = "Speed " + replay.speed + "x (S)";
    document.getElementById("rp-bullet").textContent = "Bullet cam: " + (replay.bulletCam ? "on" : "off") + " (B)";
    document.getElementById("rp-slow").textContent = "Slow-mo: " + (replay.slowMo ? "on" : "off") + " (M)";
  }
  function replayPauseOrRestart() {
    const end = replay.clip.frames[replay.clip.frames.length - 1].t;
    if (replay.time >= end) restartReplay(); else replay.paused = !replay.paused;
  }
  const SPEEDS = [1, 0.5, 0.25];
  function cycleReplaySpeed() { replay.speed = SPEEDS[(SPEEDS.indexOf(replay.speed) + 1) % SPEEDS.length]; }
  document.getElementById("rp-pause").addEventListener("click", (e) => { e.currentTarget.blur(); replayPauseOrRestart(); });
  document.getElementById("rp-restart").addEventListener("click", (e) => { e.currentTarget.blur(); restartReplay(); });
  document.getElementById("rp-speed").addEventListener("click", (e) => { e.currentTarget.blur(); cycleReplaySpeed(); });
  document.getElementById("rp-bullet").addEventListener("click", (e) => { e.currentTarget.blur(); replay.bulletCam = !replay.bulletCam; restartReplay(); });
  document.getElementById("rp-slow").addEventListener("click", (e) => { e.currentTarget.blur(); replay.slowMo = !replay.slowMo; });
  document.getElementById("rp-exit").addEventListener("click", (e) => { e.currentTarget.blur(); stopReplay(); });
  window.addEventListener("keydown", (e) => {
    if (!replay.active || videoRec) return;
    if (e.code === "Space") { e.preventDefault(); replayPauseOrRestart(); }
    else if (e.code === "KeyR") restartReplay();
    else if (e.code === "KeyS") cycleReplaySpeed();
    else if (e.code === "KeyB") { replay.bulletCam = !replay.bulletCam; restartReplay(); }
    else if (e.code === "KeyM") replay.slowMo = !replay.slowMo;
    else if (e.code === "Escape") stopReplay();
    else if (replay.from === "game" && actionsFor(normalizeInput(e.code)).includes("replay")) stopReplay();
  });

  // ---- the best-shot card: a picture of the shot to keep or share (a PNG): the map with the shot drawn on it, the points and the tricks ----
  function shotCardCanvas(clip) {
    const W = 920, H = 500, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d"), meta = clip.meta || {}, m = MAPS[clip.map] || MAPS.arena;
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#15161a"); bg.addColorStop(1, "#24252c");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#ffd24a"; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
    const S = 380, mx = 36, my = 72;
    const mc = document.createElement("canvas"); mc.width = mc.height = S;
    drawMapThumb(mc, m);
    g.drawImage(mc, mx, my);
    const hit = (clip.events || []).find((e) => e.type === "hit");
    const k = S / (m.half * 2), px = (v) => mx + (v + m.half) * k, pz = (v) => my + (v + m.half) * k;
    if (hit && hit.o && hit.p) {   // where you were, where it landed
      g.setLineDash([6, 5]); g.strokeStyle = "#ffd24a"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px(hit.o[0]), pz(hit.o[2])); g.lineTo(px(hit.p[0]), pz(hit.p[2])); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#22d3ee"; g.beginPath(); g.arc(px(hit.o[0]), pz(hit.o[2]), 6, 0, 7); g.fill();
      g.strokeStyle = "#ff3b3b"; g.lineWidth = 3; g.beginPath(); g.arc(px(hit.p[0]), pz(hit.p[2]), 8, 0, 7); g.stroke();
    }
    const font = (px2, bold) => (bold ? "bold " : "") + px2 + "px Segoe UI, Arial, sans-serif";
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "#ffd24a"; g.font = font(20, true); g.fillText("TRICKSHOT SANDBOX", mx, 48);
    const X = 480;
    g.fillStyle = "#fff"; g.font = font(70, true); g.fillText(Math.round(meta.points || 0).toLocaleString(), X, 140);
    g.fillStyle = "#9a9aa3"; g.font = font(20, false); g.fillText("points", X, 168);
    g.fillStyle = "#ffd24a"; g.font = font(34, true);
    g.fillText((meta.mult ? meta.mult.toFixed(1) : "1.0") + "x" + (Number.isFinite(meta.dist) ? "   " + Math.round(meta.dist) + " m" : ""), X, 216);
    const lines = (meta.tags || []).map((t) => [t, "#ffe9a8"]).concat((meta.pens || []).map((t) => [t, "#ff6a5e"]));
    g.font = font(17, true);
    lines.slice(0, 16).forEach(([t, col], i) => { g.fillStyle = col; g.fillText(t, X + (i % 2) * 215, 254 + Math.floor(i / 2) * 26); });
    const f = (clip.frames || []).find((fr) => fr.t >= clip.hitT) || (clip.frames || [])[0];
    const gun = f && WEAPONS[f.w] ? WEAPONS[f.w].name : f && f.w === "knife" ? "Knife" : "";
    g.fillStyle = "#9a9aa3"; g.font = font(16, false);
    g.fillText(m.name + (gun ? "  \u00b7  " + gun : "") + "  \u00b7  " + new Date().toISOString().slice(0, 10), mx, H - 22);
    g.textAlign = "right"; g.fillText("cubicobelus.github.io/trickshot_sandbox", W - 36, H - 22);
    return c;
  }
  function saveShotCard(clip) {
    if (!clip) return;
    shotCardCanvas(clip).toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "trickshot-" + Math.round((clip.meta && clip.meta.points) || 0) + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  }

  // ---- the buttons that start one ----
  function refreshReplayButtons() {
    document.getElementById("card-best").hidden = !bestClip;
    document.getElementById("r-card").hidden = !run.bestClip;
    const best = document.getElementById("watch-best"), last = document.getElementById("watch-last");
    best.hidden = !bestClip; last.hidden = !lastClip;
    document.getElementById("r-watch").hidden = !run.bestClip;
  }
  document.getElementById("watch-best").addEventListener("click", (e) => {
    e.stopPropagation();
    if (bestClip) startReplay(bestClip, "Best trickshot · " + bestClip.meta.points + " points", "menu");
  });
  document.getElementById("watch-last").addEventListener("click", (e) => {
    e.stopPropagation();
    if (lastClip) startReplay(lastClip, "Last hit · " + lastClip.meta.points + " points", "menu");
  });
  document.getElementById("r-watch").addEventListener("click", () => {
    if (run.bestClip) startReplay(run.bestClip, "Best shot of the run · " + run.bestClip.meta.points + " points", "results");
  });
  refreshReplayButtons();

  // ---- sharing: save the replay as a video, the 3D view plus the game's sound, played once from the start ----
  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const clipName = (clip, ext) => "trickshot-" + new Date().toISOString().slice(0, 10) + "-" + clip.meta.points + "pts" + ext;
  let videoRec = null;
  function saveReplayVideo() {
    if (videoRec || !replay.clip) return;
    const gl = renderer.domElement;
    if (!gl.captureStream || typeof MediaRecorder === "undefined") { flashReplayNote("This browser can't record video."); return; }
    // the video is a 2D canvas with the 3D view copied in each frame and the score painted on top
    videoCanvas = videoCanvas || document.createElement("canvas");
    videoCanvas.width = gl.width; videoCanvas.height = gl.height;
    const stream = videoCanvas.captureStream(60);
    let audioOut = null;
    if (audioCtx && audioCtx.createMediaStreamDestination) {
      audioOut = audioCtx.createMediaStreamDestination();
      masterGain.connect(audioOut);
      for (const tr of audioOut.stream.getAudioTracks()) stream.addTrack(tr);
    }
    const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";   // (Safari records mp4)
    const chunks = [];
    const mr = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6000000 } : undefined);
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      if (audioOut) { try { masterGain.disconnect(audioOut); } catch (e) { /* already gone */ } }
      const mime = mr.mimeType || type || "video/webm", ext = /mp4/.test(mime) ? ".mp4" : ".webm";   // name the file for what the browser really recorded
      downloadBlob(new Blob(chunks, { type: mime }), clipName(replay.clip, ext));
      videoRec = null;
      replayEl.classList.remove("recording");
      flashReplayNote("Saved as a video (" + ext + ").");
    };
    videoRec = mr;
    replayEl.classList.add("recording");
    restartReplay();
    replay.paused = false;
    mr.start(250);
  }
  let videoCanvas = null;
  // one frame of the video: the 3D view, the scope if you were scoped in, the title, and the
  // trick breakdown once the shot has landed (penalties in red), as the replay shows them
  function composeVideoFrame() {
    const gl = renderer.domElement, c = videoCanvas, g = c.getContext("2d");
    if (c.width !== gl.width || c.height !== gl.height) { c.width = gl.width; c.height = gl.height; }
    const W = c.width, H = c.height, k = H / 720;   // sizes scale with the video's height
    g.drawImage(gl, 0, 0, W, H);
    const scope = parseFloat(scopeEl.style.opacity) || 0;
    if (scope > 0.02) {
      const r = Math.min(W, H) * 0.44;
      g.save();
      g.globalAlpha = Math.min(scope, 1);
      g.fillStyle = "#000";
      g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, r, 0, Math.PI * 2, true); g.fill();
      g.strokeStyle = "#000"; g.lineWidth = 2 * k;
      g.beginPath(); g.moveTo(W / 2 - r, H / 2); g.lineTo(W / 2 + r, H / 2); g.moveTo(W / 2, H / 2 - r); g.lineTo(W / 2, H / 2 + r); g.stroke();
      g.restore();
    }
    g.textBaseline = "top";
    // title, top left
    g.font = "bold " + Math.round(15 * k) + "px Segoe UI, Arial, sans-serif";
    const title = "TRICKSHOT SANDBOX  ·  " + replay.label.replace(/\s*\([^)]*to keep playing\)/, "");
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(14 * k, 14 * k, g.measureText(title).width + 20 * k, 28 * k);
    g.fillStyle = "#fff";
    g.fillText(title, 24 * k, 20 * k);
    // the breakdown, top right, once the shot has landed
    if (replayTagsEl.classList.contains("show")) {
      const m = replay.clip.meta;
      const lines = [[m.mult.toFixed(2) + "x" + (Number.isFinite(m.dist) ? " - " + Math.round(m.dist) + "m" : ""), m.mult < 1 ? "#ff5a4f" : "#ffd24a", 24],
        ["+" + m.points + " points", "#ffffff", 16]]
        .concat(m.tags.map((t) => [t, "#ff9d3b", 16]), m.pens.map((t) => [t, "#ff5a4f", 16]));
      let w = 0;
      for (const [t, , sz] of lines) { g.font = "bold " + Math.round(sz * k) + "px Segoe UI, Arial, sans-serif"; w = Math.max(w, g.measureText(t).width); }
      const lh = (sz) => Math.round(sz * 1.45 * k);
      const boxH = lines.reduce((h, l) => h + lh(l[2]), 0) + 16 * k;
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(W - w - 38 * k, 14 * k, w + 24 * k, boxH);
      let y = 22 * k;
      g.textAlign = "right";
      for (const [t, col, sz] of lines) {
        g.font = "bold " + Math.round(sz * k) + "px Segoe UI, Arial, sans-serif";
        g.fillStyle = col;
        g.fillText(t, W - 26 * k, y);
        y += lh(sz);
      }
      g.textAlign = "left";
    }
  }
  let videoEndAt = 0;   // when playback reached the end; the video keeps half a second after that
  function stopVideoIfDone() {
    if (!videoRec || videoRec.state !== "recording") { videoEndAt = 0; return; }
    const atEnd = replay.phase !== "bullet" && replay.time >= replay.clip.frames[replay.clip.frames.length - 1].t;
    if (!atEnd) { videoEndAt = 0; return; }
    if (!videoEndAt) videoEndAt = performance.now();
    else if (performance.now() - videoEndAt > 500) { videoEndAt = 0; videoRec.stop(); }
  }
  let replayNoteTimer = 0;
  function flashReplayNote(text) {
    const el = document.getElementById("replay-note");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(replayNoteTimer);
    replayNoteTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }
  // one practical tip the first time you play each map (not during the tutorial), remembered in this browser
  const MAP_TIPS = {
    arena: "Arena: the kicker ramps and pads throw you into trickshots, and the tower is a sniper perch.",
    courtyard: "Courtyard: the four gates slide open and shut. Shotguns and Deagles shine in here.",
    foundry: "Foundry: stand on a launch strip to be thrown down the hall, and watch the sliding gates.",
    moonbase: "Moonbase: low gravity, so jumps are huge, and the portals link opposite corners.",
    icelake: "Ice Lake: nothing stops you here, so slide to build speed and plan your turns early.",
    summit: "Summit: trails and ramps climb the hill and ladders finish the last cliff. The top is the hill.",
    canyon: "Canyon: you can wade the river. Ramps and the mega pads reach the ledges, bridges cross the middle.",
    rooftops: "Rooftops: hold forward at a ladder to climb it. Run off a roof pad to reach the tall roofs.",
    harbour: "Harbour: ladders climb the double-stacked containers and ramps climb the single ones.",
  };
  function showMapTip() {
    if (tut.active || replay.active || !currentMap || !MAP_TIPS[currentMap.id]) return;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem("tsb-tips") || "{}") || {}; } catch (e) { /* ignore */ }
    if (seen[currentMap.id]) return;
    seen[currentMap.id] = 1;
    try { localStorage.setItem("tsb-tips", JSON.stringify(seen)); } catch (e) { /* ignore */ }
    const el = document.getElementById("map-tip");
    el.textContent = MAP_TIPS[currentMap.id];
    el.hidden = false;
    clearTimeout(mapTipTimer);
    mapTipTimer = setTimeout(() => { el.hidden = true; }, 7000);
  }
  let mapTipTimer = 0;
  document.getElementById("rp-video").addEventListener("click", (e) => { e.currentTarget.blur(); saveReplayVideo(); });
  document.getElementById("rp-card").addEventListener("click", (e) => { e.currentTarget.blur(); saveShotCard(replay.clip); });
  document.getElementById("card-best").addEventListener("click", (e) => { e.stopPropagation(); saveShotCard(bestClip); });
  document.getElementById("r-card").addEventListener("click", (e) => { e.stopPropagation(); saveShotCard(run.bestClip); });
  // ======================================================================
  // MAIN LOOP
  // ======================================================================
  const clock = new THREE.Clock();
  let shadowsBaked = false, hudTimer = 0, lastStateText = "";

  function animate() {
    requestAnimationFrame(animate);
    const realDt = Math.min(clock.getDelta(), 0.05);
    let dt = realDt;
    if (replay.active) { updateReplay(realDt); return; }

    if (hitStopTimer > 0) {
      hitStopTimer -= realDt;
      const k = Math.max(hitStopTimer, 0) / CFG.hitStopTime;
      dt *= CFG.hitStopScale + (1 - CFG.hitStopScale) * (1 - k);
      if (hitStopTimer <= 0) hitStopTimer = 0;
    }

    if (net.active) mpFrame(realDt);

    pollGamepad(dt);
    if (!pointerLocked && mapPopupLive) hideMapPopup();   // the menu opened while the map was held
    // in a room the world keeps running while the menu is up, so everyone else's view stays correct
    if (pointerLocked || net.active) {
      if ((player.hook || player.grappleWant) && (!pointerLocked || localDead || run.state === "countdown" || countingDown())) releaseHook(0);
      updateMovers();
      updateWater(elapsedTime);
      updateGates();
      if (pointerLocked && !localDead && run.state !== "countdown" && !countingDown()) updatePlayer(dt);
      achSummitCheck();
      updateMapPopup();
      updateTrickFeed();
      updateProps(dt);
      updateParticles(dt);
      updateTracers(dt);
      updateSmoke(dt);
      clouds.rotation.y += dt * 0.004;
      updateJumpPads(dt);
      updateLevelFx(dt);
      updateCasings(dt);
      updateMagDrops(dt);
      updateThrownKnives(dt);
      updateGrenades(dt);
      updateTargets(net.active ? realDt : dt);
    }

    if (pointerLocked) {
      updateRun(realDt);   // real time, so hit-stop slow-mo doesn't stretch the clock
      updateAutoGraphics(realDt);
      updateTutorial(realDt);
      stats.time += realDt; statsDirty = true;
      statsSaveTimer -= realDt;
      if (statsSaveTimer <= 0) { statsSaveTimer = 5; saveStats(); }
      updateReload(dt);
      updateCrossbowDraw();
      if (autoReloadTimer > 0) { autoReloadTimer -= dt; if (autoReloadTimer <= 0) startReload(); }

      if (fireCooldown > 0) fireCooldown -= dt;
      if (vm.burstQueue > 0) {   // the second and third rounds of a burst
        const bw = currentWeapon();
        if (!bw.burst || reload.active || vm.switchTimer > 0 || (net.active && (localDead || net.phase !== "play" || countingDown()))) vm.burstQueue = 0;
        else if ((vm.burstTimer -= dt) <= 0) {
          if (bw.ammo > 0 || SETTINGS.unlimitedAmmo) { fireGun(bw); vm.burstQueue--; vm.burstTimer = bw.burstGap; } else vm.burstQueue = 0;
        }
      }

      const w = currentWeapon();
      if (w.auto) { if (mouseHeld) attack(); }
      else if (attackPressed) { attack(); }
      attackPressed = false;

      const speed = Math.hypot(player.velocity.x, player.velocity.z);

      hudTimer -= realDt;
      if (hudTimer <= 0) {
        hudTimer = 0.07;
        if (localProtectUntil && Math.hypot(yawObject.position.x - localSpawn[0], yawObject.position.z - localSpawn[1]) > 0.4) localProtectUntil = 0;   // moving ends it
        spawnProtEl.hidden = !(net.active && nowMs() < localProtectUntil && !localDead);
        speedEl.textContent = speed.toFixed(1);
        speedbarEl.style.width = Math.min(speed / CFG.maxSpeed * 100, 100).toFixed(0) + "%";
        const gReady = player.grappleCooldown <= 0, gUsed = !!player.hook || player.grappleWant;
        setAb(abEls.hook, gUsed ? "active" : gReady ? "ready" : "cool", "grapple");
        const me = net.active && net.sub === "dm" && !localDead ? localPlayer() : null;   // health only matters in deathmatch
        hpBarEl.hidden = !me;
        if (me) {
          hpFillEl.style.width = me.hp.toFixed(0) + "%";
          hpFillEl.style.background = me.hp > 60 ? "#3ddc84" : me.hp > 30 ? "#ffd24a" : "#ff4d4d";
          hpTextEl.textContent = Math.ceil(me.hp);
        }
        speedbarEl.style.background = speed > 18 ? "#22d3ee" : (speed > 12 ? "#7CFC00" : "#ffd24a");
        const st = player.sliding ? "SLIDING"
          : (!player.onGround ? (player.wallContactTime >= 0 ? "WALL" : "AIR") : "");
        if (st !== lastStateText) { stateEl.textContent = st; lastStateText = st; }
      }

      updateViewmodel(dt, speed > 0.5, held("sprint"), player.onGround);
    }

    updateFps(realDt);
    if (pointerLocked) recordFrame(realDt);
    renderer.render(scene, camera);
    if (!shadowsBaked) { shadowsBaked = true; renderer.shadowMap.needsUpdate = true; }
  }

  player.lastYaw = yawObject.rotation.y;
  fitMuzzleFlash(currentWeapon());
  applyAttachments();
  setLoadout(SETTINGS.loadout);   // last, once the reload and ammo state it touches exist
  // whatever depends on the level's shape is redone every time a map loads
  levelLoadedHook = function (opts) {
    groundBoxes = null; grappleFloors = null;
    navBuild(); buildMapViews();
    if (decalMesh) { for (let i = 0; i < DECAL_MAX; i++) decalMesh.setMatrixAt(i, _dM.makeScale(0, 0, 0)); decalMesh.instanceMatrix.needsUpdate = true; decalNext = 0; }
    for (const k of thrownPool) if (k.state !== "idle") retireKnife(k);
    for (const g of grenades) retireGrenade(g);
    packOut = null;
    releaseHook(0);
    player.ladder = null;
    if (!opts.keepPlayer && !net.active) teleportLocal(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
    for (const t of targets) respawnTarget(t);
    refreshMapUI();
  };
  navBuild(); buildMapViews();
  if (SETTINGS.map === "random" || SETTINGS.map !== currentMap.id) loadMap(resolveMapChoice(SETTINGS.map));
  refreshMapUI();
  targetsReady = true;
  syncTargetCounts();
  updateAmmoHud();
  animate();
})();
