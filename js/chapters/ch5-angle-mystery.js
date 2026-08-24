
const CH5_FRAMETIME = 0.01; // 100 ticks/sec, matches a classic sv_fps 100 server

// turnDegPerSec: how fast the view turns, in degrees per second.
function runJump(turnDegPerSec, ticks) {
  const state = { velocity: [300, 0, 0], yaw: 0 };
  const path = [[0, 0]];
  let pos = [0, 0];
  const speeds = [300];
  for (let t = 0; t < ticks; t++) {
    state.yaw += (turnDegPerSec * CH5_FRAMETIME * Math.PI) / 180;
    const cmd = { forwardmove: 400, sidemove: 400 };
    const gen = pmAirMoveSteps(state, cmd, CH5_FRAMETIME);
    while (!gen.next().done) {}
    pos = [pos[0] + state.velocity[0] * CH5_FRAMETIME, pos[1] + state.velocity[1] * CH5_FRAMETIME];
    path.push(pos);
    speeds.push(VectorLength(state.velocity));
  }
  return { finalSpeed: speeds[speeds.length - 1], path, speeds };
}

function sweep(ticks, maxTurn = 1500, step = 15) {
  const pts = [];
  for (let turn = 0; turn <= maxTurn; turn += step) {
    pts.push([turn, runJump(turn, ticks).finalSpeed]);
  }
  return pts;
}

function mountCh5AngleMystery(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 5 · The Angle Mystery</div>
    <h1>There's a "just right" turning speed</h1>
    <p class="lede">
      Hold forward + strafe and keep turning your view: the target direction rotates a little
      each instant, so a little more speed keeps getting added, pointing a little differently
      each time. That's air-strafing. Question: how fast should you turn?
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 260px">
          <div class="control-row">
            <label><span>① how long this jump lasts</span><span id="am-ticks-val">0.50s</span></label>
            <input type="range" id="am-ticks" min="20" max="90" step="5" value="50" />
            <p class="muted" style="font-size:12px;margin:2px 0 0">Real jumps last roughly this long before you land.</p>
          </div>
          <div class="control-row" style="margin-top:14px">
            <label><span>② how fast you turn your view</span><span id="am-turn-val">200°/s</span></label>
            <input type="range" id="am-turn" min="0" max="1500" step="10" value="200" />
            <p class="muted" style="font-size:12px;margin:2px 0 0">0 = never turn. 1500 = spin like a fan.</p>
          </div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">SPEED WHEN YOU LAND</span><span class="v" id="am-final">—</span></div>
            <div class="hud-stat warn"><span class="k">BEST POSSIBLE, THIS JUMP LENGTH</span><span class="v" id="am-best">—</span></div>
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

          <h2 style="margin-top:28px">Same jump, every possible turning speed</h2>
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
      time you're in the air. Jump longer, and a gentler turn wins — that's why the graph's peak
      moves when you drag slider ① (how long the jump lasts).
    </div>

    <a class="next-link" href="#ch6-simulator">Continue → Chapter 6: fly it yourself</a>
  `;

  const canvas = section.querySelector("#am-canvas");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 0.9 });
  const graphCanvas = section.querySelector("#am-graph");
  const gctx = graphCanvas.getContext("2d");

  const ticksInput = section.querySelector("#am-ticks");
  const turnInput = section.querySelector("#am-turn");
  const ticksVal = section.querySelector("#am-ticks-val");
  const turnVal = section.querySelector("#am-turn-val");
  const finalEl = section.querySelector("#am-final");
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
    const ticks = +ticksInput.value;
    curve = sweep(ticks);
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

  function drawJump(turn, ticks) {
    const { finalSpeed, path } = runJump(turn, ticks);

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
    return finalSpeed;
  }

  function render() {
    const turn = +turnInput.value;
    const ticks = +ticksInput.value;
    turnVal.textContent = turn + "°/s";
    ticksVal.textContent = `${(ticks / 100).toFixed(2)}s`;
    const finalSpeed = drawJump(turn, ticks);
    finalEl.textContent = finalSpeed.toFixed(0);
    drawGraph(turn, finalSpeed);
  }

  ticksInput.addEventListener("input", () => {
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
