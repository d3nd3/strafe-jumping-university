// Chapter 12 -- cl_forwardspeed / cl_sidespeed.
//
// This chapter used to be wrong, and wrong in an instructive way. It read
// pmove.c:612-613 ("fmove = pm->cmd.forwardmove") and concluded that the two
// cvars ARE the two movement numbers. They aren't. FOUR steps run between your
// keyboard and Pmove(), and none of them are in the leaked source, because the
// leak has no client and no game DLL. All four were read out of the shipped
// binaries -- see js/core/cmdchain.js for addresses and opcodes.
//
// The old version claimed 150/150 produces a push of 212 with a dead zone
// starting at 300 u/s. Real answer: 150/150 produces a push of 299.8, sitting
// right on the cap, and 150/170 and 400/400 both produce a flat 300. The ratio
// changes the ANGLE and essentially nothing else. That is exactly what players
// report, and it now has a proof instead of a story.

const CVAR_FRAMETIME = 0.01; // 100 ticks/sec, matches every other chapter

const CVAR_PRESETS = [
  { label: "SOF default 200/160", fwd: 200, side: 160 },
  { label: "your config 150/170", fwd: 150, side: 170 },
  { label: "same ratio, doubled 300/340", fwd: 300, side: 340 },
  { label: "widest legal 150/200", fwd: 150, side: 200 },
  { label: "1:1 low 150/150", fwd: 150, side: 150 },
  { label: "1:1 maxed 400/400", fwd: 400, side: 400 },
  { label: "too low 100/100", fwd: 100, side: 100 },
];

// Rows for the "equal ratios are not equal" table.
const CVAR_RATIO_ROWS = [
  { fwd: 150, side: 170 },
  { fwd: 300, side: 340 },
  { fwd: 600, side: 680 },
  { fwd: 1500, side: 1700 },
];

const DEG = 180 / Math.PI;

// The widest key angle you can buy without losing top speed on ANY single input.
// Searched rather than asserted: sweep every (forward, side) pair that still
// reaches pm_maxspeed forward-only, side-only, and with both keys held, and keep
// the one with the largest angle. Comes out at 150/200 -- the point where step
// 2's shrink lands sideways exactly on step 3's 160 trim, with nothing wasted.
const CVAR_BEST = (() => {
  let best = null;
  for (let f = 150; f <= 400; f += 1) {
    for (let s = 150; s <= 600; s += 1) {
      const both = cmdChain(f, s);
      if (both.push < pm_maxspeed - 0.01) continue;
      if (chainSingleAxis(f, "forward") < pm_maxspeed) continue;
      if (chainSingleAxis(s, "side") < pm_maxspeed) continue;
      if (!best || both.keyAngle > best.chain.keyAngle) best = { fwd: f, side: s, chain: both };
    }
  }
  return best;
})();

function cvarFmtDeg(rad) {
  return (rad * DEG).toFixed(2) + "°";
}

function mountChCvars(section) {
  const floor = chainFloorForFullSpeed(true);

  const ratioRows = CVAR_RATIO_ROWS.map((r) => {
    const c = cmdChain(r.fwd, r.side);
    return `<tr>
      <td class="l">${r.fwd} / ${r.side}</td>
      <td>${(r.side / r.fwd).toFixed(3)}</td>
      <td>${c.normalized ? c.normalized.f + " / " + c.normalized.s : "—"}</td>
      <td${c.rotatedByClamp ? ' class="hot"' : ""}>${c.wire.f} / ${c.wire.s}</td>
      <td>${c.cmd.f} / ${c.cmd.s}</td>
      <td class="hot">${c.push.toFixed(1)}</td>
      <td class="hot">${cvarFmtDeg(c.keyAngle)}</td>
    </tr>`;
  }).join("");

  section.innerHTML = `
    <div class="chapter-kicker">Chapter 12 · cl_forwardspeed &amp; cl_sidespeed</div>
    <h1>Your two config numbers only set an angle</h1>
    <p class="lede">
      Typing bigger numbers does nothing. Typing a different <em>ratio</em> does something, but not
      what you'd guess: it doesn't change how hard the game pushes you, it changes
      <b>where your crosshair has to point</b> while it pushes. Here's the proof, here's why
      150/170 is not a lucky guess — and here's the one config that beats it.
    </p>

    <h2>Five things happen to your keys, not one</h2>
    <p class="muted">
      pmove.c only shows the last one. The other four live in the client and the game DLL, which
      aren't in the leaked source at all — they were read out of the shipped binaries.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col" style="flex:1 1 340px;min-width:300px">
          <div class="mono" style="font-size:12px;color:var(--text-dim);margin-bottom:6px">① your keyboard → a command · <span style="color:var(--amber)">CL_BaseMove</span></div>
          ${renderStatic(C_CL_BASEMOVE, CL_BASEMOVE_HIGHLIGHT)}
        </div>
        <div class="panel-col" style="flex:1 1 340px;min-width:300px">
          <div class="mono" style="font-size:12px;color:var(--text-dim);margin-bottom:6px">② the diagonal gets shrunk · <span style="color:var(--amber)">CL_FinishMove</span></div>
          ${renderStatic(C_CMD_NORMALIZE, CMD_NORMALIZE_HIGHLIGHT)}
        </div>
      </div>
      <div class="panel-row" style="margin-top:18px">
        <div class="panel-col" style="flex:1 1 340px;min-width:300px">
          <div class="mono" style="font-size:12px;color:var(--text-dim);margin-bottom:6px">③ each axis gets trimmed · <span style="color:var(--amber)">PAK_WriteDeltaUsercmd</span></div>
          ${renderStatic(C_CMD_CLAMP, CMD_CLAMP_HIGHLIGHT)}
        </div>
        <div class="panel-col" style="flex:1 1 340px;min-width:300px">
          <div class="mono" style="font-size:12px;color:var(--text-dim);margin-bottom:6px">④ running doubles it · <span style="color:var(--amber)">ClientThink</span></div>
          ${renderStatic(C_CLIENT_THINK, CLIENT_THINK_HIGHLIGHT)}
        </div>
      </div>
      <div class="panel-row" style="margin-top:18px">
        <div class="panel-col" style="flex:1 1 340px;min-width:300px">
          <div class="mono" style="font-size:12px;color:var(--text-dim);margin-bottom:6px">⑤ only now does pmove.c see it · <span style="color:var(--amber)">PM_AirMove</span></div>
          ${renderStatic(C_AIR_MOVE, [594, 595, 606, 612, 619, 621, 623, 624])}
        </div>
        <div class="panel-col" style="flex:1 1 340px;min-width:300px">
          <div class="callout" style="margin:0">
            <b>Read those in order once.</b> Step ② shrinks a two-key diagonal so its length is the
            <em>larger</em> of your two numbers instead of the two of them squared and added — SOF's
            fix for "diagonals are faster", and something Quake&nbsp;II never had. Step ③ then trims
            each axis separately at two <em>different</em> limits. Step ④ doubles whatever survived.
            Everything surprising about these two cvars falls out of ② and ③ disagreeing about
            what "too big" means.
          </div>
        </div>
      </div>
    </div>

    <div class="callout">
      <b>Step ② keeps your direction and throws away your size.</b> It divides the pair by its own
      length and multiplies it back up by the larger of the two — so the <em>angle</em> you asked
      for survives exactly, while the <em>length</em> becomes just
      <span class="varname">max(forward, side)</span>. Hold W+D and you get no more push than
      holding W alone. That is the classic diagonal-speed fix, and it only runs when
      <em>both</em> keys are down: strafe with no forward and this step is skipped entirely.
    </div>

    <div class="callout">
      <b>Step ③ is where a ratio can die.</b> Forward is trimmed at <b>200</b>, sideways at
      <b>160</b>. Different limits, applied to each axis on its own — so when this one bites it
      doesn't just shorten your push, it <em>rotates</em> it. The trim is written straight back
      into the client's own stored command, the client's prediction replays that same stored
      command, and the server trims it again on arrival. There is no build, and no cheat, where a
      trimmed number survives.
    </div>

    <div class="callout">
      <b>Step ④ is why nobody noticed any of it.</b> Holding run (or
      <span class="varname">cl_run 1</span>) multiplies both numbers by two, after the trim. That's
      what lifts an ordinary config over the <b>300</b> ceiling in step ⑤ — and once you're over
      it, the size of your numbers stops mattering at all.
    </div>

    <h2>Same ratio, doubled, tripled, tenfold — watch it stop moving</h2>
    <div class="panel">
      <table class="cvar-table mono">
        <thead>
          <tr>
            <td class="l">what you type</td>
            <td>ratio</td>
            <td>shrunk ②</td>
            <td>trimmed ③</td>
            <td>doubled ④</td>
            <td>push strength ⑤</td>
            <td>key angle</td>
          </tr>
        </thead>
        <tbody>${ratioRows}</tbody>
      </table>
    </div>
    <div class="callout good">
      Every row has the identical ratio 1.133. Every row ends at the same push strength,
      <b>300</b>, because everything above 300 is thrown away. But the key angle moves
      <b>${cvarFmtDeg(cmdChain(150, 170).keyAngle)} → ${cvarFmtDeg(cmdChain(300, 340).keyAngle)}</b>
      and then freezes. That is exactly the thing you noticed: <em>higher numbers at the same ratio
      aren't faster, but they do aim differently.</em>
      <br /><br />
      Here's why. Step ② rescales your pair to length <b>max(f, s)</b>, so bigger numbers survive
      step ② proportionally bigger. Once that length passes step ③'s limits, the two axes stop
      being trimmed <em>together</em> — forward can still grow to 200 while sideways is already
      stuck at 160 — and your ratio is dragged toward <b>200/160 = 1.25</b> and parks there
      forever. Type any pair big enough and you are running 200/160 whether you meant to or not.
    </div>

    <h2>The formula</h2>
    <div class="panel">
      <div class="formula">
        write f = cl_forwardspeed, s = cl_sidespeed<br /><br />
        <span style="color:var(--text-dim)">② shrink the diagonal, keeping its direction:</span><br />
        &nbsp;&nbsp;F = f × max(f, s) / √(f² + s²)<br />
        &nbsp;&nbsp;S = s × max(f, s) / √(f² + s²)<br /><br />
        <span style="color:var(--text-dim)">③ trim each axis, ④ double what's left:</span><br />
        &nbsp;&nbsp;F = 2 × min(F, 200)&nbsp;&nbsp;&nbsp;S = 2 × min(S, 160)<br /><br />
        <b>push strength</b> = min( √(F² + S²), 300 )<br />
        <b>key angle</b> = atan2(S, F)
      </div>
      <p class="muted" style="margin-bottom:0">
        Now read what that collapses to. As long as step ③ doesn't bite, step ② leaves the pair at
        length <b>max(f, s)</b> — so push strength is simply
        <b>min( 2 × max(cl_forwardspeed, cl_sidespeed), 300 )</b>, and it is pinned at 300 for any
        config where the larger of your two numbers is <b>150 or more</b>. Every config anyone
        actually plays clears that. The top line becomes a constant. The only thing your two
        numbers still control is the bottom line: the angle — and step ② keeps that
        <em>exactly</em> equal to atan2(cl_sidespeed, cl_forwardspeed), right up until step ③
        starts trimming and drags it back toward 200/160.
      </p>
    </div>

    <h2>What the angle actually is</h2>
    <p class="muted">
      Drag the sliders. Left is a top-down view of one moment mid-jump; right is what your
      crosshair has to do across a whole flight.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 300px">
          <div class="control-row">
            <label><span>cl_forwardspeed</span><span id="cv-fwd-val">150</span></label>
            <input type="range" id="cv-fwd" min="0" max="500" step="5" value="150" />
          </div>
          <div class="control-row">
            <label><span>cl_sidespeed</span><span id="cv-side-val">170</span></label>
            <input type="range" id="cv-side" min="0" max="500" step="5" value="170" />
          </div>
          <div class="control-row">
            <label><span>your current speed</span><span id="cv-speed-val">600</span></label>
            <input type="range" id="cv-speed" min="310" max="1200" step="10" value="600" />
          </div>
          <div class="btn-row" id="cv-presets" style="flex-wrap:wrap"></div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">PUSH STRENGTH (after everything)</span><span class="v" id="cv-push">—</span></div>
            <div class="hud-stat"><span class="k">KEY ANGLE — crosshair to push</span><span class="v" id="cv-key">—</span></div>
            <div class="hud-stat warn"><span class="k">DEAD ANGLE — under this you gain zero</span><span class="v" id="cv-dead">—</span></div>
            <div class="hud-stat warn"><span class="k">BEST ANGLE — aim here</span><span class="v" id="cv-best">—</span></div>
            <div class="hud-stat"><span class="k">SO YOUR CROSSHAIR SITS</span><span class="v" id="cv-off">—</span></div>
            <div class="hud-stat"><span class="k">MARGIN BEFORE YOU GAIN NOTHING</span><span class="v" id="cv-margin">—</span></div>
          </div>
        </div>
        <div class="panel-col" style="flex:1 1 300px;min-width:280px">
          <canvas class="scene" id="cv-dial" style="height:340px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#eafff2"></span>where you're travelling</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>where the keys push</span>
            <span><span class="swatch" style="background:#ffc857"></span>where you're looking</span>
            <span><span class="swatch" style="background:rgba(255,90,90,0.55)"></span>dead cone — push in here, gain nothing</span>
          </div>
        </div>
        <div class="panel-col" style="flex:1 1 300px;min-width:280px">
          <canvas class="scene" id="cv-graph" style="height:340px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#ffc857"></span>your config</span>
            <span><span class="swatch" style="background:rgba(255,255,255,0.35)"></span>200/160 for comparison</span>
          </div>
        </div>
      </div>
    </div>

    <div class="callout good" id="cv-explain">—</div>

    <h2>Why aiming wide is safe and aiming narrow is a cliff</h2>
    <p class="muted">
      The boost function does one of two things depending on your angle, and they fail completely
      differently. Too wide, and you keep the full boost but point it somewhere less useful — you
      lose a few percent. Too narrow, and <span class="varname">addspeed</span> goes negative, the
      function returns on line 3, and you gain <b>exactly zero</b>. Not less. Zero.
    </p>
    <div class="panel">
      <canvas class="scene" id="cv-cliff" style="height:280px"></canvas>
      <div class="legend">
        <span><span class="swatch" style="background:#7dffb0"></span>speed gained this tick</span>
        <span><span class="swatch" style="background:#ffc857"></span>best angle</span>
        <span><span class="swatch" style="background:rgba(255,90,90,0.55)"></span>dead — returns immediately</span>
      </div>
    </div>
    <div class="mystery" id="cv-cliff-note">—</div>

    <h2>So why is sideways-bigger-than-forward genuinely better?</h2>
    <p class="muted">
      Push strength is the same for every sane config, so it can't be about power. It's about where
      the cliff sits relative to your crosshair. Two things fall out of the numbers:
    </p>
    <div class="callout good">
      <b>1. A bigger key angle points your crosshair back toward where you're going.</b>
      The push has to sit near-perpendicular to your travel, and the push is always
      <span class="varname">key angle</span> to the side of your crosshair. So the further to the
      side your keys already push, the less your head has to be turned away from your route to put
      the push where it belongs. You can see the corridor. Your mouse sweep per jump shrinks.
      And every degree of aiming error you do make lands on the safe side of the cliff instead of
      the zero side.
    </div>
    <div class="callout good">
      <b>2. But neither number may drop below 150.</b> Hold one key on its own and step ② is
      skipped — there's no diagonal to shrink — so the raw cvar goes straight into the trim and
      then the doubling. To still reach 300 running straight ahead you need
      <b>2 × cl_forwardspeed ≥ 300</b>, i.e. <span class="varname">cl_forwardspeed ≥ ${floor}</span>,
      and the same floor applies to <span class="varname">cl_sidespeed</span> for strafing with no
      forward key. Go under it and you have quietly capped your own top speed.
    </div>
    <div class="callout" id="cv-optimum">—</div>

    <div class="mystery">
      <b>Careful with the obvious shortcut.</b> It is tempting to say "sideways is trimmed at 160,
      so <span class="varname">cl_sidespeed 170</span> is just a 160." That's only true when you
      strafe with <em>no forward key</em>. Hold both and step ② runs first, shrinking 150/170 to
      112/127 — comfortably under the trim, which then never fires. So 150/170 and 150/160 really
      are different configs, at
      <b>${cvarFmtDeg(cmdChain(150, 170).keyAngle)}</b> and
      <b>${cvarFmtDeg(cmdChain(150, 160).keyAngle)}</b>. The trim only starts eating your ratio
      once <span class="varname">max(f, s)</span> gets big enough to push the shrunk pair back over
      200/160 — which for cl_forwardspeed 150 means a cl_sidespeed above about 200.
    </div>

    <div class="mystery">
      <b>One more limit worth knowing.</b> Your view angle is a 16-bit number covering 360°, so one
      step is 360/65536 = <span class="varname">0.0054931640625°</span> — the exact constant the
      client and the game DLL both multiply by. But the wire only carries the top
      <b>12</b> of those bits (<span class="varname">angle &gt;&gt; 4</span> out,
      <span class="varname">× 16</span> back in), so the finest turn the server can actually be
      told about is <b>0.0879°</b>. Compare that to the margin stat above: at 600 u/s there are
      about four representable angles between "perfect" and "worthless". That is why "aim slightly
      wider than feels right" is universal advice.
    </div>

    <a class="next-link" href="#ch-zigzag">Continue → Chapter 13: flying the zig-zag</a>
  `;

  const fwdInput = section.querySelector("#cv-fwd");
  const sideInput = section.querySelector("#cv-side");
  const speedInput = section.querySelector("#cv-speed");
  const fwdVal = section.querySelector("#cv-fwd-val");
  const sideVal = section.querySelector("#cv-side-val");
  const speedVal = section.querySelector("#cv-speed-val");
  const pushEl = section.querySelector("#cv-push");
  const keyEl = section.querySelector("#cv-key");
  const deadEl = section.querySelector("#cv-dead");
  const bestEl = section.querySelector("#cv-best");
  const offEl = section.querySelector("#cv-off");
  const marginEl = section.querySelector("#cv-margin");
  const explainEl = section.querySelector("#cv-explain");
  const optimumEl = section.querySelector("#cv-optimum");
  const cliffNote = section.querySelector("#cv-cliff-note");
  const presetRow = section.querySelector("#cv-presets");

  const dial = section.querySelector("#cv-dial");
  const graph = section.querySelector("#cv-graph");
  const cliff = section.querySelector("#cv-cliff");

  CVAR_PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = p.label;
    btn.addEventListener("click", () => {
      fwdInput.value = p.fwd;
      sideInput.value = p.side;
      render();
    });
    presetRow.appendChild(btn);
  });

  function fit(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0f0c";
    ctx.fillRect(0, 0, rect.width, rect.height);
    return { ctx, w: rect.width, h: rect.height };
  }

  function arrow(ctx, ox, oy, ang, len, color, label, width) {
    // screen y grows downward; negate so positive angles read as "to the right"
    const dx = Math.cos(-ang) * len;
    const dy = Math.sin(-ang) * len;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width || 2.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + dx, oy + dy);
    ctx.stroke();
    const head = 9;
    const a = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(ox + dx, oy + dy);
    ctx.lineTo(ox + dx - head * Math.cos(a - 0.4), oy + dy - head * Math.sin(a - 0.4));
    ctx.lineTo(ox + dx - head * Math.cos(a + 0.4), oy + dy - head * Math.sin(a + 0.4));
    ctx.closePath();
    ctx.fill();
    if (label) {
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, ox + dx * 1.13, oy + dy * 1.13 + 4);
      ctx.textAlign = "left";
    }
  }

  // Top-down dial: travel points right, everything measured off it.
  function drawDial(m) {
    const { ctx, w, h } = fit(dial);
    const ox = w * 0.28;
    const oy = h * 0.62;
    const R = Math.min(w * 0.6, h * 0.5);

    // dead cone: any push closer to travel than the dead angle gains nothing
    ctx.fillStyle = "rgba(255,90,90,0.16)";
    ctx.strokeStyle = "rgba(255,90,90,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, R, -m.dead, m.dead);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.arc(ox, oy, R, 0, Math.PI * 2);
    ctx.stroke();

    arrow(ctx, ox, oy, 0, R, "#eafff2", "travelling", 3);
    arrow(ctx, ox, oy, m.best, R * 0.92, "#5fb4ff", "push", 3);
    arrow(ctx, ox, oy, m.best - m.key, R * 0.72, "#ffc857", "crosshair", 2.5);

    // the key angle, drawn as the fixed gap between crosshair and push
    ctx.strokeStyle = "rgba(255,200,87,0.6)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(ox, oy, R * 0.5, -m.best, -(m.best - m.key), m.key < 0);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "11px monospace";
    ctx.fillStyle = "#8fa89a";
    ctx.fillText("key angle " + cvarFmtDeg(m.key) + " — fixed by your config", 10, 18);
    ctx.fillStyle = "rgba(255,120,120,0.9)";
    ctx.fillText("dead cone ±" + cvarFmtDeg(m.dead), 10, 34);
    ctx.fillStyle = "#8fa89a";
    ctx.fillText("at " + m.speed.toFixed(0) + " u/s", 10, 50);
  }

  // Crosshair offset from travel, across the speed range.
  function drawGraph(m) {
    const { ctx, w, h } = fit(graph);
    const padL = 42, padR = 12, padT = 16, padB = 30;
    const minV = 310, maxV = 1200;
    const lo = -60, hi = 60;
    const xOf = (v) => padL + ((v - minV) / (maxV - minV)) * (w - padL - padR);
    const yOf = (d) => h - padB - ((d - lo) / (hi - lo)) * (h - padT - padB);

    ctx.font = "11px monospace";
    for (let d = lo; d <= hi; d += 30) {
      const y = yOf(d);
      ctx.strokeStyle = d === 0 ? "rgba(234,255,242,0.4)" : "rgba(255,255,255,0.07)";
      ctx.lineWidth = d === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = "#8fa89a";
      ctx.fillText((d > 0 ? "+" : "") + d + "°", 4, y + 4);
    }
    for (let v = 400; v <= maxV; v += 200) {
      ctx.fillStyle = "#8fa89a";
      ctx.fillText(v, xOf(v) - 14, h - padB + 16);
    }

    const curve = (keyAngle, push, color, width, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      let started = false;
      for (let v = minV; v <= maxV; v += 4) {
        const off = (chainBestAngle(v, push, pm_airaccelerate, CVAR_FRAMETIME) - keyAngle) * DEG;
        const y = yOf(Math.max(lo, Math.min(hi, off)));
        if (!started) { ctx.moveTo(xOf(v), y); started = true; } else ctx.lineTo(xOf(v), y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const ref = cmdChain(200, 160);
    curve(ref.keyAngle, ref.push, "rgba(255,255,255,0.35)", 1.5, [3, 3]);
    curve(m.key, m.push, "#ffc857", 2.5);

    // marker for the speed the dial is showing
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(xOf(m.speed), padT);
    ctx.lineTo(xOf(m.speed), h - padB);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#8fa89a";
    ctx.textAlign = "center";
    ctx.fillText("your speed (u/s) →", (padL + w - padR) / 2, h - 4);
    ctx.save();
    ctx.translate(12, (padT + h - padB) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("crosshair, relative to your route", 0, 0);
    ctx.restore();
    ctx.fillStyle = "rgba(234,255,242,0.6)";
    ctx.fillText("0° = looking exactly where you're going", (padL + w - padR) / 2, yOf(0) - 6);
    ctx.textAlign = "left";
  }

  // Gain vs push-to-travel angle: the cliff, drawn from the real numbers.
  function drawCliff(m) {
    const { ctx, w, h } = fit(cliff);
    const padL = 46, padR = 16, padT = 18, padB = 32;
    const xOf = (deg) => padL + (deg / 90) * (w - padL - padR);

    let peak = 0;
    const pts = [];
    for (let deg = 0; deg <= 90; deg += 0.1) {
      const gsq = chainGainSq(m.speed, m.push, deg / DEG, pm_airaccelerate, CVAR_FRAMETIME);
      // convert speed-squared gain into plain u/s gained this tick
      const g = Math.sqrt(m.speed * m.speed + gsq) - m.speed;
      pts.push([deg, g]);
      if (g > peak) peak = g;
    }
    const yOf = (g) => h - padB - (g / (peak * 1.15 || 1)) * (h - padT - padB);

    ctx.fillStyle = "rgba(255,90,90,0.14)";
    ctx.fillRect(padL, padT, xOf(m.dead * DEG) - padL, h - padT - padB);

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, h - padB);
    ctx.lineTo(w - padR, h - padB);
    ctx.stroke();

    ctx.strokeStyle = "#7dffb0";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach(([deg, g], i) => {
      const x = xOf(deg), y = yOf(g);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = "#ffc857";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(xOf(m.best * DEG), padT);
    ctx.lineTo(xOf(m.best * DEG), h - padB);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "11px monospace";
    ctx.fillStyle = "#8fa89a";
    for (let deg = 0; deg <= 90; deg += 15) {
      ctx.fillText(deg + "°", xOf(deg) - 10, h - padB + 16);
    }
    ctx.textAlign = "center";
    ctx.fillText("angle between your push and your route →", (padL + w - padR) / 2, h - 4);
    ctx.textAlign = "left";
    ctx.fillStyle = "#7dffb0";
    ctx.fillText("peak +" + peak.toFixed(2) + " u/s per tick", padL + 8, padT + 12);
    ctx.fillStyle = "rgba(255,120,120,0.9)";
    ctx.fillText("zero", padL + 8, h - padB - 8);
  }

  function render() {
    const fwd = +fwdInput.value;
    const side = +sideInput.value;
    const speed = +speedInput.value;
    fwdVal.textContent = fwd;
    sideVal.textContent = side;
    speedVal.textContent = speed;

    const chain = cmdChain(fwd, side);
    const push = chain.push;

    if (push <= 0) {
      pushEl.textContent = keyEl.textContent = deadEl.textContent = "—";
      bestEl.textContent = offEl.textContent = marginEl.textContent = "—";
      explainEl.textContent = "Both numbers are zero — no push at all, nothing to show.";
      fit(dial); fit(graph); fit(cliff);
      return;
    }

    const dead = chainDeadAngle(speed, push);
    const best = chainBestAngle(speed, push, pm_airaccelerate, CVAR_FRAMETIME);
    const m = { key: chain.keyAngle, push, speed, dead, best };

    pushEl.textContent = push.toFixed(1) + (chain.atCap ? " (at the cap)" : "");
    keyEl.textContent = cvarFmtDeg(chain.keyAngle);
    deadEl.textContent = cvarFmtDeg(dead);
    bestEl.textContent = cvarFmtDeg(best);

    const off = (best - chain.keyAngle) * DEG;
    offEl.textContent =
      Math.abs(off) < 0.05
        ? "dead ahead"
        : Math.abs(off).toFixed(1) + "° " + (off > 0 ? "outside the turn" : "inside the turn");
    marginEl.textContent = cvarFmtDeg(best - dead);

    const straightAt = chainAimedStraightSpeed(chain.keyAngle, push, pm_airaccelerate, CVAR_FRAMETIME);
    explainEl.innerHTML = `
      ${chain.normalized
        ? `Both keys down, so step ② shrinks <b>${chain.typed.f} / ${chain.typed.s}</b> to
           <b>${chain.normalized.f} / ${chain.normalized.s}</b> — same direction, length cut to
           max(f, s) = <b>${Math.max(chain.typed.f, chain.typed.s)}</b>. `
        : `Only one axis is non-zero, so step ② is skipped entirely. `}
      ${chain.rotatedByClamp
        ? `Step ③ then trims it to <b>${chain.wire.f} / ${chain.wire.s}</b>, which
           <b>rotates your angle</b> — this config is not aiming where you typed. `
        : `Step ③ trims nothing. `}
      Doubled that's <b>${chain.cmd.f} / ${chain.cmd.s}</b>, a push of length
      <b>${chain.rawPush.toFixed(1)}</b>${chain.atCap ? ` — cut down to the <b>300</b> cap` : ` (under the 300 cap, so this config is costing you push strength)`}.
      At ${speed.toFixed(0)} u/s your crosshair needs to sit
      <b>${Math.abs(off).toFixed(1)}° ${off > 0 ? "outside" : "inside"}</b> your route, and it
      would sit dead on your route at
      <b>${straightAt === Infinity ? "no speed at all" : straightAt.toFixed(0) + " u/s"}</b>.`;

    cliffNote.innerHTML = `
      At ${speed.toFixed(0)} u/s the best angle is <b>${cvarFmtDeg(best)}</b> and the cliff is at
      <b>${cvarFmtDeg(dead)}</b>. That is <b>${cvarFmtDeg(best - dead)}</b> of room on the narrow
      side. Miss by that much inward and your gain isn't reduced — it is
      <b>exactly zero</b>, because <span class="varname">addspeed</span> went negative and the
      boost function returned before touching your velocity. Miss by <b>5°</b> outward instead
      and you keep
      <b>${(
        (Math.sqrt(speed * speed + chainGainSq(speed, push, best + 5 / DEG, pm_airaccelerate, CVAR_FRAMETIME)) - speed) /
        (Math.sqrt(speed * speed + chainGainSq(speed, push, best, pm_airaccelerate, CVAR_FRAMETIME)) - speed) * 100
      ).toFixed(0)}%</b> of the gain. Wide is cheap. Narrow is fatal.`;

    const yours = cmdChain(150, 170);
    optimumEl.innerHTML = `
      Put those together and the search is small enough to just run: keep both cvars at
      <b>${floor}</b> or above so every single-key input still reaches 300, then take the widest
      key angle that survives step ③ un-trimmed. The answer is
      <b>cl_forwardspeed ${CVAR_BEST.fwd} / cl_sidespeed ${CVAR_BEST.side}</b> →
      <b>${cvarFmtDeg(CVAR_BEST.chain.keyAngle)}</b>, and it lands on the trim exactly:
      <b>${CVAR_BEST.chain.normalized.f}/${CVAR_BEST.chain.normalized.s}</b> shrunk,
      <b>${CVAR_BEST.chain.cmd.f}/${CVAR_BEST.chain.cmd.s}</b> doubled — a clean 3-4-5 triangle
      of length 400, cut back to the 300 cap. Go wider than that and step ③ starts trimming
      sideways, which rotates you back <em>narrower</em>: 150/250 gives only
      <b>${cvarFmtDeg(cmdChain(150, 250).keyAngle)}</b> and 150/300 only
      <b>${cvarFmtDeg(cmdChain(150, 300).keyAngle)}</b>.
      <br /><br />
      Your 150/170 sits at <b>${cvarFmtDeg(yours.keyAngle)}</b> — already most of the way there,
      and found by feel. ${CVAR_BEST.fwd}/${CVAR_BEST.side} is the same idea pushed to the exact
      edge of what the trim allows.`;

    drawDial(m);
    drawGraph(m);
    drawCliff(m);
  }

  fwdInput.addEventListener("input", render);
  sideInput.addEventListener("input", render);
  speedInput.addEventListener("input", render);
  window.addEventListener("resize", render);
  render();
}
