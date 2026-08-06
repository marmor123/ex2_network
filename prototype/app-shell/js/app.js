/*
 * App shell prototype — three structurally-different variants of the same
 * teaching app, switchable via ?variant=A|B|C (floating bar at the bottom).
 *
 *   A — Field notes   : code-first, dark. The stop IS the annotated source;
 *                       concept/why/what-if as callouts around it.
 *   B — System map    : diagram-first, light. The run as a living diagram;
 *                       stops as nodes, pipeline animation, tabbed layers.
 *   C — Viva deck     : presentation. Home is a title slide; each stop is a
 *                       slide deck (concept → code → why → what-if Q&A) with
 *                       a question-reveal viva mode.
 *
 * The question this prototype answers: which structure should the real app
 * have? Content (js/content.js) and chart (js/chart.js) are shared.
 */
(function () {
  const A = window.APP;

  /* ---------- tiny DOM helper (textContent only — no data through innerHTML) */
  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  /* ---------- shared pieces ------------------------------------------------- */

  function envelopeEl() {
    const box = h("div", "chart-box");
    window.EnvelopeChart(box);
    return box;
  }

  function spineEl(currentId) {
    const nav = h("nav", "spine");
    let lastGroup = null;
    A.spine.forEach((s) => {
      if (s.group !== lastGroup) {
        nav.appendChild(h("div", "spine-group", s.group));
        lastGroup = s.group;
      }
      const item = h("a", "spine-item" + (s.id === currentId ? " current" : "") + (s.state === "planned" ? " planned" : ""), s.title);
      item.href = s.state === "built" ? "#stop=" + s.id : "#";
      if (s.state === "planned") item.title = "Not built yet";
      nav.appendChild(item);
    });
    return nav;
  }

  function termTable(stop) {
    const dl = h("dl", "terms");
    stop.terms.forEach((t) => {
      dl.appendChild(h("dt", "term", t.term));
      dl.appendChild(h("dd", "def", t.def));
    });
    return dl;
  }

  function codeBlock(stop, annotated) {
    const box = h("figure", "code-block");
    const fig = h("figcaption");
    fig.appendChild(h("span", "", stop.code.heading));
    fig.appendChild(h("span", "file", stop.code.file));
    box.appendChild(fig);

    if (annotated) {
      /* Two-column: line numbers + code on the left, gutter notes on the right. */
      const grid = h("div", "code-grid");
      const codeCol = h("div", "code-col");
      stop.code.lines.forEach((line, i) => {
        const row = h("div", "code-line" + (stop.code.annotations[i + 1] ? " noted" : ""));
        row.appendChild(h("span", "ln", String(i + 1).padStart(2, "0")));
        const t = h("code", "", line === "" ? " " : line);
        if (stop.code.annotations[i + 1]) t.classList.add("has-note");
        row.appendChild(t);
        codeCol.appendChild(row);
      });
      grid.appendChild(codeCol);

      const gutter = h("div", "code-gutter");
      stop.code.lines.forEach((line, i) => {
        const note = stop.code.annotations[i + 1];
        const cell = h("div", "gutter-cell" + (note ? " filled" : ""));
        if (note) {
          cell.appendChild(h("span", "gutter-mark", "◆"));
          cell.appendChild(h("span", "gutter-text", note));
        }
        gutter.appendChild(cell);
      });
      grid.appendChild(gutter);
      box.appendChild(grid);
    } else {
      /* Flat legend form for the deck: marker numbers inline, notes below. */
      const pre = h("pre", "code-flat");
      stop.code.lines.forEach((line, i) => {
        const t = h("span", "flat-line" + (stop.code.annotations[i + 1] ? " noted" : ""));
        t.textContent = line === "" ? " " : line;
        pre.appendChild(t);
        pre.appendChild(document.createTextNode("\n"));
      });
      box.appendChild(pre);
      if (stop.code.annotations) {
        const legend = h("ol", "code-legend");
        Object.keys(stop.code.annotations).forEach((n) => {
          const li = h("li", "", n + " — " + stop.code.annotations[n]);
          legend.appendChild(li);
        });
        box.appendChild(legend);
      }
    }
    return box;
  }

  function whyCards(stop) {
    const list = h("div", "why-list");
    stop.why.forEach((w) => {
      const card = h("article", "why-card");
      const badge = h("span", "adr-badge", w.adr);
      card.appendChild(h("h3", "", w.title));
      card.appendChild(badge);
      card.appendChild(h("p", "", w.text));
      list.appendChild(card);
    });
    return list;
  }

  function whatIfCards(stop, revealMode) {
    const list = h("div", "whatif-list");
    stop.whatifs.forEach((w) => {
      const card = h("article", "whatif-card" + (revealMode ? " reveal" : ""));
      card.appendChild(h("h3", "", w.q));
      const ans = h("p", "whatif-answer", w.a);
      if (revealMode) ans.hidden = true;
      card.appendChild(ans);
      card.appendChild(h("span", "whatif-source", w.source || ""));
      if (revealMode) {
        card.addEventListener("click", () => { ans.hidden = !ans.hidden; card.classList.toggle("open", !ans.hidden); });
      }
      list.appendChild(card);
    });
    return list;
  }

  function nextPrevEl(currentId) {
    const built = A.spine.filter((s) => s.state === "built");
    const i = built.findIndex((s) => s.id === currentId);
    const row = h("div", "nextprev");
    if (i > 0) {
      const p = h("a", "prev", "← " + built[i - 1].title);
      p.href = "#stop=" + built[i - 1].id;
      row.appendChild(p);
    }
    const home = h("a", "home-link", "Home");
    home.href = "#home";
    row.appendChild(home);
    if (i < built.length - 1) {
      const n = h("a", "next", built[i + 1].title + " →");
      n.href = "#stop=" + built[i + 1].id;
      row.appendChild(n);
    }
    return row;
  }

  /* ---------- Variant A — Field notes (code-first, dark) -------------------- */

  function renderStopA(root, stop) {
    root.classList.add("va");
    const wrap = h("div", "va-wrap");
    wrap.appendChild(spineEl(stop.id));

    const main = h("main", "va-main");
    const head = h("header", "stop-head");
    head.appendChild(h("p", "kicker", stop.group + " · ADR " + stop.adrs.join(", ")));
    head.appendChild(h("h1", "", stop.title));
    head.appendChild(h("p", "subtitle", stop.subtitle));
    main.appendChild(head);

    const section = h("section", "layer");
    section.appendChild(h("h2", "layer-title", "Concept"));
    stop.concept.forEach((p) => section.appendChild(h("p", "body", p)));
    section.appendChild(termTable(stop));
    main.appendChild(section);

    const codeSection = h("section", "layer");
    codeSection.appendChild(h("h2", "layer-title", "Annotated code — follow the data"));
    codeSection.appendChild(codeBlock(stop, true));
    main.appendChild(codeSection);

    const whySection = h("section", "layer");
    whySection.appendChild(h("h2", "layer-title", "Why it's written like this"));
    whySection.appendChild(whyCards(stop));
    main.appendChild(whySection);

    const wiSection = h("section", "layer");
    wiSection.appendChild(h("h2", "layer-title", "Viva what-ifs"));
    wiSection.appendChild(whatIfCards(stop, false));
    main.appendChild(wiSection);

    main.appendChild(nextPrevEl(stop.id));
    wrap.appendChild(main);
    root.appendChild(wrap);
  }

  function renderHomeA(root) {
    root.classList.add("va");
    const wrap = h("div", "va-wrap");
    wrap.appendChild(spineEl(null));

    const main = h("main", "va-main");
    const hero = h("header", "home-head");
    hero.appendChild(h("p", "kicker", "Lab 2 · Verbs API throughput"));
    hero.appendChild(h("h1", "", A.title));
    hero.appendChild(h("p", "lead", A.home.lead));
    main.appendChild(hero);

    const tiles = h("div", "hl-tiles");
    A.home.highlights.forEach((x) => {
      const t = h("div", "hl-tile");
      t.appendChild(h("div", "hl-value", x.value));
      t.appendChild(h("div", "hl-label", x.label));
      tiles.appendChild(t);
    });
    main.appendChild(tiles);

    const chartSection = h("section", "layer");
    chartSection.appendChild(h("h2", "layer-title", "The envelope — what the benchmark measures"));
    chartSection.appendChild(envelopeEl());
    main.appendChild(chartSection);

    const roles = h("section", "layer");
    roles.appendChild(h("h2", "layer-title", "Who's who in the run"));
    const grid = h("div", "roles");
    A.home.roles.forEach((r) => {
      const c = h("div", "role");
      c.appendChild(h("h3", "", r.who));
      c.appendChild(h("p", "", r.what));
      grid.appendChild(c);
    });
    roles.appendChild(grid);
    main.appendChild(roles);

    const start = h("a", "cta", "Start at stop 1 — The experiment →");
    start.href = "#stop=experiment";
    main.appendChild(start);
    wrap.appendChild(main);
    root.appendChild(wrap);
  }

  /* ---------- Variant B — System map (diagram-first, light) ----------------- */

  function systemDiagram(root, live) {
    const fig = h("figure", "sys-diagram");
    const legend = h("figcaption", "sys-legend");
    legend.appendChild(h("span", "sys-caption", "One run, followed end to end — the client's SQ, the link, the server's memory"));
    fig.appendChild(legend);

    const row = h("div", "sys-row");

    const client = h("div", "sys-node client");
    client.appendChild(h("div", "sys-node-title", "Client"));
    client.appendChild(h("div", "sys-sq"));
    client.appendChild(h("div", "sys-sq-label", "SQ · W = 256 WRITEs"));
    client.appendChild(h("div", "sys-cq-label", "CQ"));
    row.appendChild(client);

    const link = h("div", "sys-link");
    link.appendChild(h("div", "sys-link-label", "RDMA WRITE — FDR 56 Gb/s"));
    row.appendChild(link);

    const server = h("div", "sys-node server");
    server.appendChild(h("div", "sys-node-title", "Server"));
    server.appendChild(h("div", "sys-buf"));
    server.appendChild(h("div", "sys-buf-label", "1 MB registered buffer"));
    row.appendChild(server);

    fig.appendChild(row);

    /* The two built stops as nodes on the route. */
    const stopsRow = h("div", "sys-stops");
    const exp = h("a", "sys-stop", "1 · The experiment");
    exp.href = "#stop=experiment";
    const post = h("a", "sys-stop", "2 · Posting the window");
    post.href = "#stop=posting";
    stopsRow.appendChild(exp);
    stopsRow.appendChild(h("span", "sys-stop-gap", "··· ···"));
    stopsRow.appendChild(post);
    fig.appendChild(stopsRow);

    if (live) {
      /* Mini pipeline: window bar + wire animation + CQ counter. */
      const p = h("div", "pipeline");
      const bar = h("div", "pipe-bar");
      const fill = h("div", "pipe-fill");
      bar.appendChild(fill);
      const barLabel = h("div", "pipe-label", "outstanding: 0 / 256");
      p.appendChild(h("div", "pipe-title", "The window, live"));
      p.appendChild(bar);
      p.appendChild(barLabel);

      const wire = h("div", "pipe-wire");
      const pkt = h("div", "pipe-pkt");
      wire.appendChild(pkt);
      p.appendChild(wire);

      const steps = h("ol", "pipe-steps");
      ["Post a K = 64 list", "Doorbell", "On the wire", "Lands in server memory", "Refill: poll CQEs"].forEach((s) => {
        steps.appendChild(h("li", "", s));
      });
      p.appendChild(steps);

      const controls = h("div", "pipe-controls");
      const play = h("button", "btn", "▶ Play");
      const stepBtn = h("button", "btn", "Step");
      const reset = h("button", "btn", "Reset");
      controls.appendChild(play);
      controls.appendChild(stepBtn);
      controls.appendChild(reset);
      p.appendChild(controls);
      p.appendChild(h("p", "pipe-desc", "Press Play and watch one window's worth: the SQ fills by 64, the doorbell rings, the WRITEs cross, the refill reclaims."));

      /* Loop state machine — rough but real. */
      const PHASES = [
        { out: 256, cqe: 0, step: 0, desc: "One ibv_post_send posts the K = 64 list as a linked list — one doorbell for 64 WRITEs." },
        { out: 256, cqe: 0, step: 1, desc: "The doorbell: a single write to the HCA's page rings 64 WRITEs loose." },
        { out: 256, cqe: 0, step: 2, desc: "The HCA DMA-reads the 1 MB buffer and the WRITEs cross the FDR link." },
        { out: 256, cqe: 0, step: 3, desc: "They land in the server's registered memory — no server CPU involved." },
        { out: 192, cqe: 4, step: 4, desc: "Refill: 4 CQEs are ready — one per K = 64 — outstanding drops to 192, and the loop posts the next list. The SQ never empties." },
      ];
      let i = 0, timer = null;
      function apply() {
        const ph = PHASES[i % PHASES.length];
        fill.style.width = (ph.out / 256 * 100) + "%";
        barLabel.textContent = "outstanding: " + ph.out + " / 256";
        p.querySelector(".pipe-desc").textContent = ph.desc;
        steps.querySelectorAll("li").forEach((li, n) => li.classList.toggle("on", n === ph.step));
        if (ph.step >= 2) { pkt.classList.add("moving"); } else { pkt.classList.remove("moving"); }
      }
      function tick() { i++; apply(); }
      play.addEventListener("click", () => {
        if (timer) { clearInterval(timer); timer = null; play.textContent = "▶ Play"; return; }
        timer = setInterval(tick, 900);
        play.textContent = "⏸ Pause";
      });
      stepBtn.addEventListener("click", tick);
      reset.addEventListener("click", () => { i = 0; apply(); });
      apply();
      fig.appendChild(p);
    }
    return fig;
  }

  function renderStopB(root, stop) {
    root.classList.add("vb");
    const head = h("header", "b-head");
    head.appendChild(h("p", "kicker", stop.group + " · ADR " + stop.adrs.join(", ")));
    head.appendChild(h("h1", "", stop.title));
    head.appendChild(h("p", "subtitle", stop.subtitle));
    root.appendChild(head);

    const two = h("div", "b-two");
    const left = h("div", "b-diagram");
    left.appendChild(systemDiagram(root, stop.id === "posting"));
    two.appendChild(left);

    const right = h("div", "b-tabs");
    const tabbar = h("div", "tabs");
    const tabs = [
      { key: "concept", label: "Concept" },
      { key: "code", label: "Code" },
      { key: "why", label: "Why" },
      { key: "whatif", label: "What-ifs" },
    ];
    const panes = {};
    tabs.forEach((t) => {
      const btn = h("button", "tab", t.label);
      btn.addEventListener("click", () => show(t.key));
      tabbar.appendChild(btn);
      const pane = h("div", "pane");
      if (t.key === "concept") {
        stop.concept.forEach((p) => pane.appendChild(h("p", "body", p)));
        pane.appendChild(termTable(stop));
      } else if (t.key === "code") {
        pane.appendChild(codeBlock(stop, true));
      } else if (t.key === "why") {
        pane.appendChild(whyCards(stop));
      } else {
        pane.appendChild(whatIfCards(stop, false));
      }
      panes[t.key] = pane;
      right.appendChild(pane);
    });
    function show(key) {
      tabbar.querySelectorAll(".tab").forEach((b, n) => b.classList.toggle("on", tabs[n].key === key));
      Object.keys(panes).forEach((k) => { panes[k].hidden = k !== key; });
    }
    show("concept");
    two.appendChild(right);
    root.appendChild(two);

    const nv = nextPrevEl(stop.id);
    nv.classList.add("b-nv");
    root.appendChild(nv);
    root.appendChild(h("p", "sys-hint", "Diagram-first: every stop is a node on the run's picture — click 1 or 2 on the diagram to jump."));
  }

  function renderHomeB(root) {
    root.classList.add("vb");
    const head = h("header", "b-head home");
    head.appendChild(h("p", "kicker", "Lab 2 · Verbs API throughput"));
    head.appendChild(h("h1", "", A.title));
    head.appendChild(h("p", "lead", A.home.lead));
    root.appendChild(head);
    root.appendChild(systemDiagram(root, false));
    const chartSection = h("section", "b-chart");
    chartSection.appendChild(h("h2", "", "The envelope — what the benchmark measures"));
    chartSection.appendChild(envelopeEl());
    root.appendChild(chartSection);
    const spineRow = h("div", "b-spine-row");
    spineRow.appendChild(h("p", "spine-row-title", "Follow the data — the spine"));
    spineRow.appendChild(spineEl(null));
    root.appendChild(spineRow);
  }

  /* ---------- Variant C — Viva deck (presentation) --------------------------- */

  function deck(root, slides, opts) {
    root.classList.add("vc");
    const stage = h("div", "stage");
    const deckEl = h("div", "deck");
    let idx = 0;

    slides.forEach((s) => {
      const slide = h("section", "slide " + s.kind);
      if (s.html) slide.appendChild(s.html);
      else {
        slide.appendChild(h("p", "kicker", s.kicker || ""));
        slide.appendChild(h("h2", "slide-title", s.title));
        if (s.body) s.body.forEach((b) => slide.appendChild(b));
      }
      deckEl.appendChild(slide);
    });

    const progress = h("div", "deck-progress");
    const dots = h("div", "deck-dots");
    slides.forEach(() => dots.appendChild(h("span", "dot")));
    const counter = h("span", "deck-counter", "1 / " + slides.length);
    const vivaToggle = h("label", "viva-toggle");
    const cb = h("input", "");
    cb.type = "checkbox";
    vivaToggle.appendChild(cb);
    vivaToggle.appendChild(h("span", "", "Viva mode — hide the answers"));
    progress.appendChild(vivaToggle);
    progress.appendChild(dots);
    progress.appendChild(counter);
    deckEl.appendChild(progress);

    function show(n) {
      idx = Math.max(0, Math.min(slides.length - 1, n));
      deckEl.querySelectorAll(".slide").forEach((s, i) => s.classList.toggle("on", i === idx));
      deckEl.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("on", i === idx));
      counter.textContent = (idx + 1) + " / " + slides.length;
    }

    cb.addEventListener("change", () => {
      const reveal = cb.checked;
      deckEl.querySelectorAll(".whatif-answer").forEach((a) => { a.hidden = reveal; a.closest(".whatif-card").classList.remove("open"); });
      deckEl.querySelectorAll(".slide").forEach((s) => s.classList.toggle("viva-on", reveal));
    });

    /* Deck owns the arrow keys; the switcher bar stays clickable. */
    const nav = {
      next: () => show(idx + 1),
      prev: () => show(idx - 1),
    };
    if (opts && opts.home) {
      const start = h("a", "cta", "Start the walkthrough →");
      start.href = "#stop=experiment";
      deckEl.querySelector(".slide").appendChild(start);
    }
    stage.appendChild(deckEl);
    root.appendChild(stage);
    show(0);
    return nav;
  }

  function renderStopC(root, stop) {
    const slides = [
      { kind: "concept", kicker: stop.group + " · ADR " + stop.adrs.join(", "), title: stop.title,
        body: [h("p", "subtitle", stop.subtitle)].concat(stop.concept.map((p) => h("p", "body", p))).concat([termTable(stop)]) },
      { kind: "code", kicker: "Annotated code", title: stop.code.heading,
        body: [codeBlock(stop, false)] },
      { kind: "why", kicker: "Why it's written like this", title: "The decisions behind the code",
        body: [whyCards(stop)] },
      { kind: "whatif", kicker: "Viva what-ifs", title: "Questions the examiner might ask",
        body: [whatIfCards(stop, true)] },
    ];
    const nav = deck(root, slides, {});
    root._deckNav = nav;
    root.appendChild(nextPrevEl(stop.id));
  }

  function renderHomeC(root) {
    const hero = h("div", "hero-slide-inner");
    hero.appendChild(h("p", "kicker", "Lab 2 · Verbs API throughput"));
    hero.appendChild(h("h1", "hero-title", A.title));
    hero.appendChild(h("p", "lead", A.home.lead));
    const start = h("a", "cta", "Start the walkthrough →");
    start.href = "#stop=experiment";
    hero.appendChild(start);

    const slides = [
      { kind: "title", title: A.subtitle, html: hero },
      { kind: "agenda", kicker: "Agenda", title: "Follow the data — one stop at a time", body: [spineEl(null)] },
      { kind: "envelope", kicker: "The headline", title: "The envelope — what the benchmark measures", body: [envelopeEl()] },
    ];
    deck(root, slides, { home: true });
  }

  /* ---------- Router ---------------------------------------------------------- */

  const VARIANTS = {
    A: { name: "Field notes", theme: "dark", home: renderHomeA, stop: renderStopA },
    B: { name: "System map", theme: "light", home: renderHomeB, stop: renderStopB },
    C: { name: "Viva deck", theme: "light", home: renderHomeC, stop: renderStopC },
  };

  function currentVariant() {
    const v = new URLSearchParams(location.search).get("variant");
    return VARIANTS[v] || VARIANTS.A;
  }

  function currentRoute() {
    const m = /#stop=([\w-]+)/.exec(location.hash);
    if (m && A.stops[m[1]]) return { stop: A.stops[m[1]] };
    return { home: true };
  }

  const mount = document.getElementById("app");
  function render() {
    const v = currentVariant();
    const route = currentRoute();
    mount.className = "";
    mount.setAttribute("data-theme", v.theme);
    mount.textContent = "";
    if (route.home) v.home(mount);
    else v.stop(mount, route.stop);
    document.title = (route.stop ? route.stop.title + " — " : "") + A.title;
  }

  /* ---------- Floating switcher bar ------------------------------------------- */

  const bar = h("div", "prototype-bar");
  const left = h("button", "pbtn", "‹");
  const label = h("span", "plabel");
  const right = h("button", "pbtn", "›");
  bar.appendChild(h("span", "ptag", "PROTOTYPE"));
  bar.appendChild(left);
  bar.appendChild(label);
  bar.appendChild(right);
  document.body.appendChild(bar);

  function setVariant(key) {
    const p = new URLSearchParams(location.search);
    p.set("variant", key);
    const qs = p.toString();
    const hash = location.hash;
    history.replaceState(null, "", location.pathname + "?" + qs + hash);
    render();
  }

  const keys = Object.keys(VARIANTS);
  function keyOf() { return keys.find((k) => VARIANTS[k] === currentVariant()); }

  function updateBar() {
    const i = keys.indexOf(keyOf());
    label.textContent = (i + 1) + "/" + keys.length + " · " + VARIANTS[keys[i]].name + " — " + keys[i];
  }

  left.addEventListener("click", () => {
    const i = keys.indexOf(keyOf());
    setVariant(keys[(i - 1 + keys.length) % keys.length]);
  });
  right.addEventListener("click", () => {
    const i = keys.indexOf(keyOf());
    setVariant(keys[(i + 1) % keys.length]);
  });

  /* Keyboard: ←/→ cycle variants, EXCEPT inside the viva deck (variant C),
   * which owns them for slide navigation. */
  document.addEventListener("keydown", (e) => {
    if (currentVariant().name === VARIANTS.C.name && mount._deckNav) {
      if (e.key === "ArrowRight") mount._deckNav.next();
      if (e.key === "ArrowLeft") mount._deckNav.prev();
      return;
    }
    if (e.key === "ArrowRight") right.click();
    if (e.key === "ArrowLeft") left.click();
  });

  window.addEventListener("hashchange", render);
  window.addEventListener("resize", render);
  render();
  updateBar();
})();
