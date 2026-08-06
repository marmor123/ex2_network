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

  /* ---------- tiny DOM helper (textContent only — no data through innerHTML).
   * Third arg: text, a Node, or an array of Nodes/strings to append. */
  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) {
      if (text instanceof Node) el.appendChild(text);
      else if (Array.isArray(text)) {
        text.forEach((ch) => el.appendChild(ch instanceof Node ? ch : document.createTextNode(String(ch))));
      } else el.textContent = text;
    }
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

  /* ---------- Variant D — Studio (split-screen, Claude-like) ------------------ */

  /* Diagram pieces — the right-hand panel: struct design, the connection,
   * live traffic. One builder per frame. */
  function dBox(text, cls) { return h("div", "dbox" + (cls ? " " + cls : ""), text); }
  function dChip(text, cls) { return h("span", "dchip" + (cls ? " " + cls : ""), text); }
  function dArrow(label, dir) {
    const a = h("div", "darrow " + dir);
    if (label !== undefined) a.appendChild(h("span", "darrow-label", label));
    return a;
  }
  function dFig(title, body) {
    const fig = h("figure", "d-fig");
    fig.appendChild(h("figcaption", "d-fig-title", title));
    fig.appendChild(body);
    return fig;
  }
  function dNote(text) { return h("p", "d-note", text); }

  const DIAGRAMS = {
    /* The run: one QP, one direction, TCP only for the handshake. */
    connection() {
      const client = h("div", "d-node");
      client.appendChild(h("div", "d-node-title", "Client"));
      client.appendChild(h("div", "d-node-body", "posts WRITEs · runs the clock · prints results"));
      client.appendChild(h("div", "d-node-chips", [dChip("SQ → CQ"), dChip("1 MB buffer (lkey)"), dChip("done SEND / ack wait")]));
      const server = h("div", "d-node");
      server.appendChild(h("div", "d-node-title", "Server"));
      server.appendChild(h("div", "d-node-body", "absorbs WRITEs · acks each done"));
      server.appendChild(h("div", "d-node-chips", [dChip("RQ → CQ"), dChip("1 MB buffer (addr + rkey)")]));

      const dataRow = h("div", "d-row");
      dataRow.appendChild(client);
      dataRow.appendChild(dArrow("RC QP — RDMA WRITE (data + control SENDs)", "right"));
      dataRow.appendChild(server);

      const tcp = h("div", "d-tcp");
      tcp.appendChild(dArrow("TCP handshake, once — lid : qpn : psn : gid + addr : rkey", "right"));
      const fig = dFig("The connection — what exists before any data flows", dataRow);
      fig.appendChild(tcp);
      fig.appendChild(dNote("One QP carries everything: the data WRITEs and the two control SENDs per size. TCP appears exactly once, before data flows (ADR-0001)."));
      return fig;
    },

    /* One size: warmup batch then timed batch on one stream. */
    timeline() {
      const strip = h("div", "d-strip");
      const segs = [
        ["Warmup", "4–32 WRITEs", "warmup"],
        ["t0", "", "mark"],
        ["Timed batch", "MSG_COUNTS[seq] WRITEs", "timed"],
        ["done", "", "mark"],
        ["RTT", "~10 µs", "rtt"],
        ["ack → t1", "", "mark"],
      ];
      segs.forEach(([t, s, cls]) => {
        const seg = h("div", "d-seg " + cls);
        seg.appendChild(h("div", "d-seg-title", t));
        if (s) seg.appendChild(h("div", "d-seg-sub", s));
        strip.appendChild(seg);
      });
      const fig = dFig("One size on the timeline — the clock runs t0 → t1", strip);
      fig.appendChild(dNote("The warmup rides the same windowed stream as the timed batch. The control round trip (done → ack) is inside the measured window (ADR-0003)."));
      return fig;
    },

    /* The measured window, bracketed. */
    "clock-window"() {
      const strip = h("div", "d-strip");
      [["t0", "", "mark"], ["timed batch", "the WRITEs that count", "timed"], ["done", "", "mark"], ["RTT", "", "rtt"], ["ack", "t1", "mark"]].forEach(([t, s, cls]) => {
        const seg = h("div", "d-seg " + cls);
        seg.appendChild(h("div", "d-seg-title", t));
        if (s) seg.appendChild(h("div", "d-seg-sub", s));
        strip.appendChild(seg);
      });
      const bracket = h("div", "d-bracket", "measured window — the throughput denominator");
      strip.appendChild(bracket);
      const fig = dFig("The clock window (ADR-0003) — why it stops at the ack", strip);
      fig.appendChild(dNote("A client-side completion means sent, not received. The ack is the completion barrier: RC in-order delivery guarantees every prior WRITE is in server memory before it can arrive."));
      return fig;
    },

    /* The two control messages, with sequence counters. */
    "control-flow"() {
      const client = h("div", "d-node small");
      client.appendChild(h("div", "d-node-title", "Client"));
      const server = h("div", "d-node small");
      server.appendChild(h("div", "d-node-title", "Server"));
      const done = dArrow("done SEND — tag 0x4354524c, seq = i", "right");
      const ack = dArrow("ack SEND — echoes seq = i", "left");
      const row1 = h("div", "d-row");
      row1.appendChild(client);
      row1.appendChild(done);
      row1.appendChild(server);
      const row2 = h("div", "d-row");
      const spacer = h("div", "dbox ghost");
      row2.appendChild(spacer);
      row2.appendChild(ack);
      const fig = dFig("Per size: exactly two control messages, both on the data QP", row1);
      fig.appendChild(row2);
      fig.appendChild(dNote("Both sides verify tag and sequence counter — a mismatch means the exchange desynchronized and the run aborts instead of printing corrupt numbers."));
      return fig;
    },

    /* The result line anatomy. */
    "output-line"() {
      const chip = h("div", "d-outline");
      const line = h("div", "d-out-line", "1024\t6.55\tGbps");
      const labels = h("div", "d-out-labels");
      labels.appendChild(h("span", "", "size"));
      labels.appendChild(h("span", "", "throughput"));
      labels.appendChild(h("span", "", "unit"));
      chip.appendChild(line);
      chip.appendChild(labels);
      const fig = dFig("One line per size — the whole benchmark reduces to this", chip);
      fig.appendChild(dNote("size × count × 8 ÷ elapsed seconds, auto-scaled bps → Gbps. Byte-identical to ex1; the 21 lines are the envelope you see on the home page."));
      return fig;
    },

    /* The SQ as 256 slots. */
    "sq-slots"() {
      const grid = h("div", "d-slots");
      for (let i = 0; i < 256; i++) {
        const cell = h("div", "d-slot" + (i < 192 ? " filled" : ""));
        if (i === 255) cell.classList.add("edge");
        grid.appendChild(cell);
      }
      const fig = dFig("The SQ — up to W = 256 posted-but-uncompleted WRs", grid);
      fig.appendChild(h("div", "d-slot-legend", "filled = outstanding (here 192/256) · the refill keeps it pinned near W, never empties"));
      fig.appendChild(dNote("The window exists because the wire is far: it takes ~RTT for a WRITE's completion to come back. 256 deep means the HCA always has work queued."));
      return fig;
    },

    /* K = 64: signal every 64th WQE. */
    "signal-schedule"() {
      const row = h("div", "d-wqe-row");
      for (let i = 1; i <= 256; i++) {
        const w = h("div", "d-wqe" + (i % 64 === 0 ? " signaled" : "") + (i === 256 ? " last" : ""));
        if (i % 64 === 0) w.appendChild(h("span", "d-wqe-s", "S"));
        row.appendChild(w);
      }
      const cqes = h("div", "d-wqe-cqes");
      [64, 128, 192, 256].forEach((n) => cqes.appendChild(h("div", "d-wqe-cqe", "CQE #" + (n / 64))));
      const fig = dFig("The signal schedule — 256 WRITEs, 4 completions", row);
      fig.appendChild(cqes);
      fig.appendChild(dNote("Only signaled WRs generate CQEs. In-order RC completions make the accounting exact: CQE #j covers exactly WRs j·K−K+1 … j·K."));
      return fig;
    },

    /* Struct design: the linked list of ibv_send_wr. */
    "linked-list"() {
      const wrRow = h("div", "d-wr-row");
      for (let i = 0; i < 3; i++) {
        const wr = h("div", "d-wr");
        wr.appendChild(h("div", "d-wr-name", "wrs[" + i + "]"));
        wr.appendChild(h("div", "d-wr-field", "opcode = RDMA_WRITE"));
        wr.appendChild(h("div", "d-wr-field", "send_flags = SIGNALED?"));
        wr.appendChild(h("div", "d-wr-ptr", "sg_list →"));
        wr.appendChild(h("div", "d-wr-ptr", "next →"));
        wrRow.appendChild(wr);
        if (i < 2) wrRow.appendChild(dArrow("", "right"));
        else wrRow.appendChild(h("div", "d-wr-null", "NULL"));
      }
      const sge = h("div", "d-sge");
      sge.appendChild(h("div", "d-sge-title", "ibv_sge"));
      sge.appendChild(h("div", "d-sge-field", "addr = ctx->buf (1 MB)"));
      sge.appendChild(h("div", "d-sge-field", "length = size"));
      sge.appendChild(h("div", "d-sge-field", "lkey = mr->lkey"));
      const buf = dBox("1 MB registered buffer — never modified", "buf");
      const remote = h("div", "d-remote");
      remote.appendChild(h("div", "d-remote-title", "server memory"));
      remote.appendChild(h("div", "d-remote-field", "remote_addr = dest->buf_addr"));
      remote.appendChild(h("div", "d-remote-field", "rkey = dest->rkey"));
      const fig = dFig("One linked list per ibv_post_send — the data structures", wrRow);
      fig.appendChild(h("div", "d-row", [dArrow("sg_list", "down"), sge, dArrow("addr/lkey", "down"), buf]));
      fig.appendChild(h("div", "d-row", [dArrow("wr.rdma", "right"), remote]));
      fig.appendChild(dNote("next chains the K WRs; the last next = NULL. One doorbell covers the whole list — that batching is the pipeline's small-size win (ADR-0002/0005)."));
      return fig;
    },

    /* Live: the refill keeps the SQ pinned near W. */
    "refill-live"() {
      const bar = h("div", "d-live-bar");
      const fill = h("div", "d-live-fill");
      bar.appendChild(fill);
      const label = h("div", "d-live-label", "outstanding: 256 / 256");
      const cq = h("div", "d-live-cq");
      cq.appendChild(h("div", "d-live-cq-title", "CQ — completions ready"));
      const cqeRow = h("div", "d-live-cqes");
      [1, 2, 3, 4].forEach(() => cqeRow.appendChild(h("div", "d-live-cqe", "CQE")));
      cq.appendChild(cqeRow);

      const wire = h("div", "d-live-wire");
      const pkt = h("div", "d-live-pkt");
      wire.appendChild(pkt);

      const controls = h("div", "d-live-controls");
      const play = h("button", "btn", "▶ Play");
      const step = h("button", "btn", "Step");
      controls.appendChild(play);
      controls.appendChild(step);

      const desc = h("p", "d-live-desc", "The refill runs at the head of each list post: poll ready CQEs, reclaim, post the next list.");

      const PHASES = [
        { out: 256, cqes: 0, wire: false, d: "Post a K = 64 list — one doorbell. Outstanding is back to 256." },
        { out: 256, cqes: 0, wire: true, d: "The HCA DMA-reads the buffer; the WRITEs cross the link." },
        { out: 256, cqes: 4, wire: false, d: "4 CQEs are ready — one per 64 WRs (in-order, exact)." },
        { out: 192, cqes: 0, wire: false, d: "Refill reclaims: outstanding −= K. The SQ is still full enough to keep posting — it never drains to zero." },
      ];
      let i = 0, timer = null;
      function apply() {
        const ph = PHASES[i % PHASES.length];
        fill.style.width = (ph.out / 256 * 100) + "%";
        label.textContent = "outstanding: " + ph.out + " / 256";
        cqeRow.textContent = "";
        for (let n = 0; n < ph.cqes; n++) cqeRow.appendChild(h("div", "d-live-cqe", "CQE"));
        pkt.classList.toggle("moving", ph.wire);
        desc.textContent = ph.d;
      }
      function tick() { i++; apply(); }
      play.addEventListener("click", () => {
        if (timer) { clearInterval(timer); timer = null; play.textContent = "▶ Play"; return; }
        timer = setInterval(tick, 950);
        play.textContent = "⏸ Pause";
      });
      step.addEventListener("click", tick);
      apply();

      const fig = dFig("The refill, live — why the NIC never idles", h("div", "d-live", [bar, label, wire, cq, controls, desc]));
      fig.appendChild(dNote("The template's wait-for-all drained the SQ to zero every window and re-paid the ramp. The refill polls only what's ready and posts again immediately."));
      return fig;
    },

    /* One-sided write into server memory. */
    "remote-write"() {
      const clientMem = dBox("client: 1 MB buffer", "mem");
      const hca1 = dBox("client HCA", "hca");
      const hca2 = dBox("server HCA", "hca");
      const serverMem = dBox("server: 1 MB buffer @ remote_addr", "mem");
      const row = h("div", "d-row");
      row.appendChild(h("div", "d-col", [clientMem, dArrow("DMA read", "down")]));
      row.appendChild(dArrow("RDMA WRITE — FDR link", "right"));
      row.appendChild(h("div", "d-col", [dArrow("writes straight in", "down"), serverMem]));
      const fig = dFig("An RDMA WRITE is one-sided", row);
      fig.appendChild(dNote("The server's CPU never sees the data — its HCA writes the payload into the registered buffer at remote_addr, gated by rkey. The ack is the only confirmation the client can get (ADR-0003)."));
      return fig;
    },

    /* Inline vs DMA. */
    inline() {
      const inlineWqe = h("div", "d-wqe-big");
      inlineWqe.appendChild(h("div", "d-wqe-big-title", "Inline WQE — ≤ 1024 B"));
      inlineWqe.appendChild(h("div", "d-wqe-big-field", "payload rides inside the WQE"));
      inlineWqe.appendChild(h("div", "d-wqe-big-field", "IBV_SEND_INLINE"));
      const dmaWqe = h("div", "d-wqe-big");
      dmaWqe.appendChild(h("div", "d-wqe-big-title", "DMA WQE — > 1024 B"));
      dmaWqe.appendChild(h("div", "d-wqe-big-field", "SGE → 1 MB buffer"));
      dmaWqe.appendChild(h("div", "d-wqe-big-field", "HCA DMA-reads the payload"));
      const row = h("div", "d-row");
      row.appendChild(inlineWqe);
      row.appendChild(h("div", "d-arrow-note", "vs"));
      row.appendChild(dmaWqe);
      const fig = dFig("Two paths to the wire — the 1 KB boundary is max_inline_data", row);
      fig.appendChild(dNote("Measured (ADR-0004): the inline path carries a per-message payload copy at ~853 MB/s, capping ≤ 1 KB at ~6.55 Gbps. The stack inlines small messages even without the flag."));
      return fig;
    },
  };

  function renderStopD(root, stop) {
    root.classList.add("vd");

    /* Top bar: place + cross-stop navigation. */
    const top = h("header", "d-top");
    const leftPart = h("div", "d-top-left");
    const home = h("a", "d-top-home", "← All stops");
    home.href = "#home";
    leftPart.appendChild(home);
    leftPart.appendChild(h("div", "d-top-title", stop.title));
    leftPart.appendChild(h("span", "d-top-kicker", stop.group + " · ADR " + stop.adrs.join(", ")));
    top.appendChild(leftPart);

    const built = A.spine.filter((s) => s.state === "built");
    const si = built.findIndex((s) => s.id === stop.id);
    const rightPart = h("div", "d-top-right");
    if (si > 0) {
      const p = h("a", "d-top-nav", "← " + built[si - 1].title);
      p.href = "#stop=" + built[si - 1].id;
      rightPart.appendChild(p);
    }
    if (si < built.length - 1) {
      const n = h("a", "d-top-nav", built[si + 1].title + " →");
      n.href = "#stop=" + built[si + 1].id;
      rightPart.appendChild(n);
    }
    top.appendChild(rightPart);
    root.appendChild(top);

    const frames = stop.frames;
    let idx = 0;

    const grid = h("div", "d-grid");
    const left = h("div", "d-left");
    const codePanel = h("section", "d-panel d-code-panel");
    const explainPanel = h("section", "d-panel d-explain-panel");
    const diagramPanel = h("aside", "d-panel d-diagram-panel");
    left.appendChild(codePanel);
    left.appendChild(explainPanel);
    grid.appendChild(left);
    grid.appendChild(diagramPanel);
    root.appendChild(grid);

    /* Bottom strip: dotted progress + frame title; corner arrows are fixed. */
    const bottom = h("div", "d-bottom");
    const dots = h("div", "d-dots");
    const frameTitle = h("span", "d-frame-title");
    const counter = h("span", "d-counter");
    bottom.appendChild(dots);
    bottom.appendChild(frameTitle);
    bottom.appendChild(counter);
    root.appendChild(bottom);

    const prevBtn = h("button", "d-corner prev", "‹");
    prevBtn.title = "Previous frame";
    const nextBtn = h("button", "d-corner next", "›");
    nextBtn.title = "Next frame";
    document.body.appendChild(prevBtn);
    document.body.appendChild(nextBtn);

    function renderFrame() {
      const f = frames[idx];
      dots.textContent = "";
      frames.forEach((fr, i) => {
        const dot = h("button", "d-dot" + (i === idx ? " on" : ""));
        dot.title = fr.title;
        dot.addEventListener("click", () => { idx = i; renderFrame(); });
        dots.appendChild(dot);
      });
      frameTitle.textContent = f.title;
      counter.textContent = (idx + 1) + " / " + frames.length;

      /* Left-top: code, or the stop's concept when the frame has no code. */
      codePanel.textContent = "";
      if (f.code) {
        codePanel.appendChild(h("h2", "d-panel-title", "The code — " + f.code.file));
        codePanel.appendChild(codeBlock({ code: f.code }, true));
      } else {
        codePanel.appendChild(h("h2", "d-panel-title", "The setup"));
        stop.concept.forEach((p) => codePanel.appendChild(h("p", "body", p)));
        codePanel.appendChild(termTable(stop));
      }

      /* Left-bottom: the explanation for this frame. */
      explainPanel.textContent = "";
      explainPanel.appendChild(h("h2", "d-panel-title", "What's happening"));
      f.explain.forEach((p) => explainPanel.appendChild(h("p", "body", p)));
      if (f.why) {
        const why = h("div", "d-side-card");
        why.appendChild(h("span", "adr-badge", f.why.adr));
        why.appendChild(h("h3", "", f.why.title));
        why.appendChild(h("p", "", f.why.text));
        explainPanel.appendChild(why);
      }
      if (f.whatif) {
        const wi = h("div", "d-side-card whatif");
        wi.appendChild(h("h3", "", f.whatif.q));
        wi.appendChild(h("p", "", f.whatif.a));
        explainPanel.appendChild(wi);
      }

      /* Right: the diagram for this frame. */
      diagramPanel.textContent = "";
      const diag = DIAGRAMS[f.diagram]();
      diagramPanel.appendChild(h("div", "d-diagram-sticky", [diag]));
    }

    function nav(dir) { idx = Math.max(0, Math.min(frames.length - 1, idx + dir)); renderFrame(); }
    prevBtn.addEventListener("click", () => nav(-1));
    nextBtn.addEventListener("click", () => nav(1));
    root._frameNav = { next: () => nav(1), prev: () => nav(-1) };

    renderFrame();
  }

  function renderHomeD(root) {
    root.classList.add("vd");
    const hero = h("div", "d-home");
    const kick = h("p", "kicker", "Lab 2 · Verbs API throughput");
    hero.appendChild(kick);
    hero.appendChild(h("h1", "d-home-title", A.title));
    hero.appendChild(h("p", "d-home-lead", A.home.lead));
    hero.appendChild(h("div", "d-home-chart", [envelopeEl()]));
    hero.appendChild(h("h2", "d-home-h2", "Follow the data — pick a stop"));
    const nav = h("div", "d-home-spine");
    A.spine.forEach((s) => {
      if (s.state !== "built") {
        nav.appendChild(h("div", "d-home-planned", "· " + s.title));
        return;
      }
      const a = h("a", "d-home-stop", s.group + " — " + s.title);
      a.href = "#stop=" + s.id;
      nav.appendChild(a);
    });
    hero.appendChild(nav);
    root.appendChild(hero);
  }

  /* ---------- Router ---------------------------------------------------------- */

  const VARIANTS = {
    A: { name: "Field notes", theme: "dark", home: renderHomeA, stop: renderStopA },
    B: { name: "System map", theme: "light", home: renderHomeB, stop: renderStopB },
    C: { name: "Viva deck", theme: "light", home: renderHomeC, stop: renderStopC },
    D: { name: "Studio", theme: "studio", home: renderHomeD, stop: renderStopD },
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
    /* Variant D's fixed corner arrows live on <body> — drop stale ones. */
    document.querySelectorAll(".d-corner").forEach((el) => el.remove());
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

  /* Keyboard: ←/→ cycle variants, EXCEPT in the viva deck (C) and the studio
   * frames (D), which own the arrows for their own navigation. */
  document.addEventListener("keydown", (e) => {
    const own = mount._deckNav || mount._frameNav;
    if (own) {
      if (e.key === "ArrowRight") own.next();
      if (e.key === "ArrowLeft") own.prev();
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
