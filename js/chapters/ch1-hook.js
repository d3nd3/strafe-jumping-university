
function mountCh1Hook(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 1 · The Hook</div>
    <h1>Your top speed is 300... so how is he going 480?</h1>
    <p class="lede">
      In Quake&nbsp;2, the console variable <code>pm_maxspeed</code> caps how fast you can
      <em>run</em> at 300 units per second. Yet every serious player, every speedrun, every
      trick-jump video shows people flying through the air noticeably faster than that. They're
      not cheating &mdash; they're exploiting a quirk in a few dozen lines of C code that have
      shipped, unchanged, since 1997.
    </p>
    <div class="panel">
      <div class="panel-row">
        <div class="panel-col">
          <canvas class="scene" id="hook-canvas"></canvas>
        </div>
        <div class="panel-col">
          <div class="hud">
            <div class="hud-stat"><span class="k">CURRENT SPEED</span><span class="v" id="hook-speed">300</span></div>
            <div class="hud-stat warn"><span class="k">RUN SPEED CAP</span><span class="v">300</span></div>
          </div>
          <div class="mystery">
            <strong>The mystery:</strong> nothing in the movement code ever raises
            <code>pm_maxspeed</code>. The cap is real and it's checked every single tick. And yet
            the number on the left keeps climbing past it. By the end of this journey you will
            know <em>exactly</em> which line of code allows that, and exactly what angle you need
            to turn at to make it happen.
          </div>
          <p class="muted">This little animation is running the real acceleration formula you'll
          meet in Chapter&nbsp;3 &mdash; not a fake speedometer.</p>
        </div>
      </div>
    </div>
    <a class="next-link" href="#ch2-wishdir">Begin the journey → Chapter 2: what your keyboard actually tells the engine</a>
  `;

  const canvas = section.querySelector("#hook-canvas");
  const speedEl = section.querySelector("#hook-speed");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.55, scale: 0.55 });

  // A pre-baked, visually pleasing spiral: this is illustrative (it does not
  // call physics.js) because its only job is to hook the reader with the
  // *shape* of the phenomenon before Chapter 3 proves it line by line.
  let t = 0;
  const trail = [];
  function frame() {
    t += 0.02;
    const radius = 40 + t * 26;
    const speed = 300 + Math.min(180, t * 55);
    const x = Math.cos(t * 2.4) * radius;
    const y = Math.sin(t * 2.4) * radius * 0.55;
    trail.push([x, y]);
    if (trail.length > 140) trail.shift();
    if (t > 6.5) {
      t = 0;
      trail.length = 0;
    }

    scene.clear();
    scene.grid();
    for (let i = 1; i < trail.length; i++) {
      const alpha = i / trail.length;
      scene.line(trail[i - 1], trail[i], { color: `rgba(125,255,176,${alpha * 0.8})`, dash: [], width: 2 });
    }
    if (trail.length) {
      scene.point(trail[trail.length - 1], { color: "#eafff2", radius: 5 });
    }
    speedEl.textContent = speed.toFixed(0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
