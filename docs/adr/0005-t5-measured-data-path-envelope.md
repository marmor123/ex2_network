# Measured data-path envelope with the streaming pipeline (T5 A/B)

The T5 streaming data path (ADR-0002: W=256 window, K=64 signal interval, K WRs per `ibv_post_send`, refill-never-empty, explicit `IBV_SEND_INLINE`) was measured on the dev pair (mlx-stud-01/02) with the stage-5 verify script, in the same conditions as the T4 baseline of ADR-0004, and compared point-by-point against the naive path's numbers from the immediately preceding T4 run on the same pair.

## What the measurements show

- **≤ 64 B: the pipeline pays, and pays substantially — +37%…+67%.** Message rate rises from ~4.5M msg/s (T4) to ~6.2M msg/s (T5), flat across 1–32 B and only beginning to fall at 64 B as the inline copy takes over. ADR-0004 attributed the T4 ceiling to "the client's userspace post loop — one WQE + one doorbell per `ibv_post_send`"; batching K WRs per post removes the per-WR doorbell, and the measured gain confirms that attribution. (1 B: 36.2 → 49.6 Mbps; 2 B: 60.1 → 99.1; 4 B: 120.0 → 198.2; 8 B: 238.8 → 396.3; 16 B: 479.2 → 792.8; 32 B: 948.1 Mbps → 1.58 Gbps; 64 B: 1.85 → 2.65 Gbps.)
- **128 B – 1 KB: identical to T4 to three digits** (3.61 / 5.84 / 6.29 / 6.55 Gbps). The plateau is the inline copy at ~853 MB/s (ADR-0004); the explicit `IBV_SEND_INLINE` flag changes nothing because the stack inlines small messages regardless — the flag's attribution is confirmed, not altered.
- **2 KB – 1 MB: identical to T4 to three digits** (33.5–38.2 Gbps, 36.47 at 1 MB on both runs). The refill and K-batched signaling neither help nor hurt the DMA regime.

## Decisions recorded

- **The 38 Gbps ceiling is the HCA's host interface, not the naive per-WR signaling.** ADR-0004's open question is answered: replacing the naive path (which already matches the pipeline at DMA sizes) with K=64 batched signaling does not move the DMA regime, so the bus is the bound. T6's tuning cannot exceed ~38 Gbps on this pair, and the class-bonus comparison on mlxstud03/04 is about matching the envelope, not beating it.
- The pipeline's win is the small-size message rate (+37…67%), which the T4 baseline did not attribute as reachable — the A/B "pipeline pays, never regresses" acceptance (issue #6) is met at every size: no size regressed, and the message-rate regime improved.
- The stage-5 A/B floors (256 B/1 KB ≥ 5.76, 64 KB/1 MB ≥ 34.2) were validated by this run: the pair's plateau measures 5.84 at 256 B (1.4% above the floor) and the DMA envelope 36.47–38.22 — the 10% band is right, but the 256 B point has little margin on this pair.

## Consequences

- The stage-5 verify report (15/15 client, 3/3 server) is the issue #6 acceptance record; no QP errors were observed on either side.
- T6 inherits a measured 38 Gbps bus bound and a message-rate regime that is now 6.2M msg/s; its tuning campaign should treat the mlxstud03/04 envelope as the target, per the assignment's final-measurement recommendation.
