// Chapter 9 — a catalogue of every place pmove.c's own `#ifdef SOF` branches
// (plus the sofree hooks.cpp reverse-engineering project's three physics
// cvars: _sf_sv_q2_mode, _sf_sv_q2_style_jump, _sf_sv_q2_slide_fix) show SOF
// and Quake II's movement code actually diverging, with the felt gameplay
// consequence of each one.

const SOF_Q2_DIFFS = [
  {
    num: 1,
    tag: "PMF_TIME_LAND",
    title: "Landing hard locks out your next jump",
    cite: "pmove.c:340–358 · PM_StepSlideMove",
    summary:
      "Q2's step logic ends by copying the step-down trace's Z speed over your real vertical velocity — <code>pml.velocity[2] = down_v[2]</code> — which quietly zeroes it out most ticks. SOF just deletes that line.",
    impact:
      "Real fall speed survives in SOF, so a landing below &minus;200 u/s trips <span class=\"varname\">PMF_TIME_LAND</span> and blocks your next jump for 18–25 tics (worse below &minus;400). In Q2 the same landing almost never reads fast enough to trigger it.",
    corroboration:
      "hooks.cpp toggles this exact line with <code>_sf_sv_q2_style_jump</code>, right above the comment <i>\"This is what causes q2 to not use TIME_JUMP lol.\"</i>",
    sofLabel: "SOF",
    sofCode: "// line removed —\n// real fall speed survives",
    q2Label: "Q2 (leaked branch)",
    q2Code: "pml.velocity[2] = down_v[2];",
  },
  {
    num: 2,
    tag: "duck clamp",
    title: "Mid-air ducking doesn't cap your speed",
    cite: "pmove.c:635–645 · PM_AirMove",
    summary:
      "Both engines cap your target speed to <span class=\"varname\">pm_duckspeed</span> while ducked. SOF only applies that cap when you're <i>also</i> standing on the ground; the leaked Q2 branch caps it off <span class=\"varname\">PMF_DUCKED</span> alone.",
    impact:
      "Ducking mid-air — or just carrying the DUCKED flag for one tick after leaving the ground — costs you nothing in SOF. In Q2 it would clip your wishspeed to 100 for that stretch.",
    corroboration:
      "Confirmed two ways: hooks.cpp's own reimplementation reads <code>PMF_DUCKED && PMF_ON_GROUND</code>, and disassembling retail SoF.exe / sof-bin shows the compiled check matches.",
    sofLabel: "SOF",
    sofCode: "PMF_DUCKED && PMF_ON_GROUND\n  ? pm_duckspeed : pm_maxspeed",
    q2Label: "Q2 (leaked branch)",
    q2Code: "PMF_DUCKED\n  ? pm_duckspeed : pm_maxspeed",
  },
  {
    num: 3,
    tag: "pitch flatten",
    title: "Looking up or down never slows you down",
    cite: "pmove.c:616–621 · PM_AirMove",
    summary:
      "Before building your wish vector, SOF zeroes the Z component of the forward/right vectors and renormalizes them. The leaked Q2 branch skips this — it only has the shared pitch/3 damping computed earlier in Pmove().",
    impact:
      "In SOF, aiming steeply up or down never shrinks your effective input speed while strafing. In the Q2 branch, a steep pitch still shaves a little off wishspeed even after the /3 damping.",
    corroboration:
      "hooks.cpp's my_PM_AirMove has this flatten unconditionally, and a leftover (disabled) binary-patch block shows the modder considered NOPing it out for a Q2-mode toggle.",
    sofLabel: "SOF",
    sofCode: "forward[2] = right[2] = 0;\nVectorNormalize(forward, right);",
    q2Label: "Q2 (leaked branch)",
    q2Code: "// no flatten —\n// pitch still leaks into wishvel",
  },
  {
    num: 4,
    tag: "ground Z-vel",
    title: "Reverse-gravity zones can't lift you while grounded",
    cite: "pmove.c:678–687 · PM_AirMove",
    summary:
      "After accelerating on the ground, SOF unconditionally zeroes vertical velocity. Q2's branch only zeroes it when gravity is positive — a negative <span class=\"varname\">trigger_gravity</span> volume is allowed to push you upward even while grounded.",
    impact:
      "SOF maps can't use a negative-gravity trigger to nudge a grounded player upward; Q2 maps can. A narrow, level-design-only difference, but a real one.",
    corroboration:
      "hooks.cpp's my_PM_AirMove ground branch matches SOF exactly — the gravity-sign carve-out is commented out, unused.",
    sofLabel: "SOF",
    sofCode: "velocity[2] = 0;   // always",
    q2Label: "Q2 (leaked branch)",
    q2Code: "if (gravity > 0) velocity[2] = 0;\nelse velocity[2] -= gravity * dt;",
  },
  {
    num: 5,
    tag: "wall rub",
    title: "Wall and corner contact scrubs off extra speed",
    cite: "pmove.c:188–227 · PM_StepSlideMove_",
    summary:
      "Q2's clip-velocity loop slides along every contacted plane with no side effect. SOF replaces it with a simpler 1- or 2-plane case that also multiplies velocity by a \"rub\" factor of <code>1.0 + 0.5·dot(dir, plane)</code>.",
    impact:
      "Every wall or corner touch in SOF scrubs a bit of speed off on top of the geometric slide — Q2's version doesn't. This is part of why riding a wall in SOF bleeds speed faster than in Q2.",
    corroboration:
      "hooks.cpp toggles this whole block with <code>_sf_sv_q2_mode</code>; the 0.5 / 1.0 constants match what's disassembled in both retail binaries.",
    sofLabel: "SOF",
    sofCode: "rub = 1.0 + 0.5 * dot(dir, plane);\nvelocity *= rub;",
    q2Label: "Q2 (leaked branch)",
    q2Code: "// iterative multi-plane clip,\n// no rub factor",
  },
  {
    num: 6,
    tag: "step choice",
    title: "Stair-stepping picks a path differently",
    cite: "pmove.c:324–338 · PM_StepSlideMove",
    summary:
      "To decide whether stepping up \"went farther\" than not stepping, SOF projects the displacement onto your original velocity direction. Q2 just compares squared horizontal (X/Y) distance.",
    impact:
      "Mostly invisible, but it changes stair/ledge climbing consistency in edge cases — especially while turning through a step, where the two metrics can disagree about which path wins.",
    corroboration: "hooks.cpp switches metrics under the same <code>_sf_sv_q2_mode</code> toggle as item 5.",
    sofLabel: "SOF",
    sofCode: "dist = dot(delta, start_velocity)",
    q2Label: "Q2 (leaked branch)",
    q2Code: "dist = dx*dx + dy*dy",
  },
  {
    num: 7,
    tag: "slope fix",
    title: "A safety net against getting stuck on slopes",
    cite: "pmove.c:806–809 · PM_CatagorizePosition",
    summary:
      "SOF adds a small patch: if the ground trace didn't fully clear and you're moving down, zero your vertical velocity right there. The leaked source's own comment calls it a \"dirty fix\" that trades hard-stuck slopes for a bit of persistent sliding.",
    impact: "SOF players are less likely to get hard-stopped dead by a shallow slope, at the cost of a faint, continuous slide on those same slopes. Q2 has no such patch.",
    corroboration: "hooks.cpp exposes this exact line as its own toggle, <code>_sf_sv_q2_slide_fix</code>, separate from the master mode switch.",
    sofLabel: "SOF",
    sofCode: "if (trace.fraction < 1 && ent\n    && velocity[2] < 0)\n  velocity[2] = 0;",
    q2Label: "Q2 (leaked branch)",
    q2Code: "// no patch —\n// relies on StepSlideMove alone",
  },
  {
    num: 8,
    tag: "knockback",
    title: "Getting shot briefly saps your control",
    cite: "pmove.c:47–59 · pml_t (not in the leaked source at all)",
    summary:
      "Both retail binaries carry an extra 0–1 scalar, pulled toward 0 for a moment after taking damage, that multiplies the speed of every accelerate call — ground, air, ladder, water. It's not a code branch; it's a whole field the leaked source never had.",
    impact:
      "In real SOF, a fresh hit briefly weakens how fast you can regain speed or change direction — a felt \"flinch\" with no Q2 counterpart. This project doesn't simulate damage, so it's always 1.0 (a no-op) everywhere else on this site.",
    corroboration: "Found independently in both retail binaries via IDA: a global in SoF.exe read from pm->s+0xFC, and the same extra field baked into sof-bin's pml_t.",
    sofLabel: "SOF",
    sofCode: "accelspeed *= knockback_friction;\n// 1.0 normally, dips after damage",
    q2Label: "Q2",
    q2Code: "// field doesn't exist",
  },
  {
    num: 9,
    tag: "stuck tie-break",
    title: "Stuck-position recovery checks corners in a different order",
    cite: "pmove.c:1264–1337 · PM_InitialSnapPosition",
    summary:
      "When you spawn or teleport into a slightly-bad position, both engines brute-force nearby offsets looking for one that isn't solid. SOF checks them in a different nested order than Q2.",
    impact:
      "Only matters on the rare tie where more than one nearby offset is valid — which one \"wins\" can differ. The leaked source even marks its own SOF branch \"NO LONGER USED\", though the community-hooked binary still keeps it live and toggleable.",
    corroboration: "hooks.cpp still reimplements and toggles this order under <code>_sf_sv_q2_mode</code>, despite the leaked source calling it dead.",
    sofLabel: "SOF",
    sofCode: "for z in 1,0,-1:\n for y in 1,0,-1: for x in 1,0,-1:",
    q2Label: "Q2 (leaked branch)",
    q2Code: "for z in 0,-1,1:\n for y in 0,-1,1: for x in 0,-1,1:",
  },
];

const Q2_DRIFT_DIFF = {
  num: 10,
  tag: "ramp threshold",
  title: "Ramp launches let go of the ground sooner",
  cite: "pmove.c:731–735 · PM_CatagorizePosition",
  summary:
    "If your upward velocity clears a threshold, you're immediately treated as airborne instead of being snapped back to the ground trace — SOF's threshold is 100 u/s, the leaked branch's is 180.",
  impact:
    "Off a ramp or a ledge, SOF switches you to air-accel/air-friction at a much lower vertical speed than the 180 branch would. Ramp launches feel like they \"pop\" into airborne physics sooner in SOF.",
  corroboration:
    "The source comment names the change itself: <code>//!!ZOID changed from 100 to 180 (ramp accel)</code> — Zoid was id Software's own engineer for Quake II's later official point releases. SOF's pmove.c was almost certainly forked <i>before</i> that patch shipped, so this isn't a SOF design decision at all — it's the leaked file's \"Q2\" branch reflecting a newer Quake II than the one SOF actually started from.",
  sofLabel: "SOF (and older Q2)",
  sofCode: "if (velocity[2] > 100)\n  become airborne",
  q2Label: "Q2 (post-Zoid patch)",
  q2Code: "if (velocity[2] > 180)\n  become airborne",
};

function diffCard(d) {
  return `
    <div class="panel">
      <div class="panel-row" style="align-items:flex-start;gap:28px">
        <div class="panel-col" style="flex:2 1 380px">
          <div style="font-family:var(--mono);font-size:11.5px;color:var(--text-dim);letter-spacing:.03em">${d.cite}</div>
          <h3 style="margin:4px 0 8px;font-size:17px;color:var(--text)">${d.num}. ${d.title} <span class="varname">${d.tag}</span></h3>
          <p style="margin:0 0 10px">${d.summary}</p>
          <p style="margin:0"><b>Impact:</b> ${d.impact}</p>
          ${d.corroboration ? `<p class="muted" style="margin:10px 0 0;font-size:13px">${d.corroboration}</p>` : ""}
        </div>
        <div class="panel-col" style="flex:1 1 220px;min-width:200px;font-family:var(--mono);font-size:12.5px">
          <div style="color:var(--accent-dim);margin-bottom:4px">${d.sofLabel}</div>
          <code style="display:block;white-space:pre-wrap;background:rgba(255,255,255,0.04);border-radius:6px;padding:8px 10px;margin-bottom:12px">${d.sofCode}</code>
          <div style="color:var(--text-dim);margin-bottom:4px">${d.q2Label}</div>
          <code style="display:block;white-space:pre-wrap;background:rgba(255,255,255,0.04);border-radius:6px;padding:8px 10px">${d.q2Code}</code>
        </div>
      </div>
    </div>`;
}

function mountCh8SofVsQ2(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 9 · SOF vs. Q2</div>
    <h1>Every verified difference between SOF and Quake II's movement code</h1>
    <p class="lede">
      SOF's engine is a licensed fork of Quake II. Its leaked <code>pmove.c</code> still carries
      <code>#ifdef SOF</code> / <code>#else</code> branches marking exactly where Raven's
      engineers changed the shared movement code — and a community project that hooks the real
      retail binary (<code>sofree</code>) independently exposes three of these as server cvars
      (<code>_sf_sv_q2_mode</code>, <code>_sf_sv_q2_style_jump</code>,
      <code>_sf_sv_q2_slide_fix</code>) you can toggle to switch a live SOF server back to Q2
      behavior. Every item below is confirmed by at least one of: the source's own branch, a
      hooks.cpp cvar, or disassembling the retail binaries directly.
    </p>

    <h2>Real SOF-only behavior</h2>
    ${SOF_Q2_DIFFS.map(diffCard).join("")}

    <h2>Not really a SOF change — just an older Q2</h2>
    <p class="muted">
      One difference isn't SOF authorial at all. It's the leaked file's "Q2" branch reflecting a
      later official Quake II patch than the one SOF's engine actually forked from.
    </p>
    ${diffCard(Q2_DRIFT_DIFF)}

    <div class="callout good">
      Net effect: SOF preserves real fall speed through a landing (so <span class="varname">PMF_TIME_LAND</span>
      actually fires), scrubs speed on wall contact, ignores pitch when computing wishspeed, and
      pops airborne off ramps sooner than a modern Q2 build would. None of that touches the core
      accelerate/wishdir math the rest of this site walks through — it's all in the edges: landing,
      walls, stairs, and slopes.
    </div>

    <a class="next-link" href="#ch7-recap">Continue → Chapter 10: recap</a>
  `;
}
