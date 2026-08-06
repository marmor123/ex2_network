/*
 * Envelope chart — the measured throughput envelope (ADR-0007), built to the
 * dataviz skill's method: single series (no legend — the title names it),
 * 2px line, >=8px markers with a 2px surface ring, hairline grid, crosshair +
 * tooltip with wide hit targets, selective direct labels, table-view twin,
 * selected light and dark tokens.
 *
 * Usage: EnvelopeChart(containerEl) — reads APP.envelope for data, renders
 * inline SVG + an HTML tooltip + a <details> table twin.
 */
(function () {
  const SERIES = window.APP.envelope.series;
  const FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

  function sizeLabel(bytes) {
    if (bytes >= 1024) return (bytes / 1024) + " KB";
    return bytes + " B";
  }

  /* Plot geometry */
  const W = 720, H = 320;
  const PAD = { l: 44, r: 16, t: 14, b: 30 };
  const xOf = (i) => PAD.l + (i / (SERIES.length - 1)) * (W - PAD.l - PAD.r);
  const yOf = (g) => H - PAD.b - (g / 45) * (H - PAD.t - PAD.b);

  function svgEl(name, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  window.EnvelopeChart = function (container) {
    container.classList.add("viz-root");
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "envelope-svg" });
    container.appendChild(svg);

    /* Gridlines: hairline, solid, one step off the surface. */
    for (const g of [10, 20, 30, 40]) {
      svg.appendChild(svgEl("line", {
        x1: PAD.l, x2: W - PAD.r, y1: yOf(g), y2: yOf(g), class: "env-grid",
      }));
    }

    /* X axis: log2 positions. Major ticks every 4 sizes, minor in between. */
    [0, 4, 8, 12, 16, 20].forEach((i) => {
      const d = SERIES[i].bytes;
      const t = svgEl("text", { x: xOf(i), y: H - 10, class: "env-xtick" });
      t.textContent = sizeLabel(d);
      svg.appendChild(t);
    });
    [2, 6, 10, 14, 18].forEach((i) => {
      svg.appendChild(svgEl("line", {
        x1: xOf(i), x2: xOf(i), y1: H - PAD.b + 4, y2: H - PAD.b + 8, class: "env-minortick",
      }));
    });

    /* Y axis: 0/10/20/30/40, tabular digits so ticks align. */
    [0, 10, 20, 30, 40].forEach((g) => {
      const t = svgEl("text", { x: PAD.l - 8, y: yOf(g) + 4, class: "env-ytick", "text-anchor": "end" });
      t.textContent = g;
      svg.appendChild(t);
    });
    const unit = svgEl("text", { x: PAD.l - 8, y: 6, class: "env-ytick", "text-anchor": "end" });
    unit.textContent = "Gbps";
    svg.appendChild(unit);

    /* Reference boundary: max_inline_data at 1 KB — a design line, not data. */
    svg.appendChild(svgEl("line", {
      x1: xOf(10), x2: xOf(10), y1: PAD.t, y2: H - PAD.b, class: "env-ref",
    }));
    const ref = svgEl("text", { x: xOf(10) + 5, y: PAD.t + 10, class: "env-ref-label" });
    ref.textContent = "max_inline_data";
    svg.appendChild(ref);

    /* The line: 2px, round joins, series-1. */
    const path = svgEl("path", {
      d: SERIES.map((d, i) => (i === 0 ? "M" : "L") + xOf(i) + " " + yOf(d.gbps)).join(" "),
      class: "env-line",
    });
    svg.appendChild(path);

    /* Markers: >=8px, filled series-1, 2px surface ring. */
    SERIES.forEach((d, i) => {
      svg.appendChild(svgEl("circle", { cx: xOf(i), cy: yOf(d.gbps), r: 4, class: "env-dot" }));
    });

    /* Selective direct labels: the plateau, the flat top, the dip. */
    [
      { i: 10, text: "6.55 — inline copy plateau", dy: -12 },
      { i: 16, text: "42.30 — the flat top", dy: -12 },
      { i: 20, text: "40.57 — the dip", dy: 16 },
    ].forEach(({ i, text, dy }) => {
      const t = svgEl("text", { x: xOf(i), y: yOf(SERIES[i].gbps) + dy, class: "env-dlabel", "text-anchor": "middle" });
      t.textContent = text;
      svg.appendChild(t);
    });

    /* Crosshair + tooltip. Hit target: vertical slabs between midpoints,
     * >=24px wide, so the pointer only has to be closest, not dead-center. */
    const cross = svgEl("line", { y1: PAD.t, y2: H - PAD.b, class: "env-cross" });
    svg.appendChild(cross);

    const tip = document.createElement("div");
    tip.className = "env-tip";
    tip.hidden = true;
    container.appendChild(tip);

    function showPoint(i) {
      const d = SERIES[i];
      cross.setAttribute("x1", xOf(i));
      cross.setAttribute("x2", xOf(i));
      cross.classList.add("on");

      tip.textContent = ""; /* built via textContent, never innerHTML */
      const v = document.createElement("div");
      v.className = "env-tip-value";
      v.textContent = FMT.format(d.gbps) + " Gbps";
      const l = document.createElement("div");
      l.className = "env-tip-label";
      l.textContent = sizeLabel(d.bytes) + " · " + FMT.format(d.gbps * 1e9 / (8 * d.bytes)) + " messages/s";
      tip.appendChild(v);
      tip.appendChild(l);
      tip.hidden = false;

      const rect = container.getBoundingClientRect();
      const px = xOf(i) / W * rect.width;
      tip.style.left = Math.max(0, Math.min(rect.width - tip.offsetWidth, px + 12)) + "px";
      tip.style.top = (yOf(d.gbps) / H * rect.height - tip.offsetHeight - 10) + "px";
    }
    function hidePoint() {
      cross.classList.remove("on");
      tip.hidden = true;
    }

    const slabs = SERIES.map((d, i) => {
      const x0 = i === 0 ? 0 : (xOf(i - 1) + xOf(i)) / 2;
      const x1 = i === SERIES.length - 1 ? W : (xOf(i) + xOf(i + 1)) / 2;
      const r = svgEl("rect", { x: x0, y: 0, width: x1 - x0, height: H, class: "env-hit" });
      r.addEventListener("pointerenter", () => showPoint(i));
      r.addEventListener("pointerleave", hidePoint);
      svg.appendChild(r);
      return r;
    });

    svg.addEventListener("pointerleave", hidePoint);

    /* Table twin — every value reachable without hovering (WCAG-clean). */
    const det = document.createElement("details");
    det.className = "env-table";
    const sum = document.createElement("summary");
    sum.textContent = "All 21 values";
    det.appendChild(sum);
    const table = document.createElement("table");
    const head = document.createElement("tr");
    ["Message size", "Gbps"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      head.appendChild(th);
    });
    table.appendChild(head);
    SERIES.forEach((d) => {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      td1.textContent = sizeLabel(d.bytes);
      const td2 = document.createElement("td");
      td2.textContent = FMT.format(d.gbps);
      tr.appendChild(td1);
      tr.appendChild(td2);
      table.appendChild(tr);
    });
    det.appendChild(table);
    container.appendChild(det);

    /* Keep the tooltip onscreen on resize */
    window.addEventListener("resize", hidePoint);
  };
})();
