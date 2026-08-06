# T6 dev-pair campaign: variance, scaling, and the window/signal A/B (ADR-0006)

The T6 measurement campaign (issue #7, stage 6 of verify.sh) ran on the dev pair (mlxstud01/02) in the same conditions as ADR-0004/0005: 9 full sweeps — 3 with the default parameters (W=256, K=64) and 2 each of the alternatives (512,64), (256,128), (512,128) — with per-sweep contract checks on both roles. Report: 26/26 client-side, 11/11 server-side, no QP errors.

## What the measurements show

- **The variance acceptance is met with zero visible spread.** CV across the 3 default sweeps is 0.00% at 64 KB (38.03 Gbps) and 1 MB (36.47), and ≤ 0.40% at every size (the 2 KB ramp point at 33.53 has the largest CV). The dev pair is quiet enough for the <1% criterion at the large sizes to be trivially satisfied.
- **The message-rate scaling holds in every sweep.** Each size 1..32 B doubles throughput within a hair of 2.0 (1 B: 49.54 Mbps → 32 B: 1.58 Gbps), the message-rate-bound regime at ~6.19M msg/s — unchanged from the T5 record (ADR-0005).
- **The envelope is the ADR-0004/0005 envelope, point for point.** 1 KB plateau 6.55 Gbps (the inline copy); 2 KB at 33.53 — the DMA ramp, not a regression; 4 KB–512 KB flat 37.3–38.2 Gbps; 1 MB 36.47. The 38 Gbps host-interface bound still caps the DMA regime.
- **The A/B confirms the assumed defaults.** At every one of the six anchor sizes (1 B, 32 B, 256 B, 1 KB, 64 KB, 1 MB), all three alternative sets land within 0.1% of the default's mean — e.g. 1 B: 0.04954 vs 0.04956 / 0.049505 / 0.04957; 64 KB: 38.03 vs 38.03 / 38.035 / 38.035. No alternative beats (W=256, K=64) by ≥1% anywhere: the window is deep enough to saturate the bus (the naive T4 path already did), and K=64's CQE rate is not a factor at any size.

## Decisions recorded

- **The default parameters stand: W=256, K=64.** The "tuning of final default window/signal parameters if the hardware disagrees with the assumed 256/64" acceptance is answered in the negative — the hardware agrees; no `bw.c` change.
- The issue #7 acceptance criteria 1–3 are met by this run: ≥3 sweeps with <1% variance at the large sizes (0.00%), small sizes message-rate-bound, final defaults set from the measurements (they were already the measured optimum).
- Remaining: the final measurement runs on mlxstud03/04 (criterion 4), per the assignment's recommendation — the same stage-6 script with `--final`.

## Consequences

- The final-pair comparison target is this envelope: match 38 Gbps at 4 KB–512 KB, ~36.5 at 1 MB, the 6.55 plateau, and the 6.19M msg/s small-size rate — any large-size deviation below the ADR-0004/0005 floors (34.2 Gbps) fails the stage-6 envelope check.
- mlxstud03/04 may differ (same HCA family, different machines); the A/B gate reruns there and will flag if the final pair disagrees with 256/64.
