/* Smoke test for the data-path chapters (ticket #15).
 * Drives headless Chrome over CDP: loads every built stop under variant D,
 * clicks through all frames, collects console errors + exceptions, and
 * screenshots the new stops' frames. Run: node .claude/tmp/smoke-data-path.js
 */
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP = "file:///C:/Users/marmo/ateret/ex2_network/prototype/app-shell/index.html";
const PORT = 9333;
const SHOTS = path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const STOP_IDS = ["experiment", "handshake", "memory-region", "posting", "doorbell", "wire", "landing", "completions",
  "control-round-trip", "envelope", "choices", "audit", "harness"];
const FRAME_COUNTS = { experiment: 7, handshake: 7, "memory-region": 6, posting: 6, doorbell: 3, wire: 3, landing: 3, completions: 6,
  "control-round-trip": 6, envelope: 6, choices: 8, audit: 5, harness: 5 };

const errors = [];
const log = (ok, msg) => { console.log((ok ? "PASS" : "FAIL") + "  " + msg); if (!ok) errors.push(msg); };

/* ---- launch chrome ---- */
const prof = fs.mkdtempSync(path.join(require("os").tmpdir(), "bw-smoke-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + prof,
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error("chrome debug port never came up");
}

async function main() {
  const wsUrl = await getPageWs();
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const pageErrors = [];

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") pageErrors.push("EXCEPTION: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params.entry.level)) pageErrors.push("LOG " + m.params.entry.level + ": " + m.params.entry.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push("CONSOLE ERROR: " + (m.params.args || []).map((a) => a.value || a.description).join(" "));
  };
  const send = (method, params) => new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");

  async function evalJS(expr) {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    if (r.result?.exceptionDetails) pageErrors.push("EVAL: " + r.result.exceptionDetails.text);
    return r.result?.result?.value;
  }

  async function goto(url, expectFragment) {
    pageErrors.length = 0;
    await send("Page.navigate", { url });
    for (let i = 0; i < 60; i++) {
      const state = await evalJS("document.readyState");
      if (state === "complete") break;
      await sleep(100);
    }
    await sleep(300); /* let the router render */
    const title = await evalJS("document.title");
    const mounted = await evalJS("!!document.getElementById('app').children.length");
    return { title, mounted };
  }

  /* ---- variant D: every built stop, all frames ---- */
  for (const sid of STOP_IDS) {
    const { mounted } = await goto(APP + `?variant=D#stop=${sid}`, sid);
    log(mounted, `D/${sid}: stop mounts`);
    const frameTitles = await evalJS("JSON.stringify(Array.from(document.querySelectorAll('.d-dot')).map(d => d.title))");
    const n = JSON.parse(frameTitles).length;
    log(n === FRAME_COUNTS[sid], `D/${sid}: ${n} frame dots (expected ${FRAME_COUNTS[sid]})`);
    /* click through every frame */
    for (let i = 0; i < n - 1; i++) {
      await evalJS("document.querySelector('.d-corner.next').click()");
      await sleep(60);
      const diag = await evalJS("!!document.querySelector('.d-diagram-panel figure')");
      const ex = await evalJS("document.querySelector('.d-explain-panel p') ? document.querySelector('.d-explain-panel p').textContent.length : 0");
      if (!diag || ex < 10) pageErrors.push(`D/${sid} frame ${i + 2}: diagram=${diag} explainLen=${ex}`);
    }
    const frameTitle = await evalJS("document.querySelector('.d-frame-title').textContent");
    log(!pageErrors.length, `D/${sid}: no JS errors across ${n} frames (ends at "${frameTitle}")`);
  }

  /* ---- screenshots of the new stops: first and last frame ---- */
  const newStops = { doorbell: [0, 2], wire: [0, 2], landing: [0, 2], completions: [0, 5],
    "control-round-trip": [0, 5], envelope: [0, 5], choices: [0, 7], audit: [0, 4], harness: [0, 4] };
  for (const [sid, idxs] of Object.entries(newStops)) {
    await goto(APP + `?variant=D#stop=${sid}`, sid);
    for (const idx of idxs) {
      await evalJS(`document.querySelectorAll('.d-dot')[${idx}].click()`);
      await sleep(150);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(SHOTS, `dp-${sid}-f${idx}.png`), Buffer.from(shot.result.data, "base64"));
      console.log(`shot: dp-${sid}-f${idx}.png`);
    }
  }

  /* ---- variants A/B/C spot-check on the new stops ---- */
  for (const v of ["A", "B", "C"]) {
    for (const sid of ["doorbell", "completions", "envelope", "audit"]) {
      const { mounted } = await goto(APP + `?variant=${v}#stop=${sid}`, sid);
      log(mounted && !pageErrors.length, `${v}/${sid}: renders without errors`);
    }
  }

  ws.close();
  chrome.kill();
  console.log("---");
  if (errors.length) { console.log("FAILURES (" + errors.length + "):"); errors.forEach((e) => console.log("  ✗ " + e)); process.exit(1); }
  console.log("ALL SMOKE CHECKS PASS");
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
