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

    /* --- setup chapters (stops 1–3, ticket #14) --- */

    "counts-table"() {
      const g = [];
      const counts = [1310720, 81920, 655360, 163840, 327680, 20480, 81920, 81920,
                      40960, 20480, 20480, 20480, 20480, 2560, 2560, 2560, 640,
                      320, 160, 160, 80];
      const baseY = 236, bw = 26, gap = 1, x0 = 40;
      const hOf = (c) => Math.max(8, (Math.log2(c) - 5.3) * 13);
      counts.forEach((c, i) => {
        const h = hOf(c);
        const big = i === 0 || i === 20;
        g.push(rect(x0 + i * (bw + gap), baseY - h, bw, h, {
          rx: 2, cls: big ? "dk-slot-signaled" : "dk-slot",
        }));
      });
      g.push(text(53, baseY - hOf(counts[0]) - 8, "1,310,720", { size: 10.5, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(53, baseY - hOf(counts[0]) + 16, "1 B", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(53 + 20 * (bw + gap), baseY - hOf(counts[20]) - 8, "80", { size: 10.5, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(53 + 20 * (bw + gap), baseY - hOf(counts[20]) + 16, "1 MB", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(spanBracket(x0, x0 + 10 * (bw + gap) - gap, baseY + 8, "message-rate regime"));
      g.push(spanBracket(x0 + 15 * (bw + gap), x0 + 21 * (bw + gap) - gap, baseY + 8, "wire regime"));
      g.push(callout(430, 40, 190, { title: "Counts fall as sizes rise", sub: "the smallest stable batch per size — ex1's convergence (< 1% variance)" }));
      g.push(text(40, 30, "log scale: each bar is log2 of the size's count", { size: 10, italic: true, cls: "dk-text-muted" }));

      const svg = canvas(640, 278, g);
      return fig("The counts table — one count per size, ex1's converged numbers (bw.c:111–121)", svg,
        ["1 B → <b>1,310,720</b> WRITEs · 1 MB → <b>80</b>", "≈ <b>2.86M</b> WRITEs per sweep — far below the 2^24 PSN space",
         "verbatim ex1's table (ADR-0003)"]);
    },

    "ctrl-msg"() {
      const g = [];
      g.push(rect(140, 60, 170, 74, { cls: "dk-node-accent" }));
      g.push(text(225, 92, "0x4354524c", { size: 17, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(225, 112, "tag — 'CTRL' in ASCII", { size: 10.5, anchor: "middle", cls: "dk-text-strong" }));
      g.push(rect(330, 60, 170, 74, { cls: "dk-node" }));
      g.push(text(415, 92, "0–20", { size: 17, mono: true, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(415, 112, "seq — the size index", { size: 10.5, anchor: "middle", cls: "dk-text-strong" }));
      g.push(spanBracket(140, 500, 150, "8 bytes — 2 × uint32"));
      g.push(el("line", { x1: 140, y1: 80, x2: 140, y2: 134, class: "dk-axis" }));
      g.push(el("line", { x1: 310, y1: 80, x2: 310, y2: 134, class: "dk-axis" }));
      g.push(callout(60, 30, 210, { title: "tag proves it's control", sub: "a desync fails loudly, never prints bad numbers" }));
      g.push(callout(370, 200, 250, { title: "seq is echoed back", sub: "the ack carries the done's seq — both sides verify both halves" }));

      const svg = canvas(640, 240, g);
      return fig("The control message — 8 bytes, tag + sequence counter (bw.c:126–133)", svg,
        ["8 B = <b>2 × uint32</b>", "fits one inline send — <b>enforced at build time</b> (the sizeof assert)",
         "tag or seq mismatch → abort"]);
    },

    "handshake-seq"() {
      const g = [];
      g.push(node(28, 110, 210, 130, "CLIENT", ["sends its QP address", "reads the server's", "signals 'ready'"]));
      g.push(node(402, 110, 210, 130, "SERVER", ["reads the client's address", "connects the QPs (RTR → RTS)", "sends addr + rkey"]));
      g.push(curve(238, 138, 402, 138, { label: "1 · lid:qpn:psn:gid", marker: "dk-a-data", bend: 0 }));
      g.push(curve(402, 176, 238, 176, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", label: "2 · … :addr:rkey", bend: 0 }));
      g.push(curve(238, 214, 402, 214, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", label: "3 · ready", bend: 0 }));
      g.push(callout(28, 34, 260, { title: "Order is structural", sub: "the server can't reply before the client's address arrives" }));
      g.push(callout(352, 34, 260, { title: "'ready' keeps the socket alive", sub: "the client signals receipt before closing — else the server's read truncates" }));
      g.push(text(320, 286, "then the socket closes forever — the QP is the only link from here on", { size: 11, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 300, g);
      return fig("The handshake — three messages, once, before any data flows", svg,
        ["<b>1</b> TCP connection, once per run", "<b>128-byte</b> fixed lines, zero-padded",
         "TCP carries addresses only — never data (ADR-0001)"]);
    },

    "dest-anatomy"() {
      const g = [];
      const fields = [
        { name: "LID", src: "portinfo.lid", note: "16-bit fabric address" },
        { name: "QPN", src: "qp->qp_num", note: "assigned by the hardware" },
        { name: "PSN", src: "lrand48 & 0xffffff", note: "random 24-bit start" },
        { name: "GID", src: "query_gid (or zeros)", note: "128-bit, LID-mode fabric" },
      ];
      fields.forEach((f, i) => {
        const x = 40 + i * 142;
        g.push(rect(x, 60, 128, 86, { cls: i === 2 ? "dk-node-accent" : "dk-node" }));
        g.push(text(x + 64, 84, f.name, { size: 14, mono: true, weight: 700, anchor: "middle", cls: i === 2 ? "dk-text-accent" : "dk-text-strong" }));
        g.push(text(x + 64, 106, f.src, { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
        g.push(text(x + 64, 124, f.note, { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      });
      g.push(text(320, 170, "the client sends these 4", { size: 10.5, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(text(320, 186, "the server sends 4 + 2 more:", { size: 10, anchor: "middle", cls: "dk-text-muted" }));
      g.push(rect(120, 196, 170, 60, { cls: "dk-node" }));
      g.push(text(205, 218, "BUF_ADDR", { size: 12, mono: true, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(205, 238, "where the client's WRITEs land", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(rect(350, 196, 170, 60, { cls: "dk-node-accent" }));
      g.push(text(435, 218, "RKEY", { size: 12, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(435, 238, "the key that proves the WRITE may", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 280, g);
      return fig("What an address is made of — and where each field comes from", svg,
        ["<b>4</b> fields client, <b>6</b> server", "PSN: random start — a fresh stream every run",
         "GID travels as <b>32 hex chars</b> (4 × 8)"]);
    },

    "rq-pool"() {
      const g = [];
      const slot = 14, gap = 4, cols = 8;
      const x0 = 56, y0 = 56;
      for (let i = 0; i < 32; i++) {
        const x = x0 + (i % cols) * (slot + gap);
        const y = y0 + Math.floor(i / cols) * (slot + gap);
        g.push(rect(x, y, slot, slot, { rx: 2, cls: i < 21 ? "dk-slot-filled" : "dk-slot" }));
      }
      g.push(text(x0 + 21 * (slot + gap) / 2, y0 + 4 * (slot + gap) + 16, "21 used by one sweep", { size: 11, weight: 600, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(x0 + 21 * (slot + gap) + 2 * (slot + gap), y0 + 4 * (slot + gap) + 16, "· 11 spare", { size: 11, anchor: "middle", cls: "dk-text-muted" }));
      g.push(path(`M${x0 + 16 * (slot + gap) + slot / 2},${y0 + 4 * (slot + gap)} L${x0 + 16 * (slot + gap) + slot / 2},${y0 + 4 * (slot + gap) + 24}`, { cls: "dk-leader" }));
      g.push(rect(x0, 172, 340, 56, { cls: "dk-buf" }));
      g.push(text(x0 + 14, 194, "64-byte control area", { size: 11, weight: 700, cls: "dk-text-strong" }));
      g.push(text(x0 + 14, 212, "all 32 receives point here — one ctrl_buf, one wr_id", { size: 9.5, mono: true, cls: "dk-text-muted" }));
      g.push(callout(430, 60, 190, { title: "Posted before the handshake", sub: "the RQ can never be found empty (ADR-0001)" }));

      const svg = canvas(640, 250, g);
      return fig("The control receive pool — 32 pre-posted receives, never refreshed (bw.c:688–709)", svg,
        ["<b>32</b> posted once at init", "<b>21</b> dones + <b>21</b> acks per sweep — 21 of 32 used per direction",
         "at most one message in flight per direction → shared buffer is safe"]);
    },

    "full-io"() {
      const g = [];
      g.push(rect(28, 70, 180, 70, { cls: "dk-node" }));
      g.push(text(118, 98, "the server", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(118, 118, "sends 128 bytes as a stream", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(rect(432, 70, 180, 70, { cls: "dk-node-accent" }));
      g.push(text(522, 96, "the client's buffer", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(rect(448, 108, 148, 18, { rx: 4, cls: "dk-slot" }));
      g.push(rect(448, 108, 144, 18, { rx: 4, cls: "dk-slot-filled", stroke: "none" }));
      g.push(text(522, 146, "got: 128 — both chunks in", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(208, 90, 432, 90, { cls: "dk-arrow-data", marker: "dk-a-data", label: "read #1 — 60 B", bend: 14 }));
      g.push(curve(208, 120, 432, 120, { cls: "dk-arrow-data", marker: "dk-a-data", label: "read #2 — 68 B", bend: -14 }));
      g.push(callout(60, 168, 240, { title: "TCP has no message boundaries", sub: "read() may return half a message — or more than one" }));
      g.push(callout(360, 168, 240, { title: "The loop demands all len bytes", sub: "each read resumes where the last stopped; n <= 0 means the peer died" }));

      const svg = canvas(640, 230, g);
      return fig("Robust socket IO — why the fixed size makes the loop safe (bw.c:236–260)", svg,
        ["read()/write() can go <b>short</b>", "loop until <b>len</b> — the parse trusts the message",
         "fixed-size handshake lines make len known"]);
    },

    "parse"() {
      const g = [];
      g.push(rect(28, 40, 584, 46, { cls: "dk-code" }));
      g.push(text(320, 68, "0002 : 00000a : 1a2b3c : fe8000…0000 : 7f000001 : 1a2b", {
        size: 15, mono: true, weight: 600, anchor: "middle", cls: "dk-text-strong",
      }));
      g.push(text(320, 96, "lid · qpn · psn · gid (32 hex) · addr · rkey", { size: 10, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(160, 86, 160, 130, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", label: "sscanf", bend: 6 }));
      g.push(rect(40, 134, 240, 116, { cls: "dk-node" }));
      g.push(text(52, 154, "struct bw_dest", { size: 10.5, mono: true, weight: 700, cls: "dk-text-strong" }));
      ["lid", "qpn", "psn", "gid (16 raw bytes)", "buf_addr", "rkey"].forEach((f, i) => {
        g.push(text(52, 174 + i * 12, f, { size: 10, mono: true, cls: i < 3 ? "dk-text-muted" : "dk-text-accent" }));
      });
      g.push(callout(320, 130, 290, { title: "The GID crosses as text", sub: "4 × 8 hex chars → ntohl → 16 raw bytes — byte order explicit" }));
      g.push(callout(320, 210, 290, { title: "The client demands six fields", sub: "a truncated server message must not pass with addr/rkey zero" }));

      const svg = canvas(640, 280, g);
      return fig("The 128-byte line comes back as a struct (bw_parse_dest, bw.c:262–285)", svg,
        ["sscanf against a <b>fixed layout</b>", "4 fields always · <b>6 for the client</b>",
         "GID: byte order made explicit (htonl/ntohl)"]);
    },

    "qp-states"() {
      const g = [];
      const boxes = [
        { x: 40, name: "RESET", note: "born here", cls: "dk-node" },
        { x: 210, name: "INIT", note: "this stop — pointed at a port", cls: "dk-node-accent" },
        { x: 380, name: "RTR", note: "knows the peer", cls: "dk-node-accent" },
        { x: 510, name: "RTS", note: "ready to send", cls: "dk-node" },
      ];
      boxes.forEach((b, i) => {
        g.push(rect(b.x, 60, 100, 56, { cls: b.cls }));
        g.push(text(b.x + 50, 86, b.name, { size: 12, mono: true, weight: 700, anchor: "middle", cls: b.cls === "dk-node-accent" ? "dk-text-accent" : "dk-text-strong" }));
        g.push(text(b.x + 50, 104, b.note, { size: 9, anchor: "middle", cls: "dk-text-muted" }));
        if (i < 3) g.push(curve(b.x + 100, 88, b.x + 130, 88, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", bend: 0 }));
      });
      g.push(spanBracket(380, 610, 132, "the handshake stop — RTR then RTS"));
      g.push(text(90, 40, "QP states, in order", { size: 10, cls: "dk-text-muted" }));
      g.push(callout(40, 160, 270, { title: "RTR needs the peer's address", sub: "QPN · PSN · LID — only the handshake supplies them" }));
      g.push(callout(360, 160, 250, { title: "RTS carries reliability", sub: "timeout 14 · retry 7 · rnr_retry 7 — RC retry behaviour" }));

      const svg = canvas(640, 240, g);
      return fig("The QP lifecycle — INIT here, RTR and RTS in the handshake", svg,
        ["RTR = <b>ready to receive</b> · RTS = <b>ready to send</b>", "GRH addressing only when <b>both</b> sides have GIDs",
         "a one-sided -g degrades to LID mode instead of failing (audit)"]);
    },

    "registration"() {
      const g = [];
      g.push(rect(28, 80, 220, 90, { cls: "dk-buf" }));
      g.push(text(138, 102, "1 MB buffer", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      for (let i = 0; i < 11; i++) g.push(rect(44 + i * 18, 118, 14, 8, { rx: 2, cls: "dk-memcell" }));
      g.push(text(138, 150, "page-aligned · filled 0x7b / 0x7c", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(138, 170, 138, 208, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", label: "ibv_reg_mr", bend: 8 }));
      g.push(rect(28, 212, 260, 92, { rx: 12, cls: "dk-node" }));
      g.push(text(40, 232, "PD — protection domain", { size: 10.5, weight: 700, cls: "dk-text-strong" }));
      g.push(rect(48, 242, 220, 48, { cls: "dk-subbox" }));
      g.push(text(58, 262, "MR — pinned memory", { size: 10.5, weight: 600 }));
      g.push(text(58, 280, "lkey + rkey", { size: 10, mono: true, cls: "dk-text-accent" }));
      g.push(callout(330, 70, 280, { title: "lkey — the local key", sub: "this QP's HCA may read the buffer" }));
      g.push(callout(330, 140, 280, { title: "rkey — the remote key", sub: "the server's only: the client's WRITEs present it; REMOTE_WRITE must be on" }));
      g.push(text(330, 230, "the QP and the MR share the PD —", { size: 10, italic: true, cls: "dk-text-muted" }));
      g.push(text(330, 246, "a QP can only use MRs in its own PD", { size: 10, italic: true, cls: "dk-text-muted" }));

      const svg = canvas(640, 330, g);
      return fig("Registration — the deal with the HCA (bw.c:592–605)", svg,
        ["<b>1 MB</b>, page-aligned", "lkey: local · <b>rkey: remote write, server only</b> (ADR-0002)",
         "never modified after init — no reuse hazard"]);
    },

    "cq-shared"() {
      const g = [];
      g.push(rect(240, 50, 160, 96, { cls: "dk-node-accent" }));
      g.push(text(320, 74, "QP", { size: 12, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(rect(252, 84, 136, 24, { cls: "dk-subbox" }));
      g.push(text(320, 100, "SQ — sends", { size: 9.5, anchor: "middle" }));
      g.push(rect(252, 114, 136, 24, { cls: "dk-subbox" }));
      g.push(text(320, 130, "RQ — receives", { size: 9.5, anchor: "middle" }));
      g.push(curve(280, 146, 280, 186, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", label: "send completions", bend: -8 }));
      g.push(curve(360, 146, 360, 186, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", label: "recv completions", bend: 8 }));
      g.push(rect(200, 190, 240, 64, { cls: "dk-buf" }));
      g.push(text(320, 214, "ONE CQ", { size: 12, mono: true, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(320, 234, "depth = sq_depth + 32 — the worst case", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(callout(60, 60, 190, { title: "In-order by construction", sub: "RC completions merge in order — one queue, one sequence" }));
      g.push(callout(60, 140, 190, { title: "Never full", sub: "sized to the true worst case; a full CQ would drop completions" }));

      const svg = canvas(640, 280, g);
      return fig("One CQ for both directions — the poll loops' single source (bw.c:607–608)", svg,
        ["one CQ for <b>send and receive</b> completions", "depth = sq_depth + 32 — <b>can never overflow</b> (audit)",
         "every wait — refill, done, ack — reads this one queue"]);
    },

    "inline-stepping"() {
      const g = [];
      const rungs = [1024, 960, 896];
      rungs.forEach((r, i) => {
        const y = 84 + i * 40;
        g.push(rect(60, y, 120, 30, { rx: 6, cls: i === 0 ? "dk-slot-signaled" : "dk-slot" }));
        g.push(text(120, y + 20, String(r), { size: 12, mono: true, weight: 700, anchor: "middle", cls: i === 0 ? "dk-text-accent" : "dk-text-strong" }));
        if (i < rungs.length - 1) g.push(el("line", { x1: 120, y1: y + 30, x2: 120, y2: y + 40, class: "dk-axis" }));
      });
      g.push(text(120, 220, "⋮ 0", { size: 12, mono: true, weight: 700, anchor: "middle", cls: "dk-text-muted" }));
      g.push(spanBracket(60, 180, 56, "declare, then step −64"));
      g.push(text(120, 244, "mlx4 accepts → stop", { size: 10, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(curve(180, 90, 300, 90, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", label: "created QP", bend: 0 }));
      g.push(rect(304, 66, 130, 52, { cls: "dk-node" }));
      g.push(text(369, 88, "ibv_query_qp", { size: 10.5, mono: true, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(369, 106, "read back", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(434, 92, 520, 92, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", bend: 0 }));
      g.push(rect(524, 68, 96, 48, { rx: 24, cls: "dk-node-accent" }));
      g.push(text(572, 94, "runtime", { size: 10, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(572, 108, "truth", { size: 10, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(callout(40, 260, 260, { title: "mlx4 refuses too-big declarations", sub: "no portable query exposes the ceiling — so discover it by stepping" }));
      g.push(callout(360, 260, 250, { title: "'We asked the hardware, not a header'", sub: "the read-back is the max_inline_data the data path uses (ADR-0002)" }));

      const svg = canvas(640, 320, g);
      return fig("QP create — declare 1024, step down until accepted, read back (bw.c:623–661)", svg,
        ["declare <b>1024</b>, step −64, ≤ <b>16</b> attempts", "the read-back is the runtime <b>max_inline_data</b>",
         "works on the course OFED and modern rdma-core alike (ADR-0002)"]);
    },

    "sq-depth"() {
      const g = [];
      const x0 = 60, w256 = 200, wSlack = 360, y = 90;
      g.push(rect(x0, y, w256, 44, { cls: "dk-slot-signaled" }));
      g.push(text(x0 + w256 / 2, y + 27, "W = 256 — the window", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(rect(x0 + w256, y, wSlack, 44, { cls: "dk-slot" }));
      g.push(text(x0 + w256 + wSlack / 2, y + 27, "QP_SLACK = 1024 — headroom", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(rect(x0 + w256 + wSlack, y, 24, 44, { cls: "dk-warmup" }));
      g.push(text(x0 + w256 + wSlack + 12, y - 10, "done SEND", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(spanBracket(x0, x0 + w256 + wSlack + 24, y + 60, "1280 = the default request (window + slack)"));
      g.push(curve(120, 150, 120, 196, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", label: "clamped by max_qp_wr", bend: 10 }));
      g.push(text(120, 240, "a shallower QP is still safe: the refill paces by the READ-BACK sq_depth", { size: 10, anchor: "middle", cls: "dk-text-muted" }));
      g.push(callout(380, 40, 220, { title: "The done must always fit", sub: "the slack absorbs the last list's overshoot AND the done SEND (audit)" }));

      const svg = canvas(640, 250, g);
      return fig("The SQ is not exactly W deep — window + slack (bw.c:577–582)", svg,
        ["<b>256 + 1024 = 1280</b> requested", "course hardware: max_qp_wr ≥ <b>1536</b> (T6) — un-clamped",
         "k ≤ QP_SLACK keeps the refill's guarantee (audit)"]);
    },

    "ctx-struct"() {
      const g = [];
      g.push(rect(28, 40, 240, 230, { cls: "dk-node" }));
      g.push(text(40, 62, "struct bw_context", { size: 11, mono: true, weight: 700, cls: "dk-text-strong" }));
      const fields = [
        ["context", "ibv_open_device"],
        ["pd", "ibv_alloc_pd"],
        ["mr · ctrl_mr", "ibv_reg_mr"],
        ["cq", "ibv_create_cq"],
        ["qp", "ibv_create_qp"],
        ["max_inline_data", "READ BACK"],
        ["sq_depth", "READ BACK"],
        ["portinfo", "ibv_query_port"],
      ];
      fields.forEach((f, i) => {
        g.push(text(40, 84 + i * 22, f[0], { size: 10, mono: true, cls: f[1] === "READ BACK" ? "dk-text-accent" : "dk-text-muted" }));
        g.push(curve(268, 84 + i * 22 - 4, 320, 84 + i * 22 - 4, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", bend: 0 }));
        g.push(text(328, 84 + i * 22, f[1], { size: 9.5, mono: true, cls: f[1] === "READ BACK" ? "dk-text-accent" : "dk-text-muted" }));
      });
      g.push(callout(360, 90, 250, { title: "Two fields are discovered, not chosen", sub: "max_inline_data and sq_depth come back from ibv_query_qp" }));
      g.push(callout(360, 190, 250, { title: "Teardown walks it in reverse", sub: "QP → CQ → MRs → PD → device — the harness chapter" }));

      const svg = canvas(640, 300, g);
      return fig("The state it all builds — every resource in one struct (bw.c:188–200)", svg,
        ["everything setup owns, in <b>one struct</b>", "two fields are <b>read-back</b>, not assumed",
         "the handshake reads lid · qpn · mtu out of it"]);
    },

    /* --- data-path chapters (stops 5–8, ticket #15) --- */

    "doorbell-ring"() {
      const g = [];
      g.push(rect(28, 60, 320, 170, { cls: "dk-node" }));
      g.push(text(40, 82, "host memory — the SQ ring", { size: 11, weight: 700, cls: "dk-text-strong" }));
      g.push(text(40, 100, "W = 256 slots · the WQEs sit here", { size: 9.5, cls: "dk-text-muted" }));
      const slot = 13, gap = 4, cols = 16;
      const x0 = 44, y0 = 116;
      for (let i = 0; i < 64; i++) {
        const x = x0 + (i % cols) * (slot + gap);
        const y = y0 + Math.floor(i / cols) * (slot + gap);
        g.push(rect(x, y, slot, slot, { rx: 2, cls: i < 48 ? "dk-slot-filled" : "dk-slot" }));
      }
      g.push(text(180, y0 + 4 * (slot + gap) + 16, "48 WQEs chained by next", { size: 10, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(text(344, y0 + 4 * (slot + gap) + 16, "16 free", { size: 10, anchor: "start", cls: "dk-text-muted" }));
      /* the HCA, waiting */
      g.push(rect(440, 96, 172, 96, { cls: "dk-node-accent" }));
      g.push(text(526, 122, "the HCA", { size: 13, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(rect(452, 132, 148, 28, { rx: 6, cls: "dk-subbox" }));
      g.push(text(526, 151, "doorbell register", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(526, 182, "it has not looked yet", { size: 10, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(348, 150, 440, 150, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", label: "?? — not told", bend: -14 }));
      g.push(callout(28, 244, 300, { title: "Posted ≠ processed", sub: "the client wrote the WQEs; the HCA has not seen them" }));
      g.push(text(360, 268, "the bell tells it where the ring ends", { size: 10.5, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 290, g);
      return fig("The SQ ring — instructions in host memory, invisible until rung (bw.c:917–935)", svg,
        ["<b>64</b> WQEs chained as one list", "the HCA DMA-reads the ring — but only after the bell",
         "the ring depth = window + slack (memory-region stop)"]);
    },

    "doorbell-write"() {
      const g = [];
      /* row 1: build → store → ring */
      g.push(rect(28, 56, 140, 92, { cls: "dk-node-accent" }));
      g.push(text(98, 80, "the list", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(98, 98, "64 WRs → WQEs", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(98, 114, "next-chained", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(168, 100, 220, 100, { cls: "dk-arrow-data", marker: "dk-a-data", label: "1 · store", bend: 0 }));
      g.push(rect(224, 56, 160, 92, { cls: "dk-node" }));
      g.push(text(304, 80, "SQ ring", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(304, 98, "host memory", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(304, 118, "wmb — publish first", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-accent" }));
      g.push(curve(384, 100, 436, 100, { cls: "dk-arrow-data", marker: "dk-a-data", label: "2 · ring", bend: 0 }));
      g.push(rect(440, 56, 172, 92, { cls: "dk-node-accent" }));
      g.push(text(526, 80, "the doorbell", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(526, 98, "posted MMIO write", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(526, 116, "producer index → doorbell page", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      /* row 2: the HCA walks */
      g.push(rect(440, 192, 172, 84, { cls: "dk-node" }));
      g.push(text(526, 216, "the HCA", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(526, 236, "walks the ring from its", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(526, 252, "last known position", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(526, 148, 526, 192, { cls: "dk-arrow-data", marker: "dk-a-data", label: "3 · reads", bend: 10 }));
      g.push(callout(28, 60, 170, { title: "One call, one bell", sub: "the whole list goes visible at once" }, { leaderTo: [140, 70] }));
      g.push(callout(28, 196, 320, { title: "Posted write — fire and forget", sub: "the client does not wait for the HCA; it starts building the next list immediately" }));

      const svg = canvas(640, 300, g);
      return fig("ibv_post_send from the inside — store, publish, ring (bw.c:940–947)", svg,
        ["<b>1</b> call = <b>1</b> doorbell = <b>K</b> WQEs", "wmb orders the stores before the bell",
         "the HCA's walk is 64 WQEs per bell — that is the batch"]);
    },

    "doorbell-cost"() {
      const g = [];
      /* the 163 ns budget bar */
      g.push(rect(40, 90, 560, 44, { cls: "dk-node" }));
      g.push(text(320, 78, "the per-message budget at small sizes — ~163 ns total", { size: 10.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(rect(44, 94, 60, 36, { rx: 4, cls: "dk-slot-signaled", stroke: "none" }));
      g.push(text(74, 118, "doorbell", { size: 10, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(rect(106, 94, 40, 36, { rx: 4, cls: "dk-slot", stroke: "none" }));
      g.push(text(126, 118, "poll", { size: 10, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(74, 156, "≈ 2 ns", { size: 10.5, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(126, 156, "≈ 0.6 ns", { size: 10.5, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(rect(150, 94, 446, 36, { rx: 4, cls: "dk-warmup", stroke: "none" }));
      g.push(text(373, 118, "the rest — the completion-slaved ceiling (completions stop)", { size: 10.5, weight: 600, anchor: "middle", cls: "dk-text-strong" }));
      g.push(callout(40, 196, 260, { title: "K=128 A/B", sub: "half the bells, half the calls — within 0.07% of K=64 (ADR-0006)" }));
      g.push(callout(330, 196, 280, { title: "The bell is noise", sub: "the +37–67% win was batching the bell away (ADR-0005); the ceiling is elsewhere" }));

      const svg = canvas(640, 260, g);
      return fig("What the doorbell actually costs per message (research #11)", svg,
        ["<b>1/64</b> of a posted 32-bit MMIO write per message", "K=128 vs K=64: <b>0.07%</b> — the bell is noise",
         "the naive path paid it per WRITE and measured 4.5M msg/s (ADR-0005)"]);
    },

    "wire-paths"() {
      const g = [];
      /* inline lane */
      g.push(rect(28, 56, 230, 92, { cls: "dk-node-accent" }));
      g.push(text(143, 80, "INLINE — ≤ max_inline_data", { size: 10.5, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(143, 100, "payload rides inside the WQE", { size: 10, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(143, 118, "no DMA read — nothing to fetch", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(258, 100, 330, 100, { cls: "dk-arrow-data", marker: "dk-a-data", label: "transmits the WQE's own bytes", bend: 0 }));
      /* DMA lane */
      g.push(rect(28, 192, 230, 88, { cls: "dk-buf" }));
      g.push(text(143, 216, "the registered buffer", { size: 10.5, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(143, 236, "payload lives in host memory", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(143, 254, "the SGE names it — lkey in hand", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(258, 224, 330, 224, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", label: "HCA DMA-reads", bend: 0 }));
      /* the wire */
      g.push(rect(334, 56, 280, 224, { cls: "dk-node" }));
      g.push(text(474, 82, "the wire — FDR", { size: 12, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(474, 104, "56 Gb/s per port · 4 lanes", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(474, 122, "64b/66b → ~54.5 Gbps net", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-accent" }));
      g.push(el("line", { x1: 366, y1: 140, x2: 582, y2: 140, class: "dk-axis" }));
      g.push(text(474, 170, "the run never saturates it:", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(474, 188, "the host interface is the cap", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(474, 210, "42.5 Gbps measured peak", { size: 10.5, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(el("line", { x1: 366, y1: 226, x2: 582, y2: 226, class: "dk-axis" }));
      g.push(text(474, 252, "the boundary between the lanes:", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(474, 268, "max_inline_data = 1024 B (read back)", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-strong" }));
      /* boundary line between lanes */
      g.push(el("line", { x1: 28, y1: 164, x2: 330, y2: 164, class: "dk-ref" }));
      g.push(pill(170, 158, "size ≤ max_inline_data?", 0, { size: 10 }));

      const svg = canvas(640, 300, g);
      return fig("Two paths to the wire — the boundary is the QP's max_inline_data (bw.c:906–907)", svg,
        ["inline: <b>~853 MB/s</b> copy plateau (≤ 1 KB, ADR-0004)", "DMA: <b>~42.5 Gbps</b> host-interface-bound above",
         "FDR carries ~54.5 Gbps net — never the bottleneck"]);
    },

    "inline-attribution"() {
      const g = [];
      /* the HCA, center */
      g.push(rect(240, 120, 160, 110, { cls: "dk-node-accent" }));
      g.push(text(320, 146, "the HCA", { size: 13, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(320, 166, "firmware payload ingest", { size: 9.5, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(320, 184, "~853 MB/s · 1.17 ns/B", { size: 10.5, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(320, 202, "undocumented in any vendor", { size: 9, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(320, 216, "source — required by elimination", { size: 9, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      /* candidates, ruled out */
      g.push(rect(28, 40, 190, 74, { cls: "dk-warmup" }));
      g.push(text(123, 62, "libmlx4 inline copy", { size: 10.5, weight: 700, anchor: "middle" }));
      g.push(text(123, 82, "flag-gated — and 10× too fast", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(el("path", { d: "M40,52 L206,102 M206,52 L40,102", class: "dk-bracket", stroke: "var(--series-1)" }));
      g.push(rect(28, 240, 190, 74, { cls: "dk-warmup" }));
      g.push(text(123, 262, "the kernel (mlx4_ib)", { size: 10.5, weight: 700, anchor: "middle" }));
      g.push(text(123, 282, "never touches user-QP posts", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(el("path", { d: "M40,252 L206,302 M206,252 L40,302", class: "dk-bracket", stroke: "var(--series-1)" }));
      g.push(rect(422, 40, 190, 74, { cls: "dk-warmup" }));
      g.push(text(517, 62, "CPU memcpy", { size: 10.5, weight: 700, anchor: "middle" }));
      g.push(text(517, 82, "~10 GB/s — an order too fast", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(el("path", { d: "M434,52 L600,102 M600,52 L434,102", class: "dk-bracket", stroke: "var(--series-1)" }));
      g.push(rect(422, 240, 190, 74, { cls: "dk-warmup" }));
      g.push(text(517, 262, "the wire", { size: 10.5, weight: 700, anchor: "middle" }));
      g.push(text(517, 282, "~6.3 GB/s — 7.4× too fast", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(el("path", { d: "M434,252 L600,302 M600,252 L434,302", class: "dk-bracket", stroke: "var(--series-1)" }));
      g.push(callout(40, 330, 560, { title: "The evidence for the HCA", sub: "byte-proportional at 853 MB/s · bounded at exactly max_inline_data · identical with and without the flag (T4 vs T5)" }));

      const svg = canvas(640, 386, g);
      return fig("Who performs the ~853 MB/s copy — every software candidate ruled out (research #12)", svg,
        ["<b>853 MB/s</b> to three digits over two independent intervals", "T4 (no flag) = T5 (flag) to three digits",
         "killer experiment: declare <b>max_inline_data = 0</b> on the nodes (user-mediated)"]);
    },

    "dma-floor"() {
      const g = [];
      const x0 = 90, y0 = 40, x1 = 610, y1 = 240;
      g.push(el("line", { x1: x0, y1: y1, x2: x1, y2: y1, class: "dk-axis" }));
      g.push(el("line", { x1: x0, y1: y0, x2: x0, y2: y1, class: "dk-axis" }));
      /* the floor line */
      g.push(el("line", { x1: x0, y1: 130, x2: x1, y2: 130, class: "dk-ref" }));
      g.push(pill(x0 + 60, 122, "the ~495 ns per-message floor", 0, { size: 9.5 }));
      /* wire time curve: per-message wire time = size*8/R — rises with size */
      const wireY = (ns) => y1 - (ns - 200) / (1600 - 200) * (y1 - y0 - 40);
      g.push(path(`M${x0 + 10},${wireY(385)} L${x1 - 10},${wireY(1500)}`, { cls: "dk-arrow-data", marker: "" }));
      g.push(pill(x1 - 170, wireY(1500) - 14, "wire time per message (rises with size)", 0, { size: 9 }));
      /* the two measured points */
      const px2 = x0 + 60, px4 = x0 + 210;
      g.push(el("circle", { cx: px2, cy: 130, r: 6, class: "dk-dot-big" }));
      g.push(el("circle", { cx: px4, cy: wireY(774), r: 6, class: "dk-dot-big" }));
      g.push(text(px2, 118, "2 KB", { size: 11, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(callout(px2 - 70, 236, 150, { title: "2 KB — 32.67 Gbps", sub: "wire time shorter than the floor: the HCA is the bound" }));
      g.push(text(px4, wireY(774) - 10, "4 KB", { size: 11, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(callout(px4 - 40, 150, 190, { title: "4 KB — 42.36 Gbps", sub: "wire time exceeds the floor: the host interface rules" }, { leaderTo: [px4, wireY(774) - 4] }));
      /* crossover */
      g.push(el("line", { x1: px2 + 24, y1: y1, x2: px2 + 24, y2: 130, class: "dk-axis", stroke: "var(--series-1)" }));
      g.push(text(px2 + 24, y1 + 14, "crossover ≈ 2.4–2.6 KB", { size: 9.5, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(text(300, 56, "per-message time: the floor vs the wire time", { size: 10.5, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 280, g);
      return fig("The 2 KB ramp — a fixed per-message floor of the DMA path (research #13)", svg,
        ["floor ≈ <b>490–500 ns</b>/msg, pair-invariant (501.5 vs 488.6)", "2 KB wire time ~385–430 ns < floor → 32.67 Gbps",
         "from 4 KB the wire time hides the floor → flat R"]);
    },

    "landing-placement"() {
      const g = [];
      g.push(rect(28, 90, 220, 110, { cls: "dk-node" }));
      g.push(text(138, 114, "client HCA", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(138, 134, "sends the WRITE packet:", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(138, 152, "payload + remote_addr + rkey", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(138, 176, "no server CPU anywhere in it", { size: 9.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(248, 130, 340, 130, { cls: "dk-arrow-data", marker: "dk-a-data", label: "the wire", bend: 0 }));
      /* responder */
      g.push(rect(344, 66, 268, 128, { cls: "dk-node" }));
      g.push(text(478, 90, "server HCA — the responder", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(rect(360, 102, 236, 34, { rx: 6, cls: "dk-subbox" }));
      g.push(text(478, 124, "validates the rkey against the MR", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(478, 162, "places the payload", { size: 10.5, weight: 600, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(478, 180, "consumes no RQ WQE · no notification", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(478, 194, 478, 236, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", label: "writes straight in", bend: 8 }));
      g.push(rect(344, 240, 268, 62, { cls: "dk-buf" }));
      g.push(text(478, 262, "server memory — @ remote_addr", { size: 10.5, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(478, 282, "the server CPU cannot even see it", { size: 9.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(callout(28, 40, 300, { title: "One-sided by design", sub: "the responder's CPU is never on the data path" }));
      g.push(callout(360, 316, 260, { title: "So why the ack?", sub: "nothing in the WRITE tells the client it landed — the ack is the proof (ADR-0003)" }));

      const svg = canvas(640, 360, g);
      return fig("What landing means — the responder places the payload (bw.c:936–937)", svg,
        ["rkey validated by the <b>responder HCA</b>", "RDMA WRITE: <b>no RQ WQE, no receive notification</b>",
         "a wrong rkey = protection error = loud abort"]);
    },

    "server-loop"() {
      const g = [];
      g.push(rect(28, 60, 170, 120, { cls: "dk-node" }));
      g.push(text(113, 86, "CLIENT", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(113, 106, "posts the size's WRITEs", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(113, 122, "then the done SEND", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(198, 90, 268, 90, { cls: "dk-arrow-data", marker: "dk-a-data", label: "done", bend: 0 }));
      /* the server's 4-step loop */
      const steps = [
        { x: 272, t: "poll done", s: "bw_recv_ctrl", cls: "dk-node-accent" },
        { x: 400, t: "verify", s: "tag + seq", cls: "dk-node" },
        { x: 528, t: "ack", s: "BW_SEND_ACK_WRID", cls: "dk-node-accent" },
      ];
      steps.forEach((st, i) => {
        g.push(rect(st.x, 60, 96, 120, { cls: st.cls }));
        g.push(text(st.x + 48, 100, st.t, { size: 11, weight: 700, anchor: "middle", cls: st.cls === "dk-node-accent" ? "dk-text-accent" : "dk-text-strong" }));
        g.push(text(st.x + 48, 122, st.s, { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
        if (i < steps.length - 1) g.push(curve(st.x + 96, 100, st.x + 128, 100, { cls: "dk-arrow-ptr", marker: "dk-a-ptr", bend: 0 }));
      });
      /* consume + loop back */
      g.push(text(340, 205, "…then consume the ack's own completion (audit fix)", { size: 9.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(576, 60, 320, 44, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", label: "×21 sizes", bend: -34 }));
      g.push(callout(60, 230, 280, { title: "The data never passes through here", sub: "the HCA placed it; this loop only exchanges control messages" }));
      g.push(callout(380, 230, 240, { title: "Nothing is ever reposted", sub: "the 32-deep pool covers the whole sweep (handshake stop)" }));

      const svg = canvas(640, 280, g);
      return fig("The server's whole data path — done, verify, ack, consume (bw.c:1034–1053)", svg,
        ["<b>21</b> iterations — one per size", "the ack's own completion is consumed (audit fix)",
         "verify: fixed tag + the done's sequence counter"]);
    },

    barrier() {
      const g = [];
      const axisY = 150;
      g.push(el("line", { x1: 30, y1: axisY, x2: 610, y2: axisY, class: "dk-axis" }));
      g.push(rect(40, axisY - 22, 240, 44, { cls: "dk-timed" }));
      g.push(text(160, axisY - 2, "the size's WRITEs", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(160, axisY + 12, "posted and transmitted in order", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(rect(296, axisY - 18, 60, 36, { cls: "dk-warmup" }));
      g.push(text(326, axisY + 4, "done", { size: 10.5, weight: 700, anchor: "middle" }));
      g.push(el("line", { x1: 360, y1: axisY, x2: 420, y2: axisY, class: "dk-arrow-ctrl" }));
      g.push(pill(390, axisY - 16, "RTT ~10 µs", 0, { size: 9.5 }));
      g.push(rect(424, axisY - 18, 60, 36, { cls: "dk-node-accent" }));
      g.push(text(454, axisY + 4, "ack", { size: 10.5, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      /* the guarantee */
      g.push(callout(40, 30, 290, { title: "RC in-order delivery", sub: "the server's receive completion for the done only happens after every prior WRITE was processed" }));
      g.push(callout(360, 30, 260, { title: "The ack carries it back", sub: "ack arrival ⟹ every WRITE of the size is in server memory (ADR-0003)" }, { leaderTo: [454, 66] }));
      g.push(text(320, 226, "that is the completion barrier — and why the clock may stop at the ack", { size: 11.5, anchor: "middle", cls: "dk-text-accent", weight: 700 }));
      g.push(text(320, 250, "the client's t1 is stamped the moment the ack's receive completion lands", { size: 10, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 270, g);
      return fig("Proof of landing — the done → ack barrier (bw.c:830–835)", svg,
        ["WRITEs → done → ack, all on one RC QP", "the done's completion proves the WRITEs landed",
         "the ack echoes the done's seq — both sides verify both halves"]);
    },

    "wr-id-routing"() {
      const g = [];
      /* the CQ, with one CQE per kind */
      g.push(rect(40, 50, 170, 250, { cls: "dk-node-accent" }));
      g.push(text(125, 72, "the shared CQ", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      const rows = [
        { y: 92, t: "data CQE" },
        { y: 136, t: "done-snd CQE" },
        { y: 180, t: "ack-rcv CQE" },
        { y: 224, t: "data CQE" },
      ];
      rows.forEach((r) => {
        g.push(rect(56, r.y, 138, 30, { rx: 6, cls: "dk-cqe" }));
        g.push(text(125, r.y + 20, r.t, { size: 9.5, weight: 600, anchor: "middle", cls: "dk-text-accent" }));
      });
      /* routes */
      const routes = [
        { y: 92, bit: "1 << 4", name: "BW_DATA_WRID", dest: "the refill — one CQE = K WRs", cls: "dk-arrow-data", marker: "dk-a-data" },
        { y: 136, bit: "1 << 2", name: "BW_SEND_DONE_WRID", dest: "the client's done SEND", cls: "dk-arrow-ptr", marker: "dk-a-ptr" },
        { y: 180, bit: "1 << 1", name: "BW_RECV_WRID", dest: "control receives (done · ack)", cls: "dk-arrow-ctrl", marker: "dk-a-ctrl" },
        { y: 224, bit: "1 << 4", name: "BW_DATA_WRID", dest: "the refill (again)", cls: "dk-arrow-data", marker: "dk-a-data" },
      ];
      routes.forEach((r) => {
        g.push(curve(194, r.y + 15, 250, r.y + 15, { cls: r.cls, marker: r.marker, bend: 0 }));
        g.push(pill(222, r.y + 5, r.bit, 0, { size: 9.5 }));
        g.push(text(438, r.y + 20, r.name, { size: 10, mono: true, weight: 700, cls: "dk-text-accent" }));
        g.push(text(438, r.y + 36, r.dest, { size: 9.5, cls: "dk-text-strong" }));
      });
      g.push(text(125, 272, "every CQE carries", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(125, 288, "one of the four tags", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 320, g);
      return fig("One CQ, four tags — the taxonomy routes every completion (bw.c:170–184)", svg,
        ["<b>4</b> wr_ids — all data WRITEs share one", "waits pass bitsets: pass | (1 &lt;&lt; want)",
         "an unexpected wr_id is a protocol error — abort"]);
    },

    "cqe-anatomy"() {
      const g = [];
      /* a CQE card */
      g.push(rect(60, 60, 220, 110, { cls: "dk-node-accent" }));
      g.push(text(170, 84, "one CQE", { size: 12, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(rect(76, 96, 188, 26, { rx: 5, cls: "dk-subbox" }));
      g.push(text(170, 114, "status = IBV_WC_SUCCESS ?", { size: 10, mono: true, anchor: "middle", cls: "dk-text-strong" }));
      g.push(rect(76, 128, 188, 26, { rx: 5, cls: "dk-subbox" }));
      g.push(text(170, 146, "wr_id — one of the four tags", { size: 10, mono: true, anchor: "middle", cls: "dk-text-strong" }));
      /* the check */
      g.push(rect(360, 60, 250, 110, { cls: "dk-node" }));
      g.push(text(485, 84, "bw_wc_bad — the one classifier", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(485, 108, "bad status → abort with the reason", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(485, 126, "wr_id outside `allowed` → abort", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(485, 150, "both poll loops share it — the reports", { size: 9, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(485, 164, "cannot drift apart", { size: 9, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(280, 110, 360, 110, { cls: "dk-arrow-data", marker: "dk-a-data", label: "checked", bend: 0 }));
      g.push(callout(40, 220, 260, { title: "status: did the WR succeed?", sub: "a protection error (bad rkey) arrives here, loudly" }));
      g.push(callout(340, 220, 270, { title: "wr_id: which kind of WR is it?", sub: "the routing key — the waits decide pass vs want by it" }));

      const svg = canvas(640, 270, g);
      return fig("The classifier — status and wr_id, checked together (bw.c:753–767)", svg,
        ["<b>2</b> checks per completion, shared everywhere", "allowed = pass | (1 &lt;&lt; want)",
         "a desynced exchange fails loudly — never prints"]);
    },

    "poll-until"() {
      const g = [];
      const axisY = 130;
      g.push(el("line", { x1: 30, y1: axisY, x2: 610, y2: axisY, class: "dk-axis" }));
      const cqes = [
        { x: 50, t: "data", pass: true },
        { x: 130, t: "data", pass: true },
        { x: 210, t: "done-snd", pass: true },
        { x: 290, t: "ACK", pass: false, want: true },
      ];
      cqes.forEach((c) => {
        g.push(rect(c.x, axisY - 22, 62, 44, { rx: 6, cls: c.want ? "dk-node-accent" : "dk-cqe" }));
        g.push(text(c.x + 31, axisY - 2, c.t, { size: 9.5, weight: c.want ? 700 : 600, anchor: "middle", cls: c.want ? "dk-text-accent" : "dk-text-strong" }));
        if (c.pass) g.push(el("path", { d: `M${c.x + 62},${axisY} L${c.x + 92},${axisY - 18} L${c.x + 92},${axisY + 18} z`, class: "dk-leader", fill: "none" }));
      });
      g.push(text(290 + 31, axisY + 34, "want — the clock stamps t1 here", { size: 10, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      /* the passers-through */
      g.push(text(180, 96, "passed: consumed and ignored — their bits are in `pass`", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      /* deadline */
      g.push(el("line", { x1: 480, y1: 40, x2: 480, y2: 220, class: "dk-ref" }));
      g.push(pill(480, 34, "10 s — CTRL_POLL_TIMEOUT_SEC", 0, { size: 9.5 }));
      g.push(callout(500, 100, 110, { title: "Empty CQ", sub: "poll again — the clock is checked each pass" }, { leaderTo: [480, 130] }));
      g.push(text(200, 62, "busy poll, bounded — a dead peer fails the run in 10 s, not verify.sh's 180 s", { size: 10, italic: true, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 250, g);
      return fig("The client's ack wait — pass through, stop at the want (bw_poll_until, bw.c:775–809)", svg,
        ["data and done-send completions precede the ack (in-order)", "bw_wc_bad runs on every completion, passers included",
         "t1 = the ack's completion — the clock stop (ADR-0003)"]);
    },

    outstanding() {
      const g = [];
      /* the window bar */
      g.push(rect(40, 80, 560, 40, { cls: "dk-node" }));
      g.push(rect(44, 84, 380, 32, { rx: 4, cls: "dk-slot-filled", stroke: "none" }));
      g.push(text(320, 70, "the window — W = 256 WRs outstanding max", { size: 10.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(170, 106, "outstanding = posted − reclaimed", { size: 11, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(430, 106, "free", { size: 10.5, weight: 600, anchor: "middle", cls: "dk-text-strong" }));
      /* the two counters */
      g.push(rect(80, 150, 200, 60, { cls: "dk-node" }));
      g.push(text(180, 172, "posted", { size: 11, mono: true, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(180, 192, "every WR of the stream — warmup + timed", { size: 9, anchor: "middle", cls: "dk-text-muted" }));
      g.push(rect(360, 150, 200, 60, { cls: "dk-node" }));
      g.push(text(460, 172, "reclaimed", { size: 11, mono: true, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(460, 192, "−K per data CQE, exactly (in-order RC)", { size: 9, anchor: "middle", cls: "dk-text-muted" }));
      g.push(curve(280, 180, 360, 180, { cls: "dk-arrow-data", marker: "dk-a-data", label: "−", bend: 0 }));
      /* CQE stream */
      g.push(rect(40, 248, 300, 44, { cls: "dk-cqe" }));
      g.push(text(190, 272, "CQEs → each reclaims exactly K = 64 WRs", { size: 10.5, weight: 600, anchor: "middle", cls: "dk-text-accent" }));
      g.push(callout(390, 230, 220, { title: "Scoped to one size", sub: "the ack wait consumes the residuals without touching these counters — the state is rebuilt per size" }));

      const svg = canvas(640, 310, g);
      return fig("The whole accounting: two counters, K-sized steps (struct bw_data_state, bw.c:850–853)", svg,
        ["posted − reclaimed = <b>outstanding</b>", "one data CQE = <b>exactly K WRs</b> — no per-WR bookkeeping",
         "the refill reclaims; the ack wait consumes the rest (ADR-0003)"]);
    },

    constants() {
      const g = [];
      const cards = [
        { x: 28, v: "W", d: "256", t: "WINDOW_DEFAULT", s: "WRs outstanding max — the window", cls: "dk-node-accent" },
        { x: 183, v: "K", d: "64", t: "SIGNAL_INTERVAL_DEFAULT", s: "signal every K-th WR — also the list size", cls: "dk-node-accent" },
        { x: 338, v: "SLACK", d: "1024", t: "QP_SLACK", s: "SQ headroom — the done always fits", cls: "dk-node" },
        { x: 493, v: "INLINE", d: "1024", t: "MAX_INLINE_DATA_DECLARE", s: "the largest inline tried at QP create", cls: "dk-node" },
      ];
      cards.forEach((c) => {
        g.push(rect(c.x, 70, 140, 118, { cls: c.cls }));
        g.push(text(c.x + 70, 96, c.v, { size: 13, mono: true, weight: 700, anchor: "middle", cls: c.cls === "dk-node-accent" ? "dk-text-accent" : "dk-text-strong" }));
        g.push(text(c.x + 70, 118, "= " + c.d, { size: 15, mono: true, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
        g.push(text(c.x + 70, 140, c.t, { size: 8.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
        g.push(text(c.x + 70, 158, c.s, { size: 8.5, anchor: "middle", cls: "dk-text-muted" }));
      });
      g.push(text(320, 52, "four numbers bound the whole pipeline", { size: 10.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(callout(60, 230, 250, { title: "The checks between them", sub: "K ≤ QP_SLACK keeps the refill's guarantee; W + SLACK = the SQ depth requested (1280)" }));
      g.push(callout(360, 230, 250, { title: "Surfaced, not buried", sub: "-r / -k on the CLI (usage); the inline ceiling is declared, then read back (ADR-0002)" }));

      const svg = canvas(640, 280, g);
      return fig("The constants that bound the pipeline (bw.c:146–158)", svg,
        ["W = <b>256</b> · K = <b>64</b> — the window and its completions", "QP_SLACK = <b>1024</b> — done-SEND headroom (audit invariant)",
         "MAX_INLINE_DATA_DECLARE = <b>1024</b> — stepped down, read back"]);
    },

    ceiling() {
      const g = [];
      const x0 = 90, y0 = 40, x1 = 610, y1 = 230;
      g.push(el("line", { x1: x0, y1: y1, x2: x1, y2: y1, class: "dk-axis" }));
      g.push(el("line", { x1: x0, y1: y0, x2: x0, y2: y1, class: "dk-axis" }));
      /* the flat ceiling */
      g.push(el("line", { x1: x0 + 10, y1: 130, x2: x1 - 20, y2: 130, class: "dk-arrow-data" }));
      [x0 + 10, x0 + 150, x0 + 300, x0 + 450].forEach((x) => {
        g.push(el("circle", { cx: x, cy: 130, r: 5, class: "dk-dot-tiny" }));
      });
      g.push(pill(x0 + 220, 120, "~163 ns/message — flat from 1 B to 32 B", 0, { size: 10 }));
      g.push(text(320, 160, "6.1M msg/s · 1.31M WRs measured at 1 B", { size: 10, mono: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(text(320, 180, "the post rate is slaved to completion production — the refill's spin", { size: 10, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      /* the two candidates */
      g.push(callout(60, 40, 260, { title: "Candidate 1: the client's post loop", sub: "per-WQE array fills + provider WQE build on the old stack" }));
      g.push(callout(360, 40, 240, { title: "Candidate 2: the HCA's per-QP WQE rate", sub: "~6.1M WQEs/s — observed through the completions" }));
      g.push(text(320, 250, "invariant to W, K, and payload — the two survive; the nodes decide (research #11)", { size: 10, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 270, g);
      return fig("The small-size ceiling — where the refill meets the HCA (bw.c:880–881)", svg,
        ["<b>163.3 ns</b> per message, 1–32 B flat", "(W,K) A/B: within <b>0.07%</b> — no parameter moves it",
         "one CQE poll per 256 messages — the completion path is nearly free"]);
    },

    "ctrl-send-wqe"() {
      const g = [];
      g.push(node(28, 110, 270, 150, "THE SEND WQE — 8-byte message", [
        "wr_id: DONE or ACK (routing)",
        "opcode: IBV_WR_SEND",
        "flags: SIGNALED + INLINE",
        { title: "payload", sub: "tag · seq — inside the WQE" },
      ]));
      g.push(node(352, 110, 260, 150, "STAGED FALLBACK — inline off", [
        "memcpy msg into ctrl_buf",
        "SGE → ctrl_buf · lkey = ctrl_mr",
        { title: "payload", sub: "DMA-read from the control area" },
      ]));
      g.push(text(320, 64, "max_inline_data ≥ 8?", { size: 13, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(curve(298, 150, 352, 150, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", bend: 0, label: "yes → inline", labelDy: -14 }));
      g.push(curve(298, 190, 352, 190, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", bend: 0, label: "no → staged", labelDy: -14 }));
      g.push(callout(60, 280, 300, { title: "Always signaled, unconditionally", sub: "the sender must see a completion for every control SEND" }));
      g.push(text(470, 280, "the HCA transmits the WQE's own bytes — nothing to fetch", { size: 9.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 330, g);
      return fig("The control SEND — inline by default, staged as fallback (bw.c:733–741)", svg,
        ["8 B ≤ max_inline_data = <b>1024</b> — inline in practice", "lkey = 0 is safe: the provider copies the data at post time",
         "the fallback keeps the control path alive on any stack"]);
    },

    "recv-verify"() {
      const g = [];
      g.push(node(24, 70, 190, 140, "THE CQ", [
        "data CQEs · done-send CQE",
        "then the ACK receive CQE",
      ]));
      g.push(node(238, 70, 180, 140, "bw_poll_until", [
        "want: BW_RECV_WRID",
        "pass: data | done-send",
        "deadline: 10 s",
      ]));
      g.push(node(442, 70, 174, 140, "t1 + verify", [
        "stamp CLOCK_MONOTONIC",
        "tag == BW_CTRL_TAG?",
        "seq == this size?",
      ]));
      g.push(arrow(214, 120, 238, 120, { cls: "dk-arrow-data", marker: "dk-a-data" }));
      g.push(arrow(418, 120, 442, 120, { cls: "dk-arrow-data", marker: "dk-a-data" }));
      g.push(el("circle", { cx: 529, cy: 254, r: 11, class: "dk-clock" }));
      g.push(el("line", { x1: 529, y1: 254, x2: 529, y2: 245, class: "dk-clock-hand" }));
      g.push(el("line", { x1: 529, y1: 254, x2: 534, y2: 254, class: "dk-clock-hand" }));
      g.push(text(529, 282, "t1 — the clock stops here", { size: 10, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(callout(24, 270, 320, { title: "A mismatch is an abort", sub: "wrong tag or wrong seq → 'mismatch' on stderr — never a corrupt number" }));

      const svg = canvas(640, 310, g);
      return fig("The ack wait, step by step (bw.c:817–838)", svg,
        ["the pass set makes one shared CQ work", "t1 is stamped BEFORE verification — arrival time is arrival time",
         "deadline: 10 s, then 'Timed out waiting for wr_id' (bw.c:775–809)"]);
    },

    "rt-cq"() {
      const g = [];
      const y = 160;
      g.push(el("line", { x1: 30, y1: y, x2: 610, y2: y, class: "dk-axis" }));
      [40, 116, 192].forEach((x) => {
        g.push(rect(x, y - 22, 66, 44, { cls: "dk-warmup" }));
        g.push(text(x + 33, y + 4, "data", { size: 10.5, weight: 600, anchor: "middle" }));
      });
      g.push(rect(268, y - 22, 84, 44, { cls: "dk-warmup" }));
      g.push(text(310, y + 4, "done-send", { size: 10.5, weight: 600, anchor: "middle" }));
      g.push(rect(366, y - 26, 84, 52, { cls: "dk-timed" }));
      g.push(text(408, y + 4, "ACK", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(spanBracket(40, 352, y - 52, "pass — consumed and ignored"));
      g.push(text(408, 96, "want — the wait stops here", { size: 10, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(el("circle", { cx: 408, cy: 240, r: 11, class: "dk-clock" }));
      g.push(el("line", { x1: 408, y1: 240, x2: 408, y2: 231, class: "dk-clock-hand" }));
      g.push(text(408, 268, "t1 — the clock stops at the ack", { size: 10.5, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(text(320, 120, "RC in-order: the ack CQE can only follow every data CQE", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 300, g);
      return fig("The client's CQ at the end of a size — in order (ADR-0003)", svg,
        ["data CQEs and the done-send CQE precede the ack CQE", "the pass set consumes them; the wait stops at the ack",
         "t1 is stamped the moment the ack receive completes"]);
    },

    "rt-timeline"() {
      const g = [];
      g.push(node(40, 46, 230, 58, "1 · CLIENT", ["posts the done — always signaled"]));
      g.push(node(370, 116, 240, 58, "2 · SERVER", ["done receive → verify → ack SEND"]));
      g.push(node(40, 186, 230, 58, "3 · CLIENT", ["t1 at the ack receive completion"]));
      g.push(node(370, 256, 240, 58, "4 · SERVER", ["consumes the ack-send completion"]));
      g.push(curve(270, 80, 320, 130, { cls: "dk-arrow-data", marker: "dk-a-data", bend: 6 }));
      g.push(curve(370, 150, 270, 218, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", bend: -6 }));
      g.push(curve(270, 218, 320, 268, { cls: "dk-arrow-ctrl", marker: "dk-a-ctrl", bend: 6 }));
      g.push(text(320, 40, "time", { size: 10, anchor: "middle", cls: "dk-text-muted" }));
      g.push(el("circle", { cx: 155, cy: 240, r: 11, class: "dk-clock" }));
      g.push(el("line", { x1: 155, y1: 240, x2: 155, y2: 231, class: "dk-clock-hand" }));
      g.push(text(155, 258, "t1", { size: 10, weight: 700, anchor: "middle", cls: "dk-text-accent" }));

      const svg = canvas(640, 330, g);
      return fig("The exchange, end to end — four beats per size (bw.c:1010–1049)", svg,
        ["<b>~10 µs</b> per round trip — inside every measured window", "the ack-send completion is consumed before the next done (audit fix)",
         "21 exchanges per run — the pool's 32 receives never refresh"]);
    },

    "envelope-chart"() {
      const box = document.createElement("div");
      box.className = "chart-box";
      window.EnvelopeChart(box);
      return fig("The measured envelope — means of 3 default sweeps, mlxstud03/04 (ADR-0007)", box,
        ["peak <b>42.59</b> Gbps (64 KB) · 1 MB at <b>40.57</b>", "three regimes: copy ≤ 1 KB · floor at 2 KB · host interface ≥ 4 KB",
         "the 1 MB dip: R × 80/84 = <b>40.54</b> predicted vs 40.57 measured"]);
    },

    "envelope-regimes"() {
      const g = [];
      const y0 = 62, y1 = 218, x0 = 40, x1 = 610;
      g.push(el("line", { x1: x0, y1: y1, x2: x1, y2: y1, class: "dk-axis" }));
      g.push(el("line", { x1: x0, y1: y0, x2: x0, y2: y1, class: "dk-axis" }));
      g.push(rect(x0 + 6, y0 + 16, 128, y1 - y0 - 16, { rx: 10, cls: "dk-zone-inline" }));
      g.push(rect(x0 + 140, y0 + 16, 62, y1 - y0 - 16, { rx: 10, cls: "dk-zone-ramp" }));
      g.push(rect(x0 + 208, y0 + 16, 362, y1 - y0 - 16, { rx: 10, cls: "dk-zone-flat" }));
      /* the envelope shape, schematically */
      const pts = [
        [x0 + 12, y1 - 6], [x0 + 34, y1 - 8], [x0 + 56, y1 - 10], [x0 + 78, y1 - 12],
        [x0 + 100, y1 - 16], [x0 + 122, y1 - 22], [x0 + 134, y1 - 60],
        [x0 + 150, y1 - 92], [x0 + 171, y1 - 96], [x0 + 210, y1 - 96],
        [x0 + 280, y1 - 98], [x0 + 380, y1 - 100], [x0 + 480, y1 - 104], [x0 + 560, y1 - 112],
      ];
      g.push(path(pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" "), { cls: "dk-arrow-data", marker: "" }));
      pts.forEach((p) => g.push(el("circle", { cx: p[0], cy: p[1], r: 3, class: "dk-dot-tiny" })));
      g.push(text(x0 + 70, y1 - 42, "inline copy", { size: 10.5, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(x0 + 70, y1 - 28, "~853 MB/s", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(x0 + 171, y1 - 56, "2 KB", { size: 10.5, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(x0 + 380, y1 - 80, "flat rate R — the host interface", { size: 10.5, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(x0 + 380, y1 - 64, "42.5 Gbps · dev pair 38.3", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(x0 + 540, y1 - 128, "1 MB dip", { size: 10, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(x0 + 540, y1 - 140, "R × 80/84", { size: 9.5, mono: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(320, 40, "≤ 1 KB", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(320, 246, "FDR (~54.5 Gbps net) is never the bound — the regimes are per-message costs, stacked by size", { size: 10, italic: true, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 270, g);
      return fig("Three regimes, three per-message costs (ADR-0004/0005/0007, research #12/#13)", svg,
        ["<b>≤ 1 KB</b>: the HCA's inline copy — byte-proportional, 5.84–6.55 Gbps", "<b>2 KB</b>: the ~495 ns DMA floor — 32.67 Gbps",
         "<b>4 KB–1 MB</b>: the flat host-interface rate R — 42.36–42.50, declining to 40.57"]);
    },

    "warmup-window"() {
      const g = [];
      const axisY = 150;
      g.push(el("line", { x1: 30, y1: axisY, x2: 610, y2: axisY, class: "dk-axis" }));
      /* 80 timed WRITEs as a long bar, 4 warmup WRITEs ahead */
      g.push(rect(40, axisY - 24, 430, 48, { cls: "dk-timed" }));
      g.push(text(255, axisY - 2, "80 timed WRITEs", { size: 11.5, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(rect(480, axisY - 18, 60, 36, { cls: "dk-warmup" }));
      g.push(text(510, axisY + 4, "4 warmup", { size: 10, weight: 600, anchor: "middle" }));
      g.push(flag(478, axisY + 26, "t0"));
      g.push(el("path", { d: `M478,${axisY + 44} L478,${axisY + 54} L540,${axisY + 54} L540,${axisY + 44}`, class: "dk-bracket", fill: "none" }));
      g.push(text(509, axisY + 74, "the warmup's ~0.79 ms of wire time is inside the window", { size: 9.5, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(rect(60, 40, 280, 56, { cls: "dk-subbox" }));
      g.push(text(70, 60, "reported = R × n / (n + 4)", { size: 12, mono: true, weight: 700, cls: "dk-text-strong" }));
      g.push(text(70, 78, "1 MB: R × 80/84 = 95.2% of R", { size: 10.5, cls: "dk-text-muted" }));
      g.push(rect(360, 40, 240, 56, { cls: "dk-subbox" }));
      g.push(text(370, 60, "predicts 40.54 · measured 40.57", { size: 11, mono: true, weight: 700, cls: "dk-text-accent" }));
      g.push(text(370, 78, "every DMA size 32 KB–1 MB, both pairs, within 0.05%", { size: 9.5, cls: "dk-text-muted" }));

      const svg = canvas(640, 250, g);
      return fig("The 1 MB dip — warmup-in-window arithmetic (bw.c:111–121, research #13)", svg,
        ["<b>80 + 4</b> WRs at 1 MB — the '80-WR stream' of ADR-0007", "the 256 KB/512 KB points share count 160 and measure the same rate",
         "warmup ≥ W would recover ~<b>1.76 Gbps</b> — the improvement ticket's trade (issue #18)"]);
    },

    "envelope-ramp"() {
      const g = [];
      const y0 = 60, y1 = 210, x0 = 50, x1 = 610;
      g.push(el("line", { x1: x0, y1: y1, x2: x1, y2: y1, class: "dk-axis" }));
      g.push(el("line", { x1: x0, y1: y0, x2: x0, y2: y1, class: "dk-axis" }));
      /* the floor: a horizontal line at ~500 ns */
      g.push(el("line", { x1: x0 + 10, y1: 120, x2: x1 - 10, y2: 120, class: "dk-arrow-ctrl" }));
      g.push(pill(x0 + 200, 108, "the DMA floor — ~490–500 ns / message", 0, { size: 10 }));
      /* wire time per size */
      const sizes = [
        { x: x0 + 40, t: "1 KB", v: 120, note: "inline — no floor" },
        { x: x0 + 160, t: "2 KB", v: 78, note: "wire 385 ns < floor" },
        { x: x0 + 300, t: "4 KB", v: 168, note: "wire 771 ns > floor" },
        { x: x0 + 460, t: "64 KB", v: 190, note: "wire 12 µs — floor invisible" },
      ];
      sizes.forEach((s) => {
        g.push(el("line", { x1: s.x, y1: 120, x2: s.x, y2: s.v, class: "dk-arrow-data" }));
        g.push(el("circle", { cx: s.x, cy: s.v, r: 4, class: "dk-dot-big" }));
        g.push(text(s.x, y1 + 18, s.t, { size: 10, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
        g.push(text(s.x, s.v - 12, s.note, { size: 9, anchor: "middle", cls: "dk-text-muted" }));
      });
      g.push(text(330, 30, "per-message time: wire time vs the floor — the bound is whichever is longer", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(callout(60, 244, 300, { title: "The crossover: between 2 and 4 KB, on both pairs", sub: "which is why exactly one sweep point (2 KB) is transitional" }));
      g.push(text(330, 130, "501.5 vs 488.6 ns — pair-invariant in absolute time, while R differs by 11%", { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 290, g);
      return fig("The 2 KB ramp — a per-message floor, not a batch cost (research #13)", svg,
        ["2 KB: 2048 B × 8 / ~501 ns = <b>32.67 Gbps</b>", "same count, window, and schedule as 4 KB (20480) — the difference is per-message",
         "from 4 KB the wire time hides the floor and R rules"]);
    },

    "pair-gap"() {
      const g = [];
      const x0 = 120, y0 = 70, x1 = 590;
      g.push(el("line", { x1: x0, y1: y0, x2: x1, y2: y0, class: "dk-axis" }));
      g.push(el("line", { x1: x0, y1: y0, x2: x0, y2: 250, class: "dk-axis" }));
      /* FDR capacity line */
      g.push(el("line", { x1: x0 + 10, y1: 90, x2: x1 - 10, y2: 90, class: "dk-ref" }));
      g.push(pill(x0 + 300, 80, "FDR capacity ~54.5 Gbps net", 0, { size: 9.5 }));
      g.push(text(40, 100, "Gbps", { size: 10, cls: "dk-text-muted" }));
      /* the two bars */
      g.push(rect(x0 + 60, 214, 60, 36, { cls: "dk-zone-ramp" }));
      g.push(text(x0 + 90, 250, "dev pair", { size: 10, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(x0 + 90, 205, "38.28", { size: 12, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(rect(x0 + 180, 192, 60, 58, { cls: "dk-zone-inline" }));
      g.push(text(x0 + 210, 250, "final pair", { size: 10, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(text(x0 + 210, 185, "42.57", { size: 12, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(callout(60, 60, 300, { title: "Same HCA family, two flat rates — the gap is the host", sub: "the effective DMA read bandwidth over PCIe, machine-dependent" }));
      g.push(text(330, 40, "the inline plateau and the 2 KB floor are identical on both pairs —", { size: 10, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(330, 56, "only the component crossing the host interface differs (research #13)", { size: 10, italic: true, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 280, g);
      return fig("The pair gap — the host interface, not the link (research #13)", svg,
        ["dev <b>38.28</b> vs final <b>42.57</b> — 11% apart, both far below FDR", "Gen2 x8 ruled out: 38.2 > its 32 Gbps ceiling — both most plausibly Gen3 x8",
         "the exact cause (slot, CPU, BIOS, firmware) is unrecorded — on-node probes only"]);
    },

    "anomaly-map"() {
      const g = [];
      const rows = [
        { y: 30, t: "≤ 1 KB plateau — 6.55 Gbps", m: "the HCA's inline payload copy at ~853 MB/s", s: "attributed · killer experiment pending", k: "warn" },
        { y: 96, t: "2 KB ramp — 32.67 Gbps", m: "the ~495 ns per-message DMA floor", s: "explained to 0.1%", k: "ok" },
        { y: 162, t: "1 MB dip — 40.57 Gbps", m: "warmup-in-window arithmetic: R × 80/84", s: "explained to 0.1%", k: "ok" },
        { y: 228, t: "~6.1M msg/s ceiling", m: "completion-slaved per-message rate, flat 163 ns", s: "two candidates · on-node clock test", k: "warn" },
        { y: 294, t: "pair gap — 38.3 vs 42.6 Gbps", m: "the host interface, not the wire", s: "attributed · needs lspci on the nodes", k: "warn" },
      ];
      rows.forEach((r) => {
        g.push(rect(40, r.y, 420, 46, { cls: r.k === "ok" ? "dk-timed" : "dk-warmup" }));
        g.push(text(52, r.y + 18, r.t, { size: 11, weight: 700, cls: "dk-text-strong" }));
        g.push(text(52, r.y + 34, r.m, { size: 10, cls: "dk-text-muted" }));
        g.push(pill(510, r.y + 23, r.s, 0, { size: 9.5 }));
      });
      g.push(text(320, 366, "three explained to 0.1%, two attributed by elimination — each with a crisp one-line viva story", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));

      const svg = canvas(640, 380, g);
      return fig("Five anomalies, five stories — nothing on the envelope is unexplained (research #11/#12/#13)", svg,
        ["the numbers are arithmetic and attribution, not magic", "each story has its chapter: wire / completions / this stop",
         "the confirming experiments are the user's on-node checklists"]);
    },

    "adr-map"() {
      const g = [];
      const rows = [
        { n: "0001", t: "Control on the data QP", r: "rejected: the done over TCP" },
        { n: "0002", t: "Refill · batch · declare-then-read-back", r: "rejected: wait-for-all · buffer cycling · the inline query" },
        { n: "0003", t: "The clock runs to the ack", r: "rejected: stop at the last post · two clocks" },
        { n: "0004", t: "The T4 baseline", r: "decision: don't chase the ≤ 1 KB plateau" },
        { n: "0005", t: "The T5 A/B", r: "decision: pipeline pays, never regresses" },
        { n: "0006", t: "Dev-pair campaign", r: "decision: W = 256 / K = 64 stand" },
        { n: "0007", t: "Final campaign", r: "decision: defaults unchanged, envelope locked" },
      ];
      rows.forEach((r, i) => {
        const y = 32 + i * 44;
        g.push(rect(40, y, 560, 36, { cls: "dk-subbox" }));
        g.push(pill(82, y + 18, "ADR-" + r.n, 0, { size: 9, mono: true }));
        g.push(text(130, y + 15, r.t, { size: 11, weight: 700, cls: "dk-text-strong" }));
        g.push(text(130, y + 29, r.r, { size: 9.5, italic: true, cls: "dk-text-muted" }));
      });
      g.push(text(320, 356, "the pattern: measure, don't guess — and name what you rejected", { size: 11, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 380, g);
      return fig("The seven decisions and the alternatives they rejected", svg,
        ["three protocol/pipeline decisions, four measurement records", "each rejection has a measured or structural reason",
         "this map is the viva's table of contents"]);
    },

    "adr-0001"() {
      const g = [];
      g.push(node(28, 60, 260, 130, "CHOSEN — the data QP carries it all", [
        "RDMA WRITEs, in order",
        "the done SEND after each timed batch",
        "the ack SEND back",
      ], { accent: true }));
      g.push(node(360, 60, 252, 130, "REJECTED — the done over TCP", [
        "a TCP message is not ordered against",
        "the WRITEs — the ack could arrive",
        "while the last ones are still on the wire",
      ]));
      g.push(text(320, 40, "the rejected alternative of ADR-0001", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(el("line", { x1: 288, y1: 125, x2: 360, y2: 125, class: "dk-arrow-ctrl" }));
      g.push(callout(60, 218, 520, { title: "Why the clock would lie", sub: "ack arrival implies every prior WRITE landed — only if the done rode the same in-order QP; the assignment mandates the ack as a SEND" }));

      const svg = canvas(640, 268, g);
      return fig("ADR-0001 — control rides the data QP; TCP never carries a control byte", svg,
        ["consequence: the 32-deep receive pool, posted once, never refreshed", "both messages verified: fixed tag + sequence counter",
         "a second control QP would be just as unordered — one QP is the minimum true barrier"]);
    },

    "adr-0002"() {
      const g = [];
      g.push(rect(40, 60, 260, 150, { cls: "dk-warmup" }));
      g.push(text(170, 82, "REJECTED — wait-for-all", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(170, 104, "post a window …", { size: 10, anchor: "middle" }));
      g.push(text(170, 122, "wait for ALL of it …", { size: 10, anchor: "middle" }));
      g.push(text(170, 140, "… then repost", { size: 10, anchor: "middle" }));
      g.push(el("line", { x1: 70, y1: 160, x2: 270, y2: 160, class: "dk-axis" }));
      g.push(rect(70, 156, 200, 8, { cls: "dk-slot-filled" }));
      g.push(text(170, 186, "the SQ drains to zero for ~an RTT", { size: 9.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(170, 200, "every window — the NIC idles by design", { size: 9.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(rect(340, 60, 260, 150, { cls: "dk-timed" }));
      g.push(text(470, 82, "CHOSEN — refill-never-empty", { size: 11, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
      g.push(text(470, 104, "reclaim the CQEs that are ready", { size: 10, anchor: "middle" }));
      g.push(text(470, 122, "repost immediately", { size: 10, anchor: "middle" }));
      g.push(text(470, 140, "the SQ never empties", { size: 10, anchor: "middle" }));
      g.push(el("line", { x1: 370, y1: 160, x2: 570, y2: 160, class: "dk-axis" }));
      g.push(rect(370, 156, 200, 8, { cls: "dk-slot-filled" }));
      g.push(text(470, 186, "completions reclaimed in K-sized steps", { size: 9.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(text(470, 200, "RC in-order keeps the accounting exact", { size: 9.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(callout(60, 230, 520, { title: "The cost of the rejected pattern", sub: "every window re-pays the ramp-up dip; the pipeline's win at ≤ 64 B (+37–67%) comes from K-batched posts and the refill together" }));

      const svg = canvas(640, 280, g);
      return fig("ADR-0002 — the refill discipline vs the template's wait-for-all (bw_template.c:542–588)", svg,
        ["the template empties the queue for ~an RTT every window", "the refill reclaims only what is ready and reposts",
         "one 1 MB buffer, registered once, never modified — no buffer-reuse hazard at full window depth"]);
    },

    "adr-inline"() {
      const g = [];
      const y0 = 60;
      [1024, 960, 896, 832, 768].forEach((s, i) => {
        g.push(rect(60, y0 + i * 26, 200, 20, { cls: i === 0 ? "dk-timed" : "dk-warmup" }));
        g.push(text(80, y0 + i * 26 + 15, "declare " + s, { size: 10, mono: true, weight: 600, cls: i === 0 ? "dk-text-accent" : "dk-text-strong" }));
      });
      g.push(text(60, y0 + 5 * 26 + 14, "… 64-byte steps down to 0, until creation succeeds", { size: 9.5, italic: true, cls: "dk-text-muted" }));
      g.push(text(330, 84, "the QP mlx4 accepts", { size: 10.5, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      g.push(curve(260, 70, 360, 120, { cls: "dk-arrow-data", marker: "dk-a-data", bend: 0 }));
      g.push(node(360, 128, 250, 92, "READ BACK — the runtime value", [
        "ibv_query_qp(IBV_QP_CAP)",
        "max_inline_data = what was created",
        "the data path uses THIS (bw.c:906)",
      ], { accent: true }));
      g.push(callout(60, 232, 540, { title: "Rejected: ibv_query_device", sub: "its max_inline_data field is gone on modern rdma-core — not portable across the course nodes' old OFED and a WSL compile gate" }));
      g.push(text(320, 40, "'we asked the hardware, not a header'", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 282, g);
      return fig("ADR-0002 — inline, declared then read back (bw.c:614–661)", svg,
        ["mlx4 rejects QP creation when the declaration exceeds what its WQEs carry", "the stepping loop: 1024 → 0 in 64-byte steps, 0 is the floor",
         "the sq_depth read-back paces the refill the same way (memory-region stop)"]);
    },

    "adr-0003"() {
      const g = [];
      const rows = [
        { y: 50, tag: "✗ rejected", t: "stop at the last post", d: "completion means SENT, not received — the local enqueue rate, the assignment's warning", on: false },
        { y: 130, tag: "✓ chosen", t: "first timed post → ack", d: "ex1-identical window: 'the clock runs until the ACK arrives' — byte-identical output", on: true },
        { y: 210, tag: "✗ rejected", t: "two clocks, one per side", d: "a different quantity than ex1's, plus synchronization and a seam to decide", on: false },
      ];
      rows.forEach((r) => {
        g.push(rect(40, r.y, 560, 56, { cls: r.on ? "dk-timed" : "dk-warmup" }));
        g.push(text(56, r.y + 19, r.tag, { size: 9.5, weight: 700, cls: r.on ? "dk-text-accent" : "dk-text-muted" }));
        g.push(text(56, r.y + 38, r.t, { size: 11, weight: 700, cls: "dk-text-strong" }));
        g.push(text(330, r.y + 26, r.d, { size: 9.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      });
      g.push(text(320, 296, "the ack is inside the measured window — the server's ack speed is on the client's clock by design", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 316, g);
      return fig("ADR-0003 — the clock window, and the two rejected alternatives", svg,
        ["~10 µs round trip inside every measurement — negligible above 1 B, identical in shape", "client-side completion ≠ delivery — the audit's rule of thumb",
         "same 21 lines as ex1: size, throughput, unit — nothing else"]);
    },

    "adr-0005"() {
      const g = [];
      const x0 = 110, base = 200;
      g.push(el("line", { x1: x0, y1: base, x2: 620, y2: base, class: "dk-axis" }));
      g.push(el("line", { x1: x0, y1: 50, x2: x0, y2: base, class: "dk-axis" }));
      g.push(text(40, 56, "Mbps", { size: 10, cls: "dk-text-muted" }));
      const pts = [
        { t: "1 B", t4: 36.2, t5: 49.6 },
        { t: "8 B", t4: 238.8, t5: 396.3 },
        { t: "32 B", t4: 948.1, t5: 1580 },
        { t: "64 B", t4: 1850, t5: 2650 },
      ];
      const h = (v) => (v / 2700) * 150;
      pts.forEach((p, i) => {
        const x = x0 + 50 + i * 120;
        g.push(rect(x, base - h(p.t4), 42, h(p.t4), { cls: "dk-warmup" }));
        g.push(rect(x + 52, base - h(p.t5), 42, h(p.t5), { cls: "dk-timed" }));
        g.push(text(x + 26, base + 18, p.t, { size: 9.5, weight: 700, anchor: "middle", cls: "dk-text-strong" }));
      });
      g.push(rect(x0 + 50 + 480, 0, 0, 0, { cls: "dk-warmup" }));
      g.push(rect(150, 236, 42, 10, { cls: "dk-warmup" }));
      g.push(text(176, 250, "T4 naive", { size: 9.5, anchor: "middle" }));
      g.push(rect(210, 236, 42, 10, { cls: "dk-timed" }));
      g.push(text(236, 250, "T5 pipeline", { size: 9.5, anchor: "middle" }));
      g.push(callout(60, 40, 300, { title: "+37–67% at ≤ 64 B", sub: "K-batched posts removed the per-WR doorbell" }));
      g.push(text(400, 56, "128 B – 1 MB: identical to T4 to three digits", { size: 10, italic: true, cls: "dk-text-muted" }));

      const svg = canvas(640, 270, g);
      return fig("ADR-0005 — the A/B: pipeline vs naive, point by point, same pair", svg,
        ["1 B: 36.2 → 49.6 Mbps · 64 B: 1.85 → 2.65 Gbps", "no size regressed — 'the pipeline pays, never regresses' is met at every point",
         "the DMA regime unchanged ⇒ the 38 Gbps ceiling is the host interface, not the signaling"]);
    },

    "adr-0007"() {
      const g = [];
      g.push(node(40, 50, 560, 180, "THE A/B — six anchor sizes, four parameter sets", [
        "1 B:   0.04954  vs  0.04956 / 0.049505 / 0.04957   (within 0.07%)",
        "32 B:  1.56     vs  1.56 / 1.56 / 1.56",
        "256 B: 5.84     vs  5.84 / 5.84 / 5.84",
        "1 KB:  6.55     vs  6.55 / 6.55 / 6.55",
        "64 KB: 38.03    vs  38.03 / 38.035 / 38.035",
        "1 MB:  40.567   vs  40.59 / 40.65 / 40.53",
      ]));
      g.push(callout(60, 252, 520, { title: "No alternative beats the defaults by ≥ 1% anywhere", sub: "W = 256 / K = 64 stand on both pairs — the hardware agrees with the assumed optimum (ADR-0006/0007)" }));

      const svg = canvas(640, 302, g);
      return fig("The T6 campaign — the numbers that locked the defaults", svg,
        ["<b>26/26</b> client-side, <b>11/11</b> server-side checks, no QP errors", "CV ≤ 0.40% everywhere — 0.00% at the large sizes on the dev pair",
         "K = 128 halves the CQEs and changes nothing — the ceiling is flat, not CQE-bound"]);
    },

    "audit-verdicts"() {
      const g = [];
      const rows = [
        { n: "1", t: "Counts-table fit", v: "correct", d: "optimizable: no static assert" },
        { n: "2", t: "Sequence counter", v: "correct" },
        { n: "3", t: "Control receive pool (32 vs 21)", v: "correct" },
        { n: "4", t: "PSN wrap", v: "correct" },
        { n: "5", t: "Inline-size stepping", v: "correct", d: "cosmetic errno nit" },
        { n: "6", t: "Refill / poll logic", v: "correct", d: "1 comment wrong · 1 unreachable mode" },
        { n: "7", t: "Error paths", v: "correct", d: "parse-validation nits" },
        { n: "8", t: "Client→server symlink", v: "correct" },
        { n: "9", t: "Timer resolution", v: "correct" },
        { n: "10", t: "Window / done-fits invariant", v: "correct", d: "proved, clamped + un-clamped" },
        { n: "11", t: "Measurement methodology", v: "optimizable", d: "warmup < W, inherited, not a bug" },
        { n: "12", t: "CQ depth sizing", v: "correct", d: "hardening nit" },
      ];
      rows.forEach((r, i) => {
        const y = 34 + i * 25;
        g.push(text(48, y + 13, r.n, { size: 9.5, mono: true, cls: "dk-text-muted" }));
        g.push(text(66, y + 13, r.t, { size: 10.5, weight: 600, cls: "dk-text-strong" }));
        g.push(pill(396, y + 9, r.v, 0, { size: 9, mono: true }));
        g.push(text(432, y + 13, r.d || "", { size: 9, italic: true, cls: "dk-text-muted" }));
      });
      g.push(text(320, 350, "headline: no correctness bugs — the assignment and all 7 ADRs satisfied", { size: 11, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 700 }));

      const svg = canvas(640, 372, g);
      return fig("The verdicts — twelve components, one headline (audit-bw-c.md)", svg,
        ["reviewed on two axes: Spec (assignment + ADRs) and Standards (the repo's own discipline)", "the one inaccurate comment and the four hardenings have their own frames",
         "findings: docs/research/audit-bw-c.md"]);
    },

    "audit-comment"() {
      const g = [];
      g.push(node(40, 50, 270, 130, "WARMUP RESIDUAL — 4–32 WRs", [
        "no CQEs of its own (warmup < K)",
        "covered by the FIRST multiple-of-k",
        "CQE — the refill consumes it",
      ], { accent: true }));
      g.push(node(350, 50, 250, 130, "FINAL REMAINDER — the last list", [
        "the stream's last WR, signaled",
        "no list follows → the refill can't run",
        "covered by the ACK WAIT, in order",
      ]));
      g.push(text(320, 40, "two leftovers, two covers — the comment credits both to the ack wait", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-muted" }));
      g.push(callout(60, 204, 520, { title: "The comment's error (bw.c:846–849)", sub: "only the final remainder is guaranteed ack-wait-consumed; the warmup residual is absorbed by the refill's first CQE — the code is right either way (audit finding 6, note B)" }));

      const svg = canvas(640, 254, g);
      return fig("The one wrong comment — who actually covers the leftovers", svg,
        ["warmups are 4–32 WRs < K = 64 — they generate zero CQEs of their own", "positions 1..64 with warmup 16: the first multiple-of-k CQE covers them exactly",
         "the accounting never depended on the wrong reading — exact in both readings"]);
    },

    "audit-nits"() {
      const g = [];
      const rows = [
        { y: 40, t: "validate k < sq_depth after the read-back", d: "kills the theoretical refill spin — unreachable: T6 proves max_qp_wr ≥ 1536 on both pairs" },
        { y: 108, t: "_Static_assert on the counts tables", d: "pins the 21-entry invariant — an under-long table compiles silently and reads zeros" },
        { y: 176, t: "-n parse-error check", d: "-n -5 wraps to ~2⁶⁴−4 — a run that effectively never ends" },
        { y: 244, t: "cosmetic: strerror(errno) after ibv_create_qp", d: "ibv_create_qp does not reliably set errno — the message may say \"Success\"" },
      ];
      rows.forEach((r) => {
        g.push(rect(40, r.y, 560, 52, { cls: "dk-subbox" }));
        g.push(text(56, r.y + 19, r.t, { size: 11, weight: 700, cls: "dk-text-strong" }));
        g.push(text(56, r.y + 37, r.d, { size: 10, cls: "dk-text-muted" }));
      });
      g.push(text(320, 326, "none blocks submission — each is a robustness fix, not a bug", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 344, g);
      return fig("The four hardenings (audit findings 5–7, 10–11)", svg,
        ["the spin needs sq_depth ≤ k — impossible on course hardware", "the warmup ≥ W lead is the improvement ticket's trade, not a hardening",
         "whether to take these and re-measure: issue #18's decision"]);
    },

    "audit-invariant"() {
      const g = [];
      g.push(node(40, 50, 270, 160, "THE CHAIN (un-clamped)", [
        "k ≤ window && k ≤ QP_SLACK — in main",
        "sq_depth = window + QP_SLACK",
        "refill exits: out < W && out + k < sq_depth",
        "after a K-list: out ≤ sq_depth − 1",
        "⇒ the done SEND always fits",
      ], { accent: true }));
      g.push(node(340, 50, 270, 160, "THE CLAMP CASE (max_qp_wr)", [
        "sq_depth < W + K",
        "condition 2 paces at sq_depth − k",
        "out ≤ sq_depth − k − 1 before each post",
        "⇒ out ≤ sq_depth − 1 after — done fits",
        "arbitrary -r values stay safe",
      ]));
      g.push(text(320, 240, "the audit PROVED it, both clamped and un-clamped (finding 10)", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 268, g);
      return fig("The window / done-fits invariant — proved, not assumed (bw.c:871–872, 1215–1218)", svg,
        ["CQ depth = sq_depth + 32 — the true worst case, can never overflow", "the refill's condition 2 is what makes any -r value safe",
         "the proof is why 'k ≤ window && k ≤ QP_SLACK' is enforced before any device work"]);
    },

    "audit-evidence"() {
      const g = [];
      const chips = [
        { x: 40, y: 60, v: "26/26", t: "client-side checks, dev pair" },
        { x: 232, y: 60, v: "11/11", t: "server-side checks, both pairs" },
        { x: 424, y: 60, v: "18", t: "campaign sweeps, no QP errors" },
        { x: 40, y: 148, v: "≥ 1536", t: "max_qp_wr proven on both pairs" },
        { x: 232, y: 148, v: "≤ 0.40%", t: "CV at every size (0.00% dev large)" },
        { x: 424, y: 148, v: "×2.0", t: "doubling with size, every sweep" },
      ];
      chips.forEach((c) => {
        g.push(rect(c.x, c.y, 176, 62, { cls: "dk-subbox" }));
        g.push(text(c.x + 88, c.y + 24, c.v, { size: 15, mono: true, weight: 700, anchor: "middle", cls: "dk-text-accent" }));
        g.push(text(c.x + 88, c.y + 44, c.t, { size: 9.5, anchor: "middle", cls: "dk-text-muted" }));
      });
      g.push(text(320, 246, "the risky edges are unreachable and the nuance is invisible — no new experiment needed", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 270, g);
      return fig("What the existing records already prove (ADR-0006/0007)", svg,
        ["the T6 sets requested max_send_wr 1536/1280/1536 — all created and passed", "warmup-shape effects are below the noise: doubling-with-size holds in every sweep",
         "18 sweeps across both pairs: no QP errors, no protocol errors at any W×K"]);
    },

    "harness-dispatch"() {
      const g = [];
      g.push(node(60, 70, 250, 120, "./server  (no hostname)", [
        "role: SERVER — waits, verifies, acks",
        "is_server = 1 → REMOTE_WRITE on the MR",
        "runs bw_server_ctrl_exchange",
      ]));
      g.push(node(330, 70, 250, 120, "./client <host>", [
        "role: CLIENT — drives the sweep",
        "is_server = 0 → local-write only",
        "runs bw_client_bench",
      ]));
      g.push(pill(320, 140, "same binary — argc decides", 0));
      g.push(text(320, 44, "dispatch by argc, not argv[0] — the symlink is robust by construction", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(callout(80, 220, 480, { title: "Makefile: ln -sf server client", sub: "./client with no arguments acts as the server exactly as the assignment's dispatch intends (audit finding 8)" }));

      const svg = canvas(640, 270, g);
      return fig("One binary, two roles (bw.c:1205–1210, 1246)", svg,
        ["the server waits; the client connects and drives", "both run the same init — differing in registration rights and the final bench vs exchange",
         "a hostname argument is the ONLY difference in the whole program"]);
    },

    "harness-cli"() {
      const g = [];
      g.push(node(40, 50, 560, 176, "usage — the seven flags", [
        "-p · --port — handshake port (default 18515)",
        "-d · --ib-dev — IB device by name",
        "-i · --ib-port — port of the device (default 1)",
        "-r · --window — W, the window depth",
        "-k · --signal-interval — K, max min(window, 1024)",
        "-n · --count — override every timed count",
        "-g · --gid-idx — GID index, else LID-based",
      ]));
      g.push(callout(60, 246, 520, { title: "The research checklists run through -n", sub: "-n 640 at 1 MB, -n 80 at 64 KB (the warmup model), -n 2560 at 2 KB (the floor model) — the count override is a measurement tool, not just a smoke test" }));

      const svg = canvas(640, 296, g);
      return fig("The seven flags (bw.c:1094–1112)", svg,
        ["-r/-k are the measured tunables of ADR-0002 — the A/B used them", "-n makes the protocol testable in seconds instead of minutes",
         "-g is the course fabric's rare path: LID-based by default (handshake stop)"]);
    },

    "harness-bounds"() {
      const g = [];
      g.push(node(40, 60, 180, 110, "k ≤ window", [
        "a K-list never overshoots",
        "the window itself",
      ], { accent: true }));
      g.push(node(240, 60, 180, 110, "k ≤ QP_SLACK", [
        "the slack absorbs the last",
        "list AND the done SEND",
      ], { accent: true }));
      g.push(node(440, 60, 170, 110, "sq_depth clamp", [
        "max_send_wr ≤ max_qp_wr",
        "the device's word",
      ]));
      g.push(arrow(220, 100, 240, 100, { cls: "dk-arrow-ptr", marker: "dk-a-ptr" }));
      g.push(arrow(420, 100, 440, 100, { cls: "dk-arrow-ptr", marker: "dk-a-ptr" }));
      g.push(callout(60, 198, 520, { title: "Together: the done-fits invariant", sub: "after the last K-list, outstanding ≤ sq_depth − 1 — the done SEND always finds a free SQ slot, for ANY -r value (audit finding 10)" }));
      g.push(text(320, 44, "main refuses to start on a violation — usage and exit 1, before any device work", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 248, g);
      return fig("The bounds that keep the pipeline honest (bw.c:1215–1218)", svg,
        ["a deadlock would be silent — the refusal is loud, up front", "the clamp is what makes the refill's second condition meaningful (memory-region stop)",
         "k ≤ QP_SLACK also bounds the refill's reclaim: one CQE per K, never beyond the slack"]);
    },

    "harness-device"() {
      const g = [];
      g.push(node(40, 80, 270, 120, "DEFAULT — first device", [
        "ib_dev = *dev_list",
        "course nodes: exactly one HCA (mlx4_0)",
        "no device → clear error, no crash",
      ], { accent: true }));
      g.push(node(340, 80, 270, 120, "WITH -d — exact name walk", [
        "strcmp over the list",
        "a miss → 'IB device %s not found'",
        "never a silent fallback",
      ]));
      g.push(text(320, 54, "one fetch, one pass — then bw_init_ctx owns the choice", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));
      g.push(callout(60, 228, 520, { title: "Everything downstream flows from this", sub: "QP, CQ, registrations, port attributes (LID, active MTU) — the handshake and the path MTU inherit the choice" }));

      const svg = canvas(640, 278, g);
      return fig("Picking the device (bw.c:1222–1244)", svg,
        ["the port comes next: ibv_query_port for LID and active MTU (bw.c:1257)", "MTU feeds the QP's path_mtu — large messages use the largest packets the link allows",
         "-d matters only on multi-HCA hosts — the course pairs have one"]);
    },

    "harness-teardown"() {
      const g = [];
      const steps = [
        "destroy QP — nothing in flight (the last ack wait was the barrier)",
        "destroy CQ — the QP no longer references it",
        "deregister the control MR",
        "deregister the 1 MB buffer MR",
        "deallocate the PD",
        "close the device context",
        "free: ctrl_buf · buf · ctx",
      ];
      steps.forEach((s, i) => {
        const y = 36 + i * 34;
        g.push(rect(60, y, 500, 26, { cls: i === 0 ? "dk-timed" : "dk-subbox" }));
        g.push(text(76, y + 18, s, { size: 10.5, weight: i === 0 ? 700 : 500, cls: i === 0 ? "dk-text-accent" : "dk-text-strong" }));
      });
      g.push(text(320, 286, "creation in reverse, each step checked — every completion consumed by the last ack wait", { size: 10.5, italic: true, anchor: "middle", cls: "dk-text-accent", weight: 600 }));

      const svg = canvas(640, 310, g);
      return fig("Teardown — the ordered exit (bw.c:1055–1092)", svg,
        ["each level references the one above it — reverse order is not ceremony", "a failure anywhere returns 1; the caller exits with it",
         "the run ends the way it lived: ordered, checked, every completion accounted"]);
    },
  };
})();
