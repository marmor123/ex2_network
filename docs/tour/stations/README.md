# Station content — format and conventions

Authoring deliverable for wayfinder tickets **#25–#28**. One markdown-ish file per station; the build ticket (#29) implements the tiny renderer and its parse self-check against this format.

## Naming and location

`docs/tour/stations/NN-slug.md` — `NN` is the partition table's station number (01–52), `slug` a short dash-slug. The partition doc (`docs/tour/partition.md`) is the authority on titles, types, tags, and line ranges. The capstone is the one exception: it owns no lines (partition Q1), so it is `capstone.md` with `lines: none` — the build's no-anchor station.

## Header

First line: the station title, verbatim from the partition table. Then three front-matter-ish lines:

- `type:` — one of `file`, `constant`, `struct`, `function`, plus `content` for the capstone (owns no lines).
- `tags:` — comma-separated chapter tags from the canonical nine: `orientation, types, handshake, setup, control, data-path, measurement, main, closing`.
- `lines:` — the owned line range `start-end` per the partition (pinned `bw.c` blob `8db1861`); `none` for the capstone.
- `skip: yes` — only where the partition marks an expert-escape skip station (station 1); the lead carries the affordance text.

## Body blocks

- The **lead** paragraph — the summary line, readable alone (the expert-escape affordance).
- `**What.**` / `**How.**` / `**Why.**` paragraphs — the light skeleton.
- `> ⚠ ...` — a watch-out blockquote.
- `> **Predict** — question` followed by `> **Reveal** — answer` — the predict-then-confirm block; the renderer turns the pair into the reveal control.
- `**Cross-links:** \`sym\`, ...` — code-symbol references resolved to their owning stations (as in the shell prototype).
- `:::table` / `:::` — the table extension block: a markdown table between the fences.
- `:::diagram` / `:::` — the diagram extension block: one inline SVG plus a `<figcaption>`, authored fresh (no external assets).

## Conventions

- CONTEXT.md controlled vocabulary in **bold** at first use, used verbatim: **Timed batch**, **Warmup batch**, **Size sweep**, **Counts table**, **Window depth (W)**, **Signal interval (K)**, **Refill**, **Poll loop**, **Control message**, **Done**, **Ack**, **Sequence counter**, **Completion barrier**, **Inline**, **max_inline_data**, **Handshake**, **Control receive pool**.
- Identifiers in backticks. English. Code references match the pinned `bw.c` (`8db1861`).
- Predicts only where the partition §5 inventory lists them (one loud warmup block at station 41; one-line pointers at station 5).
- Diagrams only where helpful; drawn fresh in the prototype's palette (dark navy fill, blue/teal strokes).
