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
    bhopWindow: 0.12,           // land-and-jump inside this window keeps all speed

    slideBoost: 5.5,
    slideMaxSpeed: 20,
    slideDuration: 0.9,
    slideCooldown: 0.4,
    slideFriction: 0.9,
    slideMinSpeed: 3.2,

    wallCheckDist: 0.85,
    wallPerfectWindow: 0.18,
    wallBounceRestitutionPerfect: 1.10,
    wallBounceRestitutionNormal: 0.74,
    wallBounceUpPerfect: 9.0,
    wallBounceUpNormal: 7.4,
    wallBouncePushOut: 3.0,
    wallBounceCooldown: 0.16,
    wallBounceMaxSpeed: 26,
    wallRideScoreWindow: 1.4,

    baseFov: 78,
    scopedFov: 26,
    scopeSway: 0.0016,          // breathing drift while scoped, radians (0 turns it off)
    speedFovBoost: 12,          // extra FOV at max speed
    adsTime: 0.20,
    baseSensitivity: 0.00073,
    maxMouseDelta: 180,
    accelThreshold: 25,         // px/event where accel reaches ~63% of its range

    maxShootDistance: 250,
    shotForce: 9,
    tracerSpeed: 380,
    tracerLength: 7,

    magSize: 5,
    reloadTime: 2.3,

    arenaHalfSize: 34,
    hitStopScale: 0.55,
    hitStopTime: 0.07,

    // ---- trickscore ----
    basePoints: 100,
    airBonus: 1,
    spinBonusPer360: 1,
    spin180Bonus: 0.5,
    knifeBonus: 2,
    slideBonus: 0.75,
    wallRideBonus: 1,
    movingTargetBonus: 0.75,
    smallTargetBonus: 2,
    noScopeBonus: 1.5,
    noScopeMinDist: 20,
    quickscopeBonus: 1.5,
    quickscopeWindow: 0.55,     // scope-in to shot must be under this
    lastRoundBonus: 1,
    streakBonusPer: 0.25,
    streakBonusCap: 2,
    distanceTiers: [[50, 2, "MEGA SNIPE"], [30, 1, "LONG SHOT"], [15, 0.5, "MID RANGE"]],
    speedTiers: [[19, 2, "SONIC"], [15, 1.25, "BLAZING"], [11, 0.6, "FAST"]],

    targetCount: 15,
    movingTargetFraction: 1 / 3,
    smallTargetFraction: 0.25,
  };

  const SETTINGS = {
    sensX: 1.0, sensY: 1.0, scopedSensMult: 0.35, volume: 0.55,
    unlimitedAmmo: false, mouseAccel: false, accelStrength: 0.7,
  };

  // ======================================================================
  // SCENE
  // ======================================================================
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b7d9);
  scene.fog = new THREE.Fog(0x87b7d9, 40, 120);

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

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
  scene.add(sun);

  // ======================================================================
  // LEVEL
  // ======================================================================
  const groundMeshes = [];
  const wallBoxes = [];

  function addGround(x, y, z, w, d, color, solid) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), new THREE.MeshStandardMaterial({ color }));
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    mesh.userData = { topY: y + 0.25, halfW: w / 2, halfD: d / 2, cx: x, cz: z };
    groundMeshes.push(mesh);
    if (solid) wallBoxes.push(new THREE.Box3().setFromObject(mesh));
  }
  function addWall(x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }));
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    wallBoxes.push(new THREE.Box3().setFromObject(mesh));
  }

  addGround(0, 0, 0, CFG.arenaHalfSize * 2, CFG.arenaHalfSize * 2, 0x6b8f4e);
  const H = CFG.arenaHalfSize;
  addWall(0, 6, -H, H * 2, 12, 1, 0x8899aa);
  addWall(0, 6, H, H * 2, 12, 1, 0x8899aa);
  addWall(-H, 6, 0, 1, 12, H * 2, 0x8899aa);
  addWall(H, 6, 0, 1, 12, H * 2, 0x8899aa);

  addGround(-10, 1.5, -6, 4, 4, 0xc9a24b, true);
  addGround(-4, 2.5, -10, 4, 4, 0xc9a24b, true);
  addGround(2, 3.5, -14, 4, 4, 0xc9a24b, true);
  addGround(9, 2.0, -8, 6, 4, 0xc9a24b, true);

  addWall(16, 4, 4, 1, 8, 12, 0xaa6666);
  addWall(23, 4, 4, 1, 8, 12, 0xaa6666);
  addWall(-16, 4, -16, 3, 8, 3, 0xaa6666);
  addWall(-22, 4, -8, 3, 8, 3, 0xaa6666);
  addWall(-20, 4, 14, 3, 8, 3, 0xaa6666);

  // ======================================================================
  // TARGETS (standard / moving / small)
  // ======================================================================
  const targets = [];
  const ringGeo = new THREE.TorusGeometry(1, 0.15, 10, 20);
  const centerGeo = new THREE.CircleGeometry(0.55, 14);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b });
  const ringMovingMat = new THREE.MeshStandardMaterial({ color: 0xff8c1a });
  const ringSmallMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0a5f70, emissiveIntensity: 0.5 });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });

  const PLAYER_SPAWN = new THREE.Vector3(0, 1.7, 8);

  function randomSpawnPoint(occupied) {
    const lim = CFG.arenaHalfSize - 6;
    for (let a = 0; a < 80; a++) {
      const x = (Math.random() * 2 - 1) * lim;
      const z = (Math.random() * 2 - 1) * lim;
      const y = 1.7 + Math.random() * 7.3;
      if (Math.hypot(x - PLAYER_SPAWN.x, z - PLAYER_SPAWN.z) < 11) continue;
      let ok = true;
      for (const p of occupied) {
        if (Math.hypot(x - p.x, z - p.z) < 7.5 && Math.abs(y - p.y) < 3.5) { ok = false; break; }
      }
      if (ok) return new THREE.Vector3(x, y, z);
    }
    return new THREE.Vector3((Math.random() * 2 - 1) * lim, 2 + Math.random() * 6, -(8 + Math.random() * 18));
  }

  function occupiedPoints(exclude) {
    const pts = [];
    for (const t of targets) if (t !== exclude) pts.push(t.userData.base);
    return pts;
  }

  function assignTargetType(t) {
    const ud = t.userData;
    ud.small = Math.random() < CFG.smallTargetFraction;
    ud.moving = Math.random() < CFG.movingTargetFraction;
    ud.scale = ud.small ? 0.5 : 1;
    t.scale.setScalar(ud.scale);
    ud.hitRadius = 1.1 * ud.scale;

    const ring = t.children[0];
    ring.material = ud.small ? ringSmallMat : (ud.moving ? ringMovingMat : ringMat);

    if (!ud.moving) { ud.vertical = false; return; }
    ud.vertical = Math.random() < 0.5;
    ud.phase = Math.random() * Math.PI * 2;
    ud.speedH = 0.5 + Math.random() * 0.75;
    ud.ampH = 3 + Math.random() * 5;
    ud.speedV = 0.7 + Math.random() * 0.9;
    ud.ampV = 1 + Math.random() * 2.2;
    const ang = Math.random() * Math.PI * 2;
    ud.axisX = Math.cos(ang);
    ud.axisZ = Math.sin(ang);
    const bound = CFG.arenaHalfSize - 3;
    const maxAmp = Math.min(
      Math.abs(ud.axisX) < 0.01 ? 99 : (bound - Math.abs(ud.base.x)) / Math.abs(ud.axisX),
      Math.abs(ud.axisZ) < 0.01 ? 99 : (bound - Math.abs(ud.base.z)) / Math.abs(ud.axisZ)
    );
    ud.ampH = Math.max(1.5, Math.min(ud.ampH, maxAmp));
    ud.ampV = Math.min(ud.ampV, ud.base.y - 1.4);
    if (ud.ampV < 0.4) ud.vertical = false;
  }

  function makeTarget() {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(ringGeo, ringMat), new THREE.Mesh(centerGeo, centerMat));
    group.userData = { idx: targets.length, alive: true, hitRadius: 1.1, base: new THREE.Vector3(), moving: false, vertical: false, small: false, scale: 1 };
    scene.add(group);
    targets.push(group);
    group.userData.base.copy(randomSpawnPoint(occupiedPoints(group)));
    group.position.copy(group.userData.base);
    assignTargetType(group);
    return group;
  }
  for (let i = 0; i < CFG.targetCount; i++) makeTarget();

  function respawnTarget(t) {
    t.userData.base.copy(randomSpawnPoint(occupiedPoints(t)));
    t.position.copy(t.userData.base);
    assignTargetType(t);
    t.userData.alive = true;
    t.visible = true;
  }

  // Everything a remote peer needs to rebuild a target exactly as the host has it.
  function serializeTarget(t) {
    const u = t.userData;
    return {
      b: [u.base.x, u.base.y, u.base.z], s: u.small, m: u.moving, v: u.vertical, a: u.alive,
      ph: u.phase, sh: u.speedH, ah: u.ampH, sv: u.speedV, av: u.ampV, ax: u.axisX, az: u.axisZ,
    };
  }
  function applyTargetData(t, d) {
    const u = t.userData;
    u.base.set(d.b[0], d.b[1], d.b[2]);
    u.small = d.s; u.moving = d.m; u.vertical = d.v;
    u.phase = d.ph; u.speedH = d.sh; u.ampH = d.ah; u.speedV = d.sv; u.ampV = d.av; u.axisX = d.ax; u.axisZ = d.az;
    u.scale = u.small ? 0.5 : 1;
    t.scale.setScalar(u.scale);
    u.hitRadius = 1.1 * u.scale;
    t.children[0].material = u.small ? ringSmallMat : (u.moving ? ringMovingMat : ringMat);
    t.position.copy(u.base);
    u.alive = d.a;
    t.visible = d.a;
  }

  let elapsedTime = 0;
  function updateTargets(dt) {
    elapsedTime += dt;
    // in multiplayer every peer samples the host's clock, so moving targets line up
    const clock = net.active ? mpTargetClock() : elapsedTime;
    for (const t of targets) {
      const ud = t.userData;
      if (!ud.alive) {
        if (net.role === "client") continue;   // the host decides when targets come back
        ud.respawnTimer -= dt;
        if (ud.respawnTimer <= 0) { respawnTarget(t); if (net.role === "host") mpAnnounceSpawn(t); }
        continue;
      }
      t.rotation.y += dt * (ud.small ? 2.4 : 1.5);
      if (!ud.moving) continue;
      const off = Math.cos(clock * ud.speedH + ud.phase) * ud.ampH;
      t.position.x = ud.base.x + off * ud.axisX;
      t.position.z = ud.base.z + off * ud.axisZ;
      if (ud.vertical) t.position.y = ud.base.y + Math.sin(clock * ud.speedV + ud.phase) * ud.ampV;
    }
  }

  // ======================================================================
  // PROPS
  // ======================================================================
  const props = [];
  const propMeshes = [];
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xd2a679 });
  function makeCrate(x, y, z, size) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    props.push({ mesh, half: size / 2, velocity: new THREE.Vector3() });
    propMeshes.push(mesh);
  }
  for (let i = 0; i < 10; i++) {
    makeCrate((Math.random() - 0.5) * 20, 2 + Math.random() * 4, -2 + (Math.random() - 0.5) * 14, 0.8 + Math.random() * 0.6);
  }
  let propsWereMoving = false;
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
    if (moving || propsWereMoving) renderer.shadowMap.needsUpdate = true;
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
  const casingPool = [];
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(casingGeo, brassMat);
    mesh.visible = false; mesh.frustumCulled = false;
    scene.add(mesh);
    casingPool.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), age: 0, bounces: 0, resting: false, active: false });
  }

  function ejectCasing(pos, vel) {
    let c = casingPool.find((k) => !k.active);
    if (!c) c = casingPool.reduce((a, b) => (a.age > b.age ? a : b));   // recycle the oldest
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
        if (c.bounces < 3) playCasingPing(Math.min(-c.vel.y / 6, 1) * (c.bounces ? 0.5 : 1));
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

  // lights up the surroundings for a frame; lives on the camera so it never drops out
  // of the scene (an invisible parent would remove it and force a shader rebuild)
  const muzzleLight = new THREE.PointLight(0xffb060, 0, 10, 2);
  muzzleLight.position.set(0.3, -0.15, -1.6);

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

  rifleGroup.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  knifeGroup.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  camera.add(rifleGroup);
  camera.add(knifeGroup);
  camera.add(muzzleLight);
  knifeGroup.visible = false;

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

  const WEAPONS = {
    rifle: {
      name: "SNIPER", group: rifleGroup,
      restPos: new THREE.Vector3(0.30, -0.30, -0.62),
      restRot: new THREE.Euler(0.03, -0.09, 0.01),
      adsPos: new THREE.Vector3(0.0, -0.118, -0.24),
      adsRot: new THREE.Euler(0, 0, 0),
      canADS: true, fireRate: 0.62, auto: false, isMelee: false,
      usesAmmo: true, inspectDuration: 2.0, inspects: RIFLE_INSPECTS,
    },
    knife: {
      name: "KNIFE", group: knifeGroup,
      restPos: new THREE.Vector3(0.24, -0.24, -0.42),
      restRot: new THREE.Euler(0.06, -0.26, 0.10),
      adsPos: new THREE.Vector3(0.24, -0.24, -0.42),
      adsRot: new THREE.Euler(0.06, -0.26, 0.10),
      canADS: false, fireRate: 0.38, auto: true, isMelee: true,
      usesAmmo: false, range: 3.0, inspectDuration: 1.9, inspects: KNIFE_INSPECTS,
      slashDuration: 0.42,
    },
  };

  const vm = {
    current: "rifle", pending: null,
    switchTimer: 0, switchDuration: 0.44, swapped: true,
    drawTimer: 0.4, drawDuration: 0.4,
    inspectTimer: 0, inspectIndex: 0,
    recoil: 0,
    slashTimer: 0, slashDir: 1,
    bobTimer: 0, adsProgress: 0, wantADS: false, adsStartTime: -99, flashTimer: 0,
    boltTime: -1, boltCues: [], spentCasing: false,
    camKick: 0, camKickYaw: 0,
  };

  function currentWeapon() { return WEAPONS[vm.current]; }

  function switchWeapon(name) {
    if (name === vm.current || vm.switchTimer > 0 || !WEAPONS[name]) return;
    vm.pending = name;
    vm.switchTimer = vm.switchDuration;
    vm.swapped = false;
    vm.inspectTimer = 0;
    vm.wantADS = false;
    cancelReload();
    cancelBoltCycle();
    playSwitchSound();
  }

  function startInspect() {
    if (vm.switchTimer > 0 || vm.inspectTimer > 0 || reload.active || vm.boltTime >= 0) return;
    const w = currentWeapon();
    vm.inspectIndex = Math.floor(Math.random() * w.inspects.length);
    vm.inspectTimer = w.inspectDuration;
    playInspectSound();
  }

  // ---- bolt cycle after each rifle shot (lift, rack back, push home, lock) ----
  const BOLT_CYCLE = 0.52;   // keep under the rifle's fireRate so it never delays the next shot
  const _ejectPos = new THREE.Vector3();
  const _ejectVel = new THREE.Vector3();
  const _camQuat = new THREE.Quaternion();
  const _smokeRight = new THREE.Vector3();

  function startBoltCycle() {
    vm.boltTime = 0;
    vm.boltCues = [[0.10, playBoltLift], [0.18, playBoltBack], [0.25, ejectSpentCasing], [0.31, playBoltForward], [0.44, playBoltLock]];
  }

  function cancelBoltCycle() {
    vm.boltTime = -1;
    vm.boltCues.length = 0;
    boltMesh.position.z = 0.20;
    boltMesh.rotation.z = 0;
  }

  // throw the fired case out of the port to the right, carrying the player's momentum
  function ejectSpentCasing() {
    if (!vm.spentCasing) return;
    vm.spentCasing = false;
    _ejectPos.set(0.06, 0.035, 0.12);
    rifleGroup.localToWorld(_ejectPos);
    camera.getWorldQuaternion(_camQuat);
    _ejectVel.set(2.2 + Math.random() * 0.9, 1.9 + Math.random() * 0.8, 0.5 + Math.random() * 0.5)
      .applyQuaternion(_camQuat).add(player.velocity);
    ejectCasing(_ejectPos, _ejectVel);
    spawnSmoke(_ejectPos, player.velocity.x, 0.3, player.velocity.z, 0.8, 0.04, 0.22, 0.22);
  }

  // blast smoke out the front plus a puff from each side of the muzzle brake;
  // kept faint while scoped so it doesn't cloud the lens
  function muzzleSmoke(pos, dir) {
    const a = 1 - 0.8 * easeInOut(vm.adsProgress);
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

  // Smooth knife arc. Three keyframed segments (rest -> wind-up -> peak -> settle),
  // each eased with easeInOut so the slope is zero at every seam. That makes the
  // whole swing C1-continuous: no corners, no velocity spikes, one flowing motion.
  function slashCurve(t) {
    if (t < 0.28) return -0.32 * easeInOut(t / 0.28);
    if (t < 0.62) return -0.32 + 1.22 * easeInOut((t - 0.28) / 0.34);
    return 0.90 * (1 - easeInOut((t - 0.62) / 0.38));
  }

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
          updateHotbar(); updateAmmoHud();
        }
        holster = 1 - easeInOut(Math.min((elapsed - half) / half, 1));
      }
      if (vm.switchTimer <= 0) { vm.switchTimer = 0; holster = 0; }
    } else if (vm.drawTimer > 0) {
      vm.drawTimer -= dt;
      holster = easeInOut(Math.max(vm.drawTimer, 0) / vm.drawDuration);
    }

    const w = currentWeapon();

    const adsBlocked = vm.switchTimer > 0 || vm.inspectTimer > 0 || reload.active;
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
    const bobScale = (1 - adsEased) * (0.3 + speedFactor);
    const bobX = Math.sin(vm.bobTimer) * 0.012 * bobScale;
    const bobY = Math.abs(Math.sin(vm.bobTimer * 2)) * 0.008 * bobScale;

    vm.recoil *= Math.max(0, 1 - dt * 11);

    // camera punch (gone long before the bolt lets you fire again), plus a slow
    // figure-eight breathing sway while scoped. Both move the real aim, so what
    // the reticle shows is where the shot goes.
    vm.camKick *= Math.max(0, 1 - dt * 10);
    const sway = CFG.scopeSway * adsEased;
    camera.rotation.x = vm.camKick * 0.032 * (1 + 0.6 * adsEased) + Math.sin(elapsedTime * 1.6) * sway;
    camera.rotation.y = vm.camKick * vm.camKickYaw * 0.008 + Math.sin(elapsedTime * 0.8) * sway * 1.3;

    let boltTilt = 0;
    if (vm.boltTime >= 0) {
      vm.boltTime += dt;
      while (vm.boltCues.length && vm.boltTime >= vm.boltCues[0][0]) vm.boltCues.shift()[1]();
      const bt = vm.boltTime;
      const seg = (a, b) => easeInOut(Math.min(Math.max((bt - a) / (b - a), 0), 1));
      boltMesh.rotation.z = (seg(0.10, 0.17) - seg(0.43, 0.50)) * 1.15;
      boltMesh.position.z = 0.20 + (seg(0.18, 0.27) - seg(0.31, 0.41)) * 0.10;
      // roll the rifle a little so you can see the handle work
      boltTilt = Math.sin(Math.PI * Math.min(bt / BOLT_CYCLE, 1)) * (1 - adsEased);
      if (bt >= BOLT_CYCLE) cancelBoltCycle();
    }

    // slash progresses on a timeline rather than decaying
    let slash = 0;
    if (vm.slashTimer > 0) {
      vm.slashTimer -= dt;
      const dur = w.slashDuration || 0.3;
      const t = 1 - Math.max(vm.slashTimer, 0) / dur;
      slash = slashCurve(Math.min(t, 1));
      if (vm.slashTimer <= 0) { vm.slashTimer = 0; slash = 0; }
    }
    const swing = slash * vm.slashDir;

    let ipx = 0, ipy = 0, ipz = 0, irx = 0, iry = 0, irz = 0;
    if (vm.inspectTimer > 0) {
      vm.inspectTimer -= dt;
      const t = 1 - Math.max(vm.inspectTimer, 0) / w.inspectDuration;
      w.inspects[vm.inspectIndex](Math.min(t, 1), _tmpPos, _tmpRot);
      ipx = _tmpPos.x; ipy = _tmpPos.y; ipz = _tmpPos.z;
      irx = _tmpRot.x; iry = _tmpRot.y; irz = _tmpRot.z;
      if (vm.inspectTimer <= 0) { vm.inspectTimer = 0; boltMesh.position.z = 0.20; }
    }

    let rlY = 0, rlX = 0, rlZ = 0;
    if (reload.active) {
      const p = 1 - reload.timer / CFG.reloadTime;
      const arc = Math.sin(Math.PI * p);
      rlY = -0.20 * arc; rlX = 0.55 * arc; rlZ = 0.45 * arc;
      magMesh.position.y = -0.15 - 0.14 * Math.sin(Math.PI * Math.min(p * 1.6, 1));
    } else {
      magMesh.position.y = -0.15;
    }

    const holsterDrop = holster * 0.45;
    const holsterTilt = holster * 1.1;

    w.group.position.set(
      px + bobX + ipx + swing * 0.16,
      py + bobY + ipy - holsterDrop + rlY - Math.abs(slash) * 0.05 - boltTilt * 0.02,
      pz + ipz + vm.recoil * 0.16 - Math.abs(slash) * 0.13
    );
    w.group.rotation.set(
      rx + irx - vm.recoil * 0.34 + holsterTilt + rlX - Math.abs(slash) * 0.45 + boltTilt * 0.05,
      ry + iry + swing * 0.7,
      rz + irz + rlZ + swing * 1.05 + boltTilt * 0.22
    );

    if (vm.flashTimer > 0) {
      vm.flashTimer -= dt;
      muzzleFlash.visible = true;
      flashMat.opacity = Math.max(vm.flashTimer / 0.06, 0);
      muzzleFlash.scale.setScalar(0.9 + Math.random() * 0.8);
      muzzleLight.intensity = 2.4 * Math.max(vm.flashTimer / 0.06, 0);
      if (vm.flashTimer <= 0) { muzzleFlash.visible = false; vm.flashTimer = 0; muzzleLight.intensity = 0; }
    }

    // FOV: scope zoom, plus a speed-driven widening for a sense of momentum
    const speedNow = Math.hypot(player.velocity.x, player.velocity.z);
    const speedT = Math.max(0, Math.min((speedNow - CFG.groundMaxSpeed) / (CFG.maxSpeed - CFG.groundMaxSpeed), 1));
    const speedFov = CFG.speedFovBoost * speedT * (1 - adsEased);
    const targetFov = CFG.baseFov + (CFG.scopedFov - CFG.baseFov) * adsEased + speedFov;
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov += (targetFov - camera.fov) * Math.min(dt * 12, 1);
      camera.updateProjectionMatrix();
    }
    speedlinesEl.style.opacity = Math.max(0, (speedT - 0.35) / 0.65) * 0.85 * (1 - adsEased);

    const scopeAlpha = Math.max(0, (adsEased - 0.55) / 0.45);
    scopeEl.style.opacity = scopeAlpha;
    // the lens closes in from slightly too big as your eye settles behind it
    scopeEl.style.transform = "translate(-50%, -50%) scale(" + (1.2 - 0.2 * scopeAlpha).toFixed(3) + ")";
    scopeLinesEl.style.opacity = scopeAlpha;
    crosshairEl.style.opacity = adsEased > 0.5 ? 0 : 1;
    w.group.visible = scopeAlpha < 0.98;
  }

  function updateHotbar() {
    slotRifle.classList.toggle("active", vm.current === "rifle");
    slotKnife.classList.toggle("active", vm.current === "knife");
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

  // Layered, saturated .50-cal report: a hard supersonic crack, a heavy blast and
  // body, then echoes rolling off into the distance. `scoped` (0..1) pulls the
  // sound in closer: more low end and stock thump, a bit less room.
  function playShotSound(scoped) {
    if (!audioCtx) return;
    const s = scoped || 0;
    const room = 1 - 0.3 * s;
    noiseHit(7000, 0.7, 0.80, 0.022, "highpass", 0, 0.08 * room, false);          // supersonic crack
    noiseHit(3200, 1.2, 0.45, 0.035, "bandpass", 0.001, 0.12 * room, false);      // crack edge
    noiseHit(1700, 0.5, 1.30, 0.080, "lowpass", 0.002, 0.30 * room, true);        // blast front (saturated)
    noiseHit(480, 0.7, 1.15 + 0.25 * s, 0.30, "lowpass", 0.008, 0.50 * room, true); // body
    tone("sine", 105, 28, 1.25 + 0.35 * s, 0.62, 0, 0.28 * room, true);           // sub thump
    tone("triangle", 290, 55, 0.55, 0.22, 0.004, 0.22 * room, true);              // mid punch
    if (s > 0.3) noiseHit(260, 0.8, 0.45 * s, 0.10, "lowpass", 0.003, 0.1, true); // stock into the shoulder
    // rolling echoes: each later, darker and quieter than the last
    let t = rnd(0.10, 0.14);
    const echoes = [[900, 0.34, 0.35], [620, 0.24, 0.45], [430, 0.16, 0.55], [300, 0.10, 0.70]];
    for (const [freq, gain, dur] of echoes) {
      noiseHit(freq, 0.8, gain * room, dur, "lowpass", t, 0.85, false);
      t += rnd(0.16, 0.28);
    }
  }

  function playDryFire() { noiseHit(3000, 6, 0.16, 0.04, "highpass", 0, 0.15); tone("square", 260, 150, 0.06, 0.05, 0, 0.1); }
  function playHitSound(pitch) {
    tone("square", 780 * pitch, 1480 * pitch, 0.16, 0.13, 0, 0.3);
    tone("sine", 1200 * pitch, 2000 * pitch, 0.07, 0.09, 0.01, 0.3);
  }
  function playMissSound() { tone("sine", 300, 120, 0.08, 0.12, 0, 0.2); }
  function playSwitchSound() {
    noiseHit(2600, 3, 0.15, 0.05, "highpass", 0, 0.2);
    noiseHit(1200, 2, 0.12, 0.07, "bandpass", 0.19, 0.25);
  }
  function playInspectSound() { noiseHit(1700, 2, 0.09, 0.09, "bandpass", 0, 0.25); }
  // scoping in: cloth rustle and a zoom-ring slide, then the eye settles with a lens click.
  // scoping out: a shorter slide back down.
  function playScopeSound(inward) {
    if (inward) {
      noiseHit(650, 0.8, 0.05, 0.12, "lowpass", 0, 0.1);
      noiseSweep(900, 2300, 2.2, 0.07, 0.17, "bandpass", 0, 0.12);
      noiseHit(4200, 5, 0.07, 0.025, "highpass", 0.15, 0.12);
      tone("square", 1650, 1450, 0.018, 0.025, 0.15, 0.08);
    } else {
      noiseSweep(2100, 800, 2.2, 0.06, 0.12, "bandpass", 0, 0.12);
      noiseHit(520, 0.8, 0.04, 0.09, "lowpass", 0.02, 0.1);
    }
  }
  function playKnifeSwing() {
    noiseSweep(3400, 480, 1.1, 0.26, 0.22, "bandpass", 0, 0.35);
    noiseSweep(1400, 280, 0.8, 0.12, 0.26, "lowpass", 0.02, 0.3);
  }
  function playKnifeHit() {
    noiseHit(4400, 3.5, 0.28, 0.07, "highpass", 0, 0.4);
    tone("triangle", 1500, 520, 0.12, 0.12, 0, 0.45);
    tone("sine", 250, 85, 0.16, 0.14, 0, 0.3);
  }
  function playWallBounce(perfect) {
    if (perfect) { tone("triangle", 500, 1150, 0.18, 0.16, 0, 0.4); noiseHit(1300, 1.5, 0.16, 0.11, "bandpass", 0, 0.4); }
    else tone("triangle", 320, 200, 0.10, 0.12, 0, 0.3);
  }
  function playSlideStart() {
    noiseSweep(1800, 420, 0.7, 0.30, 0.55, "lowpass", 0, 0.4);
    tone("sine", 180, 90, 0.14, 0.4, 0, 0.35);
  }
  function playSlideScrape() { noiseHit(520, 0.9, 0.07, 0.16, "lowpass", 0, 0.35); }
  function playMagOut() { noiseHit(1600, 3, 0.18, 0.09, "bandpass", 0, 0.3); tone("square", 340, 210, 0.06, 0.08, 0, 0.25); }
  function playMagIn() { noiseHit(900, 2, 0.24, 0.12, "lowpass", 0, 0.35); tone("square", 200, 130, 0.09, 0.11, 0, 0.3); }
  function playBolt() { noiseHit(2800, 3.5, 0.20, 0.07, "highpass", 0, 0.3); noiseHit(1100, 2, 0.16, 0.10, "bandpass", 0.06, 0.35); }
  // bolt cycle between shots: lift, rack back, push home, lock down
  function playBoltLift() { noiseHit(3400, 5, 0.10, 0.03, "highpass", 0, 0.15); tone("square", 1900, 1500, 0.025, 0.025, 0, 0.1); }
  function playBoltBack() {
    noiseSweep(2600, 1300, 2.5, 0.14, 0.09, "bandpass", 0, 0.2);
    noiseHit(1500, 3, 0.20, 0.05, "bandpass", 0.08, 0.25);
    tone("triangle", 620, 420, 0.06, 0.05, 0.08, 0.2);
  }
  function playBoltForward() {
    noiseSweep(1300, 2600, 2.5, 0.12, 0.08, "bandpass", 0, 0.2);
    noiseHit(1900, 3, 0.22, 0.05, "bandpass", 0.075, 0.25);
    tone("triangle", 720, 480, 0.07, 0.05, 0.075, 0.2);
  }
  function playBoltLock() { noiseHit(2600, 4, 0.16, 0.04, "highpass", 0, 0.2); tone("square", 520, 300, 0.05, 0.04, 0, 0.15); }
  // brass landing: a short bright ring
  function playCasingPing(vol) {
    if (vol < 0.05) return;
    const p = rnd(0.92, 1.1);
    tone("sine", 3900 * p, 3850 * p, 0.05 * vol, 0.22, 0, 0.3);
    tone("sine", 6100 * p, 6000 * p, 0.03 * vol, 0.15, 0, 0.3);
    noiseHit(5200, 2, 0.06 * vol, 0.02, "highpass", 0, 0.2);
  }

  // ======================================================================
  // DOM
  // ======================================================================
  const blocker = document.getElementById("blocker");
  const startBtn = document.getElementById("start-btn");
  const settingsPanel = document.getElementById("settings");
  const hud = document.getElementById("hud");
  const domEl = renderer.domElement;

  const crosshairEl = document.getElementById("crosshair");
  const scopeEl = document.getElementById("scope");
  const scopeLinesEl = document.getElementById("scope-lines");
  const speedlinesEl = document.getElementById("speedlines");
  const speedEl = document.getElementById("speed-val");
  const speedbarEl = document.getElementById("speedbar-fill");
  const stateEl = document.getElementById("state-val");
  const streakEl = document.getElementById("streak-val");
  const scoreEl = document.getElementById("score-val");
  const bonusTagsEl = document.getElementById("bonus-tags");
  const feedEl = document.getElementById("feed");
  const slotRifle = document.getElementById("slot-rifle");
  const slotKnife = document.getElementById("slot-knife");
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
  }
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
    ammo = CFG.magSize;
    updateAmmoHud();
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

  function requestPlay() {
    if (uiMode === "mp" && !net.active) return;   // nothing to play until you're in a room
    initAudio();
    domEl.requestPointerLock();
  }
  startBtn.addEventListener("click", requestPlay);
  blocker.addEventListener("click", requestPlay);

  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === domEl;
    blocker.style.display = pointerLocked ? "none" : "flex";
    hud.style.display = pointerLocked ? "block" : "none";
    if (!pointerLocked) { mouseHeld = false; attackPressed = false; vm.wantADS = false; }
    mpRefreshScoreboard();
  });

  document.addEventListener("mousemove", (e) => {
    if (!pointerLocked) return;
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

    const scopeMult = 1 + (SETTINGS.scopedSensMult - 1) * easeInOut(vm.adsProgress);
    const s = CFG.baseSensitivity * scopeMult * accelMult;
    yawObject.rotation.y -= dx * s * SETTINGS.sensX;
    pitchObject.rotation.x -= dy * s * SETTINGS.sensY;
    pitchObject.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitchObject.rotation.x));
  });

  window.addEventListener("keydown", (e) => {
    if (keys[e.code]) return;
    keys[e.code] = true;
    if (e.code === "Tab" && pointerLocked) { e.preventDefault(); mpRefreshScoreboard(); }
    if (!pointerLocked) return;
    if (e.code === "Space") { jumpQueued = true; jumpQueueTimer = 0.12; }
    if (e.code === "KeyF") startInspect();
    if (e.code === "KeyR") startReload();
    if (e.code === "Digit1") switchWeapon("rifle");
    if (e.code === "Digit2") switchWeapon("knife");
    if (e.code === "KeyQ") switchWeapon(vm.current === "rifle" ? "knife" : "rifle");
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; if (e.code === "Tab") mpRefreshScoreboard(); });

  domEl.addEventListener("mousedown", (e) => {
    if (!pointerLocked) return;
    if (e.button === 0) { mouseHeld = true; attackPressed = true; }
    if (e.button === 2) {
      if (currentWeapon().canADS && !vm.wantADS) { playScopeSound(true); vm.adsStartTime = elapsedTime; }
      vm.wantADS = true;
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouseHeld = false;
    if (e.button === 2) {
      if (vm.wantADS && currentWeapon().canADS) playScopeSound(false);
      vm.wantADS = false;
    }
  });
  domEl.addEventListener("contextmenu", (e) => e.preventDefault());
  domEl.addEventListener("wheel", (e) => {
    if (!pointerLocked) return;
    e.preventDefault();
    switchWeapon(vm.current === "rifle" ? "knife" : "rifle");
  }, { passive: false });

  // ======================================================================
  // AMMO / RELOAD
  // ======================================================================
  let ammo = CFG.magSize;
  const reload = { active: false, timer: 0, elapsed: 0, cues: [] };
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
    ammoCountEl.innerHTML = ammo + '<span class="max"> / ' + CFG.magSize + "</span>";
    ammoCountEl.classList.toggle("low", ammo <= 1);
    ammoLabelEl.textContent = reload.active ? "RELOADING" : (ammo === 1 ? "LAST ROUND" : "ROUNDS");
    ammoLabelEl.classList.toggle("reloading", reload.active);
  }

  function cancelReload() {
    if (!reload.active) return;
    reload.active = false; reload.timer = 0;
    reload.cues.length = 0;
    updateAmmoHud();
  }

  function startReload() {
    const w = currentWeapon();
    if (!w.usesAmmo || SETTINGS.unlimitedAmmo) return;
    if (reload.active || ammo >= CFG.magSize || vm.switchTimer > 0) return;
    reload.active = true;
    reload.timer = CFG.reloadTime;
    vm.inspectTimer = 0;
    vm.wantADS = false;
    cancelBoltCycle();
    reload.elapsed = 0;
    reload.cues = [[0.18, playMagOut], [1.15, playMagIn], [1.8, () => { playBolt(); ejectSpentCasing(); }]];
    updateAmmoHud();
  }

  function updateReload(dt) {
    if (!reload.active) return;
    reload.timer -= dt;
    reload.elapsed += dt;
    while (reload.cues.length && reload.elapsed >= reload.cues[0][0]) reload.cues.shift()[1]();
    if (reload.timer <= 0) {
      reload.active = false; reload.timer = 0;
      reload.cues.length = 0;
      ammo = CFG.magSize;
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
    viewRoll: 0,
  };

  // maxTop lets callers ignore surfaces that are too far above the player's feet to step onto
  function currentGroundY(x, z, maxTop) {
    const cap = maxTop === undefined ? Infinity : maxTop;
    let best = -Infinity;
    for (const g of groundMeshes) {
      const ud = g.userData;
      if (Math.abs(x - ud.cx) <= ud.halfW && Math.abs(z - ud.cz) <= ud.halfD && ud.topY > best && ud.topY <= cap) best = ud.topY;
    }
    return best;
  }

  function resolveWalls(pos, feetY) {
    const r = CFG.playerRadius;
    const headY = feetY + CFG.playerHeight;
    for (const box of wallBoxes) {
      if (feetY >= box.max.y - CFG.stepHeight) continue;   // low enough to step up onto / already above
      if (headY <= box.min.y) continue;                    // passing underneath
      const clx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
      const clz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
      const dx = pos.x - clx, dz = pos.z - clz;
      const distSq = dx * dx + dz * dz;
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
    for (const box of wallBoxes) {
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

  function tryWallBounce() {
    if (player.wallBounceCooldown > 0) return false;
    const n = nearestWallNormal(yawObject.position, CFG.wallCheckDist);
    if (!n) return false;

    const perfect = player.wallContactTime >= 0 && player.wallContactTime <= CFG.wallPerfectWindow;
    const restitution = perfect ? CFG.wallBounceRestitutionPerfect : CFG.wallBounceRestitutionNormal;

    const vx = player.velocity.x, vz = player.velocity.z;
    const dot = vx * n.x + vz * n.z;
    let rx = vx, rz = vz;
    if (dot < 0) { rx = vx - 2 * dot * n.x; rz = vz - 2 * dot * n.z; }
    rx = rx * restitution + n.x * CFG.wallBouncePushOut;
    rz = rz * restitution + n.z * CFG.wallBouncePushOut;

    const sp = Math.hypot(rx, rz);
    if (sp > CFG.wallBounceMaxSpeed) {
      const s = CFG.wallBounceMaxSpeed / sp;
      rx *= s; rz *= s;
    }

    player.velocity.x = rx;
    player.velocity.z = rz;
    player.velocity.y = perfect ? CFG.wallBounceUpPerfect : CFG.wallBounceUpNormal;
    player.wallBounceCooldown = CFG.wallBounceCooldown;
    player.wallContactTime = -1;
    player.lastWallBounceAt = elapsedTime;

    playWallBounce(perfect);
    if (perfect) burst(yawObject.position, 0x7CFC00, 5);
    return true;
  }

  function updatePlayer(dt) {
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

    const sprinting = keys["ShiftLeft"] || keys["ShiftRight"];
    const wantsCrouch = keys["ControlLeft"] || keys["ControlRight"];

    _forward.set(-Math.sin(yawObject.rotation.y), 0, -Math.cos(yawObject.rotation.y));
    _right.set(Math.cos(yawObject.rotation.y), 0, -Math.sin(yawObject.rotation.y));

    let moveX = 0, moveZ = 0;
    if (keys["KeyW"]) moveZ += 1;
    if (keys["KeyS"]) moveZ -= 1;
    if (keys["KeyD"]) moveX += 1;
    if (keys["KeyA"]) moveX -= 1;

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
        if (Math.random() < 0.5) playSlideScrape();
      }
    }

    // ---------------- GROUND / AIR ----------------
    if (player.onGround) {
      // bunnyhop: jumping on the same frame you land skips friction entirely,
      // which is what lets a chained hop carry speed instead of bleeding it
      const bhopping = keys["Space"] && (elapsedTime - player.lastLandTime) <= CFG.bhopWindow;

      if (!bhopping) {
        const fric = player.sliding ? CFG.slideFriction : frictionAt(horizSpeed);
        if (horizSpeed > 0.0001) {
          const drop = horizSpeed * fric * dt;
          const scale = Math.max(horizSpeed - drop, 0) / horizSpeed;
          player.velocity.x *= scale; player.velocity.z *= scale;
        }
      }

      if (!player.sliding) {
        accelerate(player.velocity, _wishDir, CFG.groundMaxSpeed * (sprinting ? CFG.sprintMultiplier : 1), CFG.groundAccel, dt);
      } else {
        accelerate(player.velocity, _wishDir, 2.0, 6, dt);
      }

      if (keys["Space"]) {
        player.velocity.y = CFG.jumpSpeed;
        player.onGround = false;
        player.sliding = false;
        jumpQueued = false;
        player.wallContactTime = -1;
      }
    } else {
      accelerate(player.velocity, _wishDir, CFG.airWishSpeedCap, CFG.airAccel, dt);
      const touching = nearestWallNormal(yawObject.position, CFG.wallCheckDist) !== null;
      if (touching) player.wallContactTime = player.wallContactTime < 0 ? 0 : player.wallContactTime + dt;
      else player.wallContactTime = -1;
      if (jumpQueued && tryWallBounce()) { jumpQueued = false; jumpQueueTimer = 0; }
      player.velocity.y -= CFG.gravity * dt;
    }

    clampSpeed();

    // ---------------- INTEGRATE ----------------
    const prevFeet = player.feetY;
    _nextPos.copy(yawObject.position);
    _nextPos.x += player.velocity.x * dt;
    _nextPos.z += player.velocity.z * dt;
    resolveWalls(_nextPos, prevFeet);
    resolveWalls(_nextPos, prevFeet);
    const B = CFG.arenaHalfSize - 0.6;
    _nextPos.x = Math.max(-B, Math.min(B, _nextPos.x));
    _nextPos.z = Math.max(-B, Math.min(B, _nextPos.z));
    yawObject.position.x = _nextPos.x;
    yawObject.position.z = _nextPos.z;
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
      yawObject.position.y = eyeTarget;
      player.feetY = groundY;
      player.velocity.y = 0;
      if (!player.onGround) {
        player.wallContactTime = -1;
        player.lastLandTime = elapsedTime;
      }
      player.onGround = true;
    } else {
      player.onGround = false;
      player.sliding = false;
    }
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
    feedTimer = setTimeout(() => feedEl.classList.remove("show"), 620);
  }
  function showBonusTags(text) {
    bonusTagsEl.textContent = text;
    bonusTagsEl.classList.add("show");
    clearTimeout(bonusTagsTimer);
    bonusTagsTimer = setTimeout(() => bonusTagsEl.classList.remove("show"), 1700);
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

  function computeMultipliers(target, dist, isKnife, ammoBefore) {
    const tags = [];
    let mult = 1;

    if (!player.onGround) { mult += CFG.airBonus; tags.push("AIR"); }

    // spins: full 360s stack, a lone 180 gets a smaller bonus
    const fullSpins = Math.floor(player.airSpinAccum / (Math.PI * 2));
    if (fullSpins >= 1) {
      mult += fullSpins * CFG.spinBonusPer360;
      tags.push(fullSpins * 360 + "\u00B0 SPIN");
    } else if (player.airSpinAccum >= Math.PI) {
      mult += CFG.spin180Bonus;
      tags.push("180\u00B0");
    }

    if (isKnife) {
      mult += CFG.knifeBonus;
      tags.push("KNIFE");
    } else {
      for (const tier of CFG.distanceTiers) {
        if (dist >= tier[0]) { mult += tier[1]; tags.push(tier[2]); break; }
      }
      if (vm.adsProgress < 0.35 && dist >= CFG.noScopeMinDist) {
        mult += CFG.noScopeBonus;
        tags.push("NO-SCOPE");
      } else if (vm.adsProgress >= 0.5 && (elapsedTime - vm.adsStartTime) <= CFG.quickscopeWindow) {
        // scoped in and fired almost immediately
        mult += CFG.quickscopeBonus;
        tags.push("QUICKSCOPE");
      }
      if (ammoBefore === 1 && !SETTINGS.unlimitedAmmo) {
        mult += CFG.lastRoundBonus;
        tags.push("LAST ROUND");
      }
    }

    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    for (const tier of CFG.speedTiers) {
      if (speed >= tier[0]) { mult += tier[1]; tags.push(tier[2]); break; }
    }

    if (player.sliding) { mult += CFG.slideBonus; tags.push("SLIDING"); }

    if (elapsedTime - player.lastWallBounceAt <= CFG.wallRideScoreWindow) {
      mult += CFG.wallRideBonus;
      tags.push("WALL RIDE");
    }

    if (target.userData.small) { mult += CFG.smallTargetBonus; tags.push("PINPOINT"); }
    if (target.userData.moving) {
      mult += CFG.movingTargetBonus;
      tags.push(target.userData.vertical ? "ERRATIC TARGET" : "MOVING TARGET");
    }

    const streakBonus = Math.min(streak * CFG.streakBonusPer, CFG.streakBonusCap);
    if (streakBonus > 0) { mult += streakBonus; tags.push("STREAK x" + (streak + 1)); }

    return { mult, tags };
  }

  // score, streak, HUD popups and feedback for any scoring hit (target or player)
  function awardPoints(res) {
    const pointsGained = Math.round(CFG.basePoints * res.mult);
    score += pointsGained;
    scoreEl.textContent = score;
    streak++;
    streakEl.textContent = streak;

    if (res.tags.length) showBonusTags(res.tags.join("  \u2022  ") + "   (x" + res.mult.toFixed(2) + ")");
    flashCrosshair();
    hitStopTimer = CFG.hitStopTime;
    playHitSound(Math.min(1 + (res.mult - 1) * 0.16, 2.4));
    showFeed("+" + pointsGained + (res.tags.length ? "  x" + res.mult.toFixed(1) : ""));
    return pointsGained;
  }

  function scoreHit(target, dist, isKnife, ammoBefore) {
    const res = computeMultipliers(target, dist, isKnife, ammoBefore);
    target.userData.alive = false;
    target.visible = false;
    burst(target.position, target.userData.small ? 0x22d3ee : 0xffd24a, target.userData.small ? 16 : 12);
    const pointsGained = awardPoints(res);
    target.userData.respawnTimer = 1.1;
    if (net.active) mpTargetHit(target, pointsGained);
  }

  const _muzzleWorld = new THREE.Vector3();
  const _impactPt = new THREE.Vector3();

  function attack() {
    const w = currentWeapon();
    if (fireCooldown > 0 || vm.switchTimer > 0) return;
    if (net.active && (localDead || net.phase !== "play")) return;

    if (w.usesAmmo && !SETTINGS.unlimitedAmmo) {
      if (reload.active) return;
      if (ammo <= 0) { playDryFire(); fireCooldown = 0.25; startReload(); return; }
    } else if (reload.active) {
      cancelReload();
    }

    fireCooldown = w.fireRate;
    vm.inspectTimer = 0;

    camera.getWorldDirection(raycaster.ray.direction);
    raycaster.ray.origin.setFromMatrixPosition(camera.matrixWorld);

    if (w.isMelee) {
      vm.slashTimer = w.slashDuration;
      vm.slashDir = -vm.slashDir;
      playKnifeSwing();
      raycaster.far = w.range;
      const occ = occluderDistance(w.range);
      const res = raycastTargets(w.range);
      if (res.dist >= occ) res.target = null;
      const propHits = raycaster.intersectObjects(activeProps(), false).filter((h) => h.distance < occ);
      const pres = raycastPlayers(w.range);
      if (pres.p && pres.dist < occ) {
        playKnifeHit();
        mpPvpKill(pres, true, ammo);
      } else if (res.target && (!propHits.length || res.dist < propHits[0].distance)) {
        playKnifeHit();
        scoreHit(res.target, res.dist, true, ammo);
      } else if (propHits.length) {
        const prop = props.find((p) => p.mesh === propHits[0].object);
        if (prop) {
          prop.velocity.addScaledVector(raycaster.ray.direction, CFG.shotForce * 1.6);
          prop.velocity.y += 3.5;
        }
        playKnifeHit();
        burst(propHits[0].point, 0xd2a679, 5);
        flashCrosshair();
      }
      return;
    }

    // ---- rifle ----
    const ammoBefore = ammo;
    if (!SETTINGS.unlimitedAmmo) { ammo--; updateAmmoHud(); }
    playShotSound(easeInOut(vm.adsProgress));
    vm.recoil = 1;
    vm.camKick = 1;
    vm.camKickYaw = Math.random() * 2 - 1;
    vm.flashTimer = 0.06;
    muzzleFlash.rotation.z = Math.random() * Math.PI;
    vm.spentCasing = true;
    // an empty mag skips straight to the reload, which works the bolt itself
    if (SETTINGS.unlimitedAmmo || ammo > 0) startBoltCycle();
    raycaster.far = CFG.maxShootDistance;

    const occ = occluderDistance(CFG.maxShootDistance);
    const res = raycastTargets(CFG.maxShootDistance);
    if (res.dist >= occ) res.target = null;
    const propHits = raycaster.intersectObjects(activeProps(), false).filter((h) => h.distance < occ);

    // tracer runs from the muzzle to wherever the shot actually lands
    const pres = raycastPlayers(CFG.maxShootDistance);
    const playerHit = pres.p && pres.dist < occ && (!propHits.length || pres.dist < propHits[0].distance);
    let impactDist = occ;
    if (playerHit) impactDist = pres.dist;
    else if (res.target && (!propHits.length || res.dist < propHits[0].distance)) impactDist = res.dist;
    else if (propHits.length) impactDist = propHits[0].distance;
    muzzleFlash.getWorldPosition(_muzzleWorld);
    spawnTracer(_muzzleWorld, raycaster.ray.direction, impactDist);
    muzzleSmoke(_muzzleWorld, raycaster.ray.direction);
    if (net.active) mpSendShot(_muzzleWorld, raycaster.ray.direction, impactDist);

    if (playerHit) {
      mpPvpKill(pres, false, ammoBefore);
    } else if (res.target && (!propHits.length || res.dist < propHits[0].distance)) {
      scoreHit(res.target, res.dist, false, ammoBefore);
    } else if (propHits.length) {
      const prop = props.find((p) => p.mesh === propHits[0].object);
      if (prop) {
        prop.velocity.addScaledVector(raycaster.ray.direction, CFG.shotForce);
        prop.velocity.y += 2;
      }
      burst(propHits[0].point, 0xd2a679, 5);
      flashCrosshair();
    } else {
      // in deathmatch a streak is broken by dying, not by missing
      if (!(net.active && net.sub === "dm")) { streak = 0; streakEl.textContent = streak; }
      playMissSound();
      if (impactDist < CFG.maxShootDistance) {
        _impactPt.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, impactDist);
        burst(_impactPt, 0xb8c0c8, 4);
      }
    }

    if (!SETTINGS.unlimitedAmmo && ammo <= 0) autoReloadTimer = 0.25;
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

  function setUiMode(mode) {
    if (net.active) return;
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
    g.userData.pivot = headPivot;
    g.userData.gun = gun;
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
    for (const e of list) {
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
    player.airSpinAccum = 0; player.airSpinNet = 0;
  }

  function resetLocalRound() {
    localDead = false;
    mpEls.dead.hidden = true;
    streak = 0; streakEl.textContent = 0;
    score = 0; scoreEl.textContent = 0;
    cancelReload();
    ammo = CFG.magSize;
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
          " <b>" + esc(v ? v.name : "?") + "</b><i>+" + m.pts + (tags ? " " + esc(tags) : "") + "</i>");
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
          cancelReload(); ammo = CFG.magSize; updateAmmoHud();
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
  function mpTargetHit(target, pts) { sendToHost({ t: "hit", i: target.userData.idx, pts }); }

  const _pseudoTarget = { userData: { small: false, moving: false } };
  function mpPvpKill(pres, isKnife, ammoBefore) {
    const res = computeMultipliers(_pseudoTarget, pres.dist, isKnife, ammoBefore);
    if (pres.head && !isKnife) { res.mult += 1; res.tags.push("HEADSHOT"); }
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

  function hostHandle(fromId, m) {
    const p = net.players.get(fromId);
    if (!p || !m || typeof m !== "object") return;
    switch (m.t) {
      case "st":
        if (p.alive && Number.isFinite(m.x + m.y + m.z + m.yaw + m.pitch)) {
          p.x = m.x; p.y = m.y; p.z = m.z; p.yaw = m.yaw; p.pitch = m.pitch; p.w = m.w ? "knife" : "rifle"; p.sl = !!m.sl;
        }
        break;

      case "shot":
        if (p.alive) hostBroadcast({ t: "shot", id: fromId, o: m.o, d: m.d, l: m.l });
        break;

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
  // MAIN LOOP
  // ======================================================================
  const clock = new THREE.Clock();
  let shadowsBaked = false, hudTimer = 0, lastStateText = "";

  function animate() {
    requestAnimationFrame(animate);
    const realDt = Math.min(clock.getDelta(), 0.05);
    let dt = realDt;

    if (hitStopTimer > 0) {
      hitStopTimer -= realDt;
      const k = Math.max(hitStopTimer, 0) / CFG.hitStopTime;
      dt *= CFG.hitStopScale + (1 - CFG.hitStopScale) * (1 - k);
      if (hitStopTimer <= 0) hitStopTimer = 0;
    }

    if (net.active) mpFrame(realDt);

    // in a room the world keeps running while the menu is up, so everyone else's view stays correct
    if (pointerLocked || net.active) {
      if (pointerLocked && !localDead) updatePlayer(dt);
      updateProps(dt);
      updateParticles(dt);
      updateTracers(dt);
      updateSmoke(dt);
      updateCasings(dt);
      updateTargets(net.active ? realDt : dt);
    }

    if (pointerLocked) {
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
        speedbarEl.style.background = speed > 18 ? "#22d3ee" : (speed > 12 ? "#7CFC00" : "#ffd24a");
        const st = player.sliding ? "SLIDING"
          : (!player.onGround ? (player.wallContactTime >= 0 ? "WALL" : "AIR") : "");
        if (st !== lastStateText) { stateEl.textContent = st; lastStateText = st; }
      }

      updateViewmodel(dt, speed > 0.5, keys["ShiftLeft"] || keys["ShiftRight"], player.onGround);
    }

    renderer.render(scene, camera);
    if (!shadowsBaked) { shadowsBaked = true; renderer.shadowMap.needsUpdate = true; }
  }

  player.lastYaw = yawObject.rotation.y;
  updateHotbar();
  updateAmmoHud();
  animate();
})();
