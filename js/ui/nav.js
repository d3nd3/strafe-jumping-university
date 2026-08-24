// Left-hand chapter progress rail: click-to-jump, arrow-key navigation, and a
// scroll-spy that highlights the current chapter.

function createNav(chapters) {
  const rail = document.createElement("nav");
  rail.className = "chapter-rail";
  rail.innerHTML = `
    <div class="rail-brand">Strafe Jumping<br />University</div>
    <ol class="rail-list">
      ${chapters
        .map(
          (c, i) => `<li><a href="#${c.id}" data-idx="${i}"><span class="rail-num">${i + 1}</span><span class="rail-title">${c.title}</span></a></li>`
        )
        .join("")}
    </ol>
  `;
  document.body.appendChild(rail);

  const links = [...rail.querySelectorAll("a")];

  function setActive(idx) {
    links.forEach((l, i) => l.classList.toggle("active", i === idx));
  }

  const sections = chapters.map((c) => document.getElementById(c.id));
  const observer = new IntersectionObserver(
    (entries) => {
      let best = null;
      for (const e of entries) {
        if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e;
      }
      if (best) {
        const idx = sections.indexOf(best.target);
        if (idx >= 0) setActive(idx);
      }
    },
    { threshold: [0.3, 0.5, 0.7] }
  );
  sections.forEach((s) => s && observer.observe(s));

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

  setActive(0);
  return { setActive };
}
