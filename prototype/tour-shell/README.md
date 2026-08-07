# Prototype — the two-line tour shell (ticket #22)

**Throwaway.** Answers one question: *does the two-line shell feel right?* —
bubble placement, highlight behavior, station granularity on screen, the file
line + tour line layout, and the entry feel. The build ticket reimplements
what gets approved; nothing here ships.

## Plan

Three variants of the tour shell, switchable via `?variant=` on a throwaway
route (`index.html`), sharing four sample stations in the light-skeleton voice
(what / how / why, watch-outs, cross-links, one predict-then-confirm).

- **A — Rail**: side-bubble rail on the right, horizontal tour bar along the
  bottom (chips + next stop), "Start tour" pill. The literal destination spec.
- **B — Float**: bubble floats as a card anchored to the clicked line, tour
  line as a vertical right-edge minimap strip, pulsing "Begin tour" button,
  spotlight highlight (open station dims everything else).
- **C — Deck**: bubble as a bottom sheet, tour line as a numbered stepper,
  welcome overlay entry, gutter banners marking station boundaries.

## Run

One command (Windows):

```
start prototype\tour-shell\index.html
```

Works from `file://` — no server, no build. Flip variants with the bottom
pill, the `←`/`→` keys, or `?variant=A|B|C` in the URL.

## What's shared vs variant

Shared: the code (bw.c embedded, hand-rolled C tokenizer), the four sample
stations (data model with multi-valued chapter tags + line ranges — the
metro-network-proof shape from the map), the three-state highlighting
(preview / open / scrollspy), click-anywhere-to-explain.

Variant: bubble placement, tour-line form, entry feel, highlight treatment.

## The four sample stations

| # | Station | Type | Lines | Why it's here |
|---|---------|------|-------|---------------|
| 1 | The counts table (`MSG_COUNTS` + `WARMUP_COUNTS`) | constant | 111–122 | data-first concept, low interactivity |
| 2 | `struct bw_dest` | struct | 202–211 | small struct, handshake vocabulary |
| 3 | `bw_poll_until` | function | 775–809 | the poll loop, a beacon |
| 4 | `bw_refill` | function + diagram | 868–888 | the window/refill mechanism — hardest, with an inline-SVG diagram |

Route order (execution-aware ramp, per `docs/research/learning-path.md`) —
deliberately not file order: that gap is exactly what the tour line shows.
