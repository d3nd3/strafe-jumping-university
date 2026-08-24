function mountCh7Recap(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 9 · Recap</div>
    <h1>What you just learned</h1>

    <p class="lede">Strafe-jumping isn't a bug or "just skill." It's a direct result of a few
    lines of code, and you just watched every one of them run.</p>

    <div class="panel">
      <ol style="max-width:760px;font-size:15.5px;line-height:1.9">
        <li>Your keys + mouse become a <b>target direction</b> and a <b>target speed</b> — Ch. 2.</li>
        <li>The boost function only adds speed <b>toward the target</b>, and never touches speed that's sideways to it — Ch. 3.</li>
        <li>In the air, the boost is 10× weaker than on the ground — Ch. 4.</li>
        <li>Because sideways speed is never removed, turning at the right speed lets a little get added every instant, all flight long — Ch. 5.</li>
        <li>Aiming a little off from your actual destination — not straight at it — gets you there faster, not slower — Ch. 6.</li>
        <li>You flew it yourself, and froze a real instant to see the exact numbers behind it — Ch. 7.</li>
        <li>You watched it all happen in full 3D, from behind your own character — Ch. 8.</li>
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
    </dl>

    <div class="callout good" style="margin-top:30px">
      Go back to Chapter 8 and try to beat your own top speed in 3D.
    </div>

    <a class="next-link" href="#ch1-hook">↺ Back to the start</a>
  `;
}
