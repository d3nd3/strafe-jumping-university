function mountCh7Recap(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 14 · Recap</div>
    <h1>What you just learned</h1>

    <p class="lede">Strafe-jumping isn't a bug or "just skill." It's a direct result of a few
    lines of code, and you just watched every one of them run.</p>

    <div class="panel">
      <ol style="max-width:760px;font-size:15.5px;line-height:1.9">
        <li>Your keys + mouse become a <b>target direction</b> and a <b>target speed</b> — Ch. 3.</li>
        <li>The boost function only adds speed <b>toward the target</b>, and never touches speed that's sideways to it — Ch. 4.</li>
        <li>In the air, the boost is 10× weaker than on the ground — Ch. 5.</li>
        <li>The ground doesn't just push harder — it also fights back every tick with friction. The air does neither: zero push-back, ever — Ch. 6.</li>
        <li>Because sideways speed is never removed, and nothing in the air ever claws it back, turning at the right speed lets a little get added every instant, all flight long — Ch. 7.</li>
        <li>You flew it yourself, and froze a real instant to see the exact numbers behind it — Ch. 8.</li>
        <li>You watched it all happen in full 3D, from behind your own character — Ch. 9.</li>
        <li>Real SOF and real Quake II's engine code quietly diverge in fifteen places — landing, walls, stairs, jump stacking — plus three big ones outside <code>pmove.c</code> entirely, in the client and game DLL the leak doesn't contain — Ch. 10.</li>
        <li>One of those divergences has teeth: SOF's landing lockout kills classic flat bunny-hopping outright. Only jumping onto rising ground escapes it — and its countdown is measured in 8&nbsp;ms units, so above 125&nbsp;fps it gets shorter the faster you run — Ch. 11.</li>
        <li>Your two movement cvars don't set a speed at all — the client shrinks the diagonal, trims each axis at a different limit, and doubles the result, so the push saturates at 300 for every sane config and only the <b>angle</b> survives. A wider angle puts your crosshair nearer your actual route, which is the whole benefit — Ch. 12.</li>
        <li>Put together: fly each hop near its own optimal turn rate, alternate which side of the target you lead on so the wide arcs cancel sideways, and re-aim during the landing lockout where ground accel does the work 10× faster — Ch. 13.</li>
      </ol>
    </div>

    <h2>Word list</h2>
    <p class="muted">Real code name shown next to each, same as everywhere else in this app.</p>
    <dl class="glossary">
      <dt>target direction <span class="varname">wishdir</span></dt><dd>The way your keys + mouse say you want to go right now.</dd>
      <dt>target speed <span class="varname">wishspeed</span></dt><dd>How fast you're trying to go, capped at 300.</dd>
      <dt>speed toward target <span class="varname">currentspeed</span></dt><dd>Of your current motion, how much already points the target way. Sideways motion doesn't count.</dd>
      <dt>room left to speed up <span class="varname">addspeed</span></dt><dd>Target speed minus speed toward target. Zero means no boost this instant.</dd>
      <dt>boost power <span class="varname">accel</span></dt><dd>How strong the push is: 10 on the ground, 1 in the air by default.</dd>
      <dt>tick length <span class="varname">frametime</span></dt><dd>How much time passed since the last update.</dd>
      <dt>top speed (300) <span class="varname">pm_maxspeed</span></dt><dd>The cap on your <em>target</em> speed — not a cap on your actual speed. That gap is the whole trick.</dd>
      <dt>ground push-back (6) <span class="varname">pm_friction</span></dt><dd>How hard the ground claws speed back each tick. The air has no equivalent at all.</dd>
      <dt>friction floor (100) <span class="varname">pm_stopspeed</span></dt><dd>Below this speed, ground friction removes a flat amount each tick instead of a percentage — why you stop crisply instead of crawling forever.</dd>
      <dt>landing lockout <span class="varname">PMF_TIME_LAND</span></dt><dd>Set on any landing faster than &minus;200 u/s; blocks your next jump until a byte counter (18, or 25 below &minus;400) counts down in units of 8&nbsp;ms. A flat jump always lands at exactly &minus;270, so it always fires.</dd>
      <dt>forward input <span class="varname">cl_forwardspeed</span></dt><dd>Starting point for <span class="varname">forwardmove</span> while W is held — trimmed at 200, then doubled for running. Must be 150 or more or you cap your own straight-line speed.</dd>
      <dt>strafe input <span class="varname">cl_sidespeed</span></dt><dd>Same for <span class="varname">sidemove</span> while A/D is held, but trimmed at <b>160</b>, not 200. That mismatch is the entire reason the two numbers set an angle.</dd>
      <dt>key angle <span class="varname">atan2(sidemove, forwardmove)</span></dt><dd>The fixed gap between where your crosshair points and where your keys push. Your config picks it once; the mouse can't change it.</dd>
      <dt>the cliff <span class="varname">addspeed &lt;= 0</span></dt><dd>Push any closer to your direction of travel than <span class="varname">acos(wishspeed / speed)</span> and the boost function returns having done nothing at all. Not less speed — none.</dd>
    </dl>

    <div class="callout good" style="margin-top:30px">
      Go back to Chapter 9 and try to beat your own top speed in 3D.
    </div>

    <a class="next-link" href="#ch1-hook">↺ Back to the start</a>
  `;
}
