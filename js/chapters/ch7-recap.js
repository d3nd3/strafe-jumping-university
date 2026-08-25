function mountCh7Recap(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 13 · Recap</div>
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
        <li>Real SOF and real Quake II's engine code quietly diverge in a dozen small places — landing, walls, stairs, jump stacking — most of it never touching the core accelerate math at all — Ch. 10.</li>
        <li>One of those divergences has teeth: SOF's landing lockout kills classic flat bunny-hopping outright. Only jumping onto rising ground escapes it — Ch. 11.</li>
        <li>Your keybinds set a real diagonal angle before the mouse ever moves — <span class="varname">cl_sidespeed</span> &gt; <span class="varname">cl_forwardspeed</span> widens it, buying passive speed gain further into the run — Ch. 12.</li>
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
      <dt>landing lockout <span class="varname">PMF_TIME_LAND</span></dt><dd>Set on any landing faster than &minus;200 u/s; blocks your next jump for 18-25 ticks. A flat jump always lands at exactly &minus;270, so it always fires.</dd>
      <dt>forward input <span class="varname">cl_forwardspeed</span></dt><dd>How much <span class="varname">forwardmove</span> gets sent while W is held. Combines with sidespeed to set your keyboard-only diagonal angle.</dd>
      <dt>strafe input <span class="varname">cl_sidespeed</span></dt><dd>How much <span class="varname">sidemove</span> gets sent while A/D is held. Wider than forwardspeed = a wider free diagonal, less mouse-flicking needed to keep gaining.</dd>
    </dl>

    <div class="callout good" style="margin-top:30px">
      Go back to Chapter 9 and try to beat your own top speed in 3D.
    </div>

    <a class="next-link" href="#ch1-hook">↺ Back to the start</a>
  `;
}
