// ---------------------------------------------------------------------------
// The command chain: what actually happens to cl_forwardspeed / cl_sidespeed
// between your keyboard and PM_AirMove.
//
// pmove.c only shows the LAST step of this ("fmove = pm->cmd.forwardmove").
// The leaked source has no client and no game DLL, so the three steps that run
// *before* Pmove() are invisible in it. Every one of them was read straight out
// of the shipped binaries. Addresses below are real; each claim is checkable.
//
//   sof-bin  = Linux patch-1.06a ELF (has symbols)
//   SoF.exe  = Windows retail client
//   gamex86  = Windows retail game DLL (server-side movement)
//
// -- STEP 1 -- CL_BaseMove              sof-bin 0x80b8f04
//
//      cmd->forwardmove += (short)(int)(cl_forwardspeed->value * keyFraction);
//      cmd->sidemove    += (short)(int)(cl_sidespeed->value    * keyFraction);
//
//    keyFraction is 1.0 while the key was held for the whole frame. So with a
//    key fully held these are just your cvar values, truncated to whole
//    numbers. Nothing is clamped here -- which is why people assume typing a
//    bigger number does something.
//
//    The same function's last two lines set the "run" bit:
//      if ((in_speed.state & 1) != (int)cl_run->value) cmd->buttons |= 0x20;
//    i.e. cl_run 1 (always-run) sets it whenever +speed is NOT held. Remember
//    that bit -- step 3 doubles everything when it's on.
//
// -- STEP 2 -- PAK_WriteDeltaUsercmd     sof-bin 0x80ba99c, SoF.exe 0x20005e3d
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
//    same number. This is the single most important fact on this page.
//
//    Three things make this clamp inescapable rather than cosmetic:
//      a) it writes back THROUGH the pointer, into cl.cmds[] itself -- the
//         client's own command ring buffer, not a scratch copy;
//      b) CL_PredictMovement (sof-bin 0x80cefa0) replays out of that same
//         cl.cmds[] array, so client-side prediction sees the clamped values;
//      c) the server re-applies the identical clamp on receive, in
//         PAK_ReadDeltaUsercmd (sof-bin 0x80ba5bc), so a hacked client gains
//         nothing.
//    MSG_WriteDeltaUsercmd, the plain Quake 2 version with no clamp at all,
//    is still in the binary but has zero callers -- dead code.
//
// -- STEP 3 -- ClientThink               gamex86 0x500f53a0
//    (mirrored by CL_PredictMovement     sof-bin 0x80cefa0)
//
//      if ((cmd.buttons & 0x20) && !(client->ps.pmove.pm_flags & 0x40)) {
//          forwardmove *= 2;   sidemove *= 2;   upmove *= 2;
//      }
//      scale = (byte)(GetSpeedScale(ent) * 255.0) * (1/255.0);
//      forwardmove = (int)(forwardmove * scale);
//      sidemove    = (int)(sidemove    * scale);
//      gi.pmove(&pm);
//
//    The run bit DOUBLES your movement command, after the clamp. Then a 0..255
//    "speed scale" byte (1.0 = healthy) scales it. This doubling is the piece
//    that makes the whole rest of the chapter work: it is what pushes an
//    ordinary config past pm_maxspeed, where the ratio stops mattering.
//
//    upmove is doubled but never scaled -- read the disassembly again if that
//    looks like a typo. It isn't.
//
// -- STEP 4 -- PM_AirMove                sof-bin 0x812e278, SoF.exe 0x200531a0
//
//    Only here does pmove.c pick up the story (pmove.c:612-651).
// ---------------------------------------------------------------------------

// Step 2's two clamps. Everything interesting on this page comes from the fact
// that these two numbers differ.
const CMD_FORWARD_CAP = 200;
const CMD_SIDE_CAP = 160;
const CMD_UP_CAP = 200;

// Step 3's run doubling.
const CMD_RUN_MULTIPLIER = 2;

// Run the whole chain for one fully-held key on each axis.
//
//   fwdCvar / sideCvar : what you typed in the console
//   opts.run           : the 0x20 button bit (default true -- cl_run 1)
//   opts.speedByte     : the 0..255 speed-scale byte (default 255 = healthy)
//
// Returns every intermediate value so the UI can show where a number died.
function cmdChain(fwdCvar, sideCvar, opts) {
  const run = !opts || opts.run !== false;
  const speedByte = opts && opts.speedByte !== undefined ? opts.speedByte : 255;

  // 1. CL_BaseMove: cvar -> short, truncated
  const typed = { f: Math.trunc(fwdCvar), s: Math.trunc(sideCvar) };

  // 2. PAK_WriteDeltaUsercmd: per-axis clamp, written back into cl.cmds[]
  const wire = {
    f: Math.max(-CMD_FORWARD_CAP, Math.min(CMD_FORWARD_CAP, typed.f)),
    s: Math.max(-CMD_SIDE_CAP, Math.min(CMD_SIDE_CAP, typed.s)),
  };

  // 3. ClientThink: run doubling, then the speed-scale byte, one truncation
  const mult = run ? CMD_RUN_MULTIPLIER : 1;
  const scale = speedByte * (1 / 255);
  const cmd = {
    f: Math.trunc(wire.f * mult * scale),
    s: Math.trunc(wire.s * mult * scale),
  };

  // 4. PM_AirMove: build the push, measure it, cap it (pmove.c:624-651)
  const rawPush = Math.hypot(cmd.f, cmd.s);
  const push = Math.min(rawPush, pm_maxspeed);
  const keyAngle = Math.atan2(cmd.s, cmd.f); // radians right of your crosshair

  return {
    typed,
    wire,
    cmd,
    rawPush, // length of the push before pm_maxspeed
    push, // wishspeed actually handed to PM_Accelerate
    keyAngle,
    atCap: rawPush >= pm_maxspeed, // ratio no longer affects push strength
    forwardWasted: typed.f > CMD_FORWARD_CAP,
    sideWasted: typed.s > CMD_SIDE_CAP,
    // Single-axis push strengths -- what you get walking/flying on one key.
    // These are what force cl_forwardspeed >= 150; see chainFloorForFullSpeed.
    forwardOnly: Math.trunc(wire.f * mult * scale),
    sideOnly: Math.trunc(wire.s * mult * scale),
  };
}

// The lowest cvar value on one axis that still reaches pm_maxspeed with that
// key held alone. With the run doubling that's 300/2 = 150 -- which is exactly
// why 150 keeps turning up in good configs, and it has nothing to do with
// diagonals.
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

// The speed at which your crosshair sits exactly on your direction of travel,
// i.e. where bestAngle(v) == keyAngle. Below it you aim inside the turn, above
// it you aim outside. Solve push*(1-accel*dt)/v = cos(keyAngle).
function chainAimedStraightSpeed(keyAngle, push, accel, frametime) {
  const c = Math.cos(keyAngle);
  if (c <= 1e-6) return Infinity; // 90 deg key angle never aims straight
  return (push * (1 - accel * frametime)) / c;
}
