/*
 * Diagram kit + the ten stop diagrams (variant D — Studio).
 *
 * Hand-drawn style: paper dot-grid, rounded white nodes, curved arrows with
 * arrowheads, leader-line annotations, and a facts strip under every diagram
 * so each one teaches the relevant numbers, not just the shape.
 *
 * window.DIAGRAMS[id]() → a <figure> (svg + facts). Shared primitives in
 * window.DK. All coordinates in a 640-wide viewBox.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const T = (s) => document.createTextNode(s);

  function el(name, attrs, kids) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (kids || []).forEach((c) => e.appendChild(c instanceof Node ? c : T(c)));
    return e;
  }

  /* --- shared <defs>: paper grid + three arrowheads --- */
  function defs() {
    const pat = el("pattern", { id: "dk-dots", width: "18", height: "18", patternUnits: "userSpaceOnUse" },
      [el("circle", { cx: "1.4", cy: "1.4", r: "1.3", class: "dk-grid-dot" })]);
    const mk = (id, cls, w) => el("marker", {
      id, viewBox: "0 0 10 10", refX: "8.5", refY: "5",
      markerWidth: w, markerHeight: w, orient: "auto-start-reverse",
    }, [el("path", { d: "M0,0 L10,5 L0,10 z", class: cls })]);
    return el("defs", {}, [
      pat,
      mk("dk-a-data", "dk-fill-data", 8),
      mk("dk-a-ctrl", "dk-fill-ctrl", 6.5),
      mk("dk-a-ptr", "dk-fill-ptr", 5.5),
    ]);
  }

  /* --- primitives --- */
  function rect(x, y, w, h, o) {
    o = o || {};
    return el("rect", {
      x, y, width: w, height: h,
      rx: o.rx !== undefined ? o.rx : 10,
      class: o.cls || "dk-node",
      ...(o.stroke ? { stroke: o.stroke, "stroke-width": o.sw || 1.4 } : {}),
      ...(o.fill ? { fill: o.fill } : {}),
    });
  }
  function text(x, y, s, o) {
    o = o || {};
    const attrs = {
      x, y, class: o.cls || "dk-text",
      ...(o.size ? { "font-size": o.size } : {}),
      ...(o.weight ? { "font-weight": o.weight } : {}),
      ...(o.fill ? { fill: o.fill } : {}),
      ...(o.anchor ? { "text-anchor": o.anchor } : {}),
      ...(o.mono ? { "font-family": "ui-monospace, monospace" } : {}),
      ...(o.italic ? { "font-style": "italic" } : {}),
    };
    const t = el("text", attrs);
    if (s !== undefined) t.appendChild(T(s));
    return t;
  }
  function path(d, o) {
    o = o || {};
    return el("path", {
      d,
      class: o.cls || "dk-arrow-data",
      ...(o.marker ? { "marker-end": "url(#" + o.marker + ")" } : {}),
    });
  }
  /* Straight arrow with an optional label pill at the midpoint. */
  function arrow(x1, y1, x2, y2, o) {
    o = o || {};
    const g = el("g", {});
    g.appendChild(path(`M${x1},${y1} L${x2},${y2}`, { cls: o.cls, marker: o.marker }));
    if (o.label) g.appendChild(pill((x1 + x2) / 2, (y1 + y2) / 2, o.label, o.labelDy || 0));
    return g;
  }
  /* Quadratic curve arrow; bend > 0 bows downward. */
  function curve(x1, y1, x2, y2, o) {
    o = o || {};
    const bend = o.bend !== undefined ? o.bend : 30;
    const cxm = (x1 + x2) / 2, cym = (y1 + y2) / 2 + bend;
    const g = el("g", {});
    g.appendChild(path(`M${x1},${y1} Q${cxm},${cym} ${x2},${y2}`, { cls: o.cls, marker: o.marker }));
    if (o.label) {
      const t = (cxm + x2) / 2, ty = (cym + y2) / 2 + (bend > 0 ? -8 : 8);
      g.appendChild(pill(t, ty, o.label, o.labelDy || 0));
    }
    return g;
  }
  /* A label in a white pill (width estimated — close enough for short text). */
  function pill(x, y, s, dy, o) {
    o = o || {};
    const size = o.size || 11;
    const w = s.length * size * 0.6 + 16;
    const h = size + 8;
    const g = el("g", { transform: `translate(${x - w / 2}, ${y - h / 2 + (dy || 0)})` });
    g.appendChild(rect(0, 0, w, h, { rx: h / 2, cls: "dk-pill", fill: "#fff", stroke: "rgba(41,38,31,0.12)" }));
    g.appendChild(text(w / 2, h / 2 + 0.5, s, { size, weight: o.weight || 600, cls: "dk-text-strong", anchor: "middle", mono: o.mono }));
    return g;
  }
  /* A node card with a title bar. Returns the <g>. */
  function node(x, y, w, h, title, bodyLines, o) {
    o = o || {};
    const g = el("g", {});
    g.appendChild(rect(x, y, w, h, { cls: o.accent ? "dk-node-accent" : "dk-node" }));
    const tb = rect(x, y, w, 26, { rx: 0, fill: o.accent ? "var(--accent-bg)" : "var(--surface-2)" });
    g.appendChild(tb);
    g.appendChild(rect(x, y + 13, w, 13, { rx: 0, fill: o.accent ? "var(--accent-bg)" : "var(--surface-2)" }));
    g.appendChild(text(x + 12, y + 18, title, { size: 11, weight: 700, cls: o.accent ? "dk-text-accent" : "dk-text-strong", mono: o.mono }));
    bodyLines.forEach((ln, i) => {
      if (typeof ln === "string") {
        g.appendChild(text(x + 12, y + 44 + i * 16, ln, { size: 11 }));
      } else {
        /* small inline sub-box */
        g.appendChild(rect(x + 12, y + 38 + i * 46, w - 24, 36, { cls: "dk-subbox" }));
        g.appendChild(text(x + 20, y + 54 + i * 46, ln.title, { size: 10.5, weight: 600 }));
        g.appendChild(text(x + 20, y + 67 + i * 46, ln.sub || "", { size: 10 }));
      }
    });
    return g;
  }
  /* Small callout with a leader line to a point. */
  function callout(x, y, w, s, o) {
    o = o || {};
    const g = el("g", {});
    g.appendChild(rect(x, y, w, 40, { cls: "dk-callout" }));
    g.appendChild(text(x + 10, y + 17, s.title, { size: 11, weight: 700, cls: "dk-text-strong" }));
    g.appendChild(text(x + 10, y + 32, s.sub || "", { size: 10.5 }));
    if (o.leaderTo) {
      g.appendChild(path(`M${x + w / 2},${y} L${o.leaderTo[0]},${o.leaderTo[1]}`, { cls: "dk-leader" }));
    }
    return g;
  }
  /* A flag marker on a timeline (t0 / t1). */
  function flag(x, y, label, cls) {
    const g = el("g", {});
    g.appendChild(el("path", { d: `M${x - 6},${y} L${x},${y - 14} L${x + 6},${y} z`, class: cls || "dk-flag" }));
    g.appendChild(text(x, y - 20, label, { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
    return g;
  }
  function spanBracket(x1, x2, y, label) {
    const g = el("g", {});
    g.appendChild(el("path", { d: `M${x1},${y} L${x1},${y + 8} L${x2},${y + 8} L${x2},${y}`, class: "dk-bracket", fill: "none" }));
    if (label) g.appendChild(text((x1 + x2) / 2, y + 22, label, { size: 10.5, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
    return g;
  }

  /* --- figure wrapper: title + svg + facts chips (+ optional controls) --- */
  function fig(title, svgEl, facts, extra) {
    const f = document.createElement("figure");
    f.className = "dk-fig";
    const cap = document.createElement("figcaption");
    cap.className = "dk-fig-title";
    cap.textContent = title;
    f.appendChild(cap);
    f.appendChild(svgEl);
    if (facts && facts.length) {
      const row = document.createElement("div");
      row.className = "dk-facts";
      facts.forEach((t) => {
        const c = document.createElement("span");
        c.className = "dk-fact";
        c.innerHTML = t; /* facts are authored strings, not data */
        row.appendChild(c);
      });
      f.appendChild(row);
    }
    if (extra) f.appendChild(extra);
    return f;
  }
  function canvas(w, h, kids) {
    return el("svg", { viewBox: `0 0 ${w} ${h}`, class: "dk-svg", preserveAspectRatio: "xMidYMid meet" },
      [defs(), rect(0, 0, w, h, { rx: 0, fill: "url(#dk-dots)", stroke: "none", cls: "" }), ...kids]);
  }

  /* --- the ten diagrams --- */
  window.DIAGRAMS = {
    connection() {
      const g = [];
      const client = node(24, 66, 252, 168, "CLIENT", [
        "posts the WRITEs · runs the clock",
        "prints the 21 result lines",
        { title: "SQ", sub: "W = 256 WRs" },
        { title: "CQ", sub: "completions" },
      ]);
      const server = node(364, 66, 252, 168, "SERVER", [
        "absorbs WRITEs · acks each done",
        "never sees the data",
        { title: "RQ", sub: "32 receives, pre-posted" },
        { title: "1 MB buffer", sub: "addr + rkey advertised" },
      ]);
      g.push(client, server);
      g.push(curve(276, 110, 364, 110, {
        label: "RC QP — RDMA WRITE", marker: "dk-a-data",
      }));
      g.push(text(320, 140, "data + control SENDs ride it", { size: 10, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(276, 196, 364, 196, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", bend: -24 }));
      g.push(pill(320, 214, "TCP handshake, once", 0));
      g.push(text(320, 236, "lid : qpn : psn : gid + addr : rkey", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(path("M320,106 L320,52", { cls: "dk-leader" }));
      g.push(text(320, 46, "one QP carries everything", { size: 10.5, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 320, g);
      return fig("The connection — what exists before any data flows", svg,
        ["<b>1</b> QP for data + control", "<b>32</b> pre-posted receives, never refreshed",
         "<b>21</b> sizes per sweep", "<b>~10 µs</b> control round trip (ADR-0001/0003)"]);
    },

    timeline() {
      const g = [];
      const axisY = 170;
      g.push(el("line", { x1: 30, y1: axisY, x2: 610, y2: axisY, class: "dk-axis" }));
      /* warmup */
      g.push(rect(40, axisY - 22, 96, 44, { cls: "dk-warmup" }));
      g.push(text(88, axisY - 4, "warmup", { size: 10.5, weight: 600, anchor: "middle" }));
      g.push(text(88, axisY + 12, "4–32 WRs", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      /* t0 flag */
      g.push(flag(150, axisY + 26, "t0"));
      /* timed batch */
      g.push(rect(170, axisY - 26, 250, 52, { cls: "dk-timed" }));
      g.push(text(295, axisY - 4, "timed batch", { size: 12, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(295, axisY + 14, "MSG_COUNTS[seq] WRITEs", { size: 10, mono: true, anchor: "middle", cls: "dk-text-strong" }));
      /* done marker */
      g.push(rect(436, axisY - 18, 58, 36, { cls: "dk-warmup" }));
      g.push(text(465, axisY + 4, "done", { size: 10.5, weight: 600, anchor: "middle" }));
      /* RTT */
      g.push(el("line", { x1: 500, y1: axisY, x2: 556, y2: axisY, class: "dk-arrow-ctrl" }));
      g.push(pill(528, axisY - 18, "RTT ~10 µs", 0, { size: 9.5 }));
      /* ack flag */
      g.push(flag(566, axisY + 26, "t1"));
      /* measured window bracket */
      g.push(el("path", {
        d: `M150,${axisY + 44} L150,${axisY + 54} L566,${axisY + 54} L566,${axisY + 44}`,
        class: "dk-bracket", fill: "none",
      }));
      g.push(el("path", { d: "M150,238 L146,234 M150,238 L154,234", class: "dk-bracket" }));
      g.push(el("path", { d: "M566,238 L562,234 M566,238 L570,234", class: "dk-bracket" }));
      g.push(text(358, 268, "the measured window — throughput = size × count × 8 ÷ (t1 − t0)", {
        size: 11.5, anchor: "middle", cls: "dk-text-accent", weight: 700,
      }));
      /* clocks */
      [150, 566].forEach((x) => {
        g.push(el("circle", { cx: x, cy: 60, r: 13, class: "dk-clock" }));
        g.push(el("line", { x1: x, y1: 60, x2: x, y2: 51, class: "dk-clock-hand" }));
        g.push(el("line", { x1: x, y1: 60, x2: x + 5, y2: 60, class: "dk-clock-hand" }));
      });
      g.push(text(150, 90, "clock starts", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(566, 90, "clock stops", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 300, g);
      return fig("One size on the timeline — two batches, one window", svg,
        ["1 B: <b>1,310,720</b> WRITEs · 1 MB: <b>80</b>", "warmup rides the same stream as the timed batch",
         "the control round trip is inside the window (ADR-0003)"]);
    },

    "clock-window"() {
      const g = [];
      const axisY = 150;
      g.push(el("line", { x1: 30, y1: axisY, x2: 610, y2: axisY, class: "dk-axis" }));
      g.push(flag(120, axisY + 24, "t0"));
      g.push(rect(140, axisY - 24, 220, 48, { cls: "dk-timed" }));
      g.push(text(250, axisY - 2, "timed batch", { size: 11.5, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(rect(376, axisY - 16, 52, 32, { cls: "dk-warmup" }));
      g.push(text(402, axisY + 4, "done", { size: 10, weight: 600, anchor: "middle" }));
      g.push(el("line", { x1: 434, y1: axisY, x2: 488, y2: axisY, class: "dk-arrow-ctrl" }));
      g.push(pill(461, axisY - 16, "RTT", 0, { size: 9.5 }));
      g.push(flag(500, axisY + 24, "t1 — ack"));
      g.push(el("path", { d: `M120,${axisY + 42} L120,${axisY + 52} L500,${axisY + 52} L500,${axisY + 42}`, class: "dk-bracket", fill: "none" }));
      g.push(text(310, 236, "throughput = size × count × 8 ÷ (t1 − t0)", { size: 12, mono: true, anchor: "middle", cls: "dk-text-accent", weight: 700 }));

      g.push(callout(60, 34, 250, { title: "A completion means SENT, not received", sub: "the HCA finished the post — the data may still be on the wire" }));
      g.push(callout(390, 34, 210, { title: "The ack is the barrier", sub: "RC in-order ⇒ every WRITE landed first", }, { leaderTo: [500, 74] }));
      g.push(text(60, 96, "stopping the clock here would measure the post rate, not the wire", { size: 10, italic: true, cls: "dk-text-muted" }));

      const svg = canvas(640, 280, g);
      return fig("The measured window (ADR-0003) — why the clock stops at the ack", svg,
        ["ex1-identical window: 'until the ACK arrives'", "the server's ack speed is on the client's clock",
         "~10 µs cost, negligible above 1 B"]);
    },

    "control-flow"() {
      const g = [];
      g.push(node(28, 90, 170, 130, "CLIENT", ["posts done", "waits for ack"]));
      g.push(node(442, 90, 170, 130, "SERVER", ["verifies done", "replies ack"]));
      g.push(curve(198, 118, 442, 118, { label: "done SEND — tag · seq = i", marker: "dk-a-data", bend: 18 }));
      g.push(curve(442, 196, 198, 196, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", label: "ack SEND — echoes seq = i", bend: -18 }));
      /* message anatomy */
      const anat = el("g", { transform: "translate(240, 18)" });
      anat.appendChild(rect(0, 0, 160, 44, { cls: "dk-subbox" }));
      anat.appendChild(text(8, 20, "0x4354524c", { size: 10.5, mono: true, weight: 600, cls: "dk-text-strong" }));
      anat.appendChild(text(8, 36, "tag", { size: 9, cls: "dk-text-muted" }));
      anat.appendChild(el("line", { x1: 80, y1: 6, x2: 80, y2: 38, class: "dk-axis" }));
      anat.appendChild(text(94, 20, "0–20", { size: 10.5, mono: true, weight: 600, cls: "dk-text-strong" }));
      anat.appendChild(text(94, 36, "seq — the size index", { size: 9, cls: "dk-text-muted" }));
      g.push(anat);
      g.push(path("M320,62 L320,86", { cls: "dk-leader" }));
      g.push(text(320, 78, "8 bytes, carried inline", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(callout(140, 246, 360, { title: "Both sides verify tag + seq", sub: "a mismatch means the exchange desynchronized — abort, never print corrupt numbers" }));

      const svg = canvas(640, 310, g);
      return fig("Per size: exactly two control messages, both on the data QP (ADR-0001)", svg,
        ["<b>32</b> receives cover <b>21</b> messages per direction", "the done proves the WRITEs landed (RC in-order)",
         "the ack carries that guarantee back to the clock"]);
    },

    "output-line"() {
      const g = [];
      /* the line, drawn big */
      g.push(rect(40, 70, 330, 86, { cls: "dk-code" }));
      g.push(text(58, 108, "1024", { size: 26, mono: true, weight: 700, cls: "dk-text-strong" }));
      g.push(el("line", { x1: 150, y1: 82, x2: 150, y2: 144, class: "dk-axis" }));
      g.push(text(160, 108, "6.55", { size: 26, mono: true, weight: 700, cls: "dk-text-accent" }));
      g.push(el("line", { x1: 232, y1: 82, x2: 232, y2: 144, class: "dk-axis" }));
      g.push(text(242, 108, "Gbps", { size: 26, mono: true, weight: 700, cls: "dk-text-strong" }));
      g.push(text(58, 136, "size", { size: 10, cls: "dk-text-muted" }));
      g.push(text(160, 136, "throughput", { size: 10, cls: "dk-text-muted" }));
      g.push(text(242, 136, "unit", { size: 10, cls: "dk-text-muted" }));
      /* envelope sparkline */
      const p0x = 430, p1x = 600, topY = 70, botY = 150;
      g.push(el("line", { x1: p0x, y1: botY, x2: p1x, y2: botY, class: "dk-axis" }));
      g.push(el("line", { x1: p0x, y1: topY, x2: p0x, y2: botY, class: "dk-axis" }));
      const pts = window.APP.envelope.series;
      const px = (i) => p0x + (i / 20) * (p1x - p0x);
      const py = (v) => botY - (Math.min(v, 42.6) / 42.6) * (botY - topY);
      const d = pts.map((p, i) => (i ? "L" : "M") + px(p.size) + "," + py(p.gbps)).join(" ");
      g.push(path(d, { cls: "dk-arrow-data", marker: "" }));
      pts.forEach((p, i) => g.push(el("circle", { cx: px(p.size), cy: py(p.gbps), r: 2, class: "dk-dot-tiny" })));
      g.push(el("circle", { cx: px(10), cy: py(6.55), r: 6, class: "dk-dot-big" }));
      g.push(path(`M${px(10)},${py(6.55)} L${px(10) - 60},${py(6.55) - 34}`, { cls: "dk-leader" }));
      g.push(pill(px(10) - 60, py(6.55) - 44, "1 KB → 6.55 Gbps", 0, { size: 9.5 }));
      g.push(text(430, 172, "the envelope — each size is one dot", { size: 10, cls: "dk-text-muted" }));

      const svg = canvas(640, 200, g);
      return fig("The result line — what the whole run prints (bw.c:953–965)", svg,
        ["<b>21</b> lines, byte-identical to ex1", "bps = size × count × 8 ÷ elapsed, auto-scaled",
         "nothing else on stdout — verify.sh checks the contract"]);
    },

    "sq-slots"() {
      const g = [];
      const slot = 11, gap = 2, cols = 32;
      const x0 = 36, y0 = 66;
      for (let i = 0; i < 256; i++) {
        const x = x0 + (i % cols) * (slot + gap);
        const y = y0 + Math.floor(i / cols) * (slot + gap);
        const filled = i < 192;
        const last = i === 255;
        g.push(rect(x, y, slot, slot, {
          rx: 2,
          cls: filled ? "dk-slot-filled" : (last ? "dk-slot-last" : "dk-slot"),
        }));
      }
      g.push(spanBracket(x0, x0 + 32 * (slot + gap) - gap, y0 - 22, "W = 256 slots"));
      g.push(text(x0, y0 + 8 * (slot + gap) + 26, "192 filled = outstanding now", { size: 11, weight: 600, cls: "dk-text-accent" }));
      g.push(text(x0 + 60, y0 + 8 * (slot + gap) + 26, "· 64 free — never empties", { size: 11, cls: "dk-text-muted" }));
      g.push(callout(430, 80, 180, { title: "The wire is far", sub: "a WRITE's completion takes ~RTT to return — the depth covers it" }));
      g.push(callout(430, 160, 180, { title: "Never below W−1+K", sub: "the refill keeps the pipe full by construction (ADR-0002)" }));

      const svg = canvas(640, 300, g);
      return fig("The SQ — up to W = 256 posted-but-uncompleted WRs", svg,
        ["W = <b>256</b> default", "T6 A/B: 128 and 512 within <b>0.1%</b> — 256 is the measured optimum",
         "one CQE accounts for exactly K WRs"]);
    },

    "signal-schedule"() {
      const g = [];
      const slot = 11, gap = 2, cols = 32;
      const x0 = 36, y0 = 60;
      for (let i = 0; i < 256; i++) {
        const x = x0 + (i % cols) * (slot + gap);
        const y = y0 + Math.floor(i / cols) * (slot + gap);
        const sig = (i + 1) % 64 === 0;
        g.push(rect(x, y, slot, slot, { rx: 2, cls: sig ? "dk-slot-signaled" : "dk-slot" }));
        if (sig) g.push(text(x + slot / 2, y - 4, "S", { size: 8, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      }
      /* CQE chips under the signaled columns */
      [64, 128, 192, 256].forEach((n) => {
        const i = n - 1;
        const x = x0 + (i % cols) * (slot + gap);
        const y = y0 + Math.floor(i / cols) * (slot + gap);
        g.push(el("line", { x1: x + slot / 2, y1: y + slot + gap, x2: x + slot / 2, y2: y0 + 8 * (slot + gap) + 8, class: "dk-leader" }));
        g.push(pill(x + slot / 2, y0 + 8 * (slot + gap) + 18, "CQE #" + n / 64, 0, { size: 9 }));
      });
      g.push(spanBracket(x0, x0 + 64 * (slot + gap) - gap, y0 - 22, "64 WRs"));
      g.push(text(x0 + 64 * (slot + gap) / 2, y0 - 34, "CQE #1 covers exactly these (in-order RC)", { size: 10, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(callout(440, 120, 180, { title: "4 completions per window", sub: "not 256 — the refill's poll pressure is tiny", }));

      const svg = canvas(640, 290, g);
      return fig("The signal schedule — every K-th WRITE generates a CQE (bw.c:917–920)", svg,
        ["256 WRITEs → <b>4</b> CQEs", "exact: CQE #j covers WRs (j−1)·K+1 … j·K",
         "the stream's last WR is always signaled too"]);
    },

    "linked-list"() {
      const g = [];
      /* three WR cards */
      const wrW = 150, wrH = 148, wrY = 36, wrGap = 12;
      const cards = [];
      for (let i = 0; i < 3; i++) {
        const x = 28 + i * (wrW + wrGap);
        const card = el("g", {});
        card.appendChild(rect(x, wrY, wrW, wrH, { cls: "dk-node-accent" }));
        card.appendChild(text(x + 10, wrY + 18, "ibv_send_wr wrs[" + i + "]", { size: 10.5, mono: true, weight: 700, cls: "dk-text-accent" }));
        const fields = [
          "opcode = RDMA_WRITE",
          "wr_id = BW_DATA_WRID",
          "send_flags = SIG | INL",
          "sg_list = &sges[i]",
        ];
        fields.forEach((f, fi) => card.appendChild(text(x + 10, wrY + 40 + fi * 16, f, { size: 10, mono: true })));
        card.appendChild(text(x + 10, wrY + 118, i < 2 ? "next = &wrs[" + (i + 1) + "]" : "next = NULL", { size: 10, mono: true, weight: 700, cls: "dk-text-strong" }));
        g.push(card);
        if (i < 2) g.push(curve(x + wrW, wrY + 114, x + wrW + wrGap, wrY + 114, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", bend: 0 }));
      }
      g.push(text(28 + 3 * (wrW + wrGap) - wrGap / 2, wrY + 114, "linked list — one post call", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      /* SGE card under wr[0] */
      const sgeX = 28, sgeY = 224, sgeW = 190, sgeH = 92;
      g.push(rect(sgeX, sgeY, sgeW, sgeH, { cls: "dk-node" }));
      g.push(text(sgeX + 10, sgeY + 18, "ibv_sge", { size: 10.5, mono: true, weight: 700, cls: "dk-text-strong" }));
      g.push(text(sgeX + 10, sgeY + 38, "addr = ctx->buf", { size: 10, mono: true }));
      g.push(text(sgeX + 10, sgeY + 56, "length = size", { size: 10, mono: true }));
      g.push(text(sgeX + 10, sgeY + 74, "lkey = mr->lkey", { size: 10, mono: true }));
      g.push(curve(28 + 70, wrY + wrH, sgeX + 70, sgeY, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", bend: 14 }));
      g.push(text(28 + 150, sgeY - 12, "sg_list →", { size: 9, cls: "dk-text-muted" }));
      /* buffer card */
      const bufX = 28, bufY = 348, bufW = 190, bufH = 60;
      g.push(rect(bufX, bufY, bufW, bufH, { cls: "dk-buf" }));
      g.push(text(bufX + 10, bufY + 20, "1 MB registered buffer", { size: 10.5, weight: 700, cls: "dk-text-strong" }));
      g.push(text(bufX + 10, bufY + 40, "never modified after init", { size: 9.5, cls: "dk-text-muted" }));
      for (let i = 0; i < 12; i++) g.push(rect(bufX + 18 + i * 14, bufY + 45, 10, 6, { rx: 1, cls: "dk-memcell" }));
      g.push(curve(sgeX + sgeW - 30, sgeY + sgeH, bufX + bufW - 40, bufY, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", bend: 14 }));
      /* remote card + server memory */
      const remX = 436, remY = 36, remW = 176, remH = 120;
      g.push(rect(remX, remY, remW, remH, { cls: "dk-node" }));
      g.push(text(remX + 10, remY + 18, "wr.rdma", { size: 10.5, mono: true, weight: 700, cls: "dk-text-strong" }));
      g.push(text(remX + 10, remY + 42, "remote_addr", { size: 10, mono: true }));
      g.push(text(remX + 10, remY + 60, "= dest->buf_addr", { size: 10, mono: true }));
      g.push(text(remX + 10, remY + 78, "rkey = dest->rkey", { size: 10, mono: true }));
      g.push(curve(28 + wrW, wrY + 50, remX, remY + 50, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", bend: 0 }));
      g.push(text(250, wrY + 44, "the remote side", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      const srvX = 436, srvY = 200, srvW = 176, srvH = 76;
      g.push(rect(srvX, srvY, srvW, srvH, { cls: "dk-buf" }));
      g.push(text(srvX + 10, srvY + 20, "server memory", { size: 10.5, weight: 700, cls: "dk-text-strong" }));
      g.push(text(srvX + 10, srvY + 42, "@ remote_addr — written by", { size: 9.5, cls: "dk-text-muted" }));
      g.push(text(srvX + 10, srvY + 58, "the client's HCA, no server CPU", { size: 9.5, cls: "dk-text-muted" }));
      g.push(curve(remX + remW / 2, remY + remH, srvX + srvW / 2, srvY, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", bend: 14 }));

      const svg = canvas(640, 430, g);
      return fig("The data structures — one linked list per ibv_post_send (bw.c:914–940)", svg,
        ["one doorbell per list of <b>K</b> WRs", "single buffer, never modified → <b>no reuse hazard</b> at full window depth",
         "the last WR's next = <b>NULL</b>"]);
    },

    "refill-live"() {
      const g = [];
      const sqX = 36, sqY = 84, sqW = 300, sqH = 44;
      g.push(rect(sqX, sqY, sqW, sqH, { cls: "dk-node" }));
      g.push(text(sqX + 8, sqY + 16, "SQ — the window", { size: 10.5, weight: 700, cls: "dk-text-strong" }));
      const fill = rect(sqX + 4, sqY + 24, 0, 14, { rx: 4, cls: "dk-slot-filled", stroke: "none" });
      g.push(fill);
      const needle = text(sqX + 8, sqY + sqH + 18, "outstanding: 256 / 256", { size: 10.5, weight: 600, cls: "dk-text-accent", mono: true });
      g.push(needle);
      /* wire */
      g.push(el("path", { d: `M${sqX + sqW},${sqY + 28} C${sqX + sqW + 40},${sqY - 24} ${sqX + sqW + 80},${sqY - 24} ${sqX + sqW + 120},${sqY + 28}`, class: "dk-arrow-data" }));
      const pkt = el("circle", { r: 7, class: "dk-pkt" });
      const motion = el("animateMotion", { dur: "0.9s", repeatCount: "indefinite", path: `M${sqX + sqW},${sqY + 28} C${sqX + sqW + 40},${sqY - 24} ${sqX + sqW + 80},${sqY - 24} ${sqX + sqW + 120},${sqY + 28}` });
      pkt.appendChild(motion);
      g.push(pkt);
      g.push(rect(sqX + sqW + 124, sqY + 14, 76, 28, { cls: "dk-warmup" }));
      g.push(text(sqX + sqW + 162, sqY + 32, "server", { size: 10, weight: 600, anchor: "middle" }));
      /* CQ chips */
      const cqeRow = [];
      [1, 2, 3, 4].forEach((n) => {
        const c = el("g", { opacity: 0 });
        const cx = 36 + (n - 1) * 66;
        c.appendChild(rect(cx, 190, 56, 26, { rx: 13, cls: "dk-cqe" }));
        c.appendChild(text(cx + 28, 207, "CQE #" + n, { size: 9.5, weight: 600, anchor: "middle", cls: "dk-text-accent" }));
        g.push(c);
        cqeRow.push(c);
      });
      g.push(text(36, 182, "CQ — completions ready", { size: 10, cls: "dk-text-muted" }));
      /* refill arrow back to SQ */
      g.push(curve(140, 190, 140, 132, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", label: "reclaim −= K", bend: -26 }));
      /* info card */
      g.push(callout(400, 70, 210, { title: "Refill-never-empty", sub: "poll only ready CQEs, post again — the NIC never idles" }));
      g.push(text(400, 160, "the template waited for ALL completions,", { size: 10, italic: true, cls: "dk-text-muted" }));
      g.push(text(400, 176, "draining the SQ every window — rejected in ADR-0002", { size: 10, italic: true, cls: "dk-text-muted" }));

      const svg = canvas(640, 240, g);
      const controls = document.createElement("div");
      controls.className = "d-live-controls";
      const play = document.createElement("button");
      play.className = "btn";
      play.textContent = "▶ Play";
      const step = document.createElement("button");
      step.className = "btn";
      step.textContent = "Step";
      controls.appendChild(play);
      controls.appendChild(step);
      const desc = document.createElement("p");
      desc.className = "d-live-desc";
      const PHASES = [
        { out: 256, cqes: 0, wire: false, d: "Post a K = 64 list — one doorbell. Outstanding is back to 256." },
        { out: 256, cqes: 0, wire: true, d: "The HCA DMA-reads the buffer; the WRITEs cross the link." },
        { out: 256, cqes: 4, wire: false, d: "4 CQEs are ready — one per 64 WRs (in-order, exact)." },
        { out: 192, cqes: 0, wire: false, d: "Refill reclaims: outstanding −= K. Still ≥ W−1+K — the next list is posted immediately." },
      ];
      let i = 0, timer = null;
      function apply() {
        const ph = PHASES[i % PHASES.length];
        fill.setAttribute("width", (ph.out / 256) * (sqW - 8));
        needle.textContent = "outstanding: " + ph.out + " / 256";
        cqeRow.forEach((c, n) => c.setAttribute("opacity", n < ph.cqes ? 1 : 0));
        pkt.setAttribute("opacity", ph.wire ? 1 : 0);
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
      const extra = document.createElement("div");
      extra.appendChild(controls);
      extra.appendChild(desc);
      return fig("The refill, live — why the NIC never idles (bw_refill, bw.c:868–888)", svg,
        ["+37–67% msg/s at ≤ 64 B vs the naive path (ADR-0005)", "no regression at any size", "the SQ never drains below the window"], extra);
    },

    "remote-write"() {
      const g = [];
      /* client side: buffer → HCA */
      g.push(rect(28, 84, 190, 78, { cls: "dk-buf" }));
      g.push(text(40, 104, "client: 1 MB buffer", { size: 10.5, weight: 700, cls: "dk-text-strong" }));
      for (let i = 0; i < 9; i++) g.push(rect(40 + i * 18, 122, 14, 8, { rx: 2, cls: "dk-memcell" }));
      g.push(text(40, 150, "lkey = mr->lkey", { size: 9.5, mono: true, cls: "dk-text-muted" }));
      g.push(curve(120, 162, 120, 204, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", label: "DMA read", bend: 10 }));
      g.push(rect(28, 208, 190, 40, { cls: "dk-node" }));
      g.push(text(123, 232, "client HCA", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      /* the link */
      g.push(curve(218, 228, 428, 228, { label: "RDMA WRITE — FDR 56 Gb/s link", marker: "dk-a-data", bend: 0 }));
      /* server side: HCA → buffer */
      g.push(rect(432, 208, 180, 40, { cls: "dk-node" }));
      g.push(text(522, 232, "server HCA", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(curve(522, 248, 522, 290, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", label: "writes straight in", bend: 10 }));
      g.push(rect(432, 294, 180, 78, { cls: "dk-buf" }));
      g.push(text(444, 314, "server memory", { size: 10.5, weight: 700, cls: "dk-text-strong" }));
      g.push(text(444, 332, "@ remote_addr — rkey-gated", { size: 9.5, mono: true, cls: "dk-text-muted" }));
      g.push(text(444, 352, "no server CPU involved", { size: 9.5, cls: "dk-text-muted" }));
      /* the point */
      g.push(callout(28, 60, 250, { title: "One-sided operation", sub: "the client's HCA does all the work — the server never sees the data" }));
      g.push(callout(404, 60, 210, { title: "So why the ack?", sub: "the WRITE gives the client no confirmation — the ack is the barrier (ADR-0003)", }));

      const svg = canvas(640, 400, g);
      return fig("An RDMA WRITE is one-sided (bw.c:936–937)", svg,
        ["remote_addr + rkey come from the <b>handshake</b>", "the server's data path is a buffer being filled",
         "without rkey permission the WRITE fails with a protection error"]);
    },

    inline() {
      const g = [];
      /* inline WQE */
      g.push(rect(28, 70, 250, 128, { cls: "dk-node-accent" }));
      g.push(text(40, 92, "INLINE WQE — ≤ max_inline_data", { size: 11, weight: 700, cls: "dk-text-accent" }));
      g.push(text(40, 112, "payload rides inside the WQE", { size: 10.5, cls: "dk-text-strong" }));
      [0, 1, 2, 3, 4].forEach((i) => g.push(rect(40 + i * 34, 126, 26, 12, { rx: 3, cls: "dk-memcell" })));
      g.push(text(40, 158, "no DMA read — no SGE needed", { size: 10, cls: "dk-text-muted" }));
      g.push(text(40, 174, "IBV_SEND_INLINE set", { size: 10, mono: true, cls: "dk-text-muted" }));
      /* DMA WQE */
      g.push(rect(362, 70, 250, 128, { cls: "dk-node" }));
      g.push(text(374, 92, "DMA WQE — > max_inline_data", { size: 11, weight: 700, cls: "dk-text-strong" }));
      g.push(text(374, 112, "SGE → the registered buffer", { size: 10.5, cls: "dk-text-strong" }));
      g.push(rect(430, 126, 120, 14, { cls: "dk-subbox" }));
      g.push(text(430, 138, "payload sits in host memory", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(470, 140, 470, 176, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", label: "HCA DMA-reads", bend: -10 }));
      g.push(text(374, 196, "IBV_SEND_INLINE off", { size: 10, mono: true, cls: "dk-text-muted" }));
      /* boundary */
      g.push(el("line", { x1: 320, y1: 40, x2: 320, y2: 230, class: "dk-ref" }));
      g.push(pill(320, 34, "max_inline_data = 1024 B", 0, { size: 10 }));
      /* copy cost callout */
      g.push(callout(40, 250, 250, { title: "The inline path copies", sub: "~853 MB/s per-message payload copy — the ≤ 1 KB cap", }));
      g.push(callout(350, 250, 260, { title: "Measured plateau", sub: "≤ 1 KB: 6.55 Gbps flat — boundary exactly at 1 KB", }));

      const svg = canvas(640, 320, g);
      return fig("Two paths to the wire — the boundary is the QP's max_inline_data (bw.c:906–907)", svg,
        ["the stack inlines small messages <b>even without the flag</b> (research #12)", "ADR-0004: B = <b>853 MB/s</b> copy, two independent intervals",
         "declare 1024 → read back what the hardware accepted (ADR-0002)"]);
    },
  };
})();
