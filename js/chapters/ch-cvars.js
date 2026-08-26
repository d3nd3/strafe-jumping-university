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
    <p class="muted">
      Every number in this table is SOF's chain, all five steps. Quake&nbsp;II has no ② and no ③,
      so none of this happens there — the interactive dial below can run either.
    </p>
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
      This is the whole chapter in one picture. It is a top-down view of one moment mid-jump —
      you are the dot, and <b>every angle on it is measured from the direction you are already
      travelling</b>, which is pinned pointing right. Move the sliders to change your config, and
      <b>drag inside the dial to aim your mouse</b>.
    </p>
    <p class="muted">
      By default it runs your two numbers through <b>SOF's</b> five-step chain — the one taken apart
      above. Untick <b>SOF's client chain</b> to push the identical config through <b>stock Quake
      II</b> instead, where steps ② and ③ simply don't exist. Either way the strip underneath the
      dial lists every intermediate value the picture was drawn from, with the steps that didn't run
      struck through.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 290px">
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

          <div class="hud-group">which client processes your keys?</div>
          <label class="checkrow" for="cv-engine">
            <input type="checkbox" id="cv-engine" checked />
            <span>
              <b>SOF's client chain</b>
              <em id="cv-engine-note">steps ② and ③ on: diagonal shrink, then the 200/160 trim</em>
            </span>
          </label>

          <div class="hud-group">where is your mouse pointing?</div>
          <div class="btn-row">
            <button class="btn" id="cv-aim-best">aiming perfectly</button>
            <button class="btn" id="cv-aim-straight">not turning at all</button>
          </div>

          <div class="hud-group">everything your two cvars set</div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">PUSH STRENGTH — length of the blue arrow</span><span class="v" id="cv-push">—</span></div>
            <div class="hud-stat"><span class="k">KEY ANGLE — push, measured from your CROSSHAIR</span><span class="v" id="cv-key">—</span></div>
          </div>
          <div class="hud-group">and nothing else — the rest is speed and mouse</div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat warn"><span class="k">DEAD ANGLE — push nearer your ROUTE than this gains zero</span><span class="v" id="cv-dead">—</span></div>
            <div class="hud-stat warn"><span class="k">BEST ANGLE — put the push here, measured from your ROUTE</span><span class="v" id="cv-best">—</span></div>
            <div class="hud-stat"><span class="k">SO YOUR CROSSHAIR SITS</span><span class="v" id="cv-off">—</span></div>
            <div class="hud-stat"><span class="k">MARGIN BEFORE YOU GAIN NOTHING</span><span class="v" id="cv-margin">—</span></div>
          </div>
        </div>
        <div class="panel-col" style="flex:1 1 440px;min-width:320px">
          <canvas class="scene" id="cv-dial" style="height:500px;touch-action:none;cursor:grab"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#eafff2"></span>travel — where you're already going</span>
            <span><span class="swatch" style="background:#ffc857"></span>crosshair — where you're looking</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>push — where the keys shove you</span>
            <span><span class="swatch" style="background:rgba(255,90,90,0.55)"></span>dead cone — push lands in here, you gain zero</span>
          </div>

          <div class="pipe-head mono">what the dial above is actually drawing</div>
          <div class="pipeline mono" id="cv-pipe"></div>
        </div>
      </div>

      <div class="panel-row" style="margin-top:22px">
        <div class="panel-col" style="flex:1 1 340px;min-width:300px">
          <dl class="glossary">
            <dt style="--gl:#eafff2">travel</dt>
            <dd>The direction your velocity already points. Nothing you type changes it and
              nothing on this dial is measured from anywhere else. It is drawn pointing right and
              it is the <b>0°</b> of every number below.</dd>

            <dt style="--gl:#ffc857">crosshair</dt>
            <dd>Where your mouse is pointing. This is the only thing on the dial <em>you</em>
              control frame to frame. Drag the dial to move it.</dd>

            <dt style="--gl:#5fb4ff">push</dt>
            <dd><span class="varname">wishdir</span> — the direction W+D actually shoves you.
              It is <b>not</b> your crosshair: it sits one <b>key angle</b> to the side of it,
              because <span class="varname">forwardmove</span> runs along your view and
              <span class="varname">sidemove</span> runs across it.</dd>

            <dt style="--gl:#ffc857">key angle</dt>
            <dd><b>atan2(sidemove, forwardmove)</b>, the fixed gap between crosshair and push.
              This — and only this — is what your two cvars buy you. Your mouse rotates the
              crosshair and the push <em>together</em>, like a rigid V; the config sets how far
              open that V is welded.</dd>

            <dt style="--gl:#ff7878">dead cone</dt>
            <dd><b>±acos(push strength / your speed)</b>. Land the push inside it and
              <span class="varname">addspeed</span> is negative, <span class="varname">PM_Accelerate</span>
              returns on its third line, and you gain <b>exactly zero</b>. It widens as you get
              faster, which is why the aim that worked at 400 u/s stops working at 900.</dd>

            <dt style="--gl:#7dffb0">best angle</dt>
            <dd>The first angle <em>outside</em> the cone where you still collect the full
              <span class="varname">accelspeed</span>: <b>acos(push × (1 − accel × frametime) / speed)</b>.
              It sits a hair past the cliff edge — that hair is your entire margin for error.</dd>

            <dt style="--gl:#8fa89a">push strength</dt>
            <dd><span class="varname">wishspeed</span>, the length of the blue arrow, which for
              every sane config is a flat <b>300</b>. It is what makes the dead cone the size it
              is, and it is the number your cvars <em>don't</em> change.</dd>
          </dl>
        </div>
        <div class="panel-col" style="flex:1 1 340px;min-width:300px">
          <canvas class="scene" id="cv-graph" style="height:340px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#ffc857"></span>your config</span>
            <span><span class="swatch" style="background:rgba(255,255,255,0.35)"></span>200/160 for comparison</span>
          </div>
          <p class="muted" style="font-size:13px">
            Same story across a whole flight: how far off your route your crosshair has to sit as
            you speed up. The dial is one vertical slice of this graph.
          </p>
        </div>
      </div>
    </div>

    <div class="callout good" id="cv-explain">—</div>

    <div class="callout">
      <b>What that tick-box actually turns off.</b> Two of the five steps are SOF's own and have no
      Quake&nbsp;II counterpart: step ② (<span class="varname">CL_FinishMove</span>'s diagonal
      shrink, which Q2 never had — diagonals really are faster there) and step ③
      (<span class="varname">PAK_WriteDeltaUsercmd</span>'s 200/160 per-axis trim — Q2 ships
      <span class="varname">MSG_WriteDeltaUsercmd</span>, which writes both as plain shorts and
      clamps nothing; that function is still sitting in the SOF binary with zero callers). Step ④'s
      run doubling exists in both, just in different places — Q2 does it client-side at the end of
      <span class="varname">CL_BaseMove</span>, SOF does it server-side in
      <span class="varname">ClientThink</span>, after the trim.
      <br /><br />
      So under Q2 rules your key angle is <em>exactly</em>
      <span class="varname">atan2(cl_sidespeed, cl_forwardspeed)</span> for every config that ever
      existed, and nothing can rotate it. Under SOF rules that only holds until the trim starts
      biting. Where they agree and where they don't:
      <table class="cvar-table mono" style="margin-top:12px">
        <thead>
          <tr><td class="l">you type</td><td>SOF key angle</td><td>Q2 key angle</td><td class="l">why</td></tr>
        </thead>
        <tbody>
          ${[
            [150, 170, "no trim — the shrink lands it under both caps; the 0.01° is truncation"],
            [150, 200, "no trim — the shrink lands exactly on the 160 cap, nothing to cut"],
            [400, 400, "SOF's trim drags it to 200/160; Q2 keeps your 1:1"],
            [150, 300, "SOF trims sideways hard and rotates you back narrower"],
            [1500, 1700, "SOF has parked at 200/160; Q2 still honours the ratio you typed"],
          ].map(([f, s, why]) => {
            const a = cmdChain(f, s);
            const b = cmdChain(f, s, { engine: "q2" });
            const same = Math.abs(a.keyAngle - b.keyAngle) < 0.005;
            return `<tr>
              <td class="l">${f} / ${s}</td>
              <td class="${same ? "" : "hot"}">${cvarFmtDeg(a.keyAngle)}</td>
              <td class="${same ? "" : "hot"}">${cvarFmtDeg(b.keyAngle)}</td>
              <td class="l" style="color:var(--text-dim);font-size:12px">${why}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <br />
      Note what the last row means: <em>in Quake II, typing bigger numbers at the same ratio really
      does keep your angle.</em> The thing this chapter opened with — that it stops mattering — is
      SOF's trim, and nothing else.
    </div>

    <div class="mystery">
      <b>The one number on this dial your config does <em>not</em> set is the angle between your
      push and your route.</b> Your cvars fix the push relative to your <em>crosshair</em>, and
      nothing more. Try it: set
      <span class="varname">cl_forwardspeed 300</span> /
      <span class="varname">cl_sidespeed 5</span> and the key angle comes out
      <b>${cvarFmtDeg(cmdChain(300, 5).keyAngle)}</b> — hold W+D without touching the mouse and you
      fly dead straight, exactly as you do in game. Now press <b>“not turning at all”</b>. The
      crosshair drops onto your route, the push lands
      <b>${cvarFmtDeg(cmdChain(300, 5).keyAngle)}</b> off it, that is deep inside the red, and the
      meter reads zero. You really are flying straight — and gaining nothing for it.
      <br /><br />
      The wide angle the dial normally draws is not a prediction of what
      <span class="varname">300/5</span> does to you. It is where your <em>mouse</em> would have to
      be for that config to earn anything at all — and with a
      <b>${cvarFmtDeg(cmdChain(300, 5).keyAngle)}</b> key angle, your mouse has to do essentially
      all of the work, dragging your crosshair
      <b>${(
        (chainBestAngle(600, cmdChain(300, 5).push, pm_airaccelerate, CVAR_FRAMETIME) -
          cmdChain(300, 5).keyAngle) * DEG
      ).toFixed(1)}°</b> off your own route at 600 u/s to get the push clear of the cliff. That is
      the cost of a narrow key angle, and it is the whole argument of this chapter.
    </div>

    <div class="mystery">
      <b>Check the direction on the dial — it runs the opposite way to most people's guess.</b>
      Push <span class="varname">cl_forwardspeed</span> far above
      <span class="varname">cl_sidespeed</span> and the key angle <em>shrinks</em>: your keys now
      shove you almost straight down your own crosshair, so the V closes up. But the blue arrow
      still has to clear the red cliff, and the only way to get it there is to rotate the whole V
      — which drags the orange crosshair <b>further away from your route, not closer</b>. At
      500/50 your crosshair ends up
      <b>${(
        (chainBestAngle(600, cmdChain(500, 50).push, pm_airaccelerate, CVAR_FRAMETIME) -
          cmdChain(500, 50).keyAngle) * DEG
      ).toFixed(1)}°</b> off your route at 600 u/s. Do the opposite —
      sideways bigger than forward — and the V opens, so the push reaches past the cliff while
      your crosshair is still nearly on your route: 150/200 needs only
      <b>${(
        (chainBestAngle(600, cmdChain(150, 200).push, pm_airaccelerate, CVAR_FRAMETIME) -
          cmdChain(150, 200).keyAngle) * DEG
      ).toFixed(1)}°</b>. The orange arrow goes to 0° by turning
      <span class="varname">cl_sidespeed</span> up, not <span class="varname">cl_forwardspeed</span>.
    </div>

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
  const aimBestBtn = section.querySelector("#cv-aim-best");
  const aimStraightBtn = section.querySelector("#cv-aim-straight");
  const engineInput = section.querySelector("#cv-engine");
  const engineNote = section.querySelector("#cv-engine-note");
  const pipeEl = section.querySelector("#cv-pipe");

  // Which client is chewing on your two numbers. Everything interactive in this
  // chapter reads this, so a reader can never be unsure which chain a picture is
  // drawing -- it is on the checkbox, on the dial, and in the strip underneath.
  const engineOpts = () => ({ engine: engineInput.checked ? "sof" : "q2" });

  // Where the mouse is pointing. This is deliberately NOT something the cvars
  // decide -- the single most common misreading of this dial is taking the
  // push-to-travel angle as a prediction of the config, when it is a prediction
  // of your aim. Three modes:
  //
  //   "best"     crosshair wherever the push earns the most (the useful case)
  //   "straight" crosshair on your route, i.e. you never touch the mouse --
  //              which is what "cl_forwardspeed 300 / cl_sidespeed 5 flies
  //              straight" actually looks like, and it gains nothing
  //   "drag"     wherever the reader dragged it, kept across slider changes so
  //              you can watch the push swing in and out of the cone
  let aimMode = "best";
  let aimDragged = 0;

  function aimFor(best, keyAngle) {
    if (aimMode === "straight") return 0;
    if (aimMode === "drag") return aimDragged;
    return best - keyAngle;
  }

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

  // ---- dial geometry helpers -------------------------------------------------
  // Angles below are all WORLD angles measured from travel, positive towards the
  // side your keys push. Screen y grows downward, so a world angle t is drawn at
  // canvas angle -t; every arc call negates and swaps its endpoints for that.
  const dialGeom = { ox: 0, oy: 0, R: 1 };

  function polar(ox, oy, r, t) {
    return [ox + Math.cos(-t) * r, oy + Math.sin(-t) * r];
  }

  function wedge(ctx, ox, oy, r0, r1, t1, t2, fill, stroke, dash) {
    ctx.beginPath();
    ctx.arc(ox, oy, r1, -t2, -t1);
    if (r0 > 0) ctx.arc(ox, oy, r0, -t1, -t2, true);
    else ctx.lineTo(ox, oy);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function ray(ctx, ox, oy, t, r0, r1, color, width, dash) {
    const [x0, y0] = polar(ox, oy, r0, t);
    const [x1, y1] = polar(ox, oy, r1, t);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Label placed just past a radius, pushed clear of the centre so it never sits
  // on top of the arrow it belongs to.
  function radialLabel(ctx, ox, oy, t, r, text, color, size) {
    const [x, y] = polar(ox, oy, r, t);
    const cx = Math.cos(-t), cy = Math.sin(-t);
    ctx.font = (size || 11) + "px monospace";
    ctx.fillStyle = color;
    ctx.textAlign = cx > 0.3 ? "left" : cx < -0.3 ? "right" : "center";
    ctx.textBaseline = cy > 0.3 ? "top" : cy < -0.3 ? "bottom" : "middle";
    ctx.fillText(text, x + cx * 7, y + cy * 7);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // Text laid along an arc, used for the one-line notes that hug the rim.
  function arcLabel(ctx, ox, oy, r, t, text, color, size) {
    const [x, y] = polar(ox, oy, r, t);
    ctx.save();
    ctx.translate(x, y);
    // tangent to the rim, flipped a half turn whenever that would read upside down
    let rot = -t - Math.PI / 2;
    rot = Math.atan2(Math.sin(rot), Math.cos(rot));
    if (Math.abs(rot) > Math.PI / 2) rot += rot > 0 ? -Math.PI : Math.PI;
    ctx.rotate(rot);
    ctx.font = (size || 11) + "px monospace";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // Top-down dial: travel points right, everything measured off it.
  //
  //   m.aim  = crosshair angle from travel (what the mouse controls)
  //   m.key  = crosshair -> push, welded by the config
  //   m.dead = half-width of the cone where a push earns nothing
  //   m.best = the push angle that earns the most
  function drawDial(m) {
    const { ctx, w, h } = fit(dial);
    const headH = 62;   // the three caption lines along the top
    const meterH = 56;  // the gain bar along the bottom
    const ox = w * 0.46;
    const oy = (headH + (h - meterH)) / 2;
    const R = Math.min(w * 0.33, (h - meterH - headH) / 2 - 20);
    dialGeom.ox = ox; dialGeom.oy = oy; dialGeom.R = R;

    const pushAng = m.aim + m.key;
    // as a bearing in (-180, 180], purely so a hard drag doesn't print "188.59°"
    const pushBearing = Math.atan2(Math.sin(pushAng), Math.cos(pushAng));
    const inDead = Math.abs(pushBearing) < m.dead;

    // ---- the ring, and a scale so every angle is readable, not just felt -----
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ox, oy, R, 0, Math.PI * 2);
    ctx.stroke();
    for (let d = -75; d <= 180; d += 15) {
      const t = d / DEG;
      const major = d % 45 === 0;
      ray(ctx, ox, oy, t, R, R + (major ? 7 : 4),
        major ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.13)", 1);
      if (major && d !== 0) {
        radialLabel(ctx, ox, oy, t, R + 9, (d > 0 ? "+" : "") + d + "°", "rgba(143,168,154,0.7)", 10);
      }
    }

    // ---- the dead cone ------------------------------------------------------
    // Symmetric about travel, but the push only ever lives on the positive side
    // with both keys held, so the mirror half is drawn faint.
    wedge(ctx, ox, oy, 0, R, 0, m.dead, "rgba(255,90,90,0.17)", null);
    wedge(ctx, ox, oy, 0, R, -m.dead, 0, "rgba(255,90,90,0.07)", null);
    ray(ctx, ox, oy, -m.dead, 0, R, "rgba(255,120,120,0.25)", 1, [3, 3]);
    // the cliff edge itself: cross it inward and the gain is not smaller, it is nil
    ray(ctx, ox, oy, m.dead, 0, R + 2, "rgba(255,120,120,0.9)", 2);
    // sits a ring further out than the push label, which lands on almost exactly
    // the same bearing whenever you are aiming well; clamped off the captions
    {
      const [clx, cly] = polar(ox, oy, R + 34, m.dead);
      ctx.font = "11px monospace";
      ctx.fillStyle = "rgba(255,120,120,0.95)";
      ctx.textAlign = Math.cos(-m.dead) > 0.3 ? "left" : "center";
      ctx.fillText("cliff edge", clx, Math.max(cly, headH + 2));
      ctx.textAlign = "left";
    }
    // sits in the mirror half, which is the only part of the cone nothing else uses
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,140,140,0.9)";
    ctx.textAlign = "center";
    const [dlx, dly] = polar(ox, oy, R * 0.62, -m.dead / 2);
    ctx.fillText("push anywhere in the red", dlx, dly);
    ctx.fillText("→ you gain exactly 0", dlx, dly + 14);
    ctx.textAlign = "left";

    // the rim band the push has to reach to earn anything at all
    wedge(ctx, ox, oy, R * 0.94, R, m.dead, 128 / DEG, "rgba(125,255,176,0.45)", null);
    arcLabel(ctx, ox, oy, R * 0.86, 108 / DEG, "gains speed →", "rgba(125,255,176,0.85)");

    // ---- the best angle -----------------------------------------------------
    ray(ctx, ox, oy, m.best, R * 0.2, R, "rgba(125,255,176,0.45)", 1.5, [5, 4]);
    const [bx, by] = polar(ox, oy, R, m.best);
    ctx.fillStyle = "#7dffb0";
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fill();
    // only labelled once the push has been dragged off it, or the two collide
    if (Math.abs(pushBearing - m.best) > 5 / DEG) {
      radialLabel(ctx, ox, oy, m.best, R + 8, "best " + cvarFmtDeg(m.best), "#7dffb0");
    }

    // ---- the rigid V: crosshair and push, welded key degrees apart -----------
    const kLo = Math.min(m.aim, pushAng);
    const kHi = Math.max(m.aim, pushAng);
    wedge(ctx, ox, oy, 0, R * 0.6, kLo, kHi, "rgba(255,200,87,0.18)", "rgba(255,200,87,0.8)", [4, 3]);

    // Travel is pinned along +x, so anything aimed near 0° lands its label on top
    // of the travel label. Stack them by hand in that case: push above the axis,
    // crosshair below it. Happens constantly in "not turning at all".
    const flat = (t) => Math.abs(Math.atan2(Math.sin(t), Math.cos(t))) < 8 / DEG;
    const stacked = (t, r, text, color, dy) => {
      const [lx, ly] = polar(ox, oy, r, t);
      ctx.font = "11px monospace";
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.fillText(text, lx + 6, ly + dy);
    };

    arrow(ctx, ox, oy, 0, R * 0.99, "#eafff2", null, 3);
    radialLabel(ctx, ox, oy, 0, R * 0.99 + 4, "travel 0°", "#eafff2");

    arrow(ctx, ox, oy, m.aim, R * 0.78, "#ffc857", null, 3);
    if (flat(m.aim)) stacked(m.aim, R * 0.78, "crosshair " + cvarFmtDeg(m.aim), "#ffc857", 18);
    else radialLabel(ctx, ox, oy, m.aim, R * 0.78 + 4, "crosshair " + cvarFmtDeg(m.aim), "#ffc857");

    arrow(ctx, ox, oy, pushAng, R * 0.99, inDead ? "#ff6b6b" : "#5fb4ff", null, 3.5);
    const pushColor = inDead ? "#ff6b6b" : "#5fb4ff";
    if (flat(pushAng)) stacked(pushAng, R * 0.99, "push " + cvarFmtDeg(pushBearing), pushColor, -12);
    else radialLabel(ctx, ox, oy, pushAng, R * 0.99 + 4, "push " + cvarFmtDeg(pushBearing), pushColor);

    // the key-angle caption sits inside its own wedge, on a plate so it stays
    // readable when a narrow V puts an arrow straight through it
    const kMid = (kLo + kHi) / 2;
    const kText = "key " + cvarFmtDeg(Math.abs(m.key));
    // a narrow V leaves no room inside itself, so push the plate off to the side
    const kNudge = Math.abs(m.key) < 14 / DEG ? 22 : 0;
    const [klx0, kly0] = polar(ox, oy, R * 0.36, kMid);
    const klx = klx0 + Math.sin(-kMid) * kNudge;
    const kly = kly0 - Math.cos(-kMid) * kNudge;
    ctx.font = "12px monospace";
    const kw = ctx.measureText(kText).width;
    ctx.fillStyle = "rgba(11,15,12,0.82)";
    ctx.fillRect(klx - kw / 2 - 5, kly - 9, kw + 10, 18);
    ctx.fillStyle = "#ffd166";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(kText, klx, kly);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // the dot that is you
    ctx.fillStyle = "#dfeee2";
    ctx.beginPath();
    ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // ---- captions ------------------------------------------------------------
    ctx.font = "11px monospace";
    ctx.fillStyle = "#8fa89a";
    ctx.fillText("top-down · you are the dot · " + m.speed.toFixed(0) + " u/s · dead cone ±" + cvarFmtDeg(m.dead), 10, 16);
    ctx.fillStyle = "rgba(255,200,87,0.9)";
    ctx.fillText((m.engine === "sof" ? "SOF chain" : "QUAKE II chain") +
      " · your cvars set ONE thing here: the V, welded open at " + cvarFmtDeg(Math.abs(m.key)), 10, 32);
    // where the V is pointed is the mouse's doing, so say so on every frame
    ctx.fillStyle = m.mode === "straight" ? "rgba(255,120,120,0.95)" : "rgba(143,168,154,0.85)";
    ctx.fillText(
      m.mode === "straight"
        ? "mouse: not turning at all — so the push falls in the red"
        : m.mode === "drag"
          ? "mouse: wherever you dragged it — drag again to move it"
          : "mouse: aimed perfectly — this is a CHOICE, not your config",
      10, 48);

    // ---- gain meter ----------------------------------------------------------
    const gainAt = (t) =>
      Math.sqrt(m.speed * m.speed + chainGainSq(m.speed, m.push, Math.abs(t), pm_airaccelerate, CVAR_FRAMETIME)) - m.speed;
    const gain = gainAt(pushBearing);
    const peak = gainAt(m.best);
    const frac = peak > 0 ? Math.max(0, gain / peak) : 0;

    const mx = 12, mw = w - 24, my = h - meterH + 22, mh = 12;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = inDead ? "#ff6b6b" : frac > 0.97 ? "#7dffb0" : "#ffd166";
    ctx.fillRect(mx, my, mw * Math.min(1, frac), mh);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);

    ctx.font = "11px monospace";
    const meterRight = inDead
      ? "ZERO — push is inside the dead cone"
      : gain <= 0
        ? gain.toFixed(2) + " u/s — the push is behind you, this is braking"
        : "+" + gain.toFixed(2) + " u/s  (" + (frac * 100).toFixed(0) + "% of best)";
    // the caption gives way to the number when the canvas gets narrow
    const room = mw - ctx.measureText(meterRight).width - 16;
    const meterLeft = ["speed gained this tick, aiming as drawn", "gained this tick", ""]
      .find((t) => ctx.measureText(t).width <= room);
    ctx.fillStyle = "#8fa89a";
    ctx.fillText(meterLeft, mx, my - 6);
    ctx.textAlign = "right";
    ctx.fillStyle = inDead || gain <= 0 ? "#ff6b6b" : "#7dffb0";
    ctx.fillText(meterRight, mx + mw, my - 6);
    ctx.textAlign = "left";
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

    // the same engine as the main curve, so it stays an apples-to-apples compare
    const ref = cmdChain(200, 160, engineOpts());
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

  // The live "here is every number the dial is standing on" strip. This exists
  // so nobody has to guess whether a picture came out of SoF's chain or Q2's:
  // the steps that didn't run are struck through and say why.
  function drawPipeline(chain) {
    const sof = chain.engine === "sof";
    const pair = (o) => o.f + " / " + o.s;
    const row = (cls, step, val, note) =>
      `<div class="pipe-row ${cls}"><span class="s">${step}</span><span class="v">${val}</span><span class="n">${note}</span></div>`;

    const bothKeys = chain.typed.f !== 0 && chain.typed.s !== 0;
    const rows = [
      row("", "you typed", pair(chain.typed), "① CL_BaseMove — cvar to short"),
      chain.normalized
        ? row("", "② shrink diagonal", pair(chain.normalized),
            `CL_FinishMove — length cut to max(f,s) = ${Math.max(chain.typed.f, chain.typed.s)}`)
        : row("skipped", "② shrink diagonal", pair(chain.typed),
            sof
              ? (bothKeys ? "skipped — needs both axes" : "skipped — only one key held")
              : "does not exist in Quake II"),
      chain.trimmed
        ? row("hot", "③ per-axis trim", pair(chain.wire),
            chain.rotatedByClamp
              ? "PAK_WriteDeltaUsercmd, 200 fwd / 160 side — this ROTATED your angle"
              : "PAK_WriteDeltaUsercmd — 200 fwd / 160 side")
        : row(sof ? "" : "skipped", "③ per-axis trim", pair(chain.wire),
            sof
              ? "nothing to trim — already under 200 fwd / 160 side"
              : "Q2's MSG_WriteDeltaUsercmd clamps nothing"),
      row("", "④ run × 2", pair(chain.cmd),
        sof ? "ClientThink — server side, after the trim" : "CL_BaseMove — client side, in Q2"),
      row("out", "⑤ what pmove sees",
        chain.push.toFixed(1) + " @ " + cvarFmtDeg(chain.keyAngle),
        chain.atCap
          ? `wishspeed ${chain.rawPush.toFixed(1)} capped at pm_maxspeed 300`
          : `wishspeed ${chain.rawPush.toFixed(1)} — under the 300 cap`),
    ];
    pipeEl.innerHTML = rows.join("");
  }

  function render() {
    const fwd = +fwdInput.value;
    const side = +sideInput.value;
    const speed = +speedInput.value;
    fwdVal.textContent = fwd;
    sideVal.textContent = side;
    speedVal.textContent = speed;

    const sof = engineInput.checked;
    engineNote.textContent = sof
      ? "steps ② and ③ on: diagonal shrink, then the 200/160 trim"
      : "off — stock Quake II: no diagonal shrink, no trim, so your angle is exactly what you typed";

    const chain = cmdChain(fwd, side, engineOpts());
    const push = chain.push;
    drawPipeline(chain);

    if (push <= 0) {
      pushEl.textContent = keyEl.textContent = deadEl.textContent = "—";
      bestEl.textContent = offEl.textContent = marginEl.textContent = "—";
      explainEl.textContent = "Both numbers are zero — no push at all, nothing to show.";
      fit(dial); fit(graph); fit(cliff);
      return;
    }

    const dead = chainDeadAngle(speed, push);
    const best = chainBestAngle(speed, push, pm_airaccelerate, CVAR_FRAMETIME);
    const aim = aimFor(best, chain.keyAngle);
    const m = { key: chain.keyAngle, push, speed, dead, best, aim, mode: aimMode, engine: chain.engine };
    aimBestBtn.classList.toggle("primary", aimMode === "best");
    aimStraightBtn.classList.toggle("primary", aimMode === "straight");

    pushEl.textContent = push.toFixed(1) + (chain.atCap ? " (at the cap)" : "");
    keyEl.textContent = cvarFmtDeg(chain.keyAngle);
    deadEl.textContent = cvarFmtDeg(dead);
    bestEl.textContent = cvarFmtDeg(best);

    // Positive means the crosshair sits on the same side as the push, which is
    // the side the trajectory is curving towards -- i.e. inside the turn.
    const off = (best - chain.keyAngle) * DEG;
    offEl.textContent =
      Math.abs(off) < 0.05
        ? "dead on your route"
        : Math.abs(off).toFixed(1) + "° " + (off > 0 ? "inside the turn" : "outside the turn");
    marginEl.textContent = cvarFmtDeg(best - dead);

    const straightAt = chainAimedStraightSpeed(chain.keyAngle, push, pm_airaccelerate, CVAR_FRAMETIME);
    explainEl.innerHTML = `
      <b>${sof ? "SOF's client chain" : "Stock Quake II's chain"}.</b>
      ${sof
        ? `${chain.normalized
            ? `Both keys down, so step ② shrinks <b>${chain.typed.f} / ${chain.typed.s}</b> to
               <b>${chain.normalized.f} / ${chain.normalized.s}</b> — same direction, length cut to
               max(f, s) = <b>${Math.max(chain.typed.f, chain.typed.s)}</b>. `
            : `Only one axis is non-zero, so step ② is skipped entirely. `}
           ${chain.rotatedByClamp
            ? `Step ③ then trims it to <b>${chain.wire.f} / ${chain.wire.s}</b>, which
               <b>rotates your angle</b> — this config is not aiming where you typed. `
            : `Step ③ trims nothing. `}`
        : `Neither the diagonal shrink nor the 200/160 trim exists here, so
           <b>${chain.typed.f} / ${chain.typed.s}</b> goes through untouched and your key angle is
           exactly <b>atan2(${chain.typed.s}, ${chain.typed.f})</b> — nothing in Q2 can rotate it. `}
      Doubled that's <b>${chain.cmd.f} / ${chain.cmd.s}</b>, a push of length
      <b>${chain.rawPush.toFixed(1)}</b>${chain.atCap ? ` — cut down to the <b>300</b> cap` : ` (under the 300 cap, so this config is costing you push strength)`}.
      At ${speed.toFixed(0)} u/s that puts your crosshair at
      <b>${off > 0 ? "+" : ""}${off.toFixed(1)}°</b> — ${Math.abs(off).toFixed(1)}° to the
      ${off > 0 ? "same side of your route as the push, i.e. inside the turn"
                : "far side of your route from the push, i.e. outside the turn"}. It
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

  // ---- dragging the crosshair around the dial -------------------------------
  let dragging = false;

  function aimFromEvent(ev) {
    const rect = dial.getBoundingClientRect();
    const dx = ev.clientX - rect.left - dialGeom.ox;
    const dy = ev.clientY - rect.top - dialGeom.oy;
    if (!dx && !dy) return;
    // screen y grows downward, so negate it to get back to a world angle
    let t = Math.atan2(-dy, dx);
    // keep the arrows on the canvas -- the interesting range is the near half
    aimDragged = Math.max(-80 / DEG, Math.min(150 / DEG, t));
    aimMode = "drag";
    render();
  }

  dial.addEventListener("pointerdown", (ev) => {
    dragging = true;
    dial.setPointerCapture(ev.pointerId);
    dial.style.cursor = "grabbing";
    aimFromEvent(ev);
    ev.preventDefault();
  });
  dial.addEventListener("pointermove", (ev) => {
    if (dragging) aimFromEvent(ev);
  });
  const endDrag = () => { dragging = false; dial.style.cursor = "grab"; };
  dial.addEventListener("pointerup", endDrag);
  dial.addEventListener("pointercancel", endDrag);

  aimBestBtn.addEventListener("click", () => { aimMode = "best"; render(); });
  aimStraightBtn.addEventListener("click", () => { aimMode = "straight"; render(); });
  engineInput.addEventListener("change", render);

  fwdInput.addEventListener("input", render);
  sideInput.addEventListener("input", render);
  speedInput.addEventListener("input", render);
  window.addEventListener("resize", render);
  render();
}
