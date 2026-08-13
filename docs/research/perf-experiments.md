# Perf micro-experiments log

Running log of throughput micro-optimizations tried against the default
build (`-O3 -Wall -Wextra`, W=256, K=64), each measured as the mean of 10
client runs against a fixed peer (`run_bw_avg.sh`, 10x per size) and
compared to the immediately preceding baseline. An entry is kept whether
or not the change is applied — most of these `revert` once measured,
matching `24129b5` (`-march=native`/`-flto`/`-funroll-loops`) and
`078c6bf` (WR/SGE preinit, modulo-free signaling), which predate this log
and were not re-measured for it.

## CQE batch-drain in `bw_refill`

**Hypothesis**: `bw_refill` polled `ibv_poll_cq(ctx->cq, 1, &wc)` — one
CQE per call — inside a loop that only exits once the SQ has enough room.
`ibv_poll_cq` never blocks, so if 2+ CQEs were already sitting ready, the
loop would still reclaim them one call at a time. Requesting up to
`REFILL_BATCH` (`(WINDOW + SIGNAL_INTERVAL) / SIGNAL_INTERVAL` = 5, the
max CQEs that could possibly be outstanding at once) per call should
drain everything already ready in one call without adding any wait — a
lone ready CQE is still taken and acted on immediately either way.

**Change**: commit `9eb2c55` — `struct ibv_wc wc[REFILL_BATCH]` +
`ibv_poll_cq(ctx->cq, REFILL_BATCH, wc)`, looping over the `ne` returned
entries instead of handling exactly one.

**Measured** (10 client runs each, mlx-stud-01 ↔ mlx-stud-02, avg Gbps):

| size (B) | before (1-at-a-time) | after (batch-5) |
|---|---|---|
| 1 | 0.04957 | 0.04954 |
| 2 | 0.09906 | 0.09905 |
| 4 | 0.19826 | 0.19825 |
| 8 | 0.39640 | 0.39639 |
| 16 | 0.79296 | 0.79294 |
| 32 | 1.58000 | 1.58000 |
| 64 | 2.65000 | 2.65000 |
| 128 | 3.61000 | 3.61000 |
| 256 | 5.84000 | 5.84000 |
| 512 | 6.28500 | 6.29100 |
| 1024 | 6.56000 | 6.56000 |
| 2048 | 33.51600 | 33.42200 |
| 4096 | 38.13000 | 38.13100 |
| 8192 | 38.14500 | 38.14300 |
| 16384 | 38.23000 | 38.23000 |
| 32768 | 38.27000 | 38.27000 |
| 65536 | 38.25900 | 38.26000 |
| 131072 | 38.26100 | 38.26000 |
| 262144 | 38.26500 | 38.26400 |
| 524288 | 38.29000 | 38.29000 |
| 1048576 | 38.29000 | 38.29000 |

**Verdict: no measured benefit — reverted (`8153f04`).** Every size is
flat or very slightly lower after the change; most noticeably 2048 B
(33.516 → 33.422 Gbps, ~0.3%). Consistent with the audit finding that in
steady state the refill loop's depth trigger (`outstanding + K ≥
sq_depth`) is satisfied by reclaiming exactly one CQE almost every call
(each CQE frees exactly K WRs, and the threshold gap is sized to K) — so
there is rarely a second CQE already sitting ready for the batched call
to pick up, and the larger `wc` array/loop adds a small constant cost
with nothing to amortize it against.
