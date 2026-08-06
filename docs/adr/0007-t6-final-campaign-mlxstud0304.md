# T6 final campaign on mlxstud03/04 (ADR-0007)

The final measurement runs (issue #7, criterion 4) — the same stage-6 verify campaign as ADR-0006, run with `--final` on the assignment's recommended pair. Report: 26/26 client-side, 11/11 server-side, no QP errors.

## What the measurements show

- **The final pair is faster at the DMA sizes — ~11% above the dev-pair envelope.** 4 KB–512 KB flat at 41.5–42.5 Gbps (dev pair: 37.3–38.2), 1 MB at 40.57 (dev pair: 36.47), peak 42.59 (dev pair: 38.22). The 38 Gbps host-interface bound of ADR-0004/0005 is specific to mlxstud01/02; on mlxstud03/04 the same HCA saturates closer to the FDR link. The 2 KB ramp (32.67) and the 1 MB point sitting ~1.8 Gbps below the 64 KB rate (80-WR stream) reproduce the dev-pair shape.
- **Small sizes are ~1% slower.** 1 B: 48.97 Mbps vs 49.54 → ~6.12M msg/s (dev pair: 6.19M); 32 B: 1.56 Gbps. 128 B (3.577) carries the largest CV of the run (0.81%) — the inline-copy boundary — still well within acceptance.
- **The plateau and inline behavior are identical.** 256 B 5.84, 512 B 6.29, 1 KB 6.55 — the ~853 MB/s inline copy caps ≤ 1 KB exactly as on the dev pair.
- **Variance: CV 0.18% at 64 KB and 1 MB** — <1% with room to spare (noisier than the dev pair's 0.00%, still trivial).
- **The A/B confirms the defaults on this pair too.** All three alternatives within 0.2% of (W=256, K=64) at every anchor (1 MB: 40.567 vs 40.59 / 40.65 / 40.53; 64 KB: 42.30 vs 42.31 / 42.39 / 42.255). The 256/128 set is marginally highest at 1 MB — a 0.2% effect, far below the 1% gate, consistent with noise.

## Decisions recorded

- **Final defaults: W=256, K=64 — unchanged.** The hardware agrees on both pairs; no `bw.c` tuning.
- **The final numbers are this report's envelope table** (below). Issue #7 is fully met: ≥3 sweeps <1% variance (0.00% dev pair, 0.18% final pair), message-rate scaling in every sweep, defaults set from measurements, final numbers produced on mlxstud03/04.

## The final envelope (means of 3 default sweeps, mlxstud03/04)

| size | Gbps | | size | Gbps |
|---|---|---|---|---|
| 1 B | 0.049 | | 4 KB | 42.36 |
| 2 B | 0.098 | | 8 KB | 42.37 |
| 4 B | 0.196 | | 16 KB | 42.46 |
| 8 B | 0.392 | | 32 KB | 42.50 |
| 16 B | 0.784 | | 64 KB | 42.30 |
| 32 B | 1.56 | | 128 KB | 42.04 |
| 64 B | 2.62 | | 256 KB | 41.53 |
| 128 B | 3.577 | | 512 KB | 41.55 |
| 256 B | 5.84 | | 1 MB | 40.57 |
| 512 B | 6.29 | | | |
| 1 KB | 6.55 | | peak | 42.59 |
| 2 KB | 32.67 | | | |

## Consequences

- The class-bonus number on course hardware is the mlxstud03/04 envelope: ~42.5 Gbps peak, 40.6 Gbps at 1 MB — the best this HCA pair produced in any configuration tested (naive T4, streaming T5/T6, and the three A/B parameter sets all saturate the same envelope).
- The dev-pair figures in ADR-0004/0005 remain the reference for that pair; CONTEXT.md's 38 Gbps parenthetical is amended to point at both envelopes.
