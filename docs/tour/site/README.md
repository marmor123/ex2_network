# The tour site — bw.c, every line explained

The build ticket (#29): a static, no-build site that runs from `file://` —
open `index.html` and walk the tour. Two lines: the **file line** (the code,
full-width, one row per line) and the **tour line** (the bottom stepper — the
researched route, done/current/next). Click any line to explain it: a floating
bubble anchored to the line, riding it on scroll. Three-state highlighting
(preview on hover / open / scrollspy in the stepper), localStorage progress,
and a parse self-check over the content.

## Files

| Path | Role |
|---|---|
| `index.html` | the shell (file line, bubble, stepper, self-check modal) |
| `css/app.css` | the shell's styles (the prototype's palette) |
| `js/app.js` | tokenizer, station parser, renderer, shell, self-check |
| `js/route.js` | the tour route — transcribed from `docs/tour/partition.md` §5 |
| `js/content.js` | **generated** — `bw.c` + all station texts, embedded |
| `tools/gen_content.py` | regenerates / verifies `js/content.js` |
| `docs/tour/stations/*.md` | the station content (the renderer contract's source) |

## How content gets in

The site must run from `file://`, so fetch() is out: content is embedded in
`js/content.js` via `<script src>`. The file is generated from the sources of
truth and checked in — the deployed site needs no build step.

```sh
python3 tools/gen_content.py          # regenerate after editing stations
python3 tools/gen_content.py --check  # verify the committed copy is in sync
```

`--check` also enforces the partition's pin: `bw.c` must still be the blob
`8db18617...` the station line ranges are anchored to.

## The self-check

At load, `js/app.js` verifies the renderer contract over the embedded
content: 53 stations with valid headers, the tokenizer round-trips the
source (zero loss), every line 1–1320 is owned by exactly one station, the
predict/reveal pairs and extension blocks are well-formed, every cross-link
resolves to an owning station, and the route covers all 53 stations. Results
show in the top-bar badge (click it for the detail panel); failures also
write to the console. Open `index.html?selftest=1` for the deep DOM checks
(rendered line count, click-to-explain, reveal, cross-link navigation,
progress round-trip).

## Deploying (ticket #30)

The folder is self-contained; the deploy ticket serves it at its own path
alongside the existing site (`prototype/app-shell`).
