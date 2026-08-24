const chapters = [
  { id: "ch1-hook", title: "The Hook", mount: mountCh1Hook },
  { id: "ch2-wishdir", title: "Foundations", mount: mountCh2Wishdir },
  { id: "ch3-debugger", title: "The Accelerate Debugger", mount: mountCh3Debugger },
  { id: "ch4-air-vs-ground", title: "Why Air Is Different", mount: mountCh4AirVsGround },
  { id: "ch5-angle-mystery", title: "The Angle Mystery", mount: mountCh5AngleMystery },
  { id: "ch6-waggle", title: "Aim Off-Target", mount: mountCh6Waggle },
  { id: "ch6-simulator", title: "Live Simulator", mount: mountCh6Simulator },
  { id: "ch7-playground", title: "The Full Picture (3D)", mount: mountCh7Playground },
  { id: "ch7-recap", title: "Recap & Glossary", mount: mountCh7Recap },
];

for (const c of chapters) {
  const section = document.getElementById(c.id);
  try {
    c.mount(section);
  } catch (err) {
    console.error(`Failed to mount ${c.id}`, err);
    section.innerHTML = `<div class="callout">This chapter failed to load: ${err.message}</div>`;
  }
}

createNav(chapters);
