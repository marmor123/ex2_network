# Measurement campaign: warmup / counts / W / K — the best measured envelope (issue #19)

Task ticket #19. Decision: which warmup, counts, and W/K settings give the best
*measured* envelope on the final pair (mlxstud03/04), then apply the change and
re-measure. Hypothesis-sharpened AFK; the user runs the checklists on the nodes
(node access is user-mediated). Scratch build on branch `measure/warmup-counts`.

## What the campaign must settle

1. **Warmup ≥ W (the ticket-18 claim vs the window arithmetic).** Ticket #18
   predicted "raising WARMUP_COUNTS above the window should recover ~1.76 Gbps
   at 1 MB". The ack-stopped window arithmetic (dma-regime-shape.md) says the
   opposite: the warmup's wire time is inside the measured window, so with
   warmup = 256 the 1 MB elapsed becomes (80 + 256)·τ and the line reports
   **R·80/336 ≈ 10.1 Gbps — a collapse, not a recovery**. The same arithmetic
   says **warmup = 0 is the only setting that recovers the dip** (1 MB → R ≈
   42.5). Hardware decides; both runs are cheap.
2. **Warmup = 0 as the measurement fix.** The dip is a measurement artifact —
   the true flat rate is R. Confirming warmup=0 on hardware is the gate for
   applying it.
3. **The 2 KB count-dependence.** Ticket-18 probes (dev pair) showed the ~116 ns
   excess at 2 KB exists only at count 20480 (33.53); at 640 (36.44) and 80
   (29.23) the point sits on the wire+ack curve. The campaign maps the
   transition (counts) and the size boundary (intermediate sizes) on the final
   pair, then decides: reduce the 2 KB count, or keep the ex1 table verbatim
   and document the anomaly.
4. **W/K.** ADR-0007 already A/B'd (512,64)/(256,128)/(512,128) vs (256,64): all
   within 0.2% of the default at every anchor. Recheck under the new counts
   (module B4) so "best measured envelope" is claimed with the final settings.

## Model (all predictions for the final pair, R = 42.57 Gbps)

- Reported rate = R·n/(n + w) where n = timed count, w = warmup count (the
  warmup's wire time is inside the ack-stopped window; verified to 0.1% on both
  pairs, ticket 13/18).
- 1 MB: n = 80, w = 4 → 40.54 (measured 40.57). n = 640 → 42.31. n = 80 →
  40.54 (indistinguishable from default — the dip follows the count, not the
  size). w = 0 → 42.55. w = 256 → R·80/336 = 10.14.
- 2 KB (count-dependent): per-message time = τ + ack/n + excess, τ = 2048·8/R =
  385 ns, ack ≈ 10 µs. Wire+ack model (no excess): @640 → 40.9, @2560 → 42.2,
  @5120 → 42.4, @10240 → 42.5, @20480 → 42.5 (measured 32.67 → excess
  ≈ 117 ns/message at count 20480). @80 → 31–32.
- Intermediate sizes @ 20480 (no excess → wire-bound at R): 1536 B → 42.57 if
  clean; with the old per-message floor (~490 ns) → ~25.1. The floor/count-excess
  boundary is what we map. 3072/3584 B should sit at 42.57 either way (τ = 577 /
  673 ns > any floor).
- W/K: no effect expected (ADR-0007: ≤ 0.2%); rechecked only.

## Baseline (ADR-0007, final pair, defaults W=256 K=64)

1 B 48.97 Mbps (~6.12M msg/s) · 256 B 5.84 · 1 KB 6.55 · 2 KB 32.67 ·
4 KB 42.36 · 32 KB 42.50 · 64 KB 42.30 · 1 MB 40.57 · peak 42.59 · CV 0.18%
at 64 KB/1 MB.

---

## Module A — counts, no code change (final pair; ~10 min)

Server on mlxstud03 with defaults; client on mlxstud04. Each `-n` run prints the
full 21-line envelope at that count — read line 12 (2 KB) and line 21 (1 MB),
and the flat 32 KB–512 KB mean as the live R.

| run | 1 MB prediction | 2 KB prediction | runs |
|---|---|---|---|
| A1 `-n 640` | 42.31 (R·640/644) | ~40.9 (wire+ack, no excess) | 3 |
| A2 `-n 80` | 40.54 (same as default — dip is count-following) | ~31–32 (wire+ack with big ack share) | 3 |
| A3 `-n 2560` | 42.51 | ~42.2 if clean, < 42.2 if excess starts below 20480 | 1 |
| A3 `-n 5120` | 42.53 | ~42.4 | 1 |
| A3 `-n 10240` | 42.54 | ~42.5 | 1 |

A1/A2 ×3 for CV; A3 single runs (transition mapping). Prediction checks:
- A1 line 21 ≈ 42.3 and A2 line 21 ≈ 40.5 → warmup arithmetic confirmed on the
  final pair (it already holds on the dev pair).
- A2 line 21 ≈ A2 baseline 40.57 → the dip is count-determined, not size-driven.
- A3 2 KB line: where the excess appears (first count < 20480 reading below the
  wire+ack model).

## Module B — scratch build (branch `measure/warmup-counts`; both nodes)

The patched bw.c adds `-w, --warmup=<n>` (overrides WARMUP_COUNTS for every
size, mirror of `-n`) and four extra sizes at the end of the sweep
(lines 22–25: 1536 / 2560 / 3072 / 3584 B, counts 20480+4). Build from the
branch; `make` must stay warning-free. Server runs with defaults unless noted.

| run | what it tests | prediction |
|---|---|---|
| B1 `-w 0` ×3 | the measurement fix | 1 MB → ~42.5 (recovers the dip); 2 KB unchanged (~32.7 — excess is count-driven, not warmup-driven); rest ≈ baseline |
| B2 `-w 256` ×3 | ticket-18's recovery claim, head-on | window arithmetic: 1 MB → **~10.1 Gbps collapse**; the 18 claim: ~42.5 |
| B3 default, ×2 | the size boundary of the count-excess (lines 22–25) | 3072/3584 B → ~42.6; 1536 B → ~25 (floor) or ~42.6 (no excess below 2 KB); 2560 B → the boundary |
| B4 `-w 0 -r 512 -k 64`, `-w 0 -r 256 -k 128`, `-w 0 -r 512 -k 128`, ×1 each | W/K under the new counts | no set beats (256,64) by ≥ 1% at 1 B / 1 MB |

B2 is the decisive run of the whole campaign: ~10 vs ~42.5 is a 4× gap, no noise
can hide it. B1 ×3 gives the CV for the new 1 MB number (expect ≈ 0.2%, ADR-0007).

## Module C — two-QP aggregate (optional, no code change)

Does the ~6.1M msg/s ceiling scale across QPs? Run two independent pairs
concurrently on the same node pair, different ports:

- mlxstud03: `./server -p 18516 & ./server -p 18517 &`
- mlxstud04: `./client -p 18516 mlxstud03 & ./client -p 18517 mlxstud03 &`

Read the 1 B line of each: two runs at ~6.1M msg/s each → per-QP ceiling (scales);
~3M each → card-wide cap. Caveat: both clients share one CPU post loop, so a
drop below 6.1M each doesn't by itself refute per-QP scaling — note CPU load.

## Module D — machine facts (optional, read-only, viva material; ticket-13 leftover)

On both final-pair nodes: `lspci | grep -i mellanox`, `lspci -vvv -s <bdf>`
(LnkSta Gen/x8, MaxPayload), `ibstat` (FDR, MTU, firmware), `lscpu | grep "Model name"`.
Anomaly-3 (pair gap) support for the viva. 2 minutes.

---

## Decision & apply (after the data)

1. **Warmup**: apply warmup = 0 (or 0 only where the penalty ≥ 1%: sizes ≥ 128 KB)
   if B1 confirms ~42.5 at 1 MB — a measurement fix; the viva story is "the audit
   found the ex1-inherited warmup's wire time inside the measured window".
   Trade-off recorded in ticket 18: the counts table is "ex1 verbatim"
   (ADR-0003's methodology continuity) — changing warmup trades ex1
   comparability for honest numbers. User decision at resolution.
2. **2 KB count**: if module A/B maps a clean count threshold, either set
   20480 → 2560 (reports the short-stream rate) or keep the ex1 table and
   document the anomaly as a measurement property of long 2 KB streams. Same
   ex1-verbatim trade-off.
3. **W/K**: keep 256/64 unless B4 says otherwise.
4. Apply on a branch, re-run verify.sh on the final pair, record the new
   envelope (this becomes the app chart's data — ticket 16's envelope chapter
   needs the update), update the ADRs (0007's numbers) if the record changes.
