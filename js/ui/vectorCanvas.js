// Shared 2D vector-diagram drawing helpers. Canvas coordinates are Y-down;
// this wraps a canvas so callers can draw in ordinary math coordinates
// (X right, Y up) around a chosen origin and scale, which keeps every
// chapter's diagram code readable.

function createScene(canvas, { originX = 0.5, originY = 0.5, scale = 1 } = {}) {
  const ctx = canvas.getContext("2d");

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  function cssSize() {
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  }

  function toPixel(x, y) {
    const { w, h } = cssSize();
    return [w * originX + x * scale, h * originY - y * scale];
  }

  function clear(bg = "#0b0f0c") {
    const { w, h } = cssSize();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  function grid({ step = 50, color = "rgba(120,255,170,0.08)" } = {}) {
    const { w, h } = cssSize();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const [ox, oy] = toPixel(0, 0);
    ctx.beginPath();
    for (let x = ox % step; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = oy % step; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(120,255,170,0.25)";
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(w, oy);
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, h);
    ctx.stroke();
  }

  function arrow(fromWorld, toWorld, { color = "#7dffb0", width = 2.5, label, dash = false, head = 9 } = {}) {
    const [x1, y1] = toPixel(fromWorld[0], fromWorld[1]);
    const [x2, y2] = toPixel(toWorld[0], toWorld[1]);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    if (label) {
      ctx.font = "13px 'JetBrains Mono', monospace";
      ctx.fillStyle = color;
      ctx.fillText(label, x2 + 8, y2 - 6);
    }
    ctx.restore();
  }

  function point(worldXY, { color = "#fff", radius = 3.5, label } = {}) {
    const [x, y] = toPixel(worldXY[0], worldXY[1]);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (label) {
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.fillText(label, x + 6, y - 6);
    }
    ctx.restore();
  }

  // Angle arc between two vectors from a common origin.
  function angleArc(originWorld, v1, v2, { radius = 30, color = "#ffd166", label } = {}) {
    const [ox, oy] = toPixel(originWorld[0], originWorld[1]);
    const a1 = Math.atan2(-v1[1], v1[0]);
    const a2 = Math.atan2(-v2[1], v2[0]);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox, oy, radius, a1, a2, false);
    ctx.stroke();
    if (label) {
      const mid = (a1 + a2) / 2;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.fillText(label, ox + Math.cos(mid) * (radius + 14), oy + Math.sin(mid) * (radius + 14));
    }
    ctx.restore();
  }

  function line(fromWorld, toWorld, { color = "rgba(255,255,255,0.4)", width = 1.5, dash = [4, 4] } = {}) {
    const [x1, y1] = toPixel(fromWorld[0], fromWorld[1]);
    const [x2, y2] = toPixel(toWorld[0], toWorld[1]);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function text(worldXY, str, { color = "#e8fff0", font = "13px 'JetBrains Mono', monospace", align = "left" } = {}) {
    const [x, y] = toPixel(worldXY[0], worldXY[1]);
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  return { ctx, toPixel, clear, grid, arrow, point, angleArc, line, text, resize, cssSize };
}
