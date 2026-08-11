/* Audit: in each diagram, report text elements whose anchor point is covered
 * by an opaque rect drawn AFTER them (i.e. hidden). Run: node .claude/tmp/audit-diagrams.js
 */
const path = require("path");
function fakeEl(tag) { return { tagName: tag, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); return c; }, addEventListener() {} }; }
global.window = global;
global.Node = function Node() {};
global.document = { createElement: fakeEl, createElementNS: (ns, t) => fakeEl(t), createTextNode: (s) => ({ text: String(s) }) };
require(path.join(__dirname, "..", "..", "prototype", "app-shell", "js", "content.js"));
require(path.join(__dirname, "..", "..", "prototype", "app-shell", "js", "diagrams.js"));

const OPAQUE = ["dk-node", "dk-node-accent", "dk-subbox", "dk-callout", "dk-code", "dk-buf", "dk-warmup", "dk-timed", "dk-cqe", "dk-slot-signaled", "dk-slot-filled", "dk-pill"];

function walk(e, order, fn) { fn(e, order); (e.kids || []).forEach((k) => walk(k, order, fn)); }

let bad = 0;
Object.keys(global.DIAGRAMS).forEach((name) => {
  const fig = global.DIAGRAMS[name]();
  const svg = fig.kids.find((k) => k.tagName === "svg");
  const elems = [];
  walk(svg, 0, (e) => { if (e.attrs && e.tagName !== "svg") elems.push(e); });
  elems.forEach((t, ti) => {
    const a = t.attrs;
    if (a.x === undefined || a.y === undefined || a["text-anchor"] === "middle") return;
    /* approximate text bbox for non-centered text: width guess via length */
    const wGuess = (a["font-size"] ? Number(a["font-size"]) : 11) * 0.55 * String(t.kids && t.kids[0] && t.kids[0].text || "").length;
    const tx = Number(a.x), ty = Number(a.y);
    for (let i = elems.length - 1; i > ti; i--) {
      const r = elems[i].attrs;
      if (elems[i].tagName !== "rect" || r.x === undefined || r.width === undefined) continue;
      const cls = r.class || "";
      if (!OPAQUE.some((c) => cls.includes(c))) continue;
      const rx = Number(r.x), ry = Number(r.y), rw = Number(r.width), rh = Number(r.height);
      const inside = tx >= rx && tx <= rx + rw && ty - 6 >= ry && ty <= ry + rh;
      if (inside) {
        console.log(`${name}: TEXT "${String(t.kids && t.kids[0] && t.kids[0].text).slice(0, 40)}" @(${tx},${ty}) hidden by LATER rect ${cls} @(${rx},${ry},${rw}x${rh})`);
        bad++;
      }
    }
  });
});
console.log("---");
if (bad) { console.log(bad + " possible hidden-text hits — review each"); process.exit(1); }
console.log("no hidden-text overlaps found");
