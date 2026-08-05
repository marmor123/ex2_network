# Measured data-path envelope on the course hardware (T4 baseline)

The T4 naive WRITE data path was measured on mlxstud01/02 — two full sweeps, values identical to three digits — and recorded here as the baseline for T5's A/B requirement ("the pipeline pays, never regresses") and T6's tuning campaign.

## What the measurements show

Three clean regimes, with the boundary between the second and third at exactly `max_inline_data` (1024 B):

- **≤ 128 B: message-rate-bound at ~3.7M msg/s** (0.27 µs/msg). The client's userspace post loop — one WQE + one doorbell per `ibv_post_send` — is the ceiling.
- **256 B – 1 KB: flat ~6.4 Gbps data-rate plateau.** The per-message cost fits `L(size) = size / 853 MB/s + 0.05 µs` over two independent intervals (512→1024 and 256→512 both give B = 853 MB/s to three digits): a per-message cost proportional to payload size, i.e. a per-message payload copy. The zone's upper edge is exactly `max_inline_data`, so messages ≤ `max_inline_data` ride the inline WQE path on the course stack even when `IBV_SEND_INLINE` is not set; the copy caps the zone at ~853 MB/s.
- **2 KB – 1 MB: flat ~38 Gbps** (≈4.77 GB/s). The DMA path, capped by the HCA's host interface (PCIe), not the FDR link (which could carry ~6.3 GB/s).

## Decisions recorded

- These numbers are the T4 baseline and T5's A/B reference — a regression below them anywhere is a T5 failure.
- T5 should not chase the ≤ 1 KB plateau. The inline copy is the hardware's cost for small messages, and the small sizes already beat ex1's TCP numbers on the same fabric by ~7× (ex1: 13 Mbps–940 Mbps on 1 GbE; here: 30 Mbps–6.4 Gbps on IB).
- T5's expected win is at large sizes: K-batched signaling (K=64) and refill reduce CQE pressure; whether the 38 Gbps ceiling is the bus or the naive per-WR signaling is the open question the A/B answers. T5's explicit-`IBV_SEND_INLINE` path will also confirm or refute the inline-path attribution above.

## Consequences

If 38 Gbps is the host-interface ceiling, T6's tuning cannot exceed it, and the class-bonus comparison on mlxstud03/04 becomes about matching it, not beating it. The dev-pair envelope should be re-measured once on mlxstud03/04 (different machines, same HCA family) before final numbers are claimed.
