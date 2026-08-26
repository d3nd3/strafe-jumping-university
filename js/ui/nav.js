// Left-hand chapter progress rail: click-to-jump, arrow-key navigation, and a
// scroll-spy that highlights the current chapter.
//
// Chapters that break themselves into multiple <h2> sections get those
// headings promoted to a nested sub-nav (a real table of contents for that
// chapter), so a long chapter reads as a set of named parts instead of one
// undifferentiated scroll. Chapters with 0 or 1 <h2> don't get a sub-list —
// there's nothing to contents-ify.

const SUBCHAPTER_MIN_HEADINGS = 2;

function isDetachedFromView(el, root) {
  // Some chapters embed an <h2> inside a panel that starts hidden (e.g. a
  // "frozen debugger" state shown only after the user pauses a sim). Those
  // aren't sub-chapters — skip any heading nested under an inline
  // display:none ancestor.
  let node = el;
  while (node && node !== root) {
    if (node.style && node.style.display === "none") return true;
    node = node.parentElement;
  }
  return false;
}

function extractSubchapters(chapter) {
  const section = document.getElementById(chapter.id);
  if (!section) return [];
  const headings = [...section.querySelectorAll("h2")].filter(
    (h) => !isDetachedFromView(h, section)
  );
  if (headings.length < SUBCHAPTER_MIN_HEADINGS) return [];
  return headings.map((h, i) => {
    const id = `${chapter.id}-s${i}`;
    h.id = id;
    return { id, title: h.textContent };
  });
}

function createNav(chapters) {
  chapters.forEach((c) => {
    c.subs = extractSubchapters(c);
  });

  const rail = document.createElement("nav");
  rail.className = "chapter-rail";
  rail.innerHTML = `
    <div class="rail-brand">Strafe Jumping<br />University</div>
    <ol class="rail-list">
      ${chapters
        .map(
          (c, i) => `<li data-idx="${i}">
            <a href="#${c.id}" data-idx="${i}">
              <span class="rail-num">${i + 1}</span>
              <span class="rail-title">${c.title}</span>
              ${c.subs.length ? `<span class="rail-caret">▾</span>` : ""}
            </a>
            ${
              c.subs.length
                ? `<ul class="rail-subs">
                    ${c.subs
                      .map((s) => `<li><a href="#${s.id}" data-sub="${s.id}">${s.title}</a></li>`)
                      .join("")}
                  </ul>`
                : ""
            }
          </li>`
        )
        .join("")}
    </ol>
  `;
  document.body.appendChild(rail);

  const items = [...rail.querySelectorAll(".rail-list > li")];
  const links = items.map((it) => it.querySelector(":scope > a"));
  const subLinks = [...rail.querySelectorAll(".rail-subs a")];

  function setActive(idx) {
    links.forEach((l, i) => l.classList.toggle("active", i === idx));
    items.forEach((it, i) => it.classList.toggle("open", i === idx));
  }

  // Scroll-spy for both chapters and sub-chapters: whichever section/heading
  // has most recently crossed a line near the top of the viewport is
  // "current." This is computed directly off getBoundingClientRect rather
  // than IntersectionObserver ratio thresholds, because a ratio-threshold
  // observer (e.g. threshold: [0.3, 0.5, 0.7]) never fires for a section
  // taller than viewport/threshold — which several multi-<h2> chapters are —
  // leaving them permanently "inactive" and their sub-chapter list stuck
  // collapsed even while scrolled deep inside them.
  const sections = chapters.map((c) => document.getElementById(c.id));
  const subEls = chapters.flatMap((c) => c.subs.map((s) => document.getElementById(s.id)));
  const LINE = 140;
  let ticking = false;
  const updateActive = () => {
    let currentSection = sections[0];
    for (const el of sections) {
      if (el && el.getBoundingClientRect().top <= LINE) currentSection = el;
    }
    const idx = sections.indexOf(currentSection);
    if (idx >= 0) setActive(idx);

    let currentSub = null;
    for (const el of subEls) {
      if (el && el.getBoundingClientRect().top <= LINE) currentSub = el;
    }
    subLinks.forEach((l) =>
      l.classList.toggle("active", !!currentSub && l.dataset.sub === currentSub.id)
    );
  };
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateActive();
        ticking = false;
      });
    },
    { passive: true }
  );
  updateActive();

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    const current = links.findIndex((l) => l.classList.contains("active"));
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      const next = chapters[Math.min(chapters.length - 1, Math.max(0, current) + 1)];
      document.getElementById(next.id).scrollIntoView({ behavior: "smooth" });
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      const prev = chapters[Math.max(0, current - 1)];
      document.getElementById(prev.id).scrollIntoView({ behavior: "smooth" });
    }
  });

  return { setActive };
}
