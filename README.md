# Strafe Jumping University 🎓🏃💨

Ever wondered how Quake II / Soldier of Fortune players fly around corners way faster than running should allow? That's **strafe jumping**, and this project is an interactive, step-by-step web tutorial that explains *exactly* how it works — no jargon, no hand-waving, straight from the real game source code.

**[▶ Try it live on GitHub Pages](https://d3nd3.github.io/strafe-jumping-university/)**

## What's inside

You'll walk through the physics one idea at a time:

- Why moving diagonally while turning makes you *faster*, not just sideways
- The difference between how movement works on the ground vs. in the air
- The "magic angle" that maximizes your speed gain, and why it exists
- A line-by-line, debugger-style walkthrough of the actual acceleration code (`PM_Accelerate` / `PM_AirMove`)
- Interactive vector diagrams and a live simulator you can play with yourself
- How Soldier of Fortune's movement differs from Quake II's

Everything is built directly on top of `pmove.c`, the real player-movement source from id Software (GPL), so what you learn maps 1:1 to the actual game code — not a simplified approximation.

## Running it locally

No build step, no dependencies to install — it's just static HTML/CSS/JS. Any local web server will do, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Project layout

```
index.html          entry point — each <section> is one chapter
css/style.css        styling
js/core/              physics engine, vector math, source text data
js/ui/                reusable UI widgets (vector canvas, code panel, nav)
js/chapters/          one file per lesson/chapter
pmove.c               the original id Software movement source
```

## Contributing

Found a confusing explanation, a rendering glitch, or a term that needs a simpler definition? Issues and pull requests are welcome — the goal is maximum clarity, especially for newcomers who've never seen this code before.

Have fun, and go break the speed limit. 🚀
