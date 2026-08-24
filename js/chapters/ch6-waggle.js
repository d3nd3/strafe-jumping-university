// Chapter 6: the community calls this "waggling". Verified here with the
// exact same pmAccelerateSteps/AngleVectorsYaw code as every other chapter --
// aiming a little off your actual destination, and flipping sides
// regularly, reaches a fixed target faster than aiming dead-straight at it.

const CH6W_DT = 0.01;
const CH6W_TARGET_DIST = 900;
const CH6W_START_SPEED = 80; // "just landed, not much speed yet"
const CH6W_TURN_RATE = 500; // deg/s -- how fast you can actually flick a mouse

// Aim straight at the target the whole time, hold forward only. This is the
// "obvious" strategy -- and the one this chapter shows is not the fastest.
function waggleRunStraight() {
  const pos = [0, 0];
  const vel = [CH6W_START_SPEED, 0, 0];
  const path = [[0, 0]];
  let t = 0;
  while (pos[0] < CH6W_TARGET_DIST && t < 12) {
    const wishdir = [1, 0, 0];
    const gen = pmAccelerateSteps(vel, wishdir, pm_maxspeed, 1, CH6W_DT);
    while (!gen.next().done) {}
    pos[0] += vel[0] * CH6W_DT;
    pos[1] += vel[1] * CH6W_DT;
    t += CH6W_DT;
    path.push([...pos]);
  }
  return { time: t, path, topSpeed: VectorLength(vel) };
}

// Aim `amplitudeDeg` off the direct line to the target, flipping which side
// every `periodSec` seconds, strafing toward whichever side you're currently
// aimed at -- the same real technique this app already taught: turning
// keeps re-arming room to speed up (Ch. 5), just now aimed to leave a net
// drift toward a fixed point instead of spinning in place.
function waggleRunOffset(amplitudeDeg, periodSec) {
  const pos = [0, 0];
  const vel = [CH6W_START_SPEED, 0, 0];
  const path = [[0, 0]];
  let yaw = 0;
  let side = 1;
  let sinceFlip = 0;
  let t = 0;
  let topSpeed = CH6W_START_SPEED;
  while (pos[0] < CH6W_TARGET_DIST && t < 12) {
    const bearing = Math.atan2(-pos[1], CH6W_TARGET_DIST - pos[0]);
    sinceFlip += CH6W_DT;
    if (sinceFlip >= periodSec) {
      side = -side;
      sinceFlip = 0;
    }
    const targetYaw = bearing + side * ((amplitudeDeg * Math.PI) / 180);
    const maxStep = ((CH6W_TURN_RATE * Math.PI) / 180) * CH6W_DT;
    let diff = targetYaw - yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yaw += Math.max(-maxStep, Math.min(maxStep, diff));

    const { forward, right } = AngleVectorsYaw(yaw, [0, 0, 0], [0, 0, 0]);
    // Only strafe when actually leaning off-center. Without this, holding a
    // strafe key even at 0° aim offset bakes in its own ~45° wishdir purely
    // from combining forward+side input (Chapter 2's W+D diagonal) -- which
    // would make 0° silently behave like a hidden nonzero offset instead of
    // the true "stare straight, walk straight" baseline it's meant to be.
    const fmove = 400,
      smove = amplitudeDeg > 0.01 ? side * 400 : 0;
    const wishvel = [forward[0] * fmove + right[0] * smove, forward[1] * fmove + right[1] * smove, 0];
    const wishdir = [...wishvel];
    let wishspeed = VectorNormalize(wishdir);
    if (wishspeed > pm_maxspeed) wishspeed = pm_maxspeed;
    const gen = pmAccelerateSteps(vel, wishdir, wishspeed, 1, CH6W_DT);
    while (!gen.next().done) {}

    pos[0] += vel[0] * CH6W_DT;
    pos[1] += vel[1] * CH6W_DT;
    t += CH6W_DT;
    topSpeed = Math.max(topSpeed, VectorLength(vel));
    path.push([pos[0], pos[1], side]);
  }
  return { time: t, path, topSpeed };
}

function mountCh6Waggle(section) {
  const straightBaseline = waggleRunStraight();

  section.innerHTML = `
    <div class="chapter-kicker">Chapter 6 · Aim Off-Target</div>
    <h1>Aiming straight at it is the slow way there</h1>
    <p class="lede">
      Picture this: you're already in the air — mid-flight, a little speed, nobody's jumping or
      landing here. There's a flag up ahead. You hold forward the whole time. The only question is
      which way you point your view while you fly.
    </p>
    <div class="callout">
      <b>What this chapter simulates, exactly:</b> one single, continuous flight through the air
      from a start point to a flag. Not a jump — you're already airborne for the entire thing, the
      same "in the air, boost power is 1" situation as Chapter 4. The only thing that changes below
      is where you point your view as you go.
    </div>

    <p class="muted" style="margin-bottom:4px">Here's exactly what the two sliders below do:</p>
    <ol style="max-width:760px;font-size:15px;line-height:1.8;margin-top:0">
      <li><b>① Aim offset</b> — instead of pointing your view straight at the flag, you point it a
      little to one side of it.</li>
      <li><b>② Switch time</b> — you don't keep pointing that same way forever. Every so often you
      <b>swap sides</b>: your strafe key flips (A becomes D, or D becomes A) <em>and</em> your view
      swings to point the same amount off-center, just now on the other side of the flag. Then, a
      moment later, you swap back. This repeats, left-right-left-right, the whole flight.</li>
    </ol>

    <div class="term-strip">
      <span class="term-chip"><b>aim offset</b> <span class="varname">amplitudeDeg</span> = how far to the side of the flag you point</span>
      <span class="term-chip"><b>switch time</b> <span class="varname">periodSec</span> = how long you point each way before swapping sides</span>
    </div>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 260px">
          <div class="control-row">
            <label><span>① aim offset</span><span id="w-amp-val">20°</span></label>
            <input type="range" id="w-amp" min="0" max="70" step="1" value="20" />
            <p class="muted" style="font-size:12px;margin:2px 0 0">0° = point straight at the flag, never turn. Higher = point further to the side.</p>
          </div>
          <div class="control-row" style="margin-top:14px">
            <label><span>② switch time</span><span id="w-period-val">220ms</span></label>
            <input type="range" id="w-period" min="80" max="400" step="10" value="220" />
            <p class="muted" style="font-size:12px;margin:2px 0 0">How long before you swap: strafe key flips, view swings to the other side.</p>
          </div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">TIME TO FLAG (your aim)</span><span class="v" id="w-time">—</span></div>
            <div class="hud-stat warn"><span class="k">TIME TO FLAG (aimed straight)</span><span class="v">${straightBaseline.time.toFixed(2)}s</span></div>
            <div class="hud-stat"><span class="k">TOP SPEED REACHED</span><span class="v" id="w-topspeed">—</span></div>
          </div>
          <div class="btn-row">
            <button class="btn primary" id="w-snap">Snap to the fastest offset</button>
          </div>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0">Both sliders control everything on this page.</p>
        </div>
        <div class="panel-col" style="flex:1 1 420px">
          <canvas class="scene" id="w-canvas"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#888"></span>aimed straight at the flag</span>
            <span><span class="swatch" style="background:#7dffb0"></span>leaning to one side</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>leaning to the other side</span>
          </div>
          <p class="muted" style="font-size:12.5px;margin-top:6px">Each color change in your path below is one side-switch — count them and you're counting swaps.</p>

          <h2 style="margin-top:28px">Every aim offset, tested</h2>
          <p class="muted">Same flight, run again for every offset from 0° to 70°, switch time held at your slider ②.</p>
          <canvas class="scene" id="w-graph" style="height:280px"></canvas>
        </div>
      </div>
    </div>

    <h2>Why being "wrong" gets you there "right"</h2>
    <div class="callout">
      <strong>Aim offset = 0°</strong> (dead straight) means your target direction never leaves the
      line to the flag. Chapter 4 already showed why that's slow: in the air, boost power is only
      1, and once your speed toward target catches up to 300 there's no room left to gain any
      more. You just... coast at 300 for the whole trip.
    </div>
    <div class="callout">
      <strong>Aim offset too big</strong> and you spend real motion going sideways instead of
      toward the flag — you build huge speed, but too little of it counts toward actually getting
      there.
    </div>
    <div class="callout good">
      <strong>A modest offset, switched regularly,</strong> keeps room to speed up available almost
      the entire trip (exactly Chapter 5's "just right" turning speed, now aimed at a point instead
      of spun in place) while still making steady net progress toward the flag. The community
      calls this <b>waggling</b> — it's a real, documented Quake/SoF technique for crossing gaps
      fast, not a trick unique to this app. Hit "snap to the fastest offset" — the true best is
      often surprisingly small, just a handful of degrees. It doesn't take much to stop coasting.
    </div>

    <a class="next-link" href="#ch6-simulator">Continue → Chapter 7: fly it yourself</a>
  `;

  const canvas = section.querySelector("#w-canvas");
  const scene = createScene(canvas, { originX: 0.18, originY: 0.5, scale: 0.42 });
  const graphCanvas = section.querySelector("#w-graph");
  const gctx = graphCanvas.getContext("2d");

  const ampInput = section.querySelector("#w-amp");
  const periodInput = section.querySelector("#w-period");
  const ampVal = section.querySelector("#w-amp-val");
  const periodVal = section.querySelector("#w-period-val");
  const timeEl = section.querySelector("#w-time");
  const topSpeedEl = section.querySelector("#w-topspeed");
  const snapBtn = section.querySelector("#w-snap");

  let curve = [];
  let bestAmp = 0;

  function resizeGraph() {
    const rect = graphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    graphCanvas.width = rect.width * dpr;
    graphCanvas.height = rect.height * dpr;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function recomputeCurve(periodSec) {
    curve = [];
    for (let amp = 0; amp <= 70; amp += 2) {
      curve.push([amp, waggleRunOffset(amp, periodSec).time]);
    }
    let best = curve[0];
    for (const p of curve) if (p[1] < best[1]) best = p;
    bestAmp = best[0];
  }

  function drawGraph(currentAmp, currentTime) {
    resizeGraph();
    const rect = graphCanvas.getBoundingClientRect();
    const w = rect.width,
      h = rect.height;
    const padL = 50,
      padR = 20,
      padT = 16,
      padB = 30;
    gctx.fillStyle = "#0b0f0c";
    gctx.fillRect(0, 0, w, h);

    const times = curve.map((p) => p[1]).concat([straightBaseline.time, currentTime]);
    const minY = Math.min(...times) - 0.1;
    const maxY = Math.max(...times) + 0.1;
    const xOf = (amp) => padL + (amp / 70) * (w - padL - padR);
    const yOf = (time) => h - padB - ((time - minY) / (maxY - minY)) * (h - padT - padB);

    gctx.font = "11px monospace";
    gctx.fillStyle = "#8fa89a";
    gctx.textAlign = "left";
    gctx.strokeStyle = "rgba(255,255,255,0.2)";
    gctx.beginPath();
    gctx.moveTo(padL, padT);
    gctx.lineTo(padL, h - padB);
    gctx.lineTo(w - padR, h - padB);
    gctx.stroke();
    for (const a of [0, 20, 40, 60]) gctx.fillText(a + "°", xOf(a) - 6, h - padB + 14);
    gctx.textAlign = "center";
    gctx.fillText("→ aim offset", (padL + w - padR) / 2, h - 4);
    gctx.save();
    gctx.translate(12, (padT + h - padB) / 2);
    gctx.rotate(-Math.PI / 2);
    gctx.fillText("time to flag ↑", 0, 0);
    gctx.restore();
    gctx.textAlign = "left";

    // straight-line reference
    gctx.strokeStyle = "rgba(255,107,107,0.6)";
    gctx.setLineDash([4, 4]);
    gctx.beginPath();
    gctx.moveTo(padL, yOf(straightBaseline.time));
    gctx.lineTo(w - padR, yOf(straightBaseline.time));
    gctx.stroke();
    gctx.setLineDash([]);
    gctx.fillStyle = "rgba(255,107,107,0.85)";
    gctx.fillText("aimed straight at it (0°)", padL + 6, yOf(straightBaseline.time) - 6);

    // curve
    gctx.strokeStyle = "#7dffb0";
    gctx.lineWidth = 2;
    gctx.beginPath();
    curve.forEach((p, i) => {
      const x = xOf(p[0]),
        y = yOf(p[1]);
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

    // best marker
    const bestTime = curve.reduce((m, p) => Math.min(m, p[1]), Infinity);
    gctx.fillStyle = "#ffd166";
    gctx.beginPath();
    gctx.arc(xOf(bestAmp), yOf(bestTime), 5, 0, Math.PI * 2);
    gctx.fill();
    gctx.fillText(`best: ${bestAmp}°`, Math.min(xOf(bestAmp) + 8, w - 90), Math.max(yOf(bestTime) - 8, padT + 10));

    // you-are-here
    const cx = xOf(currentAmp),
      cy = yOf(currentTime);
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
    gctx.textAlign = "center";
    gctx.fillStyle = "#eafff2";
    gctx.fillText("you are here", Math.min(Math.max(cx, padL + 45), w - padR - 45), Math.min(cy + 22, h - padB - 4));
    gctx.textAlign = "left";
  }

  // Colors the path by which side you were leaning toward at that instant --
  // this is what "switching sides" actually looks like, not just a phrase.
  function sideColor(side, alpha) {
    return side >= 0 ? `rgba(125,255,176,${alpha})` : `rgba(95,180,255,${alpha})`;
  }

  function drawRace(runResult) {
    scene.clear();
    scene.grid();
    // straight reference path (dashed gray)
    scene.line([0, 0], [CH6W_TARGET_DIST * 0.4, 0], { color: "rgba(255,255,255,0.35)", width: 2, dash: [6, 5] });
    // your path, colored by which side you were leaning toward
    const path = runResult.path;
    for (let i = 1; i < path.length; i++) {
      const t = i / path.length;
      scene.line([path[i - 1][0] * 0.4, path[i - 1][1] * 0.4], [path[i][0] * 0.4, path[i][1] * 0.4], {
        color: sideColor(path[i][2], 0.35 + t * 0.55),
        width: 2.5,
        dash: [],
      });
    }
    scene.point([0, 0], { color: "#fff", label: "start" });
    scene.point([CH6W_TARGET_DIST * 0.4, 0], { color: "#ffd166", label: "flag" });
  }

  function render() {
    const amp = +ampInput.value;
    const periodSec = +periodInput.value / 1000;
    ampVal.textContent = amp + "°";
    periodVal.textContent = periodInput.value + "ms";

    const result = waggleRunOffset(amp, periodSec);
    timeEl.textContent = result.time.toFixed(2) + "s";
    topSpeedEl.textContent = result.topSpeed.toFixed(0);
    drawRace(result);
    drawGraph(amp, result.time);
  }

  ampInput.addEventListener("input", render);
  periodInput.addEventListener("input", () => {
    recomputeCurve(+periodInput.value / 1000);
    render();
  });
  snapBtn.addEventListener("click", () => {
    ampInput.value = bestAmp;
    render();
  });
  window.addEventListener("resize", render);
  scene.setRedraw(render);

  recomputeCurve(+periodInput.value / 1000);
  render();
}
