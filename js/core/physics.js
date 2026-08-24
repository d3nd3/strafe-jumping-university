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
// Confirmed by decompiling the retail SoF.exe binary: pm_airaccelerate is
// statically initialized to 1.0 and never written anywhere else in the
// executable -- it's a permanent constant, not a togglable cvar in the
// shipped game. Kept as 0 here only as a flag for which formula this file's
// pmAirMoveSteps takes (see below); the real game reaches the exact same
// numeric result (accel = 1 in air) by always using this hardcoded 1.0
// directly, with no if/else at all -- the special 30-unit-cap
// PM_AirAccelerate formula below is never actually reachable in retail SoF.
const pm_airaccelerate = 0;
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
// PM_Accelerate (pmove.c:407-422)
//
// wishdir/wishspeed describe what the player *wants*: a direction and a
// target speed. accel is a tuning constant (10 on ground, 1 in air by
// default -- see PM_AirMove below). This function nudges pml.velocity
// towards that wish, but only by as much as accel/frametime allow, and only
// along the wishdir axis.
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
// Present in the source, but confirmed unreachable in the retail SoF.exe
// binary -- its only caller there always takes the plain PM_Accelerate path
// instead (see pm_airaccelerate above). Kept here as a faithful 1:1 port of
// real source code that some other Quake 2 engines/mods do actually use.
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
    label: `pm_airaccelerate is ${pm_airaccelerate} -> ${
      pm_airaccelerate ? "PM_AirAccelerate" : "PM_Accelerate(wishdir, wishspeed, 1)"
    }`,
    locals: { pm_airaccelerate },
  };

  let accelResult;
  if (pm_airaccelerate) {
    accelResult = yield* pmAirAccelerateSteps(state.velocity, wishdir, wishspeed, pm_accelerate, frametime);
  } else {
    accelResult = yield* pmAccelerateSteps(state.velocity, wishdir, wishspeed, 1, frametime);
  }

  yield {
    id: "done",
    label: "tick complete",
    locals: { velocity: [...state.velocity], speed: VectorLength(state.velocity) },
    terminal: true,
  };

  return { wishdir, wishspeed, ...accelResult };
}
