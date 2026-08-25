
function mountCh2Wishdir(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 3 · Foundations</div>
    <h1>What your keys and mouse turn into</h1>
    <p class="lede">
      Every instant, the game turns your keys and mouse into two things: a
      <b>target direction</b> (the way you're steering) and a <b>target speed</b> (how fast
      you're trying to go). That's it. Everything else in this app is built on those two things.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col">
          <canvas class="scene" id="wd-canvas"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#7dffb0"></span>forward (where you're looking)</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>right</span>
            <span><span class="swatch" style="background:#ffd166"></span>target direction &amp; speed</span>
          </div>
        </div>
        <div class="panel-col controls">
          <div class="control-row">
            <label><span>forward key (W/S)</span><span id="wd-fmove-val">400</span></label>
            <input type="range" id="wd-fmove" min="-400" max="400" step="10" value="400" />
            <p class="muted" style="font-size:12px;margin:2px 0 0">±400 is the real ceiling: 200 after the client trims it, doubled for running.</p>
          </div>
          <div class="control-row">
            <label><span>strafe key (A/D)</span><span id="wd-smove-val">0</span></label>
            <input type="range" id="wd-smove" min="-320" max="320" step="10" value="0" />
            <p class="muted" style="font-size:12px;margin:2px 0 0">Only ±320 — sideways is trimmed at 160, not 200. Chapter 12 is entirely about that gap.</p>
          </div>
          <div class="control-row">
            <label><span>where you're looking (mouse)</span><span id="wd-yaw-val">0°</span></label>
            <input type="range" id="wd-yaw" min="-180" max="180" step="1" value="0" />
          </div>
          <div class="dbg-locals" id="wd-locals"></div>
        </div>
      </div>
    </div>

    <p class="muted">
      "Forward" and "right" only depend on where you're looking — not on how you're actually
      moving. Add them together, weighted by your keys, and clamp the result to top speed (300):
      that's your target direction and target speed. Chapter 4 shows what happens to them next.
    </p>
    <div class="callout">
      Try holding both forward and strafe keys (W+D). Push the forward slider to 400 and the
      strafe slider to 320 — the most the game will ever hand this function — and the target
      speed still lands at <b>300</b>, exactly what running straight ahead gives you. The cap
      throws the rest away and keeps only the direction. Note the two sliders don't reach the same
      number, and that the diagonal isn't 45°: Chapter 12 is about why.
    </div>

    <a class="next-link" href="#ch3-debugger">Continue → Chapter 4: step through the real code</a>
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
      label: "before cap",
    });
    scene.arrow([0, 0], [wishvel[0] * scale, wishvel[1] * scale], { color: "#ffd166", label: "target" });

    localsEl.innerHTML = [
      ["forward direction", `[${forward[0].toFixed(2)}, ${forward[1].toFixed(2)}]`],
      ["right direction", `[${right[0].toFixed(2)}, ${right[1].toFixed(2)}]`],
      ["target motion, before cap", `[${wishvelRaw[0].toFixed(1)}, ${wishvelRaw[1].toFixed(1)}]`],
      ["target direction", `[${wishdir[0].toFixed(2)}, ${wishdir[1].toFixed(2)}]`],
      ["target speed, before cap", wishspeedRaw.toFixed(1)],
      ["target speed, after cap", wishspeed.toFixed(1)],
    ]
      .map(([k, v]) => `<div class="local-row"><span class="local-key">${k}</span><span class="local-val">${v}</span></div>`)
      .join("");
  }

  [fmoveInput, smoveInput, yawInput].forEach((el) => el.addEventListener("input", render));
  scene.setRedraw(render);
  render();
}
