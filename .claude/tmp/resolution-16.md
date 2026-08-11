**Resolution — closing chapters built** on `prototype/app-shell` (commit `72f12a7`), variant D per the design conventions on the prototype ticket.

## What was built

- **The control round trip** (6 frames, Data path): the done/ack exchange — `bw_post_ctrl_send` (inline by default, staged fallback), `bw_recv_ctrl` (t1 stamp + tag/seq verify), the CQ in order (pass set → ack → t1), the exchange timeline (four beats per size, ~10 µs); the 32-deep pool re-annotated from the exchange angle (21 of 32 consumed per direction, shared ctrl_buf, one message in flight per direction).
- **The envelope** (6 frames): the measured chart embedded in frame 1 (EnvelopeChart + table twin); three regimes schematic; the 1 MB dip as warmup-in-window arithmetic (rate = R·n/(n+4), predicts 40.54 vs measured 40.57); the 2 KB ramp as the ~495 ns DMA floor (per-message time view: wire time vs floor, crossover between 2–4 KB); the pair gap (host interface, Gen3 x8 plausibility, FDR never the bound); all five anomalies with statuses.
- **The choices** (8 frames): each ADR with its rejected alternative — the template's `pp_wait_completions` (bw_template.c:542–588) shown as the rejected code, declare-then-read-back vs `ibv_query_device`, three clock windows compared, the T4 baseline, the T5 A/B, the T6 campaign numbers.
- **The audit** (5 frames): the twelve-component verdict grid; the one inaccurate comment (bw.c:846–849) with who-actually-covers-what; the four hardenings; the proved done-fits invariant (clamped + un-clamped); what the records already prove (26/26, 11/11, max_qp_wr ≥ 1536, CV ≤ 0.40%).
- **The harness** (5 frames): argc role dispatch + symlink robustness; the seven flags; `k ≤ window && k ≤ QP_SLACK` + the clamp; device selection walk; teardown order (QP → CQ → MRs → PD → device).

27 new SVG diagrams (paper kit style, facts strips everywhere). Spine updated: 13 built stops + viva planned.

## Coverage checklist — anchored

- [x] `bw_post_control_recvs` — the 32-deep never-refreshed receive pool (round-trip "pool" frame, bw.c:688–709, plus the handshake stop)
- [x] `bw_post_ctrl_send` — done/ack SENDs, inline with staged fallback (bw.c:715–748, two frames)
- [x] `bw_wc_bad` / `bw_poll_until` — completion classification, wr_id routing, the 10 s deadline (completions stop, #15; cross-referenced in the round-trip frames)
- [x] `bw_recv_ctrl` — tag + sequence verification, full function (bw.c:817–838, round-trip "recv" frame)
- [x] `bw_server_ctrl_exchange` — the server's side of the round trip (landing stop, #15; referenced in the exchange timeline)
- [x] `bw_close_ctx` — teardown order, "The harness" stop, teardown frame (bw.c:1055–1092)
- [x] `usage` + `main` — CLI parsing (-p -d -i -r -k -n -g), role dispatch by argc, the `k ≤ window && k ≤ QP_SLACK` bound, device selection (harness frames)

**All 18 functions in bw.c appear annotated in some stop** (checked mechanically).

## Verification

- Headless frame-by-frame smoke extended and clean: all 13 stops mount under variant D, frame counts exact, no JS errors across any frame; variants A/B/C render without errors (envelope + audit spot-checked).
- DOM checks: every frame has a diagram figure with a facts strip; the envelope chart frame renders the full chart (svg + line + table twin); why/whatif side cards render where authored.
- Home page lists all 13 stops.

**Note:** screenshots were captured but could not be visually inspected this session (image rendering unavailable in this environment) — DOM-level checks stand in; a quick eyeball of `dp-control-round-trip-f0`, `dp-envelope-f0`, `dp-choices-f0`, `dp-audit-f0`, `dp-harness-f0` in `.claude/tmp/shots/` is worthwhile before the viva ticket.
