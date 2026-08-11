/* Structural validation for the teaching app (prototype/app-shell).
 * Loads content.js + diagrams.js with minimal DOM stubs and checks:
 *   - spine 'built' stops exist, have frames, unique frame ids, term table, etc.
 *   - every frame diagram resolves in DIAGRAMS
 *   - code annotation keys stay within the lines array
 *   - ticket #14 coverage checklist items are anchored somewhere
 * Run: node .claude/tmp/validate-app.js
 */
const fs = require("fs");
const path = require("path");

/* ---------- minimal DOM stubs ---------- */
function fakeEl(tag) {
  return {
    tagName: tag,
    attrs: {},
    kids: [],
    className: "",
    textContent: "",
    innerHTML: "",
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(c) { this.kids.push(c); return c; },
    addEventListener() {},
  };
}
global.window = global;
global.Node = function Node() {};
global.document = {
  createElement: fakeEl,
  createElementNS: (ns, tag) => fakeEl(tag),
  createTextNode: (s) => ({ text: String(s) }),
};
global.Intl = Intl;

const dir = path.join(__dirname, "..", "..", "prototype", "app-shell", "js");
require(path.join(dir, "content.js"));
require(path.join(dir, "diagrams.js"));

const A = global.APP;
const D = global.DIAGRAMS;
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };

/* ---------- spine / stops ---------- */
const built = A.spine.filter((s) => s.state === "built");
ok(built.length >= 3, "expected >= 3 built stops, got " + built.length);
built.forEach((s) => {
  const st = A.stops[s.id];
  ok(st, `spine stop "${s.id}" has no content`);
  if (!st) return;
  ok(st.title === s.title, `spine title mismatch for ${s.id}`);
  ok(Array.isArray(st.concept) && st.concept.length >= 3, `${s.id}: concept missing`);
  ok(Array.isArray(st.terms) && st.terms.length >= 4, `${s.id}: terms too thin`);
  ok(st.code && st.code.lines && st.code.annotations, `${s.id}: main code block missing`);
  ok(Array.isArray(st.why) && st.why.length >= 1, `${s.id}: why cards missing`);
  ok(Array.isArray(st.whatifs) && st.whatifs.length >= 1, `${s.id}: whatifs missing`);
  ok(Array.isArray(st.frames) && st.frames.length >= 3, `${s.id}: frames missing`);
  const ids = new Set();
  st.frames.forEach((f) => {
    ok(f.title && f.explain && f.explain.length >= 1, `${s.id}: frame "${f.id}" lacks title/explain`);
    ok(f.diagram && D[f.diagram], `${s.id}: frame "${f.id}" diagram "${f.diagram}" not in DIAGRAMS`);
    ok(!ids.has(f.id), `${s.id}: duplicate frame id "${f.id}"`);
    ids.add(f.id);
    if (f.code) {
      ok(Array.isArray(f.code.lines), `${s.id}/${f.id}: code.lines not array`);
      Object.keys(f.code.annotations || {}).forEach((k) => {
        const n = Number(k);
        ok(n >= 1 && n <= f.code.lines.length, `${s.id}/${f.id}: annotation ${k} outside 1..${f.code.lines.length}`);
      });
    }
  });
  /* main block annotation bounds */
  Object.keys(st.code.annotations).forEach((k) => {
    const n = Number(k);
    ok(n >= 1 && n <= st.code.lines.length, `${s.id} main: annotation ${k} outside 1..${st.code.lines.length}`);
  });
});

/* ---------- diagrams render without throwing + stay on-canvas ---------- */
function walk(e, fn) {
  fn(e);
  (e.kids || []).forEach((k) => walk(k, fn));
}
Object.keys(D).forEach((name) => {
  try {
    const fig = D[name]();
    ok(fig && fig.tagName === "figure", `diagram ${name}: not a figure`);
    const svg = fig.kids.find((k) => k.tagName === "svg");
    const vb = (svg.attrs.viewBox || "").split(/\s+/).map(Number);
    if (vb.length === 4) {
      const [vx, vy, vw, vh] = vb;
      walk(svg, (e) => {
        const a = e.attrs || {};
        if (a.x !== undefined && a.y !== undefined) {
          const x = Number(a.x), y = Number(a.y);
          if (x < vx - 2 || x > vx + vw + 2 || y < vy - 2 || y > vy + vh + 2) {
            errors.push(`diagram ${name}: text/el at (${x},${y}) off-canvas ${vw}x${vh}`);
          }
        }
        if (a.x !== undefined && a.width !== undefined) {
          const x = Number(a.x), w = Number(a.width), y = Number(a.y), h = Number(a.height);
          if (x < vx - 2 || x + w > vx + vw + 2 || y < vy - 2 || y + h > vy + vh + 2) {
            errors.push(`diagram ${name}: rect at (${x},${y}) ${w}x${h} exceeds ${vw}x${vh}`);
          }
        }
        if (a.cx !== undefined) {
          const cx = Number(a.cx), cy = Number(a.cy);
          if (cx < vx - 2 || cx > vx + vw + 2 || cy < vy - 2 || cy > vy + vh + 2) {
            errors.push(`diagram ${name}: circle at (${cx},${cy}) off-canvas`);
          }
        }
      });
    }
  } catch (e) {
    errors.push(`diagram ${name} THREW: ${e.message}`);
  }
});

/* ---------- coverage checklist (ticket #14) ---------- */
const allText = JSON.stringify(A);
const coverage = {
  "MSG_COUNTS / WARMUP_COUNTS / SWEEP_SIZES": /SWEEP_SIZES/.test(allText) && /1310720/.test(allText) && /WARMUP_COUNTS/.test(allText),
  "BW_CTRL_TAG + struct bw_ctrl_msg": /BW_CTRL_TAG/.test(allText) && /bw_ctrl_msg/.test(allText),
  "struct bw_context": /struct bw_context/.test(allText),
  "struct bw_dest": /struct bw_dest/.test(allText),
  "bw_init_ctx": /bw_init_ctx/.test(allText),
  "bw_connect_qp": /bw_connect_qp/.test(allText),
  "bw_exch_dest_client / server": /bw_exch_dest_client/.test(allText) && /bw_exch_dest_server/.test(allText),
  "bw_parse_dest": /bw_parse_dest/.test(allText),
  "bw_read_full / bw_write_full": /bw_read_full/.test(allText) && /bw_write_full/.test(allText),
  "wire_gid_to_gid / gid_to_wire_gid": /wire_gid_to_gid/.test(allText) && /gid_to_wire_gid/.test(allText),
  "bw_print_result": /bw_print_result/.test(allText),
  "bw_client_bench per-size loop": /bw_client_bench/.test(allText),
  "bw_post_control_recvs (bonus)": /bw_post_control_recvs/.test(allText),
};
console.log("--- ticket #14 coverage checklist ---");
Object.keys(coverage).forEach((k) => console.log(`${coverage[k] ? "PASS" : "FAIL"}  ${k}`));
if (Object.values(coverage).some((v) => !v)) errors.push("coverage checklist incomplete");

/* ---------- coverage checklist (ticket #15, data path) ---------- */
const coverage15 = {
  "struct bw_data_state": /struct bw_data_state/.test(allText) && /outstanding/.test(allText) && /posted/.test(allText),
  "bw_post_writes": /bw_post_writes/.test(allText) && /IBV_WR_RDMA_WRITE/.test(allText),
  "bw_refill": /bw_refill/.test(allText) && /outstanding -= k/.test(allText),
  "wr_id taxonomy": /BW_RECV_WRID/.test(allText) && /BW_SEND_DONE_WRID/.test(allText) && /BW_SEND_ACK_WRID/.test(allText) && /BW_DATA_WRID/.test(allText),
  "the four pipeline constants": /QP_SLACK/.test(allText) && /WINDOW_DEFAULT/.test(allText) && /SIGNAL_INTERVAL_DEFAULT/.test(allText) && /MAX_INLINE_DATA_DECLARE/.test(allText),
  "doorbell chapter": /doorbell/.test(allText) && /posted MMIO write/.test(allText),
  "wire chapter + inline attribution": /max_inline_data/.test(allText) && /853 MB\/s/.test(allText) && /firmware/.test(allText),
  "landing chapter": /bw_server_ctrl_exchange/.test(allText) && /remote_addr/.test(allText) && /rkey/.test(allText),
  "completions chapter (poll loop + bw_wc_bad + bw_poll_until)": /bw_wc_bad/.test(allText) && /bw_poll_until/.test(allText) && /CTRL_POLL_TIMEOUT_SEC/.test(allText),
};
console.log("--- ticket #15 coverage checklist ---");
Object.keys(coverage15).forEach((k) => console.log(`${coverage15[k] ? "PASS" : "FAIL"}  ${k}`));
if (Object.values(coverage15).some((v) => !v)) errors.push("ticket #15 coverage checklist incomplete");

/* ---------- user priority gap (a): declare-then-read-back ---------- */
if (!/we asked the hardware, not a header/.test(allText)) errors.push("priority gap (a) phrasing missing");

console.log("---");
if (errors.length) {
  console.log("FAILURES (" + errors.length + "):");
  errors.forEach((e) => console.log("  ✗ " + e));
  process.exit(1);
}
console.log("ALL CHECKS PASS");
