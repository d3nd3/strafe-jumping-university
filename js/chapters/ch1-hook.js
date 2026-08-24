
function mountCh1Hook(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 1 · The Hook</div>
    <h1>Top running speed is 300. So how is he going 480?</h1>
    <p class="lede">
      In Quake&nbsp;2, running on the ground never goes faster than 300 units per second. That
      limit is real — it's checked every instant. Yet good players fly through the air noticeably
      faster than that. Not a cheat. A trick hidden in a few lines of 1997 code.
    </p>
    <div class="panel">
      <div class="panel-row">
        <div class="panel-col">
          <canvas class="scene" id="hook-canvas"></canvas>
        </div>
        <div class="panel-col">
          <div class="hud">
            <div class="hud-stat"><span class="k">SPEED RIGHT NOW</span><span class="v" id="hook-speed">300</span></div>
            <div class="hud-stat warn"><span class="k">GROUND TOP SPEED</span><span class="v">300</span></div>
          </div>
          <div class="mystery">
            <strong>The mystery:</strong> the 300 limit never gets raised anywhere. And yet the
            number on the left keeps climbing past it. By the end, you'll know exactly why —
            and exactly how to do it yourself.
          </div>
        </div>
      </div>
    </div>
    <a class="next-link" href="#ch2-wishdir">Start → Chapter 2: what your keys actually do</a>
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
