
function mountCh2Wishdir(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 2 · Foundations</div>
    <h1>What your keyboard and mouse actually tell the engine</h1>
    <p class="lede">
      Every tick, Quake 2 boils your input down to three numbers: <code>forwardmove</code>,
      <code>sidemove</code>, and your view yaw. Everything from here on &mdash; every mystery in
      this app &mdash; is built out of what the engine does with those three numbers, so it's
      worth seeing it happen slowly, once, before the acceleration math shows up in Chapter 3.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col">
          <canvas class="scene" id="wd-canvas"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#7dffb0"></span>forward (view direction)</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>right</span>
            <span><span class="swatch" style="background:#ffd166"></span>wishvel / wishdir</span>
          </div>
        </div>
        <div class="panel-col controls">
          <div class="control-row">
            <label><span>forwardmove (W/S)</span><span id="wd-fmove-val">400</span></label>
            <input type="range" id="wd-fmove" min="-400" max="400" step="10" value="400" />
          </div>
          <div class="control-row">
            <label><span>sidemove (A/D)</span><span id="wd-smove-val">0</span></label>
            <input type="range" id="wd-smove" min="-400" max="400" step="10" value="0" />
          </div>
          <div class="control-row">
            <label><span>view yaw (mouse)</span><span id="wd-yaw-val">0°</span></label>
            <input type="range" id="wd-yaw" min="-180" max="180" step="1" value="0" />
          </div>
          <div class="dbg-locals" id="wd-locals"></div>
        </div>
      </div>
    </div>

    <h2>Reading the code</h2>
    <p>Here is exactly what's happening, in the real source (pmove.c:598-612):</p>
    <pre class="code" style="max-width:640px"><div class="code-line"><span class="ln">598</span><span class="src">pml.forward[2] = 0;</span></div><div class="code-line"><span class="ln">599</span><span class="src">pml.right[2] = 0;</span></div><div class="code-line"><span class="ln">600</span><span class="src">VectorNormalize (pml.forward);</span></div><div class="code-line"><span class="ln">601</span><span class="src">VectorNormalize (pml.right);</span></div><div class="code-line"><span class="ln">605</span><span class="src">wishvel[i] = pml.forward[i]*fmove + pml.right[i]*smove;</span></div><div class="code-line"><span class="ln">611</span><span class="src">VectorCopy (wishvel, wishdir);</span></div><div class="code-line"><span class="ln">612</span><span class="src">wishspeed = VectorNormalize(wishdir);</span></div></pre>
    <p class="muted">
      <code>forward</code> and <code>right</code> are unit vectors built purely from your view
      angle &mdash; they don't care about your velocity at all. <code>wishvel</code> is just a
      weighted sum of those two directions using your key states as weights. Then it's split into
      a <em>direction</em> (<code>wishdir</code>, always length 1) and a <em>speed</em>
      (<code>wishspeed</code>, how fast you asked to go). This wishdir/wishspeed pair is the
      entire "wish" the acceleration code has to satisfy &mdash; nothing else about your keyboard
      matters past this point.
    </p>
    <div class="callout">
      Try setting sidemove to 400 while forwardmove stays at 400 (classic "W+D"). Notice
      <code>wishdir</code> lands at a 45° diagonal between forward and right, and
      <code>wishspeed</code> is <em>not</em> 400+400 &mdash; it's clamped down, because a diagonal
      of two 400-unit sides is about 565 units long, well past <code>pm_maxspeed</code> (300).
      That clamp, and what happens to the leftover, is exactly what Chapter 3 explains.
    </div>

    <a class="next-link" href="#ch3-debugger">Continue → Chapter 3: step through PM_Accelerate like a debugger</a>
  `;

  const canvas = section.querySelector("#wd-canvas");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 0.5 });
  const fmoveInput = section.querySelector("#wd-fmove");
  const smoveInput = section.querySelector("#wd-smove");
  const yawInput = section.querySelector("#wd-yaw");
  const fmoveVal = section.querySelector("#wd-fmove-val");
  const smoveVal = section.querySelector("#wd-smove-val");
  const yawVal = section.querySelector("#wd-yaw-val");
  const localsEl = section.querySelector("#wd-locals");

  function render() {
    const fmove = +fmoveInput.value;
    const smove = +smoveInput.value;
    const yawDeg = +yawInput.value;
    fmoveVal.textContent = fmove;
    smoveVal.textContent = smove;
    yawVal.textContent = yawDeg + "°";

    const { forward, right } = AngleVectorsYaw((yawDeg * Math.PI) / 180, [0, 0, 0], [0, 0, 0]);

    const scale = 1 / 4; // world units -> canvas units for readability
    const wishvelRaw = [
      forward[0] * fmove + right[0] * smove,
      forward[1] * fmove + right[1] * smove,
    ];
    const wishdir = [...wishvelRaw];
    const wishspeedRaw = VectorLength([wishdir[0], wishdir[1], 0]);
    if (wishspeedRaw > 0) {
      wishdir[0] /= wishspeedRaw;
      wishdir[1] /= wishspeedRaw;
    }
    let wishspeed = wishspeedRaw;
    let wishvel = wishvelRaw;
    const maxspeed = 300;
    if (wishspeed > maxspeed) {
      wishvel = [wishvelRaw[0] * (maxspeed / wishspeed), wishvelRaw[1] * (maxspeed / wishspeed)];
      wishspeed = maxspeed;
    }

    scene.clear();
    scene.grid();
    scene.arrow([0, 0], [forward[0] * 100, forward[1] * 100], { color: "#7dffb0", label: "forward" });
    scene.arrow([0, 0], [right[0] * 100, right[1] * 100], { color: "#5fb4ff", label: "right" });

    const fComp = [forward[0] * fmove * scale, forward[1] * fmove * scale];
    const sComp = [right[0] * smove * scale, right[1] * smove * scale];
    scene.line([0, 0], fComp, { color: "rgba(125,255,176,0.5)" });
    scene.line(fComp, [fComp[0] + sComp[0], fComp[1] + sComp[1]], { color: "rgba(95,180,255,0.5)" });
    scene.arrow([0, 0], [wishvelRaw[0] * scale, wishvelRaw[1] * scale], {
      color: "rgba(255,209,102,0.55)",
      dash: true,
      label: "raw wishvel",
    });
    scene.arrow([0, 0], [wishvel[0] * scale, wishvel[1] * scale], { color: "#ffd166", label: "clamped wishvel" });

    localsEl.innerHTML = [
      ["forward", `[${forward[0].toFixed(2)}, ${forward[1].toFixed(2)}]`],
      ["right", `[${right[0].toFixed(2)}, ${right[1].toFixed(2)}]`],
      ["wishvel (raw)", `[${wishvelRaw[0].toFixed(1)}, ${wishvelRaw[1].toFixed(1)}]`],
      ["wishdir", `[${wishdir[0].toFixed(2)}, ${wishdir[1].toFixed(2)}]`],
      ["wishspeed (raw)", wishspeedRaw.toFixed(1)],
      ["wishspeed (clamped)", wishspeed.toFixed(1)],
    ]
      .map(([k, v]) => `<div class="local-row"><span class="local-key">${k}</span><span class="local-val">${v}</span></div>`)
      .join("");
  }

  [fmoveInput, smoveInput, yawInput].forEach((el) => el.addEventListener("input", render));
  render();
}
