// ---------------------------------------------------------------------------
// The command chain: what actually happens to cl_forwardspeed / cl_sidespeed
// between your keyboard and PM_AirMove.
//
// pmove.c only shows the LAST step of this ("fmove = pm->cmd.forwardmove").
// The leaked source has no client and no game DLL, so the FOUR steps that run
// before Pmove() are invisible in it. Every one was read out of the shipped
// binaries, and every claim below is checkable at the listed address.
//
//   sof-bin  = Linux patch-1.06a ELF (has symbols)
//   SoF.exe  = Windows retail client
//   gamex86  = Windows retail game DLL (server-side movement)
//
// The call order is CL_CreateCmd -> CL_BaseMove, IN_Move, CL_FinishMove, then
// CL_SendCmd -> PAK_WriteDeltaUsercmd, then Pmove on both ends.
// (SoF.exe fuses the first and last into CL_CreateAndSendCmd @ 0x200060c0.)
//
// -- STEP 1 -- CL_BaseMove         sof-bin 0x80b8f04, SoF.exe 0x20005070
//
//      cmd->forwardmove += (short)(int)(cl_forwardspeed->value * keyFraction);
//      cmd->sidemove    += (short)(int)(cl_sidespeed->value    * keyFraction);
//
//    keyFraction is 1.0 while the key was held for the whole frame, so with a
//    key fully held these are just your cvar values truncated to whole
//    numbers. Nothing is clamped here -- which is why people assume typing a
//    bigger number does something.
//
//    The same function's last two lines set the "run" bit:
//      if ((in_speed.state & 1) != (int)cl_run->value) cmd->buttons |= 0x20;
//    i.e. cl_run 1 (always-run) sets it whenever +speed is NOT held. Remember
//    that bit -- step 4 doubles everything when it's on.
//
// -- STEP 2 -- CL_FinishMove       sof-bin 0x80b99d4, SoF.exe 0x20005240
//              (the tail of the function, SoF.exe 0x2000575f)
//
//      if (cmd->sidemove && cmd->forwardmove) {
//          vec3_t v = { (float)cmd->sidemove, (float)cmd->forwardmove, 0 };
//          VectorNormalize (v);
//          int big = max(abs(cmd->sidemove), abs(cmd->forwardmove));
//          cmd->sidemove    = (int)(v[0] * big);
//          cmd->forwardmove = (int)(v[1] * big);
//      }
//
//    This is SoF's diagonal-normalizer and it has no counterpart in Quake 2 at
//    all. When BOTH axes are non-zero it rescales the pair so its length is
//    max(|forward|, |side|) instead of sqrt(forward^2 + side^2), which is
//    exactly the classic "diagonals are faster" fix. Two consequences that
//    drive the whole cl_forwardspeed/cl_sidespeed chapter:
//      a) it preserves DIRECTION exactly (it only rescales), so the angle your
//         keys ask for really is atan2(cl_sidespeed, cl_forwardspeed);
//      b) it shrinks both numbers, so a cl_sidespeed above 160 is NOT
//         automatically thrown away by step 3 -- only the single-key case
//         (strafing with no forward, where this step is skipped) hits that cap.
//    It runs before the clamp and before the doubling.
//
//    Also here: cmd->msec = (int)(cls.frametime * 1000), with `if (ms > 250)
//    ms = 100`. So msec really is your frame time, and it is what the landing
//    lockout counts down in -- see chainLockoutMs below.
//
// -- STEP 3 -- PAK_WriteDeltaUsercmd  sof-bin 0x80ba99c, SoF.exe 0x20005e3d
//
//      cmp word ptr [ebp+0Ah], 0FF37h   ; forwardmove <= -201 ?
//      mov word ptr [ebp+0Ah], 0FF38h   ;   -> -200
//      cmp word ptr [ebp+0Ah], 0C8h     ; forwardmove >  200  ?
//      mov word ptr [ebp+0Ah], 0C8h     ;   ->  200
//      cmp word ptr [ebp+0Ch], 0FF5Fh   ; sidemove    <= -161 ?
//      mov word ptr [ebp+0Ch], 0FF60h   ;   -> -160
//      cmp word ptr [ebp+0Ch], 0A0h     ; sidemove    >  160  ?
//      mov word ptr [ebp+0Ch], 0A0h     ;   ->  160
//      ... upmove clamped to +-200 the same way
//
//    forwardmove is capped at 200. sidemove is capped at 160. They are NOT the
//    same number, and unlike step 2 this clamp is per-axis, so when it bites it
//    ROTATES your wish direction as well as shortening it.
//
//    Three things make it inescapable rather than cosmetic:
//      a) it writes back THROUGH the pointer, into cl.cmds[] itself -- the
//         client's own command ring buffer, not a scratch copy;
//      b) CL_PredictMovement (sof-bin 0x80cefa0) replays out of that same
//         cl.cmds[] array, so client-side prediction sees the clamped values;
//      c) the server re-applies the identical clamp on receive, in
//         PAK_ReadDeltaUsercmd (sof-bin 0x80ba5bc).
//    MSG_WriteDeltaUsercmd, the plain Quake 2 version with no clamp at all, is
//    still in the binary but has zero callers -- dead code.
//
// -- STEP 4 -- ClientThink            gamex86 0x500f53a0
//              (mirrored by CL_PredictMovement, sof-bin 0x80cefa0)
//
//      if ((cmd.buttons & 0x20) && !(client->ps.pmove.pm_flags & 0x40)) {
//          forwardmove *= 2;   sidemove *= 2;   upmove *= 2;
//      }
//      scale = (byte)(GetSpeedScale (ent) * 255.0) * (1/255.0);
//      forwardmove = (int)(forwardmove * scale);
//      sidemove    = (int)(sidemove    * scale);
//      gi.pmove (&pm);
//
//    The run bit DOUBLES your movement command, after the clamp. Then a 0..255
//    "speed scale" byte (1.0 = healthy) scales it. This doubling is what pushes
//    an ordinary config past pm_maxspeed in step 5, where the size of your
//    numbers stops mattering and only the angle survives.
//
//    upmove is doubled but never scaled -- read the disassembly again if that
//    looks like a typo. It isn't.
//
// -- STEP 5 -- PM_AirMove             sof-bin 0x812e278, SoF.exe 0x200531a0
//
//    Only here does pmove.c pick up the story (pmove.c:612-651).
// ---------------------------------------------------------------------------

// Step 3's two clamps. Much of this chapter comes from the fact that they
// differ.
const CMD_FORWARD_CAP = 200;
const CMD_SIDE_CAP = 160;
const CMD_UP_CAP = 200;

// Step 4's run doubling.
const CMD_RUN_MULTIPLIER = 2;

// The largest movement command the engine can ever be handed, per axis, after
// the clamp and the doubling. Every simulator on this site uses these instead
// of the symmetric +-400 they used to assume: sideways really does top out
// lower than forward.
const CMD_MAX_FORWARD = CMD_FORWARD_CAP * CMD_RUN_MULTIPLIER; // 400
const CMD_MAX_SIDE = CMD_SIDE_CAP * CMD_RUN_MULTIPLIER; //       320
const CMD_MAX_UP = CMD_UP_CAP * CMD_RUN_MULTIPLIER; //           400

// ---------------------------------------------------------------------------
// STOCK QUAKE II, for contrast. Two of the five steps above simply do not exist
// there, and this matters enough that every demo in the cvar chapter can be
// switched between the two:
//
//   step 2 (the diagonal normalizer)  SoF only. Quake II's CL_FinishMove has no
//                                     counterpart -- diagonals really are faster
//                                     in Q2, which is the bug SoF fixed.
//   step 3 (the 200/160 per-axis trim) SoF only. Q2 ships MSG_WriteDeltaUsercmd,
//                                     which writes forwardmove/sidemove as plain
//                                     shorts and clamps nothing. That function is
//                                     still in the SoF binary with zero callers.
//   step 4 (the run doubling)         In BOTH, but in different places: Q2 does
//                                     it client-side at the end of CL_BaseMove
//                                     ("adjust for speed key / running"), SoF
//                                     does it server-side in ClientThink after
//                                     the trim. Same x2 either way.
//
// So under Q2 rules your key angle is exactly atan2(cl_sidespeed,
// cl_forwardspeed) for every config, forever -- nothing can rotate it. Under SoF
// rules it only stays there until the trim starts biting.
// ---------------------------------------------------------------------------
const CMD_ENGINES = ["sof", "q2"];

function cmdEngine(opts) {
  return opts && opts.engine === "q2" ? "q2" : "sof";
}

// Run the whole chain for one fully-held key on each axis.
//
//   fwdCvar / sideCvar : what you typed in the console
//   opts.run           : the 0x20 button bit (default true -- cl_run 1)
//   opts.speedByte     : the 0..255 speed-scale byte (default 255 = healthy)
//   opts.engine        : "sof" (default) or "q2" -- see CMD_ENGINES above
//
// Returns every intermediate value so the UI can show where a number died.
function cmdChain(fwdCvar, sideCvar, opts) {
  const run = !opts || opts.run !== false;
  const speedByte = opts && opts.speedByte !== undefined ? opts.speedByte : 255;
  const engine = cmdEngine(opts);
  const isSof = engine === "sof";

  // 1. CL_BaseMove: cvar -> short, truncated. Both engines.
  const typed = { f: Math.trunc(fwdCvar), s: Math.trunc(sideCvar) };

  // 2. CL_FinishMove: diagonal normalizer, both-axes-only, direction-preserving.
  //    SoF only.
  let f = typed.f;
  let s = typed.s;
  let normalized = null;
  if (isSof && f !== 0 && s !== 0) {
    const len = Math.hypot(s, f);
    const big = Math.max(Math.abs(f), Math.abs(s));
    s = Math.trunc((s / len) * big);
    f = Math.trunc((f / len) * big);
    normalized = { f, s };
  }

  // 3. PAK_WriteDeltaUsercmd: per-axis clamp, written back into cl.cmds[].
  //    SoF only -- Q2's MSG_WriteDeltaUsercmd writes the shorts through untouched.
  const wire = isSof
    ? {
        f: Math.max(-CMD_FORWARD_CAP, Math.min(CMD_FORWARD_CAP, f)),
        s: Math.max(-CMD_SIDE_CAP, Math.min(CMD_SIDE_CAP, s)),
      }
    : { f, s };
  const trimmed = wire.f !== f || wire.s !== s;
  const rotatedByClamp = normalized !== null && trimmed;

  // 4. Run doubling, then the speed-scale byte, one truncation. Both engines
  //    (ClientThink in SoF, CL_BaseMove in Q2); the speed byte is SoF's only.
  const mult = run ? CMD_RUN_MULTIPLIER : 1;
  const scale = isSof ? speedByte * (1 / 255) : 1;
  const cmd = {
    f: Math.trunc(wire.f * mult * scale),
    s: Math.trunc(wire.s * mult * scale),
  };

  // 5. PM_AirMove: build the push, measure it, cap it (pmove.c:624-651)
  const rawPush = Math.hypot(cmd.f, cmd.s);
  const push = Math.min(rawPush, pm_maxspeed);
  const keyAngle = Math.atan2(cmd.s, cmd.f); // radians right of your crosshair

  return {
    engine,
    typed,
    normalized, // null when step 2 didn't run (one axis only, or Q2)
    wire,
    trimmed, // step 3 actually cut something
    cmd,
    rawPush, // length of the push before pm_maxspeed
    push, // wishspeed actually handed to PM_Accelerate
    keyAngle,
    atCap: rawPush >= pm_maxspeed, // ratio no longer affects push strength
    rotatedByClamp, // step 3 bit, so your angle is not what you typed
  };
}

// Push strength with a single key held. Step 2 is skipped entirely in this
// case (it needs both axes non-zero), so the raw cvar goes straight into the
// clamp. This is the constraint that pins cl_forwardspeed at 150 or above:
// anything less and you can no longer reach 300 running straight ahead.
// Under Q2 rules there is no clamp, so only the 300 cap applies.
function chainSingleAxis(cvar, axis, opts) {
  const run = !opts || opts.run !== false;
  const cap = cmdEngine(opts) === "q2"
    ? Infinity
    : axis === "side" ? CMD_SIDE_CAP : CMD_FORWARD_CAP;
  const mult = run ? CMD_RUN_MULTIPLIER : 1;
  return Math.min(Math.min(Math.trunc(Math.abs(cvar)), cap) * mult, pm_maxspeed);
}

// The lowest cvar value on one axis that still reaches pm_maxspeed with that
// key held alone. With the run doubling that's 300/2 = 150 -- which is why 150
// keeps turning up in good configs, and it has nothing to do with diagonals.
function chainFloorForFullSpeed(run) {
  return pm_maxspeed / (run === false ? 1 : CMD_RUN_MULTIPLIER);
}

// ---------------------------------------------------------------------------
// The two angles PM_Accelerate defines, both measured from your TRAVEL
// direction to your PUSH direction. (pmove.c:426-429)
//
//   currentspeed = DotProduct(velocity, wishdir) = |v| * cos(theta)
//   addspeed     = wishspeed - currentspeed
//   if (addspeed <= 0) return;                       <- the cliff
//   accelspeed   = accel * frametime * wishspeed;
//   if (accelspeed > addspeed) accelspeed = addspeed;
//
// deadAngle: narrower than this and addspeed goes negative -- the function
// returns having done nothing. Not "less speed". Zero speed.
// ---------------------------------------------------------------------------
function chainDeadAngle(speed, push) {
  if (push >= speed) return 0; // still under your own cap: any angle gains
  return Math.acos(push / speed);
}

// bestAngle: the angle that maximises the gain, which is the last angle before
// accelspeed stops being clipped by addspeed. Solve accel*dt*push = push - |v|*cos
// for cos:  cos(theta) = push * (1 - accel*dt) / |v|.
function chainBestAngle(speed, push, accel, frametime) {
  const c = (push * (1 - accel * frametime)) / speed;
  if (c >= 1) return 0;
  if (c <= -1) return Math.PI;
  return Math.acos(c);
}

// Speed gained (as speed-squared) in one tick at a given push-to-travel angle.
// Straight from |v + a*w|^2 = |v|^2 + 2*a*(v.w) + a^2.
function chainGainSq(speed, push, thetaRad, accel, frametime) {
  const current = speed * Math.cos(thetaRad);
  const addspeed = push - current;
  if (addspeed <= 0) return 0;
  const a = Math.min(accel * frametime * push, addspeed);
  return 2 * a * current + a * a;
}

// ---------------------------------------------------------------------------
// ONE WHOLE JUMP, tick by tick, instead of one tick in isolation.
//
// bestAngle above answers "where should the push be RIGHT NOW". Across a real
// flight two different things can happen and they are nothing alike:
//
//  TRACKING -- turn the mouse every tick so the push stays on bestAngle. Then
//    currentspeed is push*(1-accel*dt) going into every tick and push coming
//    out of it, so addspeed is re-opened by hand, every tick, by the act of
//    turning. |v|^2 then grows by exactly 2*a*push*(1-accel*dt) + a^2 per tick
//    -- 1791 with SoF's numbers -- and that rate does NOT depend on how fast
//    you already are. Speed is sqrt(v0^2 + 1791n): no ceiling, just sqrt.
//
//  FROZEN -- pick one yaw and hold it. wishdir is now fixed in world space, so
//    the ONLY thing that changes currentspeed is your own acceleration adding
//    accelspeed to it: it climbs by exactly `a` per tick and nothing re-opens
//    it. When it reaches wishspeed, addspeed is 0 and every remaining tick of
//    the jump is worth nothing at all. You get (push - v0.w)/a useful ticks.
//
// The sting is in that last line. Freeze on the one-tick "best angle", where
// v0.w is already push - a, and you get exactly ONE useful tick out of the
// whole jump. The best angle to freeze at is far wider, and it is the one that
// spends the budget exactly as the jump ends -- see chainFreezeAngleFor.
// ---------------------------------------------------------------------------
function chainJumpRun(startSpeed, ticks, push, accel, frametime, mode, freezeAngle) {
  let vx = startSpeed;
  let vy = 0;
  const a = accel * frametime * push;
  const speeds = [startSpeed];
  const currents = [];
  let live = 0;
  let deadAt = -1;

  for (let i = 0; i < ticks; i++) {
    const sp = Math.hypot(vx, vy);
    let wx, wy;
    if (mode === "track") {
      // re-aim: put the push back on bestAngle, measured off the CURRENT travel
      const th = chainBestAngle(sp, push, accel, frametime);
      const c = Math.cos(th);
      const s = Math.sin(th);
      wx = (vx / sp) * c - (vy / sp) * s;
      wy = (vx / sp) * s + (vy / sp) * c;
    } else {
      // world-fixed yaw, so a world-fixed wishdir, measured off the take-off run
      wx = Math.cos(freezeAngle);
      wy = Math.sin(freezeAngle);
    }

    const current = vx * wx + vy * wy; // DotProduct(velocity, wishdir)
    currents.push(current);
    const addspeed = push - current;
    if (addspeed > 0) {
      const accelspeed = Math.min(a, addspeed);
      vx += accelspeed * wx;
      vy += accelspeed * wy;
      live++;
    } else if (deadAt < 0) {
      deadAt = i;
    }
    speeds.push(Math.hypot(vx, vy));
  }

  return {
    speeds, // ticks+1 long, speeds[0] is take-off
    currents, // DotProduct(velocity, wishdir) entering each tick
    live, // ticks that actually moved you
    deadAt, // first tick that returned on addspeed <= 0, or -1
    finalSpeed: Math.hypot(vx, vy),
    headingTurned: Math.atan2(vy, vx), // how far your route swung, for the next jump
  };
}

// The frozen aim that spends the whole 300 budget exactly as the jump ends:
// solve v0*cos(theta) + a*ticks = push. Anything narrower runs dry early and
// coasts; anything wider never finishes spending and wastes the width.
function chainFreezeAngleFor(startSpeed, ticks, push, accel, frametime) {
  const c = (push - accel * frametime * push * ticks) / startSpeed;
  if (c >= 1) return 0;
  if (c <= -1) return Math.PI;
  return Math.acos(c);
}

// How fast your mouse has to turn, in radians per tick, to hold a given
// push-to-travel angle while the velocity itself is rotating under you. This is
// the "delta per tick" the dial's static angle never shows.
function chainTrackRate(speed, push, accel, frametime, theta) {
  return (accel * frametime * push * Math.sin(theta)) / speed;
}

// The speed at which your crosshair sits exactly on your direction of travel,
// i.e. where bestAngle(v) == keyAngle. The trajectory always curves towards the
// push, so "inside the turn" is the push side of your travel: below this speed
// bestAngle < keyAngle and you aim OUTSIDE the turn, above it you aim inside.
// Solve push*(1-accel*dt)/v = cos(keyAngle).
function chainAimedStraightSpeed(keyAngle, push, accel, frametime) {
  const c = Math.cos(keyAngle);
  if (c <= 1e-6) return Infinity; // 90 deg key angle never aims straight
  return (push * (1 - accel * frametime)) / c;
}

// ---------------------------------------------------------------------------
// PMF_TIME_LAND, in real milliseconds.  Pmove_REAL (SoF.exe 0x200549fd):
//
//      mov  dl, [ecx+1Ch]        ; cmd.msec
//      shr  edx, 3               ; msec >> 3
//      jnz  short have_msec
//      mov  edx, 1               ; if (!msec) msec = 1
//   have_msec:
//      cmp  edx, esi             ; vs pm_time
//      jl   short subtract
//      ...clear PMF_TIME_* and pm_time = 0
//   subtract:
//      sub  al, dl               ; pm_time -= msec
//
// pm_time is a BYTE counted in units of 8 ms, not in ticks -- so the 18 and 25
// that PM_CatagorizePosition stores are 144 ms and 200 ms nominally. But the
// `if (!msec) msec = 1` floor means that once your frame time drops below 8 ms
// (above 125 fps) the counter can only fall by 1 per frame, so the lockout
// becomes a fixed number of FRAMES and gets shorter in real time the faster
// you run. That is a genuine, measurable framerate advantage.
// ---------------------------------------------------------------------------
function chainLockoutMs(pmTime, frameMsec) {
  if (!pmTime) return 0;
  const msec = Math.max(1, Math.floor(frameMsec) >> 3);
  return Math.ceil(pmTime / msec) * frameMsec;
}
