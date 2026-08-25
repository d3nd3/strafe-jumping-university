// Instrumented ports of the Quake 2 / SoF player-movement acceleration code.
//
// These are *generator* functions: each `yield` corresponds to one meaningful
// line of pmove.c and hands back a snapshot of what just happened. That lets
// exactly the same function drive two very different UIs with zero
// duplication:
//   1. The debugger (js/ui/codePanel.js) calls .next() once per "Step" click
//      and renders the yielded snapshot.
//   2. The live simulator (chapter 6) drains the generator to completion
//      every animation frame and just uses the final state.
//
// Because it's the same generator either way, "step the live simulator frame
// by frame" is not a separate fake implementation — it's this same function,
// paused.


const pm_stopspeed = 100;
const pm_maxspeed = 300;
const pm_accelerate = 10;
// Confirmed by decompiling PM_AirMove directly out of the retail binary --
// both the Windows SoF.exe and the Linux sof.sof2000i386 build agree --
// pm_airaccelerate is statically initialized to 1.0 and never written
// anywhere else: a permanent constant, not a togglable cvar, in the shipped
// game. More importantly, it's not a boolean gate at all. id's public
// Quake 2 pmove.c (and the id-Software/Quake-2 GitHub release) has
// PM_AirMove's airborne branch read `if (pm_airaccelerate) PM_AirAccelerate
// (...) else PM_Accelerate(wishdir, wishspeed, 1)` -- a runtime test picking
// between two different formulas. That test does not exist in SoF's
// compiled airborne branch: there's a single accelerate computation, and
// pm_airaccelerate is read once as a plain multiplicand feeding it, exactly
// parallel to how pm_accelerate parameterizes the ground/ladder branches.
// The tell: PM_AirAccelerate's defining trait is capping wishspeed to 30
// before computing addspeed, while still using the full wishspeed to size
// accelspeed -- two different derived values in the same call. SoF's
// compiled addspeed is computed exactly once, from the uncapped wishspeed,
// *before* the ladder/ground/air branch even starts, then reused unchanged
// inside the air branch. No 30.0 constant appears anywhere in the function.
// A faithful inline of PM_AirAccelerate could not lose that cap without
// changing behavior, so its absence isn't a compiler optimization -- SoF's
// own PM_AirMove was written without that separate formula. Net effect:
// pm_airaccelerate is just SoF's (always-on) air accel scalar, structurally
// identical in shape to pm_accelerate but ten times weaker.
const pm_airaccelerate = 1;
const pm_duckspeed = 100;
const pm_friction = 6;

// PM_CatagorizePosition's ground-leave velocity check (pmove.c:704-707).
// #define SOF is active in this file by default (line 23), so 100 is what
// actually ships; 180 is what stock Quake 2 uses without that patch. Moving
// upward faster than this, you're treated as airborne even while still
// touching the ground -- which matters the instant you launch off a ramp:
// a lower threshold hands control (and keeps friction) off to "airborne"
// sooner, so less of a ramp launch's speed gets eaten by ground friction.
const SOF_GROUND_LEAVE_VELOCITY = 100;
const Q2_GROUND_LEAVE_VELOCITY = 180;

// PM_CheckJump, reduced to its actual latch logic (pmove.c:826-871; the
// PMF_TIME_LAND and water-jump branches are left out -- not modeled here).
// jumpState is a small {held: boolean} the caller owns across ticks.
// Faithfully reproduces real Quake 2/SoF's jump-buffering quirk: the latch
// only clears when the key is *released* (not when you leave the ground),
// so pressing jump while airborne and holding it through touchdown fires
// the instant you land -- no re-press needed exactly on that frame. Land,
// keep holding, and it won't jump again until you let go and press once
// more (usually while still airborne, ready for the next landing).
function pmCheckJump(jumpState, upmove, grounded) {
  if (upmove < 10) {
    jumpState.held = false;
    return false;
  }
  if (jumpState.held) return false;
  if (!grounded) return false;
  jumpState.held = true;
  return true;
}

// ---------------------------------------------------------------------------
// PM_Friction, ground-only (pmove.c:355-397, water branch omitted -- this
// app never simulates water). Not one of the course's stepped lessons; it's
// here purely so Chapter 7's 3D playground can stop rolling forever once you
// let go of the keys on the ground, the same way the real game does.
// ---------------------------------------------------------------------------
function pmGroundFriction(velocity, frametime) {
  const speed = VectorLength(velocity);
  if (speed < 1) {
    velocity[0] = 0;
    velocity[1] = 0;
    return;
  }
  const control = speed < pm_stopspeed ? pm_stopspeed : speed;
  const drop = control * pm_friction * frametime;
  let newspeed = speed - drop;
  if (newspeed < 0) newspeed = 0;
  newspeed /= speed;
  velocity[0] *= newspeed;
  velocity[1] *= newspeed;
  velocity[2] *= newspeed;
}

// ---------------------------------------------------------------------------
// PM_ClipVelocity (pmove.c:80-95) -- removes the part of a velocity that
// points into a surface, leaving only the part that runs along it. This is
// what makes hitting a wall at an angle *slide* you along it instead of
// stopping you dead. Returns a new vector rather than writing through an
// "out" pointer like the C version, since JS has no by-reference args.
// ---------------------------------------------------------------------------
const STOP_EPSILON = 0.1;
function pmClipVelocity(inVel, normal, overbounce) {
  const backoff = DotProduct(inVel, normal) * overbounce;
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] = inVel[i] - normal[i] * backoff;
    if (out[i] > -STOP_EPSILON && out[i] < STOP_EPSILON) out[i] = 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// PM_Accelerate (pmove.c:407-422)
//
// wishdir/wishspeed describe what the player *wants*: a direction and a
// target speed. accel is a tuning constant (10 on ground, 1 in air by
// default -- see PM_AirMove below). This function nudges pml.velocity
// towards that wish, but only by as much as accel/frametime allow, and only
// along the wishdir axis.
//
// One thing this leaves out on purpose: decompiling *both* shipped retail
// binaries (SoF.exe and the Linux sof-bin ELF) shows accelspeed there is
// actually `accel * knockbackFriction * frametime * wishspeed` -- an extra
// 0..1 factor, 1.0 normally, pulled toward 0 for a moment right after the
// player takes damage/knockback. It's real and it's on every accelerate call
// in the retail game (ground, air, ladder, water, fly), not something the
// leaked pmove.c source even has a field for. This app never simulates
// taking damage, so that factor is always implicitly 1.0 here -- a genuine
// SOF mechanic, just not one this course has any use for modeling.
// ---------------------------------------------------------------------------
function* pmAccelerateSteps(velocity, wishdir, wishspeed, accel, frametime) {
  // int i; float addspeed, accelspeed, currentspeed;
  yield { id: "decl", label: "declare locals", locals: {} };

  const currentspeed = DotProduct(velocity, wishdir);
  yield {
    id: "currentspeed",
    label: "currentspeed = DotProduct(velocity, wishdir)",
    locals: { currentspeed },
  };

  const addspeed = wishspeed - currentspeed;
  yield {
    id: "addspeed",
    label: "addspeed = wishspeed - currentspeed",
    locals: { currentspeed, addspeed },
  };

  if (addspeed <= 0) {
    yield {
      id: "early-return",
      label: "addspeed <= 0 -> return (no room left to accelerate)",
      locals: { currentspeed, addspeed },
      terminal: true,
    };
    return { velocity, currentspeed, addspeed, accelspeed: 0, applied: false };
  }

  let accelspeed = accel * frametime * wishspeed;
  yield {
    id: "accelspeed",
    label: "accelspeed = accel * frametime * wishspeed",
    locals: { currentspeed, addspeed, accelspeed },
  };

  if (accelspeed > addspeed) {
    accelspeed = addspeed;
    yield {
      id: "clamp",
      label: "accelspeed > addspeed -> clamp accelspeed = addspeed",
      locals: { currentspeed, addspeed, accelspeed },
    };
  }

  for (let i = 0; i < 3; i++) {
    velocity[i] += accelspeed * wishdir[i];
  }
  yield {
    id: "apply",
    label: "velocity[i] += accelspeed * wishdir[i]  (for x, y, z)",
    locals: { currentspeed, addspeed, accelspeed, velocity: [...velocity] },
    terminal: true,
  };

  return { velocity, currentspeed, addspeed, accelspeed, applied: true };
}

// ---------------------------------------------------------------------------
// PM_AirAccelerate (pmove.c:424-441)
//
// Real Quake 2 code -- id's own public pmove.c has this exact function --
// but not confirmed present in SoF's own source at all: the retail binary's
// PM_AirMove doesn't call anything shaped like this (see pm_airaccelerate
// above for how we know). Kept here as a faithful 1:1 port of the id source,
// useful context since some other Quake 2 engines/mods do wire this up.
// Identical to PM_Accelerate except the *wished* speed used for the addspeed
// comparison is capped to 30 units/sec, even though the full wishspeed is
// still used to size accelspeed -- gentler, more skill-based air control.
// ---------------------------------------------------------------------------
function* pmAirAccelerateSteps(velocity, wishdir, wishspeed, accel, frametime) {
  yield { id: "decl", label: "declare locals", locals: {} };

  let wishspd = wishspeed;
  yield { id: "wishspd-init", label: "wishspd = wishspeed", locals: { wishspd } };

  if (wishspd > 30) {
    wishspd = 30;
    yield { id: "wishspd-clamp", label: "wishspd > 30 -> clamp wishspd = 30", locals: { wishspd } };
  }

  const currentspeed = DotProduct(velocity, wishdir);
  yield {
    id: "currentspeed",
    label: "currentspeed = DotProduct(velocity, wishdir)",
    locals: { wishspd, currentspeed },
  };

  const addspeed = wishspd - currentspeed;
  yield {
    id: "addspeed",
    label: "addspeed = wishspd - currentspeed",
    locals: { wishspd, currentspeed, addspeed },
  };

  if (addspeed <= 0) {
    yield {
      id: "early-return",
      label: "addspeed <= 0 -> return",
      locals: { wishspd, currentspeed, addspeed },
      terminal: true,
    };
    return { velocity, currentspeed, addspeed, accelspeed: 0, applied: false };
  }

  let accelspeed = accel * wishspeed * frametime;
  yield {
    id: "accelspeed",
    label: "accelspeed = accel * wishspeed * frametime  (uses FULL wishspeed, not wishspd)",
    locals: { wishspd, currentspeed, addspeed, accelspeed },
  };

  if (accelspeed > addspeed) {
    accelspeed = addspeed;
    yield {
      id: "clamp",
      label: "accelspeed > addspeed -> clamp accelspeed = addspeed",
      locals: { wishspd, currentspeed, addspeed, accelspeed },
    };
  }

  for (let i = 0; i < 3; i++) {
    velocity[i] += accelspeed * wishdir[i];
  }
  yield {
    id: "apply",
    label: "velocity[i] += accelspeed * wishdir[i]  (for x, y, z)",
    locals: { wishspd, currentspeed, addspeed, accelspeed, velocity: [...velocity] },
    terminal: true,
  };

  return { velocity, currentspeed, addspeed, accelspeed, applied: true };
}

// ---------------------------------------------------------------------------
// PM_AirMove -- airborne branch only (pmove.c:585-673).
//
// This app's simulator never touches ground (strafe-jumping is entirely an
// airborne phenomenon), so PM_StepSlideMove's collision/step logic and
// gravity are intentionally out of scope -- only the horizontal
// wishvel/wishdir/wishspeed construction and the accelerate call, which is
// the actual subject of this app, are ported.
//
// state: { velocity: vec3, yaw: radians (view angle) }
// cmd:   { forwardmove, sidemove } in [-1, 1], scaled to Q2's +-400 range by caller
// ---------------------------------------------------------------------------
function* pmAirMoveSteps(state, cmd, frametime) {
  const { forward, right } = AngleVectorsYaw(state.yaw, [0, 0, 0], [0, 0, 0]);
  yield {
    id: "basis",
    label: "pml.forward / pml.right built from view yaw",
    locals: { forward: [...forward], right: [...right] },
  };

  const fmove = cmd.forwardmove;
  const smove = cmd.sidemove;

  const wishvel = [
    forward[0] * fmove + right[0] * smove,
    forward[1] * fmove + right[1] * smove,
    0,
  ];
  yield {
    id: "wishvel",
    label: "wishvel[i] = forward[i]*fmove + right[i]*smove",
    locals: { fmove, smove, wishvel: [...wishvel] },
  };

  const wishdir = [...wishvel];
  const wishspeedRaw = VectorNormalize(wishdir);
  let wishspeed = wishspeedRaw;
  yield {
    id: "wishdir",
    label: "wishdir = normalize(wishvel); wishspeed = its former length",
    locals: { wishdir: [...wishdir], wishspeed },
  };

  const maxspeed = pm_maxspeed;
  if (wishspeed > maxspeed) {
    VectorScale(wishvel, maxspeed / wishspeed, wishvel);
    wishspeed = maxspeed;
    yield {
      id: "clamp-maxspeed",
      label: "wishspeed > maxspeed -> scale wishvel down, wishspeed = maxspeed",
      locals: { wishvel: [...wishvel], wishspeed },
    };
  }

  yield {
    id: "branch",
    label: `PM_Accelerate(wishdir, wishspeed, pm_airaccelerate)  -- pm_airaccelerate = ${pm_airaccelerate}, no separate air formula in retail SoF`,
    locals: { pm_airaccelerate },
  };

  const accelResult = yield* pmAccelerateSteps(state.velocity, wishdir, wishspeed, pm_airaccelerate, frametime);

  yield {
    id: "done",
    label: "tick complete",
    locals: { velocity: [...state.velocity], speed: VectorLength(state.velocity) },
    terminal: true,
  };

  return { wishdir, wishspeed, ...accelResult };
}

// ---------------------------------------------------------------------------
// PM_SnapPosition's velocity write, plus the matching read-back at the top of
// the *next* Pmove() call -- decompiled straight out of both retail binaries
// (SoF.exe and the Linux sof-bin ELF; the ELF's Hex-Rays output spells it out
// unambiguously):
//
//   *(short*)(pm->s.velocity + 0) = (int)(pml.velocity[0] * 8.0);
//   *(short*)(pm->s.velocity + 1) = (int)(pml.velocity[1] * 8.0);
//   *(short*)(pm->s.velocity + 2) = (int)(pml.velocity[2] * 8.0);
//   // ... next tick's Pmove() then does:
//   pml.velocity[i] = pm->s.velocity[i] * 0.125;
//
// pmove_state_t.velocity is a `short[3]` -- this is the actual network wire
// format (and the client/server's only copy of velocity between ticks), not
// a display-only rounding step. Two things fall out of that:
//   1. velocity is quantized to steps of 0.125 u/s (1/8, matching the *8/
//      0.125 pair above) every single tick, not just when it crosses the
//      network.
//   2. a `short` tops out at 32767 -> divided by 8, that's a hard ceiling of
//      4095.875 u/s *per axis* (4096 down to -4096). Cross it and the store
//      doesn't clamp -- it truncates to 16 bits and wraps, so the velocity
//      you read back next tick is essentially garbage (often near-zero or
//      flipped in sign), not a smoothly capped value.
//
// This is the *only* velocity limit that exists anywhere in real SoF's
// movement code: decompiling the full Pmove() function top to bottom shows
// no sv_maxvelocity-style cvar and no SV_CheckVelocity-style clamp function
// at all (confirmed absent from both binaries) between PM_AirMove and this
// snap. It's why speed can't actually grow forever in the real game the way
// it can in this app's simulators without this function: every single tick
// is a round trip through a 16-bit short, and blowing through it corrupts
// your velocity rather than politely refusing to go faster.
// ---------------------------------------------------------------------------
function pmSnapVelocity(velocity) {
  for (let i = 0; i < 3; i++) {
    const raw = Math.trunc(velocity[i] * 8); // (int)(pml.velocity[i] * 8.0)
    const asShort = (raw << 16) >> 16; // stored into a 16-bit short -- wraps outside [-32768, 32767]
    velocity[i] = asShort * 0.125; // next tick's pml.velocity[i] = pm->s.velocity[i] * 0.125
  }
}
