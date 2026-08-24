// The gdb-style dual code panel + stepper. One `Debugger` instance wires a
// generator factory (from js/core/physics.js) to:
//   - a C source pane and a JS source pane, line-highlighted in sync
//   - a "locals" watch pane showing the yielded snapshot's variables
//   - a plain-English description of what the highlighted line(s) do
//   - Step / Back / Play / Reset controls
//
// Because generators can't rewind, each Debugger keeps a history array of
// every yielded snapshot for the *current run*; Back just moves a pointer
// back through that history instead of re-executing anything.

function renderSource(lines) {
  return lines
    .map((l) => `<div class="code-line" data-line="${l.n}"><span class="ln">${l.n}</span><span class="src">${escapeHtml(l.content)}</span></div>`)
    .join("");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtVal(v) {
  if (Array.isArray(v)) return `[${v.map((n) => fmtVal(n)).join(", ")}]`;
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2) : String(v);
  return String(v);
}

// The code panel shows real source, so it keeps real variable names. But the
// "watch" list next to it is plain-English on purpose -- nobody should have
// to already know what "wishdir" means to follow along.
const FRIENDLY_LABELS = {
  currentspeed: "speed already aimed right",
  addspeed: "room left to speed up",
  accelspeed: "speed boost this step",
  wishdir: "target direction",
  wishspeed: "target speed",
  wishspd: "target speed (air limit: 30)",
  velocity: "speed + direction",
  wishvel: "target motion",
  forward: "forward direction",
  right: "right direction",
  speed: "total speed",
  pm_airaccelerate: "air boost mode",
  fmove: "forward key amount",
  smove: "side key amount",
};
function friendlyLabel(key) {
  return FRIENDLY_LABELS[key] || key;
}

function createDebugger({
  mount,
  title,
  cSource,
  jsSource,
  map,
  makeGenerator,
  describe, // optional: (step) => extra HTML description
}) {
  mount.innerHTML = `
    <div class="dbg">
      <div class="dbg-toolbar">
        <span class="dbg-title">${title}</span>
        <div class="dbg-controls">
          <button class="btn" data-act="reset" title="Reset">⟲ Reset</button>
          <button class="btn" data-act="back" title="Step back">◀ Back</button>
          <button class="btn primary" data-act="step" title="Step">Step ▶</button>
          <button class="btn" data-act="play" title="Auto-play">▶ Play</button>
        </div>
      </div>
      <div class="dbg-panes">
        <div class="code-pane">
          <div class="pane-label">pmove.c — the real Quake&nbsp;2 source</div>
          <pre class="code c-pane">${renderSource(cSource)}</pre>
        </div>
        <div class="code-pane">
          <div class="pane-label">physics.js — this app's 1:1 port</div>
          <pre class="code js-pane">${renderSource(jsSource)}</pre>
        </div>
      </div>
      <div class="dbg-info">
        <div class="dbg-desc"></div>
        <div class="dbg-locals"></div>
      </div>
    </div>
  `;

  const cPane = mount.querySelector(".c-pane");
  const jsPane = mount.querySelector(".js-pane");
  const descEl = mount.querySelector(".dbg-desc");
  const localsEl = mount.querySelector(".dbg-locals");
  const btnStep = mount.querySelector('[data-act="step"]');
  const btnBack = mount.querySelector('[data-act="back"]');
  const btnPlay = mount.querySelector('[data-act="play"]');
  const btnReset = mount.querySelector('[data-act="reset"]');

  let gen = null;
  let history = []; // array of yielded values (snapshots), in order
  let cursor = -1; // index into history currently displayed
  let playTimer = null;
  let onChangeCb = null;

  function clearHighlight(pane) {
    pane.querySelectorAll(".code-line.active").forEach((el) => el.classList.remove("active"));
  }

  function highlightLines(pane, lineNumbers) {
    clearHighlight(pane);
    let firstEl = null;
    for (const n of lineNumbers || []) {
      const el = pane.querySelector(`.code-line[data-line="${n}"]`);
      if (el) {
        el.classList.add("active");
        if (!firstEl) firstEl = el;
      }
    }
    if (firstEl) firstEl.scrollIntoView({ block: "nearest" });
  }

  function renderSnapshot(step) {
    if (!step) {
      clearHighlight(cPane);
      clearHighlight(jsPane);
      descEl.innerHTML = `<em>Press Step to begin.</em>`;
      localsEl.innerHTML = "";
      return;
    }
    const m = map[step.id] || { c: [], js: [] };
    highlightLines(cPane, m.c);
    highlightLines(jsPane, m.js);
    descEl.innerHTML = describe ? describe(step) : `<strong>${escapeHtml(step.label)}</strong>`;
    const rows = Object.entries(step.locals || {})
      .map(
        ([k, v]) =>
          `<div class="local-row"><span class="local-key">${friendlyLabel(k)} <span class="varname">${escapeHtml(k)}</span></span><span class="local-val">${fmtVal(v)}</span></div>`
      )
      .join("");
    localsEl.innerHTML = rows || "<em>nothing yet — press Step</em>";
  }

  function updateButtons() {
    const atStart = cursor < 0;
    const finished = history.length > 0 && history[history.length - 1]?.terminal && cursor === history.length - 1;
    btnBack.disabled = atStart;
    btnStep.disabled = finished;
    btnPlay.disabled = finished;
  }

  function reset() {
    stopPlay();
    gen = makeGenerator();
    history = [];
    cursor = -1;
    renderSnapshot(null);
    updateButtons();
    onChangeCb?.(null);
  }

  function step() {
    if (cursor < history.length - 1) {
      // Replaying from cache (user had gone Back, now stepping forward again).
      cursor++;
      renderSnapshot(history[cursor]);
      updateButtons();
      onChangeCb?.(history[cursor]);
      return history[cursor];
    }
    const { value, done } = gen.next();
    if (done) {
      updateButtons();
      return null;
    }
    history.push(value);
    cursor = history.length - 1;
    renderSnapshot(value);
    updateButtons();
    onChangeCb?.(value);
    return value;
  }

  function back() {
    if (cursor <= 0) {
      cursor = -1;
      renderSnapshot(null);
    } else {
      cursor--;
      renderSnapshot(history[cursor]);
    }
    updateButtons();
    onChangeCb?.(cursor >= 0 ? history[cursor] : null);
  }

  function stopPlay() {
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
      btnPlay.textContent = "▶ Play";
    }
  }

  function togglePlay() {
    if (playTimer) {
      stopPlay();
      return;
    }
    btnPlay.textContent = "⏸ Pause";
    playTimer = setInterval(() => {
      const s = step();
      if (!s || s.terminal) stopPlay();
    }, 700);
  }

  btnStep.addEventListener("click", step);
  btnBack.addEventListener("click", back);
  btnReset.addEventListener("click", reset);
  btnPlay.addEventListener("click", togglePlay);

  reset();

  return {
    step,
    back,
    reset,
    get currentStep() {
      return cursor >= 0 ? history[cursor] : null;
    },
    onChange(cb) {
      onChangeCb = cb;
    },
  };
}
