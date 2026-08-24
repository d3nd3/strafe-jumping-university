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
const JS_ACCELERATE = block(1, `
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
`);

const ACCELERATE_MAP = {
  decl: { c: [409, 410], js: [1] },
  currentspeed: { c: [412], js: [2] },
  addspeed: { c: [413], js: [4] },
  "early-return": { c: [414, 415], js: [6, 7] },
  accelspeed: { c: [416], js: [10] },
  clamp: { c: [417, 418], js: [12, 13] },
  apply: { c: [420, 421], js: [16, 17] },
};

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
		if (pm_airaccelerate)
			PM_AirAccelerate (wishdir, wishspeed, pm_accelerate);
		else
			PM_Accelerate (wishdir, wishspeed, 1);
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
  if (pm_airaccelerate) {
    yield* pmAirAccelerateSteps(state.velocity, wishdir, wishspeed, pm_accelerate, frametime);
  } else {
    yield* pmAccelerateSteps(state.velocity, wishdir, wishspeed, 1, frametime);
  }
  // gravity + PM_StepSlideMove intentionally omitted: this app is a pure
  // horizontal air-strafe model, see Chapter 6 for why.
}
`);

const AIR_MOVE_MAP = {
  basis: { c: [598, 603], js: [2] },
  wishvel: { c: [605, 607], js: [4, 5, 6, 7, 8, 9] },
  wishdir: { c: [611, 612], js: [11, 12] },
  "clamp-maxspeed": { c: [619, 623], js: [14, 15, 16, 17] },
  branch: { c: [666, 669], js: [20] },
  done: { c: [671, 673], js: [25] },
};
