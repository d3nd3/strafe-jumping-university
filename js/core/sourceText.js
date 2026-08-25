// Display-only copies of the real pmove.c source and the JS port, used by the
// dual code panel (js/ui/codePanel.js). These are text for rendering/line
// highlighting; the code that actually *runs* the simulation lives in
// physics.js. Line numbers on the C side are the real pmove.c line numbers.
// Line numbers on the JS side are local to each block (1-based).

function block(startLine, text) {
  const lines = text.replace(/^\n/, "").replace(/\n$/, "").split("\n");
  return lines.map((content, i) => ({ n: startLine + i, content }));
}

// --- pmove.c : PM_Accelerate (lines 407-422) --------------------------------
const C_ACCELERATE = block(407, `
void PM_Accelerate (vec3_t wishdir, float wishspeed, float accel)
{
	int			i;
	float		addspeed, accelspeed, currentspeed;

	currentspeed = DotProduct (pml.velocity, wishdir);
	addspeed = wishspeed - currentspeed;
	if (addspeed <= 0)
		return;
	accelspeed = accel*pml.frametime*wishspeed;
	if (accelspeed > addspeed)
		accelspeed = addspeed;

	for (i=0 ; i<3 ; i++)
		pml.velocity[i] += accelspeed*wishdir[i];
}
`);

// --- js/core/physics.js : pmAccelerateSteps (display copy) ------------------
const ACCELERATE_JS_TEXT = `
function* pmAccelerateSteps(velocity, wishdir, wishspeed, accel, frametime) {
  const currentspeed = DotProduct(velocity, wishdir);

  const addspeed = wishspeed - currentspeed;

  if (addspeed <= 0) {
    return; // no room left to accelerate -- already past what we wished for
  }

  let accelspeed = accel * frametime * wishspeed;

  if (accelspeed > addspeed) {
    accelspeed = addspeed;
  }

  for (let i = 0; i < 3; i++) {
    velocity[i] += accelspeed * wishdir[i];
  }
}
`;
const JS_ACCELERATE = block(1, ACCELERATE_JS_TEXT);

const ACCELERATE_MAP = {
  decl: { c: [409, 410], js: [1] },
  currentspeed: { c: [412], js: [2] },
  addspeed: { c: [413], js: [4] },
  "early-return": { c: [414, 415], js: [6, 7] },
  accelspeed: { c: [416], js: [10] },
  clamp: { c: [417, 418], js: [12, 13] },
  apply: { c: [420, 421], js: [16, 17] },
};

// Plain-English descriptions for each PM_Accelerate step, shared by every
// debugger instance that walks this function (Chapter 3's own debugger,
// and Chapter 6/7's "Freeze & inspect" panels) -- one set of wording, not
// three copies that can drift out of sync. Each plain term is immediately
// followed by the exact variable name it refers to in the code panel
// (amber, monospace) so nobody has to hover or look anything up.
const VARNAME = (name) => `<span class="varname">${name}</span>`;
const ACCELERATE_DESCRIPTIONS = {
  decl: `Three inputs: which way you're trying to go (${VARNAME("wishdir")}), how fast (${VARNAME("wishspeed")}), and how strong the boost is (${VARNAME("accel")}). ${VARNAME("wishdir")} is always exactly 1 unit long — direction only, no speed, guaranteed by the caller.`,
  currentspeed: `${VARNAME("currentspeed")}: how much of your current motion (${VARNAME("velocity")}) already points toward the target. Sideways motion doesn't count. Unlike ${VARNAME("wishdir")}, ${VARNAME("velocity")}'s length is your real current speed — 0, 300, anything.`,
  addspeed: `Work out how much speed room is left (${VARNAME("addspeed")}) before you'd hit your target speed.`,
  "early-return": `No room left (${VARNAME("addspeed")} ≤ 0) — you're already going fast enough that way. Nothing changes.`,
  accelspeed: `Work out this step's boost (${VARNAME("accelspeed")}): boost power × tick length × target speed.`,
  clamp: `Don't overshoot. If the boost (${VARNAME("accelspeed")}) is bigger than the room left (${VARNAME("addspeed")}), shrink it to fit.`,
  apply: `Add the boost — but <strong>only</strong> in the direction you're trying to go (${VARNAME("wishdir")}). Everything sideways to that is left completely alone.`,
};
function describeAccelerateStep(step) {
  return `<div>${ACCELERATE_DESCRIPTIONS[step.id] || ""}</div>`;
}

// --- pmove.c : PM_AirAccelerate (lines 424-441) ------------------------------
const C_AIR_ACCELERATE = block(424, `
void PM_AirAccelerate (vec3_t wishdir, float wishspeed, float accel)
{
	int			i;
	float		addspeed, accelspeed, currentspeed, wishspd = wishspeed;

	if (wishspd > 30)
		wishspd = 30;
	currentspeed = DotProduct (pml.velocity, wishdir);
	addspeed = wishspd - currentspeed;
	if (addspeed <= 0)
		return;
	accelspeed = accel * wishspeed * pml.frametime;
	if (accelspeed > addspeed)
		accelspeed = addspeed;

	for (i=0 ; i<3 ; i++)
		pml.velocity[i] += accelspeed*wishdir[i];
}
`);

const JS_AIR_ACCELERATE = block(1, `
function* pmAirAccelerateSteps(velocity, wishdir, wishspeed, accel, frametime) {
  let wishspd = wishspeed;

  if (wishspd > 30) {
    wishspd = 30;
  }

  const currentspeed = DotProduct(velocity, wishdir);

  const addspeed = wishspd - currentspeed;

  if (addspeed <= 0) {
    return;
  }

  let accelspeed = accel * wishspeed * frametime; // note: FULL wishspeed here

  if (accelspeed > addspeed) {
    accelspeed = addspeed;
  }

  for (let i = 0; i < 3; i++) {
    velocity[i] += accelspeed * wishdir[i];
  }
}
`);

const AIR_ACCELERATE_MAP = {
  decl: { c: [426, 427], js: [1] },
  "wishspd-init": { c: [427], js: [1] },
  "wishspd-clamp": { c: [429, 430], js: [3, 4, 5] },
  currentspeed: { c: [431], js: [7] },
  addspeed: { c: [432], js: [9] },
  "early-return": { c: [433, 434], js: [11, 12] },
  accelspeed: { c: [435], js: [15] },
  clamp: { c: [436, 437], js: [17, 18] },
  apply: { c: [439, 440], js: [21, 22] },
};

// --- pmove.c : PM_AirMove, full function (lines 585-674) --------------------
const C_AIR_MOVE = block(585, `
void PM_AirMove (void)
{
	int			i;
	vec3_t		wishvel;
	float		fmove, smove;
	vec3_t		wishdir;
	float		wishspeed;
	float		maxspeed;

	fmove = pm->cmd.forwardmove;
	smove = pm->cmd.sidemove;

//!!!!! pitch should be 1/3 so this isn't needed??!
#ifdef SOF
	pml.forward[2] = 0;
	pml.right[2] = 0;
	VectorNormalize (pml.forward);
	VectorNormalize (pml.right);
#endif

	for (i=0 ; i<2 ; i++)
		wishvel[i] = pml.forward[i]*fmove + pml.right[i]*smove;
	wishvel[2] = 0;

	PM_AddCurrents (wishvel);

	VectorCopy (wishvel, wishdir);
	wishspeed = VectorNormalize(wishdir);

//
// clamp to server defined max speed
//
	// disassembly of retail SoF.exe shows this test is actually
	// (PMF_DUCKED && PMF_ON_GROUND) -- ducking mid-air doesn't cap you
	maxspeed = (pm->s.pm_flags & PMF_DUCKED) ? pm_duckspeed : pm_maxspeed;

	if (wishspeed > maxspeed)
	{
		VectorScale (wishvel, maxspeed/wishspeed, wishvel);
		wishspeed = maxspeed;
	}

	if ( pml.ladder )
	{
		PM_Accelerate (wishdir, wishspeed, pm_accelerate);
		if (!wishvel[2])
		{
			if (pml.velocity[2] > 0)
			{
				pml.velocity[2] -= pm->s.gravity * pml.frametime;
				if (pml.velocity[2] < 0)
					pml.velocity[2]  = 0;
			}
			else
			{
				pml.velocity[2] += pm->s.gravity * pml.frametime;
				if (pml.velocity[2] > 0)
					pml.velocity[2]  = 0;
			}
		}
		PM_StepSlideMove ();
	}
	else if ( pm->groundentity )
	{	// walking on ground
		pml.velocity[2] = 0; //!!! this is before the accel
		PM_Accelerate (wishdir, wishspeed, pm_accelerate);

		// PGM	-- fix for negative trigger_gravity fields
		#ifdef SOF
		pml.velocity[2] = 0;
		#else
		if(pm->s.gravity > 0)
			pml.velocity[2] = 0;
		else
			pml.velocity[2] -= pm->s.gravity * pml.frametime;
		#endif
		// PGM
		if (!pml.velocity[0] && !pml.velocity[1])
			return;
		PM_StepSlideMove ();
	}
	else
	{	// not on ground, so little effect on velocity
		// reconstructed from the disassembly (id's public source branches on
		// pm_airaccelerate here; SoF's compiled PM_AirMove doesn't):
		PM_Accelerate (wishdir, wishspeed, pm_airaccelerate);
		// add gravity
		pml.velocity[2] -= pm->s.gravity * pml.frametime;
		PM_StepSlideMove (); //sof1 slidefix here. velocity clamped to a mininum.
	}
}
`);

// --- js/core/physics.js : pmAirMoveSteps (display copy, airborne path only) -
const JS_AIR_MOVE = block(1, `
function* pmAirMoveSteps(state, cmd, frametime) {
  const { forward, right } = AngleVectorsYaw(state.yaw, ..., ...);

  const fmove = cmd.forwardmove;
  const smove = cmd.sidemove;

  const wishvel = [
    forward[0] * fmove + right[0] * smove,
    forward[1] * fmove + right[1] * smove,
    0,
  ];

  const wishdir = [...wishvel];
  let wishspeed = VectorNormalize(wishdir);

  const maxspeed = pm_maxspeed;
  if (wishspeed > maxspeed) {
    VectorScale(wishvel, maxspeed / wishspeed, wishvel);
    wishspeed = maxspeed;
  }

  // -- this app only ever simulates the airborne branch --
  // No if/else here -- confirmed via disassembly that retail SoF just
  // always calls the plain accelerate formula, parameterized by
  // pm_airaccelerate (see physics.js for the full IDA evidence).
  yield* pmAccelerateSteps(state.velocity, wishdir, wishspeed, pm_airaccelerate, frametime);
  // gravity + PM_StepSlideMove intentionally omitted: this app is a pure
  // horizontal air-strafe model, see Chapter 6 for why.
}
`);

const AIR_MOVE_MAP = {
  basis: { c: [598, 603], js: [2] },
  wishvel: { c: [605, 607], js: [4, 5, 6, 7, 8, 9] },
  wishdir: { c: [611, 612], js: [11, 12] },
  "clamp-maxspeed": { c: [619, 623], js: [14, 15, 16, 17] },
  branch: { c: [666, 669], js: [22, 23, 24, 25, 26] },
  done: { c: [671, 673], js: [29] },
};

// Plain-English descriptions for PM_AirMove's own steps -- the code that
// *calls* PM_Accelerate, answering "where did wishdir/wishspeed actually
// come from before we got here?" Shares ACCELERATE_DESCRIPTIONS for the
// delegated accelerate steps (see describeAirMoveToAccelerate below), so
// this only needs to cover the steps unique to PM_AirMove itself.
const AIR_MOVE_DESCRIPTIONS = {
  basis: `Your view's yaw turns into two unit vectors: ${VARNAME("forward")} and ${VARNAME("right")} (90° clockwise from it). Keys haven't entered the picture yet.`,
  wishvel: `Now your keys enter it. ${VARNAME("wishvel")} = ${VARNAME("forward")}×${VARNAME("fmove")} + ${VARNAME("right")}×${VARNAME("smove")} — the velocity you're asking for this instant. Rebuilt from scratch every tick, separate from ${VARNAME("velocity")} (your real motion).`,
  wishdir: `${VARNAME("wishdir")} = ${VARNAME("wishvel")}, forced to length 1. ${VARNAME("wishspeed")} gets ${VARNAME("wishvel")}'s old length — your <em>intended</em> speed, not your actual speed (${VARNAME("velocity")}'s length). They can differ by hundreds of u/s; that gap is what circle-strafing exploits.`,
  "clamp-maxspeed": `${VARNAME("wishspeed")} gets capped here (300, or 100 crouched) — but only what you can <em>ask for</em> each tick. Your real velocity is never capped by this line, which is how circle-strafing climbs past 300. <br/><br/>Two verified quirks: the crouch check here is leaked-source-only — disassembling retail SoF.exe shows the real condition also requires <code>PMF_ON_GROUND</code> (crouching mid-air doesn't cap you). And this line's own <code>VectorScale(wishvel, ...)</code> is dead code — nothing reads ${VARNAME("wishvel")} again afterward, only ${VARNAME("wishdir")}/${VARNAME("wishspeed")} reach ${VARNAME("PM_Accelerate")}.`,
  branch: `Airborne, so boost power is ${VARNAME("pm_airaccelerate")} — hardcoded to <b>1</b> in the retail binary, not a togglable cvar. id's public source branches between two formulas here; SoF's compiled ${VARNAME("PM_AirMove")} has no such branch, just one call using ${VARNAME("pm_airaccelerate")} as its strength.`,
  done: `${VARNAME("velocity")} is now updated, using the ${VARNAME("wishdir")}/${VARNAME("wishspeed")} built above. One full tick, key press to velocity change.`,
};

function describeAirMoveToAccelerate(step) {
  if (step.id in ACCELERATE_DESCRIPTIONS) return describeAccelerateStep(step);
  return `<div>${AIR_MOVE_DESCRIPTIONS[step.id] || step.label}</div>`;
}

// A second copy of the JS accelerate source, renumbered to sit right after
// JS_AIR_MOVE in one continuous pane -- so stepping into the delegated
// PM_Accelerate call highlights real lines in the SAME pane instead of
// jumping to a different debugger. (JS_ACCELERATE above keeps its own
// 1-based numbering for the standalone Chapter 3 debugger; this is only a
// renumbered display copy of the identical text, not a second
// implementation.)
const JS_ACCELERATE_INLINE = block(101, ACCELERATE_JS_TEXT);
const C_AIRMOVE_TO_ACCELERATE = [...C_AIR_MOVE, ...C_ACCELERATE];
const JS_AIRMOVE_TO_ACCELERATE = [...JS_AIR_MOVE, ...JS_ACCELERATE_INLINE];
const AIRMOVE_TO_ACCELERATE_MAP = {
  ...AIR_MOVE_MAP,
  decl: { c: [409, 410], js: [101] },
  currentspeed: { c: [412], js: [102] },
  addspeed: { c: [413], js: [104] },
  "early-return": { c: [414, 415], js: [106, 107] },
  accelspeed: { c: [416], js: [110] },
  clamp: { c: [417, 418], js: [112, 113] },
  apply: { c: [420, 421], js: [116, 117] },
};

// Plain-English descriptions for PM_AirAccelerate's own steps (the 30-cap
// variant). Shares nothing with ACCELERATE_DESCRIPTIONS -- despite looking
// almost identical, the two functions differ in a way worth spelling out
// (see "accelspeed" below). This is real, compiled-elsewhere Quake 2 code,
// but not confirmed present in SoF's own source at all -- see the callout
// in Chapter 3 -- so its description doesn't assume a SoF caller exists.
const AIR_ACCELERATE_DESCRIPTIONS = {
  decl: `Same 3 inputs as PM_Accelerate. id's public source calls this with ${VARNAME("accel")} = <code>pm_airaccelerate</code>, a cvar off by default. SoF's compiled binary never calls this function at all.`,
  "wishspd-init": `${VARNAME("wishspd")} starts as a copy of ${VARNAME("wishspeed")} — the real one is left alone from here on.`,
  "wishspd-clamp": `Clamp ${VARNAME("wishspd")} to 30 if it's higher. This is the function's whole point: "room left" below is measured against a gentle 30 u/s cap, so a strong boost power doesn't feel twitchy in the air.`,
  currentspeed: `Same as PM_Accelerate: how much of ${VARNAME("velocity")} already points toward ${VARNAME("wishdir")}.`,
  addspeed: `Room left to speed up — but measured against the 30-capped ${VARNAME("wishspd")}, not the real ${VARNAME("wishspeed")}.`,
  "early-return": `No room left (${VARNAME("addspeed")} ≤ 0) — nothing changes.`,
  accelspeed: `The catch: this step's boost size uses the FULL, uncapped ${VARNAME("wishspeed")} — not the 30-capped ${VARNAME("wishspd")} used just above. Two different numbers, same function.`,
  clamp: `Don't overshoot the capped room left — shrink ${VARNAME("accelspeed")} to fit if it's bigger.`,
  apply: `Add the boost, only along ${VARNAME("wishdir")}.`,
};
function describeAirAccelerateStep(step) {
  return `<div>${AIR_ACCELERATE_DESCRIPTIONS[step.id] || ""}</div>`;
}

// --- pmove.c : PM_Friction (lines 369-411) -----------------------------------
const C_FRICTION = block(369, `
void PM_Friction (void)
{
	float	*vel;
	float	speed, newspeed, control;
	float	friction;
	float	drop;

	vel = pml.velocity;

	speed = sqrt(vel[0]*vel[0] +vel[1]*vel[1] + vel[2]*vel[2]);
	if (speed < 1)
	{
		vel[0] = 0;
		vel[1] = 0;
		return;
	}

	drop = 0;

// apply ground friction
	if ((pm->groundentity && pml.groundsurface && !(pml.groundsurface->flags & SURF_SLICK) ) || (pml.ladder) )
	{
		friction = pm_friction;
		control = speed < pm_stopspeed ? pm_stopspeed : speed;
		drop += control*friction*pml.frametime;
	}

// apply water friction
	if (pm->waterlevel && !pml.ladder)
		drop += speed*pm_waterfriction*pm->waterlevel*pml.frametime;

// scale the velocity
	newspeed = speed - drop;
	if (newspeed < 0)
	{
		newspeed = 0;
	}
	newspeed /= speed;

	vel[0] = vel[0] * newspeed;
	vel[1] = vel[1] * newspeed;
	vel[2] = vel[2] * newspeed;
}
`);
const FRICTION_HIGHLIGHT = [378, 389, 392, 393, 401];
