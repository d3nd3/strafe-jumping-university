// Chapter 7: everything the course taught, in one 3D playground. Reuses the
// exact same physics.js functions as every earlier chapter -- this is not a
// separate "game build", it's the same pmAirMoveSteps/pmAccelerateSteps code
// with a ground, gravity, and a jump button bolted on around it, and a
// third-person camera instead of a top-down one.

const CH7_FRAMETIME = 0.01; // fixed 100 updates/sec, same as Chapter 6
const CH7_GRAVITY = 800; // typical Quake 2 sv_gravity default
const CH7_JUMP_VELOCITY = 270; // pmove.c:868 -- pml.velocity[2] += 270
const CH7_TRAIL_MAX = 260;

// physics.js's vec3 convention is x,y horizontal + z up (matching pmove.c).
// three.js is x,z horizontal + y up. This is the only place that mapping happens.
function toThree(v, out) {
  return out.set(v[0], v[2], v[1]);
}

function mountCh7Playground(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 7 · The Full Picture</div>
    <h1>Try it all, in 3D</h1>
    <p class="lede">Same target direction, same boost function, same turning trick — now with a
    ground, gravity, and a jump, watched from behind in 3D.</p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 260px">
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">SPEED</span><span class="v" id="pg-speed">300</span></div>
            <div class="hud-stat" id="pg-gain-stat"><span class="k">RIGHT NOW</span><span class="v" id="pg-gain">—</span></div>
            <div class="hud-stat"><span class="k">ON GROUND?</span><span class="v" id="pg-ground">yes</span></div>
          </div>
          <div class="control-row">
            <label><span>turning speed</span><span id="pg-turnrate-val">180°/s</span></label>
            <input type="range" id="pg-turnrate" min="30" max="400" step="10" value="180" />
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-dim);margin-top:4px">
            <input type="checkbox" id="pg-vectors" checked style="accent-color:var(--accent)" />
            show direction arrows
          </label>
          <div class="btn-row" style="margin-top:10px">
            <button class="btn" id="pg-reset">⟲ Reset</button>
            <button class="btn primary" id="pg-debug">⏸ Freeze &amp; inspect</button>
          </div>
          <p class="muted" style="font-size:12.5px;margin-top:10px">
            Click the scene, then <b>W/S</b> move, <b>A/D</b> strafe, <b>←/→</b> turn,
            <b>Space</b> jump. Air-strafe by tapping turn while airborne.
          </p>
        </div>
        <div class="panel-col" style="flex:1 1 480px">
          <div id="pg-wrap" tabindex="0" style="position:relative;width:100%;height:480px;border-radius:8px;overflow:hidden;border:1px solid var(--border);cursor:crosshair;outline:none"></div>
          <div class="legend">
            <span><span class="swatch" style="background:#ffd166"></span>forward (view)</span>
            <span><span class="swatch" style="background:#7dffb0"></span>target direction</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>actual motion</span>
          </div>
        </div>
      </div>
    </div>

    <div class="callout">
      This is the exact same <code>pmAirMoveSteps</code> / <code>PM_Accelerate</code> code from
      every earlier chapter. Ground movement adds friction and a boost power of 10; leave the
      ground and it drops to 1, plus gravity — the Chapter 4 split, now under your feet.
    </div>

    <div id="pg-debugger-wrap" style="display:none">
      <h2>Frozen. Here's exactly what just happened.</h2>
      <p class="muted">Real numbers from the instant you paused, including whether you were on the ground or airborne.</p>
      <div class="panel" id="pg-debugger-mount"></div>
      <button class="btn primary" id="pg-resume">▶ Resume</button>
    </div>

    <a class="next-link" href="#ch7-recap">Continue → Chapter 8: recap</a>
  `;

  const wrap = section.querySelector("#pg-wrap");
  const speedEl = section.querySelector("#pg-speed");
  const gainEl = section.querySelector("#pg-gain");
  const gainStat = section.querySelector("#pg-gain-stat");
  const groundEl = section.querySelector("#pg-ground");
  const turnRateInput = section.querySelector("#pg-turnrate");
  const turnRateVal = section.querySelector("#pg-turnrate-val");
  const vectorsToggle = section.querySelector("#pg-vectors");
  const resetBtn = section.querySelector("#pg-reset");
  const debugBtn = section.querySelector("#pg-debug");
  const resumeBtn = section.querySelector("#pg-resume");
  const debuggerWrap = section.querySelector("#pg-debugger-wrap");
  const debuggerMount = section.querySelector("#pg-debugger-mount");

  // ---- three.js scene setup ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f0c);
  scene.fog = new THREE.Fog(0x0b0f0c, 900, 3200);

  const camera = new THREE.PerspectiveCamera(62, 1, 1, 6000);

  scene.add(new THREE.AmbientLight(0x8fa89a, 0.9));
  const sun = new THREE.DirectionalLight(0xeafff2, 0.9);
  sun.position.set(600, 900, 400);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8000, 8000),
    new THREE.MeshStandardMaterial({ color: 0x0e1310, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(8000, 80, 0x2f4a3a, 0x1a251e);
  scene.add(grid);

  // A scattering of simple pillars purely as visual landmarks -- not
  // collidable, just something to judge speed and turning against.
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1c2b22 });
  for (let i = 0; i < 40; i++) {
    const ang = (i / 40) * Math.PI * 2 + i * 0.7;
    const r = 500 + (i % 5) * 260;
    const h = 60 + ((i * 37) % 140);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, h, 8), pillarMat);
    pillar.position.set(Math.cos(ang) * r, h / 2, Math.sin(ang) * r);
    scene.add(pillar);
  }

  // player: a simple capsule-ish body (box + cone "nose") -- legible, cheap.
  const player = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 56, 12),
    new THREE.MeshStandardMaterial({ color: 0x7dffb0, emissive: 0x0c2417 })
  );
  body.position.y = 28;
  player.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(7, 20, 8), new THREE.MeshStandardMaterial({ color: 0xffd166 }));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 40, 16);
  player.add(nose);
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(20, 26, 24),
    new THREE.MeshBasicMaterial({ color: 0x5c6b62, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 1;
  player.add(groundRing);
  scene.add(player);

  // Direction arrows, attached above the player's head. THREE.ArrowHelper's
  // shaft is a 1px line -- most browsers ignore WebGL line width entirely,
  // so it's invisible from any distance. These are built from real geometry
  // (a cylinder shaft + a cone head) so they stay legible in third person.
  function makeArrow(color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1, 8), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(6, 16, 10), mat);
    group.add(shaft, head);
    group.setDir = function (dir) {
      this.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    };
    group.setLen = function (len) {
      const shaftLen = Math.max(1, len - 16);
      shaft.scale.y = shaftLen;
      shaft.position.y = shaftLen / 2;
      head.position.y = shaftLen + 8;
    };
    group.setLen(50);
    return group;
  }
  const arrowForward = makeArrow(0xffd166);
  const arrowTarget = makeArrow(0x7dffb0);
  const arrowVelocity = makeArrow(0x5fb4ff);
  [arrowForward, arrowTarget, arrowVelocity].forEach((a) => scene.add(a));

  // fading trail
  const trailMaxPoints = CH7_TRAIL_MAX;
  const trailGeom = new THREE.BufferGeometry();
  const trailPositions = new Float32Array(trailMaxPoints * 3);
  trailGeom.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
  trailGeom.setDrawRange(0, 0);
  const trailLine = new THREE.Line(trailGeom, new THREE.LineBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.55 }));
  scene.add(trailLine);

  function resizeRenderer() {
    const w = wrap.clientWidth || 1;
    const h = wrap.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resizeRenderer();
  if (window.ResizeObserver) new ResizeObserver(resizeRenderer).observe(wrap);
  window.addEventListener("resize", resizeRenderer);

  // ---- input ----
  const keys = new Set();
  let spaceHeld = false;
  wrap.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
  });
  wrap.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  wrap.addEventListener("click", () => wrap.focus());

  // ---- movement state (vec3 convention: x,y horizontal, z up) ----
  let position, velocity, yaw, grounded, trailPts, camYaw, camPitch;
  let lastFrame = null;
  let paused = false;

  function resetRun() {
    position = [0, 0, 0];
    velocity = [300, 0, 0];
    yaw = 0;
    grounded = true;
    trailPts = [];
    camYaw = 0;
    camPitch = 0.28;
    lastFrame = null;
  }

  function tick() {
    const turnRateDegPerSec = +turnRateInput.value;
    if (keys.has("arrowleft")) yaw += ((turnRateDegPerSec * Math.PI) / 180) * CH7_FRAMETIME;
    if (keys.has("arrowright")) yaw -= ((turnRateDegPerSec * Math.PI) / 180) * CH7_FRAMETIME;

    const spaceNow = keys.has(" ");
    const justJumped = spaceNow && !spaceHeld && grounded;
    spaceHeld = spaceNow;

    if (justJumped) {
      velocity[2] = Math.max(velocity[2] + CH7_JUMP_VELOCITY, CH7_JUMP_VELOCITY);
      grounded = false;
    }

    if (grounded) pmGroundFriction(velocity, CH7_FRAMETIME);

    let fmove = 0,
      smove = 0;
    if (keys.has("w")) fmove += 400;
    if (keys.has("s")) fmove -= 400;
    if (keys.has("d")) smove += 400;
    if (keys.has("a")) smove -= 400;

    const { forward, right } = AngleVectorsYaw(yaw, [0, 0, 0], [0, 0, 0]);
    const wishvel = [forward[0] * fmove + right[0] * smove, forward[1] * fmove + right[1] * smove, 0];
    const wishdir = [...wishvel];
    let wishspeed = VectorNormalize(wishdir);
    if (wishspeed > pm_maxspeed) wishspeed = pm_maxspeed;

    const before = [...velocity];
    const accelUsed = grounded ? pm_accelerate : 1;

    if (grounded) velocity[2] = 0;
    const gen = pmAccelerateSteps(velocity, wishdir, wishspeed, accelUsed, CH7_FRAMETIME);
    let result;
    while (true) {
      const r = gen.next();
      if (r.done) {
        result = r.value;
        break;
      }
    }
    if (!grounded) velocity[2] -= CH7_GRAVITY * CH7_FRAMETIME;

    lastFrame = {
      velocityBefore: before,
      wishdir,
      wishspeed,
      accel: accelUsed,
      frametime: CH7_FRAMETIME,
      addspeed: result.addspeed,
      grounded,
    };

    position = [position[0] + velocity[0] * CH7_FRAMETIME, position[1] + velocity[1] * CH7_FRAMETIME, position[2] + velocity[2] * CH7_FRAMETIME];

    if (position[2] <= 0) {
      position[2] = 0;
      if (velocity[2] < 0) velocity[2] = 0;
      grounded = true;
    } else {
      grounded = false;
    }

    trailPts.push([...position]);
    if (trailPts.length > trailMaxPoints) trailPts.shift();
  }

  const tmpV = new THREE.Vector3();
  const tmpCamTarget = new THREE.Vector3();
  const tmpCamPos = new THREE.Vector3();

  function updateVisuals() {
    toThree(position, tmpV);
    player.position.copy(tmpV);
    player.rotation.y = -yaw + Math.PI / 2;

    const speed = VectorLength(velocity);
    const gaining = lastFrame ? lastFrame.addspeed > 0 : false;
    groundRing.material.color.set(gaining ? 0x7dffb0 : 0x5c6b62);

    const showVectors = vectorsToggle.checked;
    [arrowForward, arrowTarget, arrowVelocity].forEach((a) => (a.visible = showVectors));
    if (showVectors) {
      const headPos = tmpV.clone().add(new THREE.Vector3(0, 66, 0));
      const { forward } = AngleVectorsYaw(yaw, [0, 0, 0], [0, 0, 0]);
      arrowForward.position.copy(headPos);
      arrowForward.setDir(toThree(forward, new THREE.Vector3()));
      arrowForward.setLen(55);

      arrowTarget.position.copy(headPos.clone().add(new THREE.Vector3(0, 20, 0)));
      if (lastFrame && lastFrame.wishspeed > 1) {
        arrowTarget.setDir(toThree(lastFrame.wishdir, new THREE.Vector3()));
        arrowTarget.setLen(45 + (lastFrame.wishspeed / pm_maxspeed) * 45);
        arrowTarget.visible = true;
      } else {
        arrowTarget.visible = false;
      }

      arrowVelocity.position.copy(headPos.clone().add(new THREE.Vector3(0, 40, 0)));
      if (speed > 1) {
        arrowVelocity.setDir(toThree(velocity, new THREE.Vector3()));
        arrowVelocity.setLen(45 + Math.min(1, speed / 500) * 80);
        arrowVelocity.visible = true;
      } else {
        arrowVelocity.visible = false;
      }
    }

    // trail
    for (let i = 0; i < trailPts.length; i++) {
      trailPositions[i * 3] = trailPts[i][0];
      trailPositions[i * 3 + 1] = trailPts[i][2] + 2;
      trailPositions[i * 3 + 2] = trailPts[i][1];
    }
    trailGeom.setDrawRange(0, trailPts.length);
    trailGeom.attributes.position.needsUpdate = true;

    // third-person camera: smoothly settle behind + above the player,
    // looking roughly where they're facing.
    camYaw += (yaw - camYaw) * 0.12;
    const dist = 220;
    const height = 110;
    tmpCamPos.set(tmpV.x - Math.cos(camYaw) * dist, tmpV.y + height, tmpV.z - Math.sin(camYaw) * dist);
    camera.position.lerp(tmpCamPos, 0.18);
    tmpCamTarget.set(tmpV.x, tmpV.y + 50, tmpV.z);
    camera.lookAt(tmpCamTarget);

    speedEl.textContent = speed.toFixed(0);
    if (lastFrame) {
      gainEl.textContent = gaining ? "gaining speed" : "not gaining";
      gainStat.classList.toggle("warn", !gaining);
      groundEl.textContent = lastFrame.grounded ? "yes" : "no";
    }

    renderer.render(scene, camera);
  }

  function loop() {
    if (!paused) {
      tick();
      updateVisuals();
    }
    requestAnimationFrame(loop);
  }

  resetBtn.addEventListener("click", resetRun);
  turnRateInput.addEventListener("input", () => {
    turnRateVal.textContent = turnRateInput.value + "°/s";
  });

  debugBtn.addEventListener("click", () => {
    if (!lastFrame) return;
    paused = true;
    debuggerWrap.style.display = "block";
    debuggerWrap.scrollIntoView({ behavior: "smooth", block: "start" });

    createDebugger({
      mount: debuggerMount,
      title: lastFrame.grounded ? "PM_Accelerate — on the ground (boost 10)" : "PM_Accelerate — in the air (boost 1)",
      cSource: C_ACCELERATE,
      jsSource: JS_ACCELERATE,
      map: ACCELERATE_MAP,
      makeGenerator: () =>
        pmAccelerateSteps([...lastFrame.velocityBefore], lastFrame.wishdir, lastFrame.wishspeed, lastFrame.accel, lastFrame.frametime),
    });
  });

  resumeBtn.addEventListener("click", () => {
    paused = false;
    debuggerWrap.style.display = "none";
  });

  resetRun();
  loop();
}
