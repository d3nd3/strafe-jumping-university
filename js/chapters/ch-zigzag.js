// Chapter 13 -- practical advice: given everything the last twelve chapters
// verified, how should a competitive SOF player actually fly a flat-ground
// zig-zag from point A to point B? This chapter doesn't introduce new
// physics; it applies three already-verified results together:
//   - Chapter 7's theta_min / optimal-turn-rate model, re-run for flat
//     ground specifically (landingHeight = 0), reusing that chapter's own
//     runJump/sweep functions directly (they're globals, same as every
//     other chapter reuses CH5_JUMP_VELOCITY/CH5_GRAVITY).
//   - Chapter 11's finding that a flat landing ALWAYS trips the landing
//     lockout -- there is no way to avoid paying it once per hop. Note the
//     lockout is pm_time = 18 in units of 8ms, not 18 ticks; at the 100 fps
//     this course simulates that works out to 18 frames anyway, which is why
//     the tick counts below are still the right number to feed groundTurn/
//     airTurn. chainLockoutMs (core/cmdchain.js) does the real arithmetic.
//   - Chapter 12's corrected wishspeed dead-zone: PM_Accelerate's ground
//     branch (accel=10) can reorient velocity far faster than the air
//     branch (accel=1) can, which is verified fresh below rather than
//     assumed.

function mountChZigzag(section) {
  // Reuses Chapter 7's own model for flat ground: landingHeight = 0. Same
  // function, same constants -- not a re-derivation.
  const flatCurve = sweep(0);
  let flatBest = flatCurve[0];
  for (const p of flatCurve) if (p[1] > flatBest[1]) flatBest = p;
  const flatBestTurn = flatBest[0];
  const flatRun = runJump(flatBestTurn, 0);
  const headingSwept = flatBestTurn * flatRun.airtime;

  // Flat landing velocity + lockout, straight from Chapter 11's own
  // functions (landingVelocity, lockoutTicks) -- not re-derived either.
  const flatLandV = landingVelocity(0);
  const flatLockPmTime = lockoutTicks(flatLandV);
  const SIM_FRAME_MS = CH_FRICTION_FRAMETIME * 1000;
  const lockSeconds = chainLockoutMs(flatLockPmTime, SIM_FRAME_MS) / 1000;
  // How many simulated ticks that lockout actually spans at this framerate --
  // what groundTurn/airTurn below need, and only equal to pm_time at 100 fps.
  const flatLockTicks = Math.round(lockSeconds / CH_FRICTION_FRAMETIME);
  const cycleSeconds = flatRun.airtime + lockSeconds;

  // Ground (accel=10, with friction) vs air (accel=1) reorientation over
  // that exact lockout window -- verified fresh, not assumed from Ch. 5/6.
  function groundTurn(nTicks, offsetDeg) {
    const velocity = [pm_maxspeed, 0, 0];
    const phi = (offsetDeg * Math.PI) / 180;
    const wishdir = [Math.cos(phi), Math.sin(phi), 0];
    for (let t = 0; t < nTicks; t++) {
      pmGroundFriction(velocity, CH_FRICTION_FRAMETIME);
      const gen = pmAccelerateSteps(velocity, wishdir, pm_maxspeed, pm_accelerate, CH_FRICTION_FRAMETIME);
      while (!gen.next().done) {}
    }
    return velocity;
  }
  function airTurn(nTicks, offsetDeg) {
    const velocity = [pm_maxspeed, 0, 0];
    const phi = (offsetDeg * Math.PI) / 180;
    const wishdir = [Math.cos(phi), Math.sin(phi), 0];
    for (let t = 0; t < nTicks; t++) {
      const gen = pmAccelerateSteps(velocity, wishdir, pm_maxspeed, pm_airaccelerate, CH_FRICTION_FRAMETIME);
      while (!gen.next().done) {}
    }
    return velocity;
  }
  function headingOf(v) {
    return (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  }

  section.innerHTML = `
    <div class="chapter-kicker">Chapter 13 · Flying the Zig-Zag</div>
    <h1>Getting from A to B, as fast as the engine allows</h1>
    <p class="lede">
      Everything so far has been "here's what one number does." This is the payoff: given all of
      it -- θ_min, the 10× ground/air split, the landing lockout, the wishspeed cap -- what should
      a competitive jumper actually <em>do</em> to cross flat, open ground in the least time?
    </p>

    <h2>① One hop already curves ~${headingSwept.toFixed(0)}° on its own -- stop fighting that</h2>
    <p class="muted">
      This isn't a guess -- it's Chapter 7's own <span class="varname">sweep()</span>, run again with
      <span class="varname">landingHeight = 0</span> (flat ground), same 300 → clamped-diagonal model.
    </p>
    <div class="panel">
      <div class="panel-row" style="gap:24px;flex-wrap:wrap">
        <div class="panel-col" style="flex:1 1 200px">
          <div style="font-family:var(--mono);font-size:12px;color:var(--text-dim)">OPTIMAL TURN RATE</div>
          <div style="font-size:22px;margin:4px 0" class="varname">${flatBestTurn.toFixed(0)}°/s</div>
        </div>
        <div class="panel-col" style="flex:1 1 200px">
          <div style="font-family:var(--mono);font-size:12px;color:var(--text-dim)">LANDING SPEED (from a 300 u/s takeoff)</div>
          <div style="font-size:22px;margin:4px 0" class="varname">${flatRun.finalSpeed.toFixed(0)} u/s</div>
        </div>
        <div class="panel-col" style="flex:1 1 200px">
          <div style="font-family:var(--mono);font-size:12px;color:var(--text-dim)">AIRTIME</div>
          <div style="font-size:22px;margin:4px 0" class="varname">${flatRun.airtime.toFixed(3)}s</div>
        </div>
        <div class="panel-col" style="flex:1 1 200px">
          <div style="font-family:var(--mono);font-size:12px;color:var(--text-dim)">TOTAL HEADING SWEPT, TAKEOFF TO LANDING</div>
          <div style="font-size:22px;margin:4px 0" class="varname">${headingSwept.toFixed(1)}°</div>
        </div>
      </div>
    </div>
    <div class="callout good">
      A single, optimally-flown flat hop doesn't go anywhere near straight -- its heading swings
      through roughly <b>${headingSwept.toFixed(0)}°</b> in the time it's airborne, because staying
      above θ_min (Chapter 7) demands it. Trying to fly each hop dead-straight at your target throws
      away the speed gain entirely. The zig-zag isn't a stylistic choice; it's what the fastest
      trajectory the physics allows actually looks like.
    </div>

    <h2>② Alternate which side you lead on, so the arcs cancel</h2>
    <p class="muted">
      Since no single hop points at the target, aim the <em>whole arc</em> at it instead: start hop
      1 biased left of your true bearing to your target and let its ${headingSwept.toFixed(0)}°
      sweep carry you back across it, then start hop 2 biased right by the same amount and let it
      sweep back. Two hops, opposite bias, same magnitude -- the sideways halves cancel and what's
      left is forward progress at close to each hop's own best speed, not a compromise angle that's
      optimal for neither.
    </p>

    <h2>③ The landing lockout isn't dead time -- use it to re-aim</h2>
    <p class="muted">
      Chapter 11 already showed a flat landing (${flatLandV.toFixed(0)} u/s vertical) always trips
      <span class="varname">PMF_TIME_LAND</span>: <b>pm_time ${flatLockPmTime}</b>, which at the
      100 fps this course simulates is ${flatLockTicks} ticks
      (${lockSeconds.toFixed(3)}s) where <span class="varname">PM_CheckJump</span> refuses to fire,
      no way around it on flat ground. But you're still standing on the ground for those ticks, and
      ground accel is <b>10×</b> air accel (Chapter 5). Re-aiming your view right as you land, so
      those ${flatLockTicks} locked-out ticks are spent turning on the ground instead of standing
      there waiting, reorients your velocity far faster than trying to do the same turn once you're
      airborne again:
    </p>
    <div class="panel">
      <div class="panel-row" style="gap:0;flex-wrap:wrap">
        <table class="mono" style="border-collapse:collapse;width:100%;font-size:13px">
          <thead>
            <tr style="text-align:right;color:var(--text-dim)">
              <td style="padding:4px 10px;text-align:left">wishdir turned this far from your heading</td>
              <td style="padding:4px 10px">30°</td><td style="padding:4px 10px">60°</td><td style="padding:4px 10px">90°</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:4px 10px;text-align:left;color:var(--text-dim)">on the ground, ${flatLockTicks} lockout ticks (accel 10)</td>
              ${[30, 60, 90].map((o) => `<td style="padding:4px 10px;text-align:right">${headingOf(groundTurn(flatLockTicks, o)).toFixed(1)}°</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:4px 10px;text-align:left;color:var(--text-dim)">in the air, same ${flatLockTicks} ticks (accel 1)</td>
              ${[30, 60, 90].map((o) => `<td style="padding:4px 10px;text-align:right">${headingOf(airTurn(flatLockTicks, o)).toFixed(1)}°</td>`).join("")}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="callout">
      Real numbers from <span class="varname">PM_Accelerate</span>, not an estimate: asking for a full
      90° turn, the ${flatLockTicks} grounded lockout ticks actually deliver
      <b>${headingOf(groundTurn(flatLockTicks, 90)).toFixed(0)}°</b> of real reorientation --
      the same ${flatLockTicks} ticks spent airborne only manage
      <b>${headingOf(airTurn(flatLockTicks, 90)).toFixed(0)}°</b>. Point ①'s wide arc should mostly
      happen <em>during the jump</em>; the sharp correction back toward center between hops belongs
      in the lockout window, where it's cheap.
    </div>

    <h2>④ Make sure your cvars can actually reach 300</h2>
    <p class="muted">
      Chapter 12's corrected finding applies directly here: hop ① above lands at
      <b>${flatRun.finalSpeed.toFixed(0)} u/s</b> -- already past normal running speed after a single
      hop. Any <span class="varname">cl_forwardspeed</span>/<span class="varname">cl_sidespeed</span>
      diagonal whose magnitude doesn't clear 300 has its own wishspeed sitting <em>below</em> that speed,
      which means θ_min stops being 0° and starts demanding real angle the moment your chain speed
      passes your own cap -- exactly the dead zone Chapter 12 measured. Pick forward/side values whose
      diagonal (<span class="varname">√(fwd²+side²)</span>) clears 300, or the keyboard-only portion of
      every hop past the first starts costing you angle you didn't budget for.
    </p>

    <h2>Put together</h2>
    <div class="callout good">
      <b>The recipe:</b> fly each hop at roughly Chapter 7's optimal turn rate for a flat landing
      (~${flatBestTurn.toFixed(0)}°/s here), alternating which side of the true bearing you lead on
      each hop so the ${headingSwept.toFixed(0)}°-wide arcs cancel out sideways and add up forward.
      Spend the unavoidable ${flatLockTicks}-tick landing lockout re-aiming on the ground, where accel
      is 10× stronger, instead of waiting to correct in the air. And set cl_forwardspeed/cl_sidespeed
      so their diagonal clears 300 -- otherwise you're fighting Chapter 12's dead zone on every hop
      after the first. Total cycle time per hop on flat ground:
      <span class="varname">${flatRun.airtime.toFixed(2)}s airborne + ${lockSeconds.toFixed(2)}s locked out
      = ${cycleSeconds.toFixed(2)}s</span> -- that's the real, physics-floor number to beat.
    </div>

    <a class="next-link" href="#ch7-recap">Continue → Chapter 14: recap</a>
  `;
}
