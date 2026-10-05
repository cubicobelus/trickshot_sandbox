(function () {
  "use strict";

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
    // Realistic accuracy (a setting, off by default): extra spread, in radians
    realisticAirSpread: 0.025,  // any gun, while you're in the air
    realisticHipSpread: 0.012,  // the sniper when it isn't scoped, so a no-scope is a real gamble

  };

  const SETTINGS = {
    sensX: 1.0, sensY: 1.0, scopedSensMult: 0.35, volume: 0.55,
    unlimitedAmmo: false, mouseAccel: false, accelStrength: 0.7,
    realisticAccuracy: false,
    autoSprint: false,          // sprint whenever you move; Shift walks instead   // shots spread mid-jump, and the unscoped sniper isn't laser-accurate
    // crosshair
    xhStyle: "cross", xhColor: "#eeeeee", xhSize: 9, xhThick: 2, xhGap: 0, xhAlpha: 1, xhOutline: false,
    // view
    hand: "right", fov: 78, bob: 1, shake: 1, scopeSway: true, speedLines: true,
    quality: "auto", showFps: false,   // graphics: auto / high / medium / low, and the frame counter
    // sound levels, on top of the master volume
    volGuns: 1, volMove: 1, volHits: 1, volKnife: 1, volGear: 1,
    loadout: "rifle",   // the one gun carried alongside the knife
    playMode: "free",   // "free" play, or a Score Attack run: "sa60" / "sa120"
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
  const SKY_TOP = 0x3f7dc6, SKY_HORIZON = 0xcfe2ee;
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
  let fpsTime = 0, fpsFrames = 0;
  function updateFps(realDt) {
    fpsEl.hidden = !SETTINGS.showFps;
    if (!SETTINGS.showFps) return;
    fpsTime += realDt; fpsFrames++;
    if (fpsTime < 0.5) return;
    fpsEl.textContent = Math.round(fpsFrames / fpsTime) + " fps · " + (fpsTime / fpsFrames * 1000).toFixed(1) + " ms · " +
      gfxLevel + (SETTINGS.quality === "auto" ? " (auto)" : "");
    fpsTime = 0; fpsFrames = 0;
  }

  // the environment map below already lights everything softly from the sky, so the
  // fill light is low and the sun does the shaping
  scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x56663f, 0.62));
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
  (function buildEnvironment() {
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
    scene.environment = env;
  })();

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
  const SURFACE_DRAW = {
    // turf with a faint line every tile (4 m), handy for judging distance
    grass(g, n) {
      g.fillStyle = "#6f9a52"; g.fillRect(0, 0, n, n);
      speckle(g, 2600, n, 0.16, true);
      g.strokeStyle = "rgba(255,255,255,0.13)"; g.lineWidth = 3;
      g.strokeRect(0, 0, n, n);
    },
    // concrete panels with seams
    concrete(g, n) {
      g.fillStyle = "#a5afb9"; g.fillRect(0, 0, n, n);
      speckle(g, 1400, n, 0.08, true);
      g.strokeStyle = "rgba(40,48,58,0.35)"; g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, n - 3, n - 3);
      g.fillStyle = "rgba(40,48,58,0.25)";
      for (const [x, y] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) { g.beginPath(); g.arc(x * n, y * n, 3, 0, 7); g.fill(); }
    },
    // painted blocks
    brick(g, n) {
      g.fillStyle = "#b06a62"; g.fillRect(0, 0, n, n);
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
    deck(g, n) {
      g.fillStyle = "#8d949c"; g.fillRect(0, 0, n, n);
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
  const surfaceCanvases = {};
  function surfaceMaterial(kind, repeatX, repeatY) {
    if (!surfaceCanvases[kind]) surfaceCanvases[kind] = canvasTexture(256, SURFACE_DRAW[kind]);
    const t = surfaceCanvases[kind].clone();
    t.needsUpdate = true;
    t.repeat.set(repeatX, repeatY);
    return new THREE.MeshStandardMaterial({ map: t, roughness: kind === "deck" ? 0.6 : 0.9, metalness: kind === "deck" ? 0.3 : 0 });
  }

  // ======================================================================
  // LEVEL
  // ======================================================================
  const groundMeshes = [];
  const wallBoxes = [];      // everything that blocks movement
  const bounceBoxes = [];    // the subset you can wall-bounce off: actual walls and pillars

  // surfaces: "grass" for the floor, "deck" for platforms, "concrete" and "brick" for walls
  function addGround(x, y, z, w, d, surface, solid) {
    const tile = surface === "grass" ? 4 : Math.max(w, d);   // grass tiles every 4 m; decks show one border
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), surfaceMaterial(surface, w / tile, d / tile));
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    mesh.userData = { topY: y + 0.25, halfW: w / 2, halfD: d / 2, cx: x, cz: z };
    groundMeshes.push(mesh);
    if (solid) wallBoxes.push(new THREE.Box3().setFromObject(mesh));
  }
  function addWall(x, y, z, w, h, d, surface) {
    const span = Math.max(w, d), tile = surface === "concrete" ? 4 : 3;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surfaceMaterial(surface, span / tile, h / tile));
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    wallBoxes.push(box);
    bounceBoxes.push(box);
  }

  // ---- kicker ramps: a sloped floor rising along x or z. Running off the high end turns
  // your speed into lift (see player.groundRise), so a fast run-up throws you into the air ----
  const FLOOR_Y = 0.25;   // top of the main ground
  const ramps = [];
  function addRamp(cx, cz, along, width, length, height, dir) {
    const r = { cx, cz, along, dir, length, height,
      halfW: along === "x" ? length / 2 : width / 2, halfD: along === "x" ? width / 2 : length / 2 };
    ramps.push(r);
    // a wedge: profile in x (length) and y (height), extruded across the width
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(length, 0); shape.lineTo(length, height); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geo.translate(-length / 2, 0, -width / 2);
    if (along === "x") { if (dir < 0) geo.rotateY(Math.PI); }
    else geo.rotateY(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    const mesh = new THREE.Mesh(geo, surfaceMaterial("deck", 0.25, 0.25));
    mesh.position.set(cx, FLOOR_Y, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    // the sides and the tall end block you; on the slope your feet are always within a step
    // of these, so they never get in the way of running up it
    const along0 = (u) => (along === "x" ? cx : cz) + dir * (u - 0.5) * length;
    const box = (a0, a1, c0, c1, h) => {
      const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      wallBoxes.push(along === "x"
        ? new THREE.Box3(new THREE.Vector3(lo, FLOOR_Y, c0), new THREE.Vector3(hi, FLOOR_Y + h, c1))
        : new THREE.Box3(new THREE.Vector3(c0, FLOOR_Y, lo), new THREE.Vector3(c1, FLOOR_Y + h, hi)));
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
    return FLOOR_Y + r.height * Math.min(Math.max(0.5 + r.dir * a / r.length, 0), 1);
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
    scene.add(g);
    jumpPads.push({ x, y: y + 0.16, z, r: T.radius, power: T.power(), boost: T.boost(), glowMat, beam, flash: 0 });
  }
  function updateJumpPads(dt) {
    for (const p of jumpPads) {
      p.flash = Math.max(0, p.flash - dt * 3);
      p.glowMat.emissiveIntensity = 0.7 + 0.25 * Math.sin(elapsedTime * 4 + p.x) + p.flash * 1.5;
      p.beam.material.opacity = 0.26 + 0.08 * Math.sin(elapsedTime * 4 + p.x) + p.flash * 0.5;
    }
  }

  const H = CFG.arenaHalfSize;
  addGround(0, 0, 0, H * 2, H * 2, "grass");
  addWall(0, 6, -H, H * 2, 12, 1, "concrete");
  addWall(0, 6, H, H * 2, 12, 1, "concrete");
  addWall(-H, 6, 0, 1, 12, H * 2, "concrete");
  addWall(H, 6, 0, 1, 12, H * 2, "concrete");

  // bounce corridors: parallel walls to chain wall bounces down. The wall nearer the middle is
  // 3.5 m lower than the outer one, so climbing the corridor gets you out over it into the open.
  addWall(-31, 5.75, -8, 1, 11.5, 22, "concrete");
  addWall(-25, 4, -8, 1, 8, 22, "concrete");
  addWall(18, 4, 6, 1, 8, 12, "brick");
  addWall(24, 5.75, 6, 1, 11.5, 12, "brick");

  // pillars to bounce off and duck behind
  addWall(-15, 4, -24, 3, 8, 3, "brick");
  addWall(13, 4, -24, 3, 8, 3, "brick");
  addWall(-18, 4, 20, 3, 8, 3, "brick");
  addWall(-6, 3, 30, 3, 6, 3, "brick");

  // sniper tower in the north-east corner, reached by its own jump pad
  addGround(30, 6.3, -30, 7, 7, "deck", true);   // top at 6.55 m: a mega pad clears it
  for (const [lx, lz] of [[27, -33], [33, -33], [27, -27], [33, -27]]) addWall(lx, 3.15, lz, 0.8, 6.3, 0.8, "concrete");

  // kicker ramps, aimed out into open ground
  addRamp(-8, 18, "x", 4, 7, 2.4, 1);
  addRamp(12, 22, "z", 4, 7, 2.4, -1);
  addRamp(-4, -30, "x", 4, 7, 2.4, -1);

  // jump pads: teal ones for about 1 s of air, magenta mega pads for about 1.5 s
  // A mega pad in the middle; mega pads in two opposite corners (north-east, at the tower, and
  // south-west) and normal pads in the other two.
  addJumpPad(0, FLOOR_Y, -2, "mega");
  addJumpPad(24, FLOOR_Y, -24, "mega");   // north-east: the tower pad
  addJumpPad(-30, FLOOR_Y, 30, "mega");   // south-west
  addJumpPad(-28, FLOOR_Y, -27, "normal");   // north-west
  addJumpPad(30, FLOOR_Y, 30, "normal");     // south-east
  addJumpPad(-28, FLOOR_Y, 12, "normal");    // off the end of the west bounce corridor

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

  const PLAYER_SPAWN = new THREE.Vector3(0, 1.7, 8);

  const _spawnProbe = new THREE.Vector3();
  function insideSolid(x, y, z, margin) {
    _spawnProbe.set(x, y, z);
    for (const b of wallBoxes) if (b.distanceToPoint(_spawnProbe) < margin) return true;
    for (const r of ramps) if (rampHeight(r, x, z) > -Infinity && y < r.height + FLOOR_Y + margin) return true;
    return false;
  }

  // Where a target of this kind should go: try a batch of random spots and keep the one furthest
  // from the other targets, and further still from ones of the same kind, so the map fills evenly
  // and no colour bunches up in one corner. Never right next to the player.
  function pickTargetSpot(type, exclude) {
    const lim = CFG.arenaHalfSize - 6;
    const me = yawObject.position;
    let best = null, bestScore = -Infinity;
    for (let a = 0; a < 48; a++) {
      const x = (Math.random() * 2 - 1) * lim;
      const z = (Math.random() * 2 - 1) * lim;
      const y = 1.7 + Math.random() * 7.3;
      if (Math.hypot(x - PLAYER_SPAWN.x, z - PLAYER_SPAWN.z) < 11) continue;
      if (Math.hypot(x - me.x, z - me.z) < 12) continue;
      if (insideSolid(x, y, z, 1.6)) continue;
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
  const metalDark = new THREE.MeshStandardMaterial({ color: 0x232427, roughness: 0.4, metalness: 0.6 });
  const metalMid = new THREE.MeshStandardMaterial({ color: 0x3c3f45, roughness: 0.5, metalness: 0.5 });
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
  addPart(rifleGroup, new THREE.BoxGeometry(0.08, 0.10, 0.34), woodStock, 0, -0.01, 0.36);
  addPart(rifleGroup, new THREE.BoxGeometry(0.07, 0.06, 0.20), woodStock, 0, -0.07, 0.42, -0.12, 0, 0);
  addPart(rifleGroup, new THREE.BoxGeometry(0.055, 0.04, 0.18), woodStock, 0, 0.07, 0.30);
  addPart(rifleGroup, new THREE.BoxGeometry(0.085, 0.15, 0.03), gripMat, 0, -0.03, 0.54);
  // pistol grip, trigger guard and trigger
  addPart(rifleGroup, new THREE.BoxGeometry(0.05, 0.13, 0.055), gripMat, 0, -0.11, 0.19, 0.32, 0, 0);
  addPart(rifleGroup, new THREE.TorusGeometry(0.032, 0.006, 6, 14, Math.PI), metalDark, 0, -0.058, 0.10, 0, HALF_PI, Math.PI);
  addPart(rifleGroup, new THREE.BoxGeometry(0.008, 0.035, 0.008), metalDark, 0, -0.075, 0.10, 0.25, 0, 0);
  // wooden forend under the barrel
  addPart(rifleGroup, new THREE.BoxGeometry(0.075, 0.07, 0.36), woodStock, 0, -0.025, -0.40);
  // tapered barrel
  addPart(rifleGroup, new THREE.CylinderGeometry(0.023, 0.033, 0.88, 16), metalDark, 0, 0.005, -0.64, HALF_PI, 0, 0);
  // muzzle brake: a block with three gas ports cut into each side
  addPart(rifleGroup, new THREE.BoxGeometry(0.068, 0.058, 0.15), metalDark, 0, 0.005, -1.11);
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      addPart(rifleGroup, new THREE.BoxGeometry(0.004, 0.036, 0.022), portMat, side * 0.0335, 0.005, -1.065 - i * 0.04);
    }
  }
  // folded bipod, legs tucked along the barrel
  addPart(rifleGroup, new THREE.CylinderGeometry(0.034, 0.034, 0.03, 12), metalDark, 0, 0.0, -0.62, HALF_PI, 0, 0);
  // scope: tube, objective bell, eyepiece, turrets and mounts
  addPart(rifleGroup, new THREE.CylinderGeometry(0.034, 0.034, 0.38, 16), metalDark, 0, 0.12, -0.05, HALF_PI, 0, 0);
  addPart(rifleGroup, new THREE.CylinderGeometry(0.052, 0.034, 0.09, 16), metalDark, 0, 0.12, -0.285, HALF_PI, 0, 0);
  addPart(rifleGroup, new THREE.CylinderGeometry(0.054, 0.054, 0.025, 16), metalDark, 0, 0.12, -0.34, HALF_PI, 0, 0);
  addPart(rifleGroup, new THREE.CylinderGeometry(0.034, 0.042, 0.06, 16), metalDark, 0, 0.12, 0.165, HALF_PI, 0, 0);
  addPart(rifleGroup, new THREE.CylinderGeometry(0.019, 0.019, 0.032, 12), metalMid, 0, 0.165, -0.04);
  addPart(rifleGroup, new THREE.CylinderGeometry(0.019, 0.019, 0.032, 12), metalMid, 0.045, 0.12, -0.04, 0, 0, HALF_PI);
  addPart(rifleGroup, new THREE.CylinderGeometry(0.044, 0.044, 0.07, 16), metalMid, 0, 0.12, -0.04, HALF_PI, 0, 0);
  addPart(rifleGroup, new THREE.TorusGeometry(0.040, 0.010, 8, 16), metalDark, 0, 0.12, -0.14);
  addPart(rifleGroup, new THREE.TorusGeometry(0.040, 0.010, 8, 16), metalDark, 0, 0.12, 0.07);
  addPart(rifleGroup, new THREE.BoxGeometry(0.03, 0.05, 0.03), metalDark, 0, 0.085, -0.14);
  addPart(rifleGroup, new THREE.BoxGeometry(0.03, 0.05, 0.03), metalDark, 0, 0.085, 0.07);
  // lenses: dark coated glass with a faint glint
  addPart(rifleGroup, new THREE.CircleGeometry(0.048, 20), scopeGlass, 0, 0.12, -0.353);
  addPart(rifleGroup, new THREE.CircleGeometry(0.012, 10), glintMat, -0.016, 0.137, -0.354);
  addPart(rifleGroup, new THREE.CircleGeometry(0.038, 20), scopeGlass, 0, 0.12, 0.196, 0, Math.PI, 0);
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


  const polymerMat = new THREE.MeshStandardMaterial({ color: 0x2b2c2f, roughness: 0.75, metalness: 0.15 });
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
  addPart(arGroup, new THREE.BoxGeometry(0.03, 0.016, 0.03), metalDark, 0, 0.064, 0.08);        // rear sight base
  addPart(arGroup, new THREE.TorusGeometry(0.0075, 0.0025, 6, 14), metalDark, 0, 0.077, 0.08);  // rear sight ring
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
  // ---- Desert Eagle: polished stainless, a long triangular barrel with a top rail over
  // a short slide, a squared trigger guard and a chunky rubber grip ----
  const stainlessMat = new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.22, metalness: 0.9 });
  const stainlessDark = new THREE.MeshStandardMaterial({ color: 0xa7acb3, roughness: 0.3, metalness: 0.85 });
  const pistolGroup = new THREE.Group();
  addPart(pistolGroup, new THREE.BoxGeometry(0.036, 0.032, 0.21), stainlessDark, 0, -0.008, -0.03);    // frame
  // barrel: a triangular prism, point down, flat face up, with the rail along the top
  const deBarrel = addPart(pistolGroup, new THREE.CylinderGeometry(0.026, 0.026, 0.17, 3), stainlessMat, 0, 0.034, -0.1, HALF_PI, 0, 0);
  deBarrel.rotation.order = "XZY"; deBarrel.rotation.set(HALF_PI, 0, Math.PI);   // flat side up
  deBarrel.scale.set(1, 1, 0.75);
  addPart(pistolGroup, new THREE.BoxGeometry(0.014, 0.006, 0.16), stainlessDark, 0, 0.052, -0.1);       // top rail
  addPart(pistolGroup, new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 10), portMat, 0, 0.034, -0.186, HALF_PI, 0, 0);   // bore
  addPart(pistolGroup, new THREE.BoxGeometry(0.005, 0.009, 0.012), stainlessDark, 0, 0.059, -0.175);    // front sight
  // slide: the rear section, which kicks back on every shot
  const pistolSlide = new THREE.Group();
  pistolGroup.add(pistolSlide);
  addPart(pistolSlide, new THREE.BoxGeometry(0.04, 0.042, 0.11), stainlessMat, 0, 0.028, 0.035);
  for (let i = 0; i < 6; i++) addPart(pistolSlide, new THREE.BoxGeometry(0.042, 0.032, 0.0035), stainlessDark, 0, 0.026, 0.05 + i * 0.008);
  addPart(pistolSlide, new THREE.BoxGeometry(0.008, 0.009, 0.008), stainlessDark, -0.009, 0.053, 0.083);   // rear sight, two ears
  addPart(pistolSlide, new THREE.BoxGeometry(0.008, 0.009, 0.008), stainlessDark, 0.009, 0.053, 0.083);
  // squared trigger guard, trigger, slide stop, hammer
  addPart(pistolGroup, new THREE.BoxGeometry(0.008, 0.032, 0.008), stainlessDark, 0, -0.036, -0.06);
  addPart(pistolGroup, new THREE.BoxGeometry(0.008, 0.008, 0.06), stainlessDark, 0, -0.05, -0.034);
  addPart(pistolGroup, new THREE.BoxGeometry(0.006, 0.024, 0.006), metalDark, 0, -0.032, -0.03, 0.25, 0, 0);
  addPart(pistolGroup, new THREE.BoxGeometry(0.004, 0.008, 0.03), stainlessDark, 0.02, 0.006, 0.0);
  addPart(pistolGroup, new THREE.BoxGeometry(0.014, 0.02, 0.014), stainlessDark, 0, 0.044, 0.096, -0.5, 0, 0);
  addPart(pistolGroup, new THREE.BoxGeometry(0.04, 0.135, 0.058), gripMat, 0, -0.08, 0.06, 0.24, 0, 0);    // rubber grip
  const pistolMag = addPart(pistolGroup, new THREE.BoxGeometry(0.03, 0.12, 0.045), metalDark, 0, -0.09, 0.062, 0.24, 0, 0);

  const HELD = [rifleGroup, arGroup, akGroup, shotgunGroup, pistolGroup, knifeGroup];
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
  //   scope: sniper overlay; other guns aim down sights, zooming to adsZoom x FOV
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
      adsPos: new THREE.Vector3(0.0, -0.118, -0.24), adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, scope: true, fireRate: 1.1, auto: false, isMelee: false, usesAmmo: true,
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
      recoilKick: { up: 0.006, grow: 0.0007, side: 0.0035, max: 0.11, recover: 7, hold: 0.12 },
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
      recoilKick: { up: 0.011, grow: 0.0018, side: 0.016, max: 0.26, recover: 5, hold: 0.15 },   // terrible on purpose
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
      adsPos: new THREE.Vector3(0.0, -0.049, -0.2), adsRot: new THREE.Euler(0, 0, 0),   // the stock drops away below the view
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
      muzzle: new THREE.Vector3(0, 0.034, -0.2), eject: new THREE.Vector3(0.024, 0.04, 0.03),
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
      canADS: false, fireRate: 0.38, auto: true, isMelee: true,
      usesAmmo: false, range: 3.0, inspectDuration: 1.9, inspects: KNIFE_INSPECTS,
      slashDuration: 0.42,
    },
  };
  const WEAPON_ORDER = ["rifle", "ar", "ak", "shotgun", "pistol", "knife"];
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
    recoilPitch: 0, recoilYaw: 0, burstShots: 0, lastShotAt: -99,   // recoil on the aim (where bullets go)
    viewRecoilPitch: 0, viewRecoilYaw: 0,                            // how much of it the view (crosshair) shows
    camKick: 0, camKickYaw: 0,
  };

  function currentWeapon() { return WEAPONS[vm.current]; }

  function switchWeapon(name) {
    if (name === vm.current || vm.switchTimer > 0 || !WEAPONS[name]) return;
    vm.last = vm.current;
    vm.pending = name;
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
    const adsStep = dt / CFG.adsTime;
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
    const bobScale = (1 - adsEased) * (0.3 + speedFactor) * SETTINGS.bob;
    const bobX = Math.sin(vm.bobTimer) * 0.012 * bobScale;
    const bobY = Math.abs(Math.sin(vm.bobTimer * 2)) * 0.008 * bobScale;

    vm.recoil *= Math.max(0, 1 - dt * 11);

    // camera punch (gone long before the bolt lets you fire again), plus a slow
    // figure-eight breathing sway while scoped. Both move the real aim, so what
    // the reticle shows is where the shot goes.
    vm.camKick *= Math.max(0, 1 - dt * 10);
    const sway = SETTINGS.scopeSway && w.scope ? CFG.scopeSway * adsEased : 0;
    const kick = vm.camKick * SETTINGS.shake;
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
    const speedFov = CFG.speedFovBoost * speedT * (1 - adsEased);
    const adsFov = w.scope ? CFG.scopedFov : SETTINGS.fov * (w.adsZoom || 1);
    const targetFov = SETTINGS.fov + (adsFov - SETTINGS.fov) * adsEased + speedFov;
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov += (targetFov - camera.fov) * Math.min(dt * 12, 1);
      camera.updateProjectionMatrix();
    }
    speedlinesEl.style.opacity = SETTINGS.speedLines ? Math.max(0, (speedT - 0.35) / 0.65) * 0.85 * (1 - adsEased) : 0;

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

  function initAudio() {
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
  function playShotSound(profile) {
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
    makeup.gain.value = 1.56 * pf.gain * SETTINGS.volGuns;
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
  const grappleFillEl = document.getElementById("grapplebar-fill");
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
    knife: '<path d="M5 13.5 L33 8.5 L41 11 L41 13.6 L33 15.4 L5 15.4 Z"/><rect x="41" y="8" width="3" height="9" rx="1"/><rect x="44" y="10.3" width="15" height="4.2" rx="2.1"/><circle cx="60.5" cy="12.4" r="2.4"/>',
  };
  const iconSVG = (id) => '<svg viewBox="0 0 64 24" fill="currentColor">' + WEAPON_ICONS[id] + "</svg>";

  // ---- loadout: one gun plus the knife ----
  const GUNS = WEAPON_ORDER.filter((id) => WEAPONS[id].usesAmmo);
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
    const prev = SETTINGS.loadout;
    SETTINGS.loadout = id;
    if (vm.current !== id) {   // even from the knife: picking a gun puts it in your hand
      cancelReload(); cancelBoltCycle(); cancelPump();
      vm.switchTimer = 0; vm.pending = null; vm.swapped = true; vm.throwTimer = 0; vm.slashTimer = 0;
      vm.inspectTimer = 0; vm.wantADS = false; vm.adsProgress = 0;
      vm.recoilPitch = vm.recoilYaw = vm.viewRecoilPitch = vm.viewRecoilYaw = 0; vm.burstShots = 0;
      currentWeapon().group.visible = false;
      vm.current = id;
      currentWeapon().group.visible = true;
      fitMuzzleFlash(currentWeapon());
    }
    if (vm.last !== "knife") vm.last = id;
    buildHotbar();
    updateHotbar();
    updateAmmoHud();
    loadoutEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.gun === id));
    if (prev !== id) saveSettings();
  }
  const loadoutEl = document.getElementById("loadout");
  for (const id of GUNS) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.gun = id;
    b.innerHTML = iconSVG(id) + WEAPONS[id].name;
    b.addEventListener("click", () => setLoadout(id));
    loadoutEl.appendChild(b);
  }
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
    const L = s.xhSize, T = s.xhThick, G = s.xhGap, st = s.xhStyle;
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
      (s.xhOutline ? draw(2, "#000") : "") + draw(0, "currentColor") + "</svg>";
  }

  const xhPreviewEl = document.getElementById("xh-preview");
  function applySettings() {
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
    if (["free", "sa60", "sa120"].includes(saved.playMode)) SETTINGS.playMode = saved.playMode;
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
    if (uiMode === "solo" && isRunMode() && !runInProgress() && !tut.active) startRun();
    lockPointer();
  }
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

  // what's held right now, by binding (a wheel notch counts as a tap held for a moment)
  const inputHeld = (b) => (b === "Wheel" ? !!(keys.WheelUp || keys.WheelDown) : !!keys[b]);
  const held = (action) => BINDS[action].some((b) => b && inputHeld(b));
  // Ctrl+D (bookmark), Ctrl+S and friends would fire mid-game while Ctrl is a game key, so they're blocked then
  const usesCtrl = () => ACTION_IDS.some((a) => BINDS[a].includes("ControlLeft"));

  // what each action does when its input goes down, and (for the ones that are held) comes up
  const onPress = {
    jump() { jumpQueued = true; jumpQueueTimer = 0.12; },
    reload() { startReload(); },
    inspect() { startInspect(); },
    gun() { switchWeapon(SETTINGS.loadout); },
    knife() { switchWeapon("knife"); },
    swap(e, wheel) { switchWeapon((wheel ? vm.pending || vm.current : vm.current) === "knife" ? SETTINGS.loadout : "knife"); },
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
    if (id === "Tab" && pointerLocked) { e.preventDefault(); mpRefreshScoreboard(); }
    if (!pointerLocked || replay.active) return;
    pressInput(id, e);
  });
  window.addEventListener("keyup", (e) => {
    const id = normalizeInput(e.code);
    keys[id] = false;
    if (id === "Tab") mpRefreshScoreboard();
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
      k(L("fire")) + " attack" + dot + k(L("aim")) + " scope / throw knife" + dot + k(gunKnife) + " gun / knife";
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
      if (!reload.magDropped) { reload.magDropped = true; dropMagazine(w); }
    } else if (t >= R.magUp && t < R.magSeat) {
      const x = (t - R.magUp) / (R.magSeat - R.magUp);
      magY = w.magRestY - R.rise * (1 - easeOut(Math.min(x / 0.85, 1))) - seatGap * (x < 0.85 ? 1 : 1 - (x - 0.85) / 0.15);
    }
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
    wallImpactSpeed: 0, wallImpactAt: -99,   // the last time a wall stopped us, and how fast we hit it
    viewRoll: 0,
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
        if (!grappleRay.intersectBox(box, _gHit)) continue;
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
  function poseRope(start, pos, dir) {
    _gTail.copy(pos).addScaledVector(dir, -SPEAR_LEN);   // the rope ties on at the spear's tail
    _gRope.subVectors(_gTail, start);
    const len = _gRope.length();
    ropeMesh.position.copy(start).addScaledVector(_gRope, 0.5);
    ropeMesh.quaternion.setFromUnitVectors(_gUp, _gRope.divideScalar(len || 1));
    ropeMesh.scale.set(1, len, 1);
    hookHead.quaternion.setFromUnitVectors(_gUp, dir);
    hookHead.position.copy(pos).addScaledVector(dir, -SPEAR_LEN / 2);   // the tip is what sticks in
    ropeMesh.visible = hookHead.visible = true;
  }
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

    // ---------------- GROUND / AIR ----------------
    if (player.onGround) {
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
    let targetRoll = -moveX * 0.022;
    if (player.sliding) targetRoll += 0.085 + Math.sin(elapsedTime * 22) * 0.006;
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
        if (player.groundRise > 2) { player.launch = "ramp"; player.launchRun = Math.hypot(player.velocity.x, player.velocity.z); }
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
  function flashCrosshair() {
    crosshairEl.classList.add("hit");
    setTimeout(() => crosshairEl.classList.remove("hit"), 100);
  }

  // distance along the current ray to the nearest wall, pillar, platform or the floor
  const _occPoint = new THREE.Vector3();
  function occluderDistance(maxDist) {
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    let best = maxDist;
    for (const box of wallBoxes) {
      const hit = raycaster.ray.intersectBox(box, _occPoint);
      if (hit) { const dist = o.distanceTo(hit); if (dist < best) best = dist; }
    }
    if (d.y < 0) { const t = (o.y - 0.25) / -d.y; if (t > 0 && t < best) best = t; }
    return best;
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
      airTime: player.onGround ? 0 : elapsedTime - player.groundedAt,
      airId: player.groundedAt,   // the same for every shot in one jump
      launch: !player.onGround && player.velocity.y > 0 ? player.launch : null,
      // anywhere in a pad or ramp flight you ran onto, so it isn't "standing still"
      launched: !player.onGround && !!player.launch && player.launchRun >= CFG.standingStillSpeed,
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
      if (weapon && weapon.scope && vm.adsProgress < 0.35 && dist >= CFG.noScopeMinDist) add("NO-SCOPE", CFG.noScopeMult);
      else if (weapon && weapon.scope && vm.adsProgress >= 0.5 && (elapsedTime - vm.adsStartTime) <= CFG.quickscopeWindow) {
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

    // target size: precision a knife swing at arm's length doesn't need
    const kind = target.userData.type;
    if (!(isKnife && !thrown)) {
      if (kind === "tiny") add("MICRO TARGET", CFG.tinyTargetMult);
      else if (kind === "small") add("PINPOINT", CFG.smallTargetMult);
    }
    if (target.userData.moving && kind !== "tiny") add("MOVING TARGET", CFG.movingTargetMult);   // purple's MICRO covers its speed

    if (streak > 0) add("STREAK " + (streak + 1), Math.min(1 + streak * CFG.streakMultPer, CFG.streakMultMax));

    if (still) add("STANDING STILL", CFG.standingStillMult);
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
        ["FAST / BLAZING / SONIC", "up to " + x(Math.min(1 + (C.maxSpeed - C.speedFrom) * C.speedMultPer, C.speedMultMax)), "+" + C.speedMultPer + "x per u/s over " + C.speedFrom + " u/s; the tag shows your speed."],
        ["REVERSE", x(C.reverseMult), "In the air, having turned 90°+ since takeoff, flying at " + C.reverseSpeed + "+ u/s away from where you aim. Backpedalling doesn't count."],
      ]],
      ["Aim", [
        ["MID RANGE / LONG SHOT / MEGA SNIPE", "no cap", "+" + C.distanceMultPerM + "x per meter past " + C.distanceFrom + " m: " +
          x(1 + 15 * C.distanceMultPerM) + " at 30 m, " + x(1 + 35 * C.distanceMultPerM) + " at 50 m, " + x(1 + 65 * C.distanceMultPerM) + " at 80 m."],
        ["NO-SCOPE", x(C.noScopeMult), "Sniper, unscoped, from " + C.noScopeMinDist + " m or more. With Realistic accuracy on, unscoped shots spread a little."],
        ["QUICKSCOPE", x(C.quickscopeMult), "Sniper, fired within " + C.quickscopeWindow + " s of scoping in."],
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

  // score, streak, HUD popups and feedback for any scoring hit (target or player)
  function awardPoints(res) {
    const pointsGained = Math.round(CFG.basePoints * res.mult * (res.scale || 1));
    score += pointsGained;
    scoreEl.textContent = score;
    streak++;
    streakEl.textContent = streak;

    showBonusTags(res.mult, res.tags, res.pens || [], res.dist);
    flashCrosshair();
    hitStopTimer = CFG.hitStopTime;
    playHitSound(Math.min(1 + (res.mult - 1) * 0.16, 2.4));
    showFeed("+" + pointsGained + "  " + res.mult.toFixed(2) + "x");
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
    else { statMax("longestShot", dist); if (thrown) stat("knifeThrowHits"); else gunStat(vm.current).points += pointsGained; }
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
      mpPvpKill(pres, true, 0);
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
    if (net.active && (localDead || net.phase !== "play")) return;

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

    camera.getWorldDirection(raycaster.ray.direction);
    raycaster.ray.origin.setFromMatrixPosition(camera.matrixWorld);

    if (w.isMelee) {
      vm.swingIndex = (vm.swingIndex + 1) % SWING_ORDER.length;
      vm.swingKind = SWING_ORDER[vm.swingIndex];
      vm.slashTimer = w.slashDuration;
      vm.meleePending = true;
      playKnifeSwing();
      return;
    }
    fireGun(w);
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
    const steady = 1 - 0.2 * easeInOut(vm.adsProgress);   // aiming down sights steadies it a little
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
    playShotSound(w.sound);
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
    if (SETTINGS.realisticAccuracy) {
      if (w.scope) cone += CFG.realisticHipSpread * (1 - ads);
      if (!player.onGround) cone += CFG.realisticAirSpread;
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
    let anyHit = false, pvp = null, puffs = 0;
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
      } else if (impactDist < maxD && puffs++ < 4) {
        _impactPt.copy(raycaster.ray.origin).addScaledVector(_pelletDir, impactDist);
        burst(_impactPt, 0xb8c0c8, w.pellets > 1 ? 2 : 4);
      }
    }

    if (pvp) mpPvpKill(pvp, false, ammoBefore, w);
    for (const [target, dist] of targetHits) scoreHit(target, dist, false, ammoBefore, undefined, false, w);
    if (anyHit && !targetHits.size && !pvp) flashCrosshair();
    if (!targetHits.size && !pvp) breakStreak();   // hitting only a crate or a wall is a miss
    if (run.state === "live") { run.shots++; if (targetHits.size) run.shotsHit++; }
    if (!net.active) {
      const gs = gunStat(vm.current);
      gs.shots++; stat("shots");
      if (targetHits.size) { gs.hits++; stat("shotsHit"); }
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
    const root = new THREE.Group();
    root.add(spin);
    root.visible = false;
    root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    scene.add(root);
    thrownPool.push({ root, spin, vel: new THREE.Vector3(), from: new THREE.Vector3(), age: 0, state: "idle", snap: null });
  }

  const _thFwd = new THREE.Vector3(), _thRight = new THREE.Vector3(), _thLook = new THREE.Vector3();

  function throwKnife() {
    if (vm.throwTimer > 0 || vm.switchTimer > 0 || vm.grappleOut > 0.25) return;
    if (run.state === "countdown" || run.state === "done") return;
    if (run.state === "live") run.shots++;
    stat("knifeThrows"); stat("shots");
    if (net.active && (localDead || net.phase !== "play")) return;
    vm.throwTimer = CFG.knifeThrowCooldown;
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

      if (k.age > 4) { retireKnife(k); if (!k.remote) breakStreak(); continue; }   // flew off without hitting anything
      k.vel.y -= CFG.knifeThrowGravity * dt;
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
          const p = _kRay.intersectBox(box, _kTmp);
          if (!p) continue;
          const dist = o.distanceTo(p);
          if (dist < hitDist) { hitDist = dist; kind = "wall"; _kHit.copy(p); boxFaceNormal(box, p, _kNormal); }
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
        mpPvpKill(hitPlayer, true, 0, undefined, k.snap, true);
        retireKnife(k);
        continue;
      }
      if (kind === "target") {
        o.addScaledVector(d, hitDist);
        playKnifeHit();
        if (run.state === "live") run.shotsHit++;
        stat("shotsHit");
        lastShotOrigin.copy(k.from);
        scoreHit(hitTarget, k.from.distanceTo(o), true, 0, k.snap, true);
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
      k.spin.rotation.x -= KNIFE_SPIN * dt;
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
  //   dm   - targets are off, players eliminate each other (one hit kills)
  // ======================================================================
  const ROOM_PREFIX = "trickshot-sandbox-";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O/1/I to avoid misreads
  const ROUND_SECONDS = 180, RESULTS_SECONDS = 10, RESPAWN_MS = 3000, PROTECT_MS = 1500, MAX_PLAYERS = 8;
  const PLAYER_COLORS = [0xe5484d, 0x3e8ef7, 0x30a46c, 0xf5a524, 0x9d5bd2, 0x13b9b9, 0xe5589b, 0xa0a0a8];
  // spawn points on the open floor, clear of the walls, pillars and platforms
  const SPAWNS = [[0, 8], [-28, 28], [28, 28], [28, -28], [-28, -28], [0, 28], [-28, 2], [8, -26]];
  const SUB_NAMES = { race: "Score Race", dm: "Deathmatch" };

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
    phase: "play", left: ROUND_SECONDS, leftRecv: 0, resultsLeft: 0,
    players: new Map(), ttOffset: 0, ttSynced: false,
    lastTick: 0, boardTimer: 0,
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
    hostBtn: document.getElementById("mp-host-btn"),
    joinBtn: document.getElementById("mp-join-btn"),
    status: document.getElementById("mp-status"),
    subHint: document.getElementById("mp-sub-hint"),
    roomCode: document.getElementById("mp-room-code"),
    roomMode: document.getElementById("mp-room-mode"),
    hostMode: document.getElementById("mp-host-mode"),
    nextSub: document.getElementById("mp-next-sub"),
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
    boardFoot: document.getElementById("sb-foot"),
  };

  const SUB_HINTS = {
    race: "Everyone shoots the same targets and the best trickscore when the timer ends wins. Players can't hurt each other.",
    dm: "Targets are off. Any hit eliminates a player, and kills pay out your full trick multipliers. Best score wins.",
  };
  function selectedSub() { return document.querySelector('input[name="mp-sub"]:checked').value; }
  function refreshSubHint() { mpEls.subHint.textContent = SUB_HINTS[selectedSub()]; }
  document.querySelectorAll('input[name="mp-sub"]').forEach((r) => r.addEventListener("change", refreshSubHint));
  refreshSubHint();

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
      id, name, color, score: 0, kills: 0, deaths: 0, alive: true,
      x: 0, y: 0.25, z: 0, yaw: 0, pitch: 0, w: "rifle", sl: false,
      respawnAt: 0, protectUntil: 0, mesh: null, snap: true,
    };
  }

  function disposeAvatar(p) {
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

  function makeAvatar(p) {
    const g = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe0b894, roughness: 0.8 });
    addPart(g, new THREE.BoxGeometry(0.46, 0.7, 0.26), dark, 0, 0.38, 0);        // legs
    addPart(g, new THREE.BoxGeometry(0.58, 0.72, 0.32), suit, 0, 1.05, 0);       // torso
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.5, 0);
    addPart(headPivot, new THREE.SphereGeometry(0.2, 12, 10), skin, 0, 0.14, 0);
    const gun = new THREE.Group();
    addPart(gun, new THREE.BoxGeometry(0.07, 0.09, 0.95), dark, 0, 0, -0.45);
    addPart(gun, new THREE.BoxGeometry(0.06, 0.06, 0.3), metalMid, 0, 0.07, -0.3);
    gun.position.set(0.24, -0.25, -0.1);
    headPivot.add(gun);
    g.add(headPivot);
    const knife = new THREE.Group();
    addPart(knife, new THREE.BoxGeometry(0.035, 0.07, 0.3), metalMid, 0, 0, -0.2);
    knife.position.set(0.24, -0.25, -0.1);
    knife.visible = false;
    headPivot.add(knife);
    g.userData.pivot = headPivot;
    g.userData.gun = gun;
    g.userData.knife = knife;
    g.add(makeNameTag(p.name, p.color));
    scene.add(g);
    return g;
  }

  function ensureAvatar(p) {
    if (p.id === net.id) return;
    if (!p.mesh) { p.mesh = makeAvatar(p); p.snap = true; }
  }

  function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  function updateAvatars(dt) {
    const k = 1 - Math.exp(-dt * 18);
    for (const p of net.players.values()) {
      if (p.id === net.id || !p.mesh) continue;
      const m = p.mesh;
      m.visible = p.alive;
      if (!p.alive) continue;
      if (p.snap) {
        m.position.set(p.x, p.y, p.z); m.rotation.y = p.yaw; p.snap = false;
      } else {
        m.position.x += (p.x - m.position.x) * k;
        m.position.y += (p.y - m.position.y) * k;
        m.position.z += (p.z - m.position.z) * k;
        m.rotation.y += wrapAngle(p.yaw - m.rotation.y) * k;
      }
      m.userData.pivot.rotation.x = p.pitch;
      const squash = p.sl ? 0.62 : 1;
      m.scale.y += (squash - m.scale.y) * k;
      m.userData.gun.visible = p.w === "rifle";
      m.userData.knife.visible = p.w === "knife";
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
  function feedLine(html) {
    const el = document.createElement("div");
    el.innerHTML = html;
    mpEls.feed.appendChild(el);
    while (mpEls.feed.children.length > 5) mpEls.feed.firstChild.remove();
    setTimeout(() => el.remove(), 6000);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function syncPlayers(list) {
    const seen = new Set();
    for (const raw of list) {
      // everything here came over the network and ends up in the page: force plain types and ranges
      if (!raw || typeof raw !== "object") continue;
      const num = (v) => (Number.isFinite(v) ? v : 0);
      const e = {
        id: String(raw.id).slice(0, 64), name: String(raw.name).replace(/[^\w \-]/g, "").slice(0, 14) || "Player",
        color: Number.isInteger(raw.color) && raw.color >= 0 && raw.color <= 0xffffff ? raw.color : 0xa0a0a8,
        score: num(raw.score), kills: num(raw.kills), deaths: num(raw.deaths), alive: raw.alive === true,
      };
      seen.add(e.id);
      let p = net.players.get(e.id);
      if (!p) { p = makePlayerRecord(e.id, e.name, e.color); net.players.set(e.id, p); }
      p.name = e.name; p.color = e.color; p.score = e.score; p.kills = e.kills; p.deaths = e.deaths;
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
  }

  function setLocalDead(by) {
    localDead = true;
    player.velocity.set(0, 0, 0);
    player.sliding = false;
    mouseHeld = false; vm.wantADS = false;
    cancelReload();
    streak = 0; streakEl.textContent = 0;
    mpEls.deadBy.textContent = by ? "by " + by : "";
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
    localDead = false;
    mpEls.dead.hidden = true;
    streak = 0; streakEl.textContent = 0;
    score = 0; scoreEl.textContent = 0;
    cancelReload();
    refillAmmo();
    updateAmmoHud();
  }

  function applyRound(m) {
    net.sub = m.sub;
    net.phase = m.phase;
    net.left = m.left; net.leftRecv = nowMs();
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
        const off = m.tt - nowMs() / 1000;
        net.ttOffset = net.ttSynced ? net.ttOffset + (off - net.ttOffset) * 0.25 : off;
        net.ttSynced = true;
        if (net.role === "client") net.sub = m.sub;
        syncPlayers(m.p);
        mpRefreshHud();
        break;
      }

      case "phase":
        net.phase = m.phase; net.resultsLeft = m.rl || 0;
        if (m.phase === "results") { mpEls.dead.hidden = true; mouseHeld = false; }
        syncPlayers(m.p);
        mpRefreshHud();
        break;

      case "states":
        for (const s of m.s) {
          if (s[0] === net.id) continue;
          const p = net.players.get(s[0]);
          if (!p) continue;
          p.x = s[1]; p.y = s[2]; p.z = s[3]; p.yaw = s[4]; p.pitch = s[5]; p.w = s[6] ? "knife" : "rifle"; p.sl = !!s[7];
        }
        break;

      case "throw":
        if (m.id !== net.id) spawnRemoteKnife(m.o, m.v);
        break;

      case "shot":
        if (m.id === net.id) break;
        _tmpV1.set(m.o[0], m.o[1], m.o[2]);
        _tmpV2.set(m.d[0], m.d[1], m.d[2]);
        spawnTracer(_tmpV1, _tmpV2, m.l);
        playRemoteShot();
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
        if (t) applyTargetData(t, m.d);
        break;
      }

      case "kill": {
        const k = net.players.get(m.k), v = net.players.get(m.v);
        if (v) { v.alive = false; }
        const tags = (m.tags || []).slice(0, 3).join(" · ");
        feedLine("<b>" + esc(k ? k.name : "?") + "</b> " + (m.knife ? "knifed" : (m.head ? "headshot" : "sniped")) +
          " <b>" + esc(v ? v.name : "?") + "</b><i>+" + (Number(m.pts) || 0) + (tags ? " " + esc(tags) : "") + "</i>");
        if (m.v === net.id) setLocalDead(k ? k.name : "");
        else if (m.k !== net.id) { playHitSound(0.7); if (v && v.mesh) burst(v.mesh.position, 0xff5555, 8); }
        break;
      }

      case "respawn": {
        const p = net.players.get(m.id);
        if (p) { p.alive = true; p.x = m.pos[0]; p.y = 0.25; p.z = m.pos[1]; p.snap = true; }
        if (m.id === net.id) {
          localDead = false;
          mpEls.dead.hidden = true;
          teleportLocal(m.pos[0], m.pos[1]);
          cancelReload(); refillAmmo(); updateAmmoHud();
        }
        break;
      }
    }
  }
  const _tmpV1 = new THREE.Vector3(), _tmpV2 = new THREE.Vector3();

  function playRemoteShot() {
    noiseHit(1400, 0.5, 0.40, 0.09, "lowpass", 0, 0.45, true);
    noiseHit(420, 0.7, 0.35, 0.28, "lowpass", 0.01, 0.6, true);
    tone("sine", 130, 34, 0.35, 0.3, 0, 0.35, true);
  }

  // ---------------- local actions that need to reach the host ----------------
  function sendToHost(msg) {
    if (net.role === "host") hostHandle(net.id, msg);
    else if (net.hostConn && net.hostConn.open) net.hostConn.send(msg);
  }
  function mpSendShot(origin, dir, dist) {
    sendToHost({ t: "shot", o: [r2(origin.x), r2(origin.y), r2(origin.z)], d: [r2(dir.x * 1000) / 1000, r2(dir.y * 1000) / 1000, r2(dir.z * 1000) / 1000], l: r2(dist) });
  }
  function mpSendThrow(pos, vel) {
    sendToHost({ t: "throw", o: [r2(pos.x), r2(pos.y), r2(pos.z)], v: [r2(vel.x), r2(vel.y), r2(vel.z)] });
  }
  // a thrown knife from another player: it flies and sticks on every screen, but only its owner scores with it
  function spawnRemoteKnife(o, v) {
    const k = thrownPool.find((q) => q.state === "idle") || thrownPool.reduce((a, b) => (a.age > b.age ? a : b));
    if (k.root.parent !== scene) scene.add(k.root);
    k.root.position.set(o[0], o[1], o[2]);
    k.from.copy(k.root.position);
    k.vel.set(v[0], v[1], v[2]);
    k.snap = null; k.remote = true; k.age = 0; k.state = "flying";
    k.root.visible = true;
    k.root.scale.setScalar(1);
    k.spin.rotation.set(0, 0, 0);
    faceAlongVelocity(k);
  }
  function mpTargetHit(target, pts) { sendToHost({ t: "hit", i: target.userData.idx, pts }); }

  const _pseudoTarget = { userData: { small: false, moving: false } };
  function mpPvpKill(pres, isKnife, ammoBefore, weapon, snap, thrown) {
    const res = computeMultipliers(_pseudoTarget, pres.dist, isKnife, ammoBefore, snap, !!thrown, weapon);
    if (pres.head && !isKnife) { res.mult *= 1.5; res.tags.push("HEADSHOT x1.50"); }
    const pts = awardPoints(res);
    burst(pres.point, 0xff5555, 14);
    sendToHost({ t: "pvp", v: pres.p.id, pts, tags: res.tags, head: !!pres.head, knife: !!isKnife });
  }

  // ---------------- host logic ----------------
  function boardList() {
    return [...net.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, kills: p.kills, deaths: p.deaths, alive: p.alive }));
  }
  function hostSendRaw(m) { for (const c of net.conns.values()) if (c.open) c.send(m); }
  function hostBroadcast(m) { hostSendRaw(m); applyEvent(m); }
  function hostBoardMsg() {
    return { t: "board", p: boardList(), sub: net.sub, left: net.left, phase: net.phase, rl: net.resultsLeft, tt: mpTargetClock() };
  }
  function hostBroadcastBoard() { hostBroadcast(hostBoardMsg()); }
  function roundMsg(fresh) {
    return {
      t: "round", sub: net.sub, left: net.left, phase: net.phase, rl: net.resultsLeft, fresh: !!fresh, p: boardList(),
      targets: net.sub === "race" ? targets.map(serializeTarget) : null, tt: mpTargetClock(),
    };
  }

  function mpAnnounceSpawn(t) { hostBroadcast({ t: "tspawn", i: t.userData.idx, d: serializeTarget(t) }); }

  function pickSpawn(exceptId) {
    let best = SPAWNS[0], bestScore = -1;
    for (const s of SPAWNS) {
      let nearest = 999;
      for (const p of net.players.values()) {
        if (p.id === exceptId || !p.alive) continue;
        nearest = Math.min(nearest, Math.hypot(p.x - s[0], p.z - s[1]));
      }
      const sc = nearest + Math.random() * 6;
      if (sc > bestScore) { bestScore = sc; best = s; }
    }
    return best;
  }

  function hostRespawn(p) {
    const s = pickSpawn(p.id);
    p.alive = true; p.x = s[0]; p.y = 0.25; p.z = s[1];
    p.protectUntil = net.sub === "dm" ? nowMs() + PROTECT_MS : 0;
    hostBroadcast({ t: "respawn", id: p.id, pos: s });
  }

  function hostStartRound() {
    net.sub = net.pendingSub;
    net.phase = "play";
    net.left = ROUND_SECONDS;
    net.resultsLeft = 0;
    for (const p of net.players.values()) { p.score = 0; p.kills = 0; p.deaths = 0; p.alive = true; }
    if (net.sub === "race") for (const t of targets) { respawnTarget(t); t.userData.respawnTimer = 1.1; }
    hostBroadcast(roundMsg(true));
    for (const p of net.players.values()) hostRespawn(p);
  }

  function hostEndRound() {
    net.phase = "results";
    net.resultsLeft = RESULTS_SECONDS;
    hostBroadcast({ t: "phase", phase: "results", rl: net.resultsLeft, p: boardList() });
  }

  function hostAddPlayer(conn, hello) {
    const used = new Set([...net.players.values()].map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[0];
    const name = String(hello.name || "Player").replace(/[^\w \-]/g, "").trim().slice(0, 14) || "Player";
    const p = makePlayerRecord(conn.peer, name, color);
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

  function hostHandle(fromId, m) {
    const p = net.players.get(fromId);
    if (!p || !m || typeof m !== "object") return;
    switch (m.t) {
      case "st":
        if (p.alive && Number.isFinite(m.x + m.y + m.z + m.yaw + m.pitch)) {
          p.x = m.x; p.y = m.y; p.z = m.z; p.yaw = m.yaw; p.pitch = m.pitch; p.w = m.w ? "knife" : "rifle"; p.sl = !!m.sl;
        }
        break;

      case "shot": {
        const o = vec3(m.o, 1000), d = vec3(m.d, 2), l = Number(m.l);
        if (p.alive && o && d && Number.isFinite(l)) hostBroadcast({ t: "shot", id: fromId, o, d, l: Math.max(0, Math.min(l, 2000)) });
        break;
      }

      case "throw": {
        const o = vec3(m.o, 1000), v = vec3(m.v, 200);
        if (p.alive && o && v) hostBroadcast({ t: "throw", id: fromId, o, v });
        break;
      }

      case "hit": {
        if (net.sub !== "race" || net.phase !== "play") break;
        const t = targets[m.i];
        if (!t || (fromId !== net.id && !t.userData.alive)) break;   // someone beat them to it
        const pts = Math.max(0, Math.min(Number(m.pts) || 0, 20000));
        p.score += pts; p.kills++;
        hostBroadcast({ t: "tkill", i: m.i, by: fromId });
        hostBroadcastBoard();
        break;
      }

      case "pvp": {
        const v = net.players.get(m.v);
        if (net.sub !== "dm" || net.phase !== "play" || !v || v === p || !v.alive || !p.alive) break;
        if (nowMs() < v.protectUntil) break;
        const pts = Math.max(0, Math.min(Number(m.pts) || 0, 20000));
        v.alive = false; v.deaths++; v.respawnAt = nowMs() + RESPAWN_MS;
        p.kills++; p.score += pts;
        hostBroadcast({ t: "kill", k: fromId, v: v.id, pts, tags: Array.isArray(m.tags) ? m.tags.slice(0, 6).map(String) : [], head: !!m.head, knife: !!m.knife });
        hostBroadcastBoard();
        break;
      }
    }
  }

  function localStateMsg() {
    return {
      t: "st", x: r2(yawObject.position.x), y: r2(player.feetY), z: r2(yawObject.position.z),
      yaw: r2(yawObject.rotation.y * 100) / 100, pitch: r2(pitchObject.rotation.x * 100) / 100,
      w: vm.current === "knife" ? 1 : 0, sl: player.sliding ? 1 : 0,
    };
  }

  function hostTick(dt) {
    const now = nowMs();
    if (net.phase === "play") {
      net.left -= dt;
      if (net.left <= 0) { net.left = 0; hostEndRound(); }
    } else {
      net.resultsLeft -= dt;
      if (net.resultsLeft <= 0) hostStartRound();
    }
    if (net.phase === "play" && net.sub === "dm") {
      for (const p of net.players.values()) if (!p.alive && now >= p.respawnAt) hostRespawn(p);
    }

    if (!localDead) hostHandle(net.id, localStateMsg());
    const s = [];
    for (const p of net.players.values()) {
      if (p.alive) s.push([p.id, p.x, p.y, p.z, p.yaw, p.pitch, p.w === "knife" ? 1 : 0, p.sl ? 1 : 0]);
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
    else if (!localDead && net.hostConn && net.hostConn.open) net.hostConn.send(localStateMsg());
  }
  // a timer rather than requestAnimationFrame so a backgrounded host keeps the room alive
  setInterval(mpTick, 50);

  // ---------------- connecting ----------------
  function randomCode() {
    let c = "";
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
  }

  function mpEnter(role, code) {
    net.active = true; net.role = role; net.code = code;
    net.players.clear(); net.ttSynced = false; net.ttOffset = 0;
    net.phase = "play"; net.left = ROUND_SECONDS; net.leftRecv = nowMs();
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
    mpEls.hostMode.hidden = role !== "host";
    mpEls.nextSub.value = net.pendingSub;
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
    net.peer = null; net.hostConn = null; net.id = null; net.role = null; net.active = false;
  }

  function mpLeave(message) {
    const wasActive = net.active;
    mpTeardown();
    if (!wasActive) { setConnectBusy(false); mpStatus(message || ""); return; }
    document.exitPointerLock();
    setPropsEnabled(true);
    for (const t of targets) respawnTarget(t);
    resetLocalRound();
    mpEls.tabs.forEach((t) => (t.disabled = false));
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
    net.pendingSub = selectedSub();
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

  function hostOnConnection(conn) {
    conn.on("open", () => {
      if (net.players.size >= MAX_PLAYERS) { conn.send({ t: "full" }); setTimeout(() => conn.close(), 300); return; }
      net.conns.set(conn.peer, conn);
    });
    conn.on("data", (m) => {
      if (!net.conns.has(conn.peer)) return;
      if (m && m.t === "hello" && !net.players.has(conn.peer)) hostAddPlayer(conn, m);
      else hostHandle(conn.peer, m);
    });
    conn.on("close", () => hostRemovePlayer(conn.peer));
    conn.on("error", () => hostRemovePlayer(conn.peer));
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
        if (!net.active && m.t === "round") { clearTimeout(timeout); mpEnter("client", code); net.lastTick = nowMs(); }
        if (net.active) applyEvent(m);
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

  mpEls.hostBtn.addEventListener("click", mpHost);
  mpEls.joinBtn.addEventListener("click", mpJoin);
  mpEls.code.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") mpJoin(); });
  mpEls.name.addEventListener("keydown", (e) => e.stopPropagation());
  mpEls.leaveBtn.addEventListener("click", () => mpLeave(""));
  mpEls.nextSub.addEventListener("change", () => { net.pendingSub = mpEls.nextSub.value; });
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
    mpEls.roomMode.textContent = SUB_NAMES[net.sub];
    mpEls.players.innerHTML = "";
    for (const p of net.players.values()) {
      const li = document.createElement("li");
      const hex = "#" + p.color.toString(16).padStart(6, "0");
      li.innerHTML = '<span class="dot" style="background:' + hex + '"></span>' + esc(p.name) +
        (p.id === net.id ? ' <span class="tag">YOU</span>' : "");
      mpEls.players.appendChild(li);
    }
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }
  function leftNow() {
    return net.role === "host" ? net.left : net.left - (nowMs() - net.leftRecv) / 1000;
  }

  function mpRefreshHud() {
    if (!net.active) return;
    mpEls.timerVal.textContent = net.phase === "results" ? "0:00" : fmtTime(leftNow());
    mpEls.timerMode.textContent = net.phase === "results" ? "Round over" : SUB_NAMES[net.sub];
    mpEls.roomMode.textContent = SUB_NAMES[net.sub];
  }

  function mpRefreshScoreboard() {
    const results = net.active && net.phase === "results";
    const held = net.active && pointerLocked && keys["Tab"];
    mpEls.board.hidden = !(results || held);
    if (mpEls.board.hidden) return;
    const rows = [...net.players.values()].sort((a, b) => b.score - a.score || b.kills - a.kills);
    const dm = net.sub === "dm";
    mpEls.boardTitle.textContent = results && rows.length ? "Round over — " + rows[0].name + " wins" : SUB_NAMES[net.sub];
    document.querySelector("#scoreboard th:nth-child(4)").textContent = dm ? "Kills" : "Hits";
    document.querySelector("#scoreboard th:nth-child(5)").textContent = dm ? "Deaths" : "";
    mpEls.boardBody.innerHTML = rows.map((p, i) => {
      const hex = "#" + p.color.toString(16).padStart(6, "0");
      return '<tr class="' + (p.id === net.id ? "me" : "") + '"><td>' + (i + 1) + '</td><td><span class="dot" style="background:' + hex + '"></span>' +
        esc(p.name) + "</td><td>" + p.score + "</td><td>" + p.kills + "</td><td>" + (dm ? p.deaths : "") + "</td></tr>";
    }).join("");
    mpEls.boardFoot.textContent = results ? "Next round in " + Math.max(0, Math.ceil(net.resultsLeft)) + "s" : "";
  }

  let mpUiTimer = 0;
  function mpFrame(dt) {
    updateAvatars(dt);
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
    "perfectBounces", "slides", "padLaunches", "runs", "bhops", "grapples"];
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
  const RUN_LENGTHS = { sa60: 60, sa120: 120 };
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
  function runTopsFor(mode) {
    const list = loadRunTops()[mode];
    return Array.isArray(list) ? list.filter((e) => e && Number.isFinite(e.score)).slice(0, 5) : [];
  }

  function startRun() {
    Object.assign(run, { state: "countdown", mode: SETTINGS.playMode, left: RUN_LENGTHS[SETTINGS.playMode], count: 3,
      shots: 0, shotsHit: 0, hits: 0, best: null, bestClip: null });
    score = 0; scoreEl.textContent = 0;
    streak = 0; streakEl.textContent = 0;
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
      notes: [SETTINGS.unlimitedAmmo ? "unlimited ammo" : "", SETTINGS.realisticAccuracy ? "realistic accuracy" : ""].filter(Boolean) };
    const list = runTopsFor(run.mode);
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const rank = list.indexOf(entry) + 1;
    const tops = loadRunTops();
    tops[run.mode] = list.slice(0, 5);
    try { localStorage.setItem(RUN_KEY, JSON.stringify(tops)); } catch (e) { /* storage blocked */ }
    showResults(entry, rank, tops[run.mode]);
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

  // ---- the mode buttons in the menu ----
  const modeButtons = document.querySelectorAll("#play-modes button");
  function refreshModeUI() {
    modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.playMode === SETTINGS.playMode));
    const note = document.getElementById("mode-note");
    const quit = document.getElementById("run-quit");
    if (!isRunMode()) {
      note.textContent = "Endless: targets keep coming back, play as long as you like.";
      startBtn.textContent = "Click to play";
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
  const tut = { active: false, step: 0, base: null, look: 0, doneTimer: 0, lastHit: null };
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
    { title: "Aim", text: () => "Hold " + keyOf("aim") + " to aim (the sniper scopes in), then hit a target.", done: () => tut.lastHit && tut.lastHit.aimed },
    { title: "Shoot in the air", text: "Hit a target while you're in the air. Every trick multiplies the shot.", done: () => tut.lastHit && tut.lastHit.tags.includes("AIR") },
    { title: "Jump pad", text: "Run onto a glowing jump pad. The purple ones throw you higher.", done: () => tutDelta("padLaunches") >= 1 },
    { title: "Bunnyhop", text: "Jump again the moment you land to keep your speed. Do it twice.", done: () => tutDelta("bhops") >= 2 },
    { title: "Wall bounce", text: () => "Run at a wall, jump, and press " + keyOf("jump") + " again as you reach it. Right on time is a perfect bounce.", done: () => tutDelta("wallBounces") >= 1 },
    { title: "Grapple", text: () => "Aim at a wall, the floor or a target and tap " + keyOf("grapple") + ". A hook flies out and zips you there. Tap " + keyOf("grapple") + " or " + keyOf("jump") + " to let go and keep your speed.", done: () => tutDelta("grapples") >= 1 },
    { title: "Knife", text: () => "Press " + either("knife", "swap") + " for the knife, then " + keyOf("aim") + " to throw it. " + either("gun", "swap") + " takes you back to the gun.", done: () => tutDelta("knifeThrows") >= 1 },
    { title: "Trickshot", text: "Put it together: land a 3x shot. Jump, spin, hit from far away...", done: () => tut.lastHit && tut.lastHit.mult >= 3 },
  ];
  const tutEl = document.getElementById("tutorial");
  function startTutorial() {
    if (runInProgress() || run.state === "done") quitRun();
    tut.active = true; tut.step = 0; tut.doneTimer = 0;
    tutBegin();
    try { localStorage.setItem(TUT_KEY, "started"); } catch (e) { /* ignore */ }
    refreshTutorialUI();
    requestPlay();
  }
  function tutBegin() {
    tut.base = Object.assign({}, stats);
    tut.look = 0; tut.lastHit = null;
    renderTutorial();
  }
  function endTutorial(finished) {
    tut.active = false;
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
      document.getElementById("tut-text").textContent = "The Trickshot list in the menu has every trick and its value. Try Score Attack next.";
      document.getElementById("tut-fill").style.width = "100%";
      tutEl.classList.add("done");
      tut.active = false;
      setTimeout(() => endTutorial(true), 6000);
      try { localStorage.setItem(TUT_KEY, "done"); } catch (e) { /* ignore */ }
      refreshTutorialUI();
      return;
    }
    tutBegin();
  }
  // every frame of play
  function updateTutorial(dt) {
    if (!tut.active) return;
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
      if (k.state !== "flying") continue;
      k.root.getWorldQuaternion(_rq);
      kn.push([r3(k.root.position.x), r3(k.root.position.y), r3(k.root.position.z), r4(_rq.x), r4(_rq.y), r4(_rq.z), r4(_rq.w), r2(k.spin.rotation.x)]);
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
    const clip = { v: 1, snap: snap.s, hitT: r3(p.hitT - t0), meta: p.meta,
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
      replayKnives = [0, 1, 2].map(() => { const k = thrownPool[0].root.clone(true); k.visible = false; scene.add(k); return k; });
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
        playKnifeSwing();
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
          if (ka) { m.position.set(ka[0], ka[1], ka[2]); m.quaternion.set(ka[3], ka[4], ka[5], ka[6]); if (m.children[0]) m.children[0].rotation.x = ka[7]; }
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

  // ---- the buttons that start one ----
  function refreshReplayButtons() {
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
    const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const chunks = [];
    const mr = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6000000 } : undefined);
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      if (audioOut) { try { masterGain.disconnect(audioOut); } catch (e) { /* already gone */ } }
      downloadBlob(new Blob(chunks, { type: "video/webm" }), clipName(replay.clip, ".webm"));
      videoRec = null;
      replayEl.classList.remove("recording");
      flashReplayNote("Saved as a video (.webm).");
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
  document.getElementById("rp-video").addEventListener("click", (e) => { e.currentTarget.blur(); saveReplayVideo(); });
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

    // in a room the world keeps running while the menu is up, so everyone else's view stays correct
    if (pointerLocked || net.active) {
      if ((player.hook || player.grappleWant) && (!pointerLocked || localDead || run.state === "countdown")) releaseHook(0);
      if (pointerLocked && !localDead && run.state !== "countdown") updatePlayer(dt);
      updateProps(dt);
      updateParticles(dt);
      updateTracers(dt);
      updateSmoke(dt);
      clouds.rotation.y += dt * 0.004;
      updateJumpPads(dt);
      updateCasings(dt);
      updateMagDrops(dt);
      updateThrownKnives(dt);
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
      if (autoReloadTimer > 0) { autoReloadTimer -= dt; if (autoReloadTimer <= 0) startReload(); }

      if (fireCooldown > 0) fireCooldown -= dt;

      const w = currentWeapon();
      if (w.auto) { if (mouseHeld) attack(); }
      else if (attackPressed) { attack(); }
      attackPressed = false;

      const speed = Math.hypot(player.velocity.x, player.velocity.z);

      hudTimer -= realDt;
      if (hudTimer <= 0) {
        hudTimer = 0.07;
        speedEl.textContent = speed.toFixed(1);
        speedbarEl.style.width = Math.min(speed / CFG.maxSpeed * 100, 100).toFixed(0) + "%";
        const gReady = player.grappleCooldown <= 0, gUsed = !!player.hook || player.grappleWant;
        grappleFillEl.style.width = (gUsed ? 0 : gReady ? 100 : (1 - player.grappleCooldown / player.grappleCooldownMax) * 100).toFixed(0) + "%";
        grappleFillEl.classList.toggle("cooling", !gReady || gUsed);
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
  setLoadout(SETTINGS.loadout);   // last, once the reload and ammo state it touches exist
  targetsReady = true;
  syncTargetCounts();
  updateAmmoHud();
  animate();
})();
