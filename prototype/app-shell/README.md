# Prototype — the teaching app shell

**Question this prototype answers:** what should the app look and feel like —
visual language, navigation, diagram style, code presentation, interactivity
level? Resolution on [issue #9](https://github.com/marmor123/ex2_network/issues/9)
records the design conventions the build tickets follow. The build is
happening on this same branch — **variant D (Studio)** is the chosen design;
variants A/B/C stay for reference.

**Run it:**

```
start prototype/app-shell/index.html
```

(Or just double-click `index.html` — it runs from `file://`, no server, no
build step, consistent with the app's static-HTML form decision.)

## Three variants

Flip between them with the floating bar at the bottom, the `‹` / `›` buttons,
or the arrow keys (`?variant=A|B|C` in the URL; reload-stable):

| Key | Name | Structure | Primary affordance |
|---|---|---|---|
| **A** | Field notes | Code-first, dark. A stop IS the annotated source — concept, why and what-ifs as callouts around the code. Left rail = the spine. | Scroll the code; the annotations are the lesson |
| **B** | System map | Diagram-first, light. The run as a living picture: client SQ → link → server buffer; stops are nodes. Posting the window has a playable mini-pipeline. | Click the diagram; watch the window fill and refill |
| **C** | Viva deck | Presentation. Home is a title slide; each stop is a 4-slide deck (concept → code → why → what-if). Viva mode hides answers until you reveal them. | Arrow through it; rehearse the exam |
| **D** | Studio | Split-screen, Claude-like (cream, white panels, terracotta). Left: code on top, explanation below. Right: a hand-drawn-style SVG diagram synced to the frame — struct design (linked lists, pointers), the connection, the live traffic — with leader-line annotations and a facts strip under every figure. One idea per frame; dotted progress + corner arrows at the bottom. | Step through the frames with the corner arrows; the diagram tracks the code |

Content is shared: home (experiment, roles, envelope chart, spine) and the
stops — the **Setup** group (**The experiment**, ADR-0003 clock window;
**The handshake**, ADR-0001 TCP exchange + control receive pool;
**Memory region**, ADR-0002 registration + declare-then-read-back), the full
**Data path** group (**Posting the window**, **The doorbell**, **On the
wire**, **Landing in server memory**, **Completions**, **The control round
trip**), and the closing groups: **The envelope** (**The shape of the
numbers** — three regimes, the 1 MB dip's warmup arithmetic, the 2 KB DMA
floor, the pair gap, all five anomalies), **The choices** (**Why it's
written like this** — each ADR with its rejected alternative), **Inside the
audit** (**What the audit found** — twelve verdicts, the one wrong comment,
the hardenings), and **The harness** (**The program's shell** — argc role
dispatch, the seven flags, the bounds, device pick, teardown). Every stop
carries concept / annotated code / ADR why / viva what-ifs, using CONTEXT.md
vocabulary; the data-path and envelope chapters carry the research findings:
the HCA's ~853 MB/s inline copy (research #12), the 2 KB per-message DMA
floor (research #13), the completion-slaved ~163 ns ceiling (research #11),
and the warmup-in-window arithmetic (research #13). Full bw.c coverage: all
18 functions are annotated somewhere. Stops are added per the wayfinder
build tickets (#14: setup chapters, #15: data path, #16: closing chapters).

The envelope chart follows the dataviz skill (single-series line on log2
sizes, crosshair + tooltip, table twin, light/dark tokens).

## What to react to

1. Which structure feels right for *learning* — scroll-annotated code (A),
   diagram exploration (B), or slide walkthrough (C)?
2. Within the winner: the stop layout, the code presentation (gutter notes vs
   legend), the what-if presentation (open vs reveal), diagram/animation depth.
3. The home page: what should it promise, what should it lead with?

The answer is usually a mix — "the spine from A, the diagram from B, the viva
mode from C" — steal freely; the losing variants stay on this branch.
