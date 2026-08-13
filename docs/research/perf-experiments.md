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

## Per-size warmup round before the timed batch

**Hypothesis**: the timed batch starts from a cold pipe (`outstanding =
0`), so the first `~W` WRs ramp the window up rather than running at
steady state from the first post. An untimed warmup round immediately
before the timed one, filling the pipe first, might remove that ramp from
the measured window. This re-tests, on the RDMA path, the same question
already answered "no benefit" for ex1's TCP path (the original header
comment this repo carried before the experiment: "ex1's warmup counts
measured no benefit, and their wire time sits inside the measured
window").

**Change**: commit `66a5742` — an untimed warmup round
(`BW_WARMUP_COUNTS`, per-size, env-var override) alternated with the
existing timed benchmark round per size; `CTRL_POOL_DEPTH` doubled to `2
* SWEEP_SIZES` (42) since both sides now trade two done/ack round trips
per size unconditionally (a size can't skip its warmup round only on the
client, since the server never learns the counts and would desync).

**Measured** (10 client runs per level, mlx-stud-01 ↔ mlx-stud-02, avg
Gbps; warmup applied uniformly to all 21 sizes per level; benchmark count
left at `MSG_COUNTS` throughout):

| size (B) | warmup=0 | warmup=64 (K) | warmup=256 (W) | warmup=512 (2W) | warmup=1024 (QP_SLACK) | spread |
|---|---|---|---|---|---|---|
| 1 | 0.04955 | 0.04956 | 0.04953 | 0.04955 | 0.04956 | 0.061% |
| 2 | 0.09906 | 0.09906 | 0.09907 | 0.09906 | 0.09907 | 0.010% |
| 4 | 0.19825 | 0.19807 | 0.19826 | 0.19819 | 0.19825 | 0.096% |
| 8 | 0.39641 | 0.39639 | 0.39642 | 0.39636 | 0.39632 | 0.025% |
| 16 | 0.79294 | 0.79294 | 0.79267 | 0.79287 | 0.79295 | 0.035% |
| 32 | 1.58000 | 1.58000 | 1.58000 | 1.58000 | 1.58000 | 0.000% |
| 64 | 2.64900 | 2.65000 | 2.65000 | 2.65000 | 2.64900 | 0.038% |
| 128 | 3.60200 | 3.61100 | 3.61100 | 3.61000 | 3.61100 | 0.249% |
| 256 | 5.84000 | 5.84000 | 5.83400 | 5.84000 | 5.83600 | 0.103% |
| 512 | 6.29100 | 6.29100 | 6.29100 | 6.29000 | 6.28900 | 0.032% |
| 1024 | 6.55900 | 6.57100 | 6.56500 | 6.55900 | 6.55800 | 0.198% |
| 2048 | 33.44100 | 33.52400 | 33.46600 | 33.59800 | 33.44100 | 0.469% |
| 4096 | 38.13100 | 38.13400 | 38.13400 | 38.13400 | 38.13300 | 0.008% |
| 8192 | 38.14600 | 38.15400 | 38.15100 | 38.15100 | 38.15200 | 0.021% |
| 16384 | 38.23000 | 38.22900 | 38.23100 | 38.23000 | 38.23000 | 0.005% |
| 32768 | 38.26700 | 38.22900 | 38.27000 | 38.27000 | 38.27000 | 0.107% |
| 65536 | 38.25800 | 38.25700 | 38.26000 | 38.24800 | 38.26000 | 0.031% |
| 131072 | 38.26400 | 38.26100 | 38.26000 | 38.26300 | 38.26000 | 0.010% |
| 262144 | 38.26400 | 38.26400 | 38.26600 | 38.26100 | 38.26700 | 0.016% |
| 524288 | 38.28800 | 38.29000 | 38.29000 | 38.28900 | 38.29000 | 0.005% |
| 1048576 | 38.28900 | 38.29000 | 38.28500 | 38.27000 | 38.29000 | 0.052% |

Spread = (max − min) / mean across the 5 levels for that size.

**Verdict: no measured benefit at any size — reverted (`9ead2b1`).**
Worst-case spread across all 5 levels (0 → 1024, spanning K, W, 2W, and
QP_SLACK) is 0.469% at 2048 B; every other size is under 0.25%, all well
inside the repo's 1% convergence threshold — indistinguishable from
run-to-run noise. Confirms, on the RDMA path, the same finding this
codebase already made on ex1's TCP path: the ramp-up cost the warmup
round would remove is negligible relative to the timed window at every
size in the sweep.
