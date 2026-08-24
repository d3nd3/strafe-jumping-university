function mountCh7Recap(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 7 · Recap</div>
    <h1>What you actually learned</h1>

    <p class="lede">You now know something most Quake players never dig into: strafe-jumping
    isn't a bug, an exploit outside the rules, or "just skill" in some vague sense. It is a
    precise, deterministic consequence of four lines of code, and you've stepped through every
    one of them.</p>

    <div class="panel">
      <ol style="max-width:760px;font-size:15.5px;line-height:1.9">
        <li>Your input becomes <code>wishdir</code> (a direction) and <code>wishspeed</code> (a speed) — Chapter 2.</li>
        <li><code>PM_Accelerate</code> adds speed <strong>only along wishdir</strong>, capped by <code>addspeed = wishspeed − currentspeed</code> — Chapter 3.</li>
        <li>In the air, <code>accel = 1</code> instead of <code>10</code>, because <code>pm_airaccelerate</code> defaults to 0 — Chapter 4.</li>
        <li>Because nothing ever removes the part of your velocity that's <em>sideways</em> to wishdir, keeping wishdir at the right angle ahead of your velocity lets every tick add a little more speed, tick after tick, all air-time long — Chapter 5.</li>
        <li>You flew it yourself, and paused mid-air to see the exact real numbers behind a single tick — Chapter 6.</li>
      </ol>
    </div>

    <h2>Glossary</h2>
    <dl class="glossary">
      <dt>wishdir</dt><dd>A unit vector (length 1) describing the direction the player's current input is asking to move in. Built from view yaw and forwardmove/sidemove; knows nothing about current velocity.</dd>
      <dt>wishspeed</dt><dd>How fast the player is asking to go, in units/second, clamped to <code>pm_maxspeed</code> (300) before it ever reaches the acceleration code.</dd>
      <dt>currentspeed</dt><dd><code>DotProduct(velocity, wishdir)</code> — the projection of current velocity onto the wishdir axis. Ignores any sideways component entirely.</dd>
      <dt>addspeed</dt><dd><code>wishspeed − currentspeed</code>. How much more speed, along wishdir, is still "owed" this tick. Zero or negative means PM_Accelerate does nothing.</dd>
      <dt>accel</dt><dd>A tuning constant multiplied into how much of addspeed is actually granted per tick: 10 on the ground, 1 in the air by default, 10 again if the (rarely-enabled) <code>pm_airaccelerate</code> cvar is on.</dd>
      <dt>frametime</dt><dd>The real duration of the current physics tick, in seconds. Directly scales accelspeed — which is why old Quake engines were sensitive to framerate for movement tricks.</dd>
      <dt>pm_maxspeed</dt><dd>300 units/second. A hard clamp on <em>wishspeed</em>, the thing you're asking for — not a clamp on your actual velocity, which is the entire loophole this app explains.</dd>
    </dl>

    <div class="callout good" style="margin-top:30px">
      Go back to Chapter 6 and try to beat your own top speed. Now that you know exactly why the
      "sweet spot" exists, see if you can feel it.
    </div>

    <a class="next-link" href="#ch1-hook">↺ Back to the beginning</a>
  `;
}
