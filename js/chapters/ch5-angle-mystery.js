
const CH5_FRAMETIME = 0.01; // 100 ticks/sec, matches a classic sv_fps 100 server

// Real, confirmed SoF constants -- not tuned for this chapter. CH5_JUMP_VELOCITY
// matches PM_CheckJump's actual retail value (Chapter 9's CH7_JUMP_VELOCITY: a
// flat assignment, decompiled straight out of SoF.exe) and CH5_GRAVITY matches
// Chapter 9's CH7_GRAVITY (typical Quake 2 sv_gravity default). Airtime is no
// longer a slider you set by hand -- it falls out of these two numbers plus how
// far below (or above) your takeoff point you land, exactly like a real jump.
const CH5_JUMP_VELOCITY = 270;
const CH5_GRAVITY = 800;
// v0^2 / (2g): the highest a flat 270 u/s launch can ever climb. Landing any
// higher than this is physically impossible for a single jump, so the slider
// below stays safely under it.
const CH5_APEX_HEIGHT = (CH5_JUMP_VELOCITY * CH5_JUMP_VELOCITY) / (2 * CH5_GRAVITY);

// turnDegPerSec: how fast the view turns, in degrees per second.
// landingHeight: where the ground is, relative to the takeoff point (0 = flat
// ground, negative = dropping off a ledge, positive = landing up on something).
// Vertical motion (liftoff, gravity, landing) is entirely decoupled from the
// horizontal air-strafe math below -- turning never changes how long you're
// airborne, only how fast you're going when you land. That's real physics, not
// a simplification: pmAirMoveSteps only ever touches velocity[0]/[1].
function runJump(turnDegPerSec, landingHeight) {
  const state = { velocity: [pm_maxspeed, 0, CH5_JUMP_VELOCITY], yaw: 0 };
  const path = [[0, 0]];
  let pos = [0, 0];
  let height = 0;
  const speeds = [pm_maxspeed];
  let ticks = 0;
  const MAX_TICKS = 600; // 6s safety cap -- real airtimes here top out around 1.4s
  // landingHeight > 0 means the ground you land on is above your takeoff point --
  // you hit it climbing, on the way up. Anything <= 0 means it's below (or level
  // with) takeoff, so you hit it falling, after the apex. Same trajectory either
  // way; only which crossing counts as "landed" changes.
  const rising = landingHeight > 0;
  for (; ticks < MAX_TICKS; ticks++) {
    state.yaw += (turnDegPerSec * CH5_FRAMETIME * Math.PI) / 180;
    // The largest command the engine can actually be handed: forward trims at
    // 200 and sideways at 160, both doubled by the run bit (js/core/cmdchain.js).
    // Not symmetric, and never was -- this used to say 400/400.
    const cmd = { forwardmove: CMD_MAX_FORWARD, sidemove: CMD_MAX_SIDE };
    const gen = pmAirMoveSteps(state, cmd, CH5_FRAMETIME);
    while (!gen.next().done) {}
    state.velocity[2] -= CH5_GRAVITY * CH5_FRAMETIME; // gravity, same as Chapter 9's airborne branch
    pos = [pos[0] + state.velocity[0] * CH5_FRAMETIME, pos[1] + state.velocity[1] * CH5_FRAMETIME];
    height += state.velocity[2] * CH5_FRAMETIME;
    // PM_SnapPosition's real 16-bit velocity round-trip (physics.js) -- runs
    // after this tick's movement already used the full-float velocity, same
    // order as every other simulator on this site.
    pmSnapVelocity(state.velocity);
    path.push(pos);
    speeds.push(Math.hypot(state.velocity[0], state.velocity[1]));
    if (rising ? height >= landingHeight : height <= landingHeight) break;
  }
  return {
    finalSpeed: speeds[speeds.length - 1],
    airtime: (ticks + 1) * CH5_FRAMETIME,
    path,
    speeds,
  };
}

function sweep(landingHeight, maxTurn = 1500, step = 15) {
  const pts = [];
  for (let turn = 0; turn <= maxTurn; turn += step) {
    pts.push([turn, runJump(turn, landingHeight).finalSpeed]);
  }
  return pts;
}

function describeLanding(h) {
  if (h === 0) return "flat ground — a normal jump";
  if (h < 0) return `dropping ${-h}u before you land — more air time`;
  return `landing ${h}u up from where you jumped — less air time`;
}

function mountCh5AngleMystery(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 7 · The Angle Mystery</div>
    <h1>There's a "just right" turning speed</h1>
    <p class="lede">
      Hold forward + strafe and keep turning your view during a real jump: the target direction
      rotates a little each instant, so a little more speed keeps getting added, pointing a little
      differently each time. That's air-strafing. Question: how fast should you turn?
    </p>

    <div class="callout good">
      <b>This is a real SOF jump, not an arbitrary flight:</b> liftoff at
      <span class="varname">270 u/s</span> vertical — PM_CheckJump's actual, confirmed retail
      value — with gravity at <span class="varname">800 u/s²</span> pulling you back down, the same
      two numbers Chapter 9's 3D playground uses. Airtime isn't a knob you set anymore; it falls
      straight out of that physics, driven by how far below or above your takeoff point you land.
    </div>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 260px">
          <div class="control-row">
            <label><span>① where you land</span><span id="am-land-val">0u</span></label>
            <input type="range" id="am-land" min="-400" max="40" step="10" value="0" />
            <p class="muted" style="font-size:12px;margin:2px 0 0" id="am-land-desc">flat ground — a normal jump</p>
          </div>
          <div class="control-row" style="margin-top:14px">
            <label><span>② how fast you turn your view</span><span id="am-turn-val">200°/s</span></label>
            <input type="range" id="am-turn" min="0" max="1500" step="10" value="200" />
            <p class="muted" style="font-size:12px;margin:2px 0 0">0 = never turn. 1500 = spin like a fan.</p>
          </div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">SPEED WHEN YOU LAND</span><span class="v" id="am-final">—</span></div>
            <div class="hud-stat"><span class="k">AIRBORNE FOR</span><span class="v" id="am-airtime">—</span></div>
            <div class="hud-stat warn"><span class="k">BEST POSSIBLE, THIS LANDING HEIGHT</span><span class="v" id="am-best">—</span></div>
          </div>
          <div class="btn-row">
            <button class="btn primary" id="am-snap">Snap to the best turning speed</button>
          </div>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0">These 2 sliders control everything on this page — both pictures update live as you drag them.</p>
        </div>
        <div class="panel-col" style="flex:1 1 420px">
          <p class="muted" style="margin-top:0">This is the one jump the sliders above describe — watch it change as you drag them.</p>
          <canvas class="scene" id="am-canvas"></canvas>
          <div class="legend"><span><span class="swatch" style="background:#7dffb0"></span>path during this one jump</span></div>

          <h2 style="margin-top:28px">Same landing height, every possible turning speed</h2>
          <p class="muted">
            The dot above only shows the turning speed you picked. This chart runs the
            <b>same jump over again from 0°/s all the way to 1500°/s</b>, and plots the landing
            speed each time — so you can see every option at once, not just one.
          </p>
          <canvas class="scene" id="am-graph" style="height:300px"></canvas>
        </div>
      </div>
    </div>

    <h2>Why "just right" beats both extremes</h2>
    <div class="callout">
      <strong>Turn too slowly</strong> and your target direction barely moves — you catch up to
      your target speed almost right away, and then there's no room left to gain any more for the
      rest of the jump.
    </div>
    <div class="callout">
      <strong>Turn too fast</strong> and the target direction swings past where you're actually
      going. You're spending your boost fighting your own motion instead of building it up.
    </div>
    <div class="callout good">
      <strong>Just right</strong> keeps a little room to speed up available for the <em>whole</em>
      time you're in the air. Drop farther before landing (more air time), and a gentler turn
      wins — that's why the graph's peak moves when you drag slider ① (where you land).
    </div>

    <a class="next-link" href="#ch6-simulator">Continue → Chapter 8: fly it yourself</a>
  `;

  const canvas = section.querySelector("#am-canvas");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 0.55 });
  const graphCanvas = section.querySelector("#am-graph");
  const gctx = graphCanvas.getContext("2d");

  const landInput = section.querySelector("#am-land");
  const turnInput = section.querySelector("#am-turn");
  const landVal = section.querySelector("#am-land-val");
  const landDesc = section.querySelector("#am-land-desc");
  const turnVal = section.querySelector("#am-turn-val");
  const finalEl = section.querySelector("#am-final");
  const airtimeEl = section.querySelector("#am-airtime");
  const bestEl = section.querySelector("#am-best");
  const snapBtn = section.querySelector("#am-snap");

  let curve = [];
  let bestTurn = 0;

  function resizeGraph() {
    const rect = graphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    graphCanvas.width = rect.width * dpr;
    graphCanvas.height = rect.height * dpr;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function recomputeCurve() {
    const landingHeight = +landInput.value;
    curve = sweep(landingHeight);
    let best = curve[0];
    for (const p of curve) if (p[1] > best[1]) best = p;
    bestTurn = best[0];
    bestEl.textContent = best[1].toFixed(0);
  }

  function drawGraph(currentTurn, currentSpeed) {
    resizeGraph();
    const rect = graphCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const padL = 56, padR = 20, padT = 16, padB = 34;
    gctx.fillStyle = "#0b0f0c";
    gctx.fillRect(0, 0, w, h);

    const maxTurn = 1500;
    const ys = curve.map((p) => p[1]);
    const minY = Math.min(300, ...ys) - 5;
    const maxY = Math.max(...ys, currentSpeed) + 10;
    const xOf = (turn) => padL + (turn / maxTurn) * (w - padL - padR);
    const yOf = (speed) => h - padB - ((speed - minY) / (maxY - minY)) * (h - padT - padB);

    gctx.font = "11px monospace";
    gctx.textAlign = "left";

    // axes
    gctx.strokeStyle = "rgba(255,255,255,0.2)";
    gctx.beginPath();
    gctx.moveTo(padL, padT);
    gctx.lineTo(padL, h - padB);
    gctx.lineTo(w - padR, h - padB);
    gctx.stroke();

    // y-axis ticks (landing speed)
    const yStep = maxY - minY > 250 ? 100 : maxY - minY > 100 ? 50 : 20;
    gctx.fillStyle = "#8fa89a";
    gctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let v = Math.ceil(minY / yStep) * yStep; v <= maxY; v += yStep) {
      const y = yOf(v);
      gctx.beginPath();
      gctx.moveTo(padL, y);
      gctx.lineTo(w - padR, y);
      gctx.stroke();
      gctx.fillText(String(v), 6, y + 4);
    }

    // x-axis ticks (turning speed)
    for (let t = 0; t <= maxTurn; t += 300) {
      const x = xOf(t);
      gctx.fillStyle = "#8fa89a";
      gctx.fillText(t + "°/s", x - (t === 0 ? 0 : 14), h - padB + 16);
    }
    gctx.textAlign = "center";
    gctx.fillText("→ turning speed", (padL + w - padR) / 2, h - 4);
    gctx.save();
    gctx.translate(14, (padT + h - padB) / 2);
    gctx.rotate(-Math.PI / 2);
    gctx.fillText("landing speed ↑", 0, 0);
    gctx.restore();
    gctx.textAlign = "left";

    // 300 reference line (your normal running top speed)
    gctx.strokeStyle = "rgba(255,107,107,0.5)";
    gctx.setLineDash([4, 4]);
    gctx.beginPath();
    gctx.moveTo(padL, yOf(300));
    gctx.lineTo(w - padR, yOf(300));
    gctx.stroke();
    gctx.setLineDash([]);
    gctx.fillStyle = "rgba(255,107,107,0.85)";
    gctx.fillText("300 = normal running top speed", padL + 6, yOf(300) - 6);

    // the curve itself, plus a visible dot at every simulated turning speed
    gctx.strokeStyle = "#7dffb0";
    gctx.lineWidth = 2;
    gctx.beginPath();
    curve.forEach((p, i) => {
      const x = xOf(p[0]), y = yOf(p[1]);
      if (i === 0) gctx.moveTo(x, y);
      else gctx.lineTo(x, y);
    });
    gctx.stroke();
    gctx.fillStyle = "#7dffb0";
    curve.forEach((p) => {
      gctx.beginPath();
      gctx.arc(xOf(p[0]), yOf(p[1]), 2, 0, Math.PI * 2);
      gctx.fill();
    });

    // peak marker: the single best turning speed for this jump length
    const bestSpeed = curve.reduce((m, p) => (p[1] > m ? p[1] : m), 0);
    const px = xOf(bestTurn), py = yOf(bestSpeed);
    gctx.fillStyle = "#ffd166";
    gctx.beginPath();
    gctx.arc(px, py, 5, 0, Math.PI * 2);
    gctx.fill();
    gctx.fillStyle = "#ffd166";
    gctx.fillText(`best: ${bestSpeed.toFixed(0)} at ${bestTurn.toFixed(0)}°/s`, Math.min(px + 8, w - 190), Math.max(py - 8, padT + 10));

    // "you are here": exactly matches the SPEED WHEN YOU LAND stat and the
    // jump path drawn above -- same simulated run, not a separate estimate.
    const cx = xOf(currentTurn), cy = yOf(currentSpeed);
    gctx.strokeStyle = "rgba(255,255,255,0.35)";
    gctx.beginPath();
    gctx.moveTo(cx, padT);
    gctx.lineTo(cx, h - padB);
    gctx.stroke();
    gctx.fillStyle = "#eafff2";
    gctx.beginPath();
    gctx.arc(cx, cy, 5, 0, Math.PI * 2);
    gctx.fill();
    gctx.strokeStyle = "#0b0f0c";
    gctx.lineWidth = 2;
    gctx.stroke();
    // drawn below its dot (peak label is above its dot) so the two labels
    // never overlap even when your current setting is close to the best one
    gctx.fillStyle = "#eafff2";
    gctx.textAlign = "center";
    gctx.fillText("you are here", Math.min(Math.max(cx, padL + 50), w - padR - 50), Math.min(cy + 24, h - padB - 4));
    gctx.textAlign = "left";
  }

  function drawJump(turn, landingHeight) {
    const { finalSpeed, airtime, path } = runJump(turn, landingHeight);

    scene.clear();
    scene.grid();
    for (let i = 1; i < path.length; i++) {
      const t = i / path.length;
      scene.line([path[i - 1][0] * 0.4, path[i - 1][1] * 0.4], [path[i][0] * 0.4, path[i][1] * 0.4], {
        color: `rgba(125,255,176,${0.3 + t * 0.6})`,
        width: 2.5,
        dash: [],
      });
    }
    scene.point([path[0][0] * 0.4, path[0][1] * 0.4], { color: "#fff", label: "start" });
    const last = path[path.length - 1];
    scene.point([last[0] * 0.4, last[1] * 0.4], { color: "#7dffb0", label: "landing" });
    return { finalSpeed, airtime };
  }

  function render() {
    const turn = +turnInput.value;
    const landingHeight = +landInput.value;
    turnVal.textContent = turn + "°/s";
    landVal.textContent = (landingHeight > 0 ? "+" : "") + landingHeight + "u";
    landDesc.textContent = describeLanding(landingHeight);
    const { finalSpeed, airtime } = drawJump(turn, landingHeight);
    finalEl.textContent = finalSpeed.toFixed(0);
    airtimeEl.textContent = airtime.toFixed(2) + "s";
    drawGraph(turn, finalSpeed);
  }

  landInput.addEventListener("input", () => {
    recomputeCurve();
    render();
  });
  turnInput.addEventListener("input", render);
  snapBtn.addEventListener("click", () => {
    turnInput.value = bestTurn.toFixed(1);
    render();
  });
  window.addEventListener("resize", render);
  scene.setRedraw(render);

  recomputeCurve();
  render();
}
