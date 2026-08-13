# Benchmark scripts

Orchestrators that SSH into the course pair (mlx-stud-02 as client,
mlx-stud-01 as server, via a `~/.ssh/config` `ProxyJump` through the
department bastion) and drive `bw`'s client 10x per size to average out
run-to-run noise. Used to produce the measured tables in
[`docs/research/perf-experiments.md`](../docs/research/perf-experiments.md).

Run from outside this repo (they `ssh` in and `cd` to it remotely), e.g.
`./scripts/run_bw_avg.sh` from wherever `~/.ssh/config` is set up.

## `run_bw_avg.sh`

Still useful today: builds and runs `./client` 10x against a peer,
prints the per-size average Gbps table. No dependency on anything
removed from `bw.c`.

```
./run_bw_avg.sh [peer_host] [n_runs]
```

## `sweep_warmup.sh`, `sweep_benchcount.sh`, `sweep_wk.sh`

**Historical — will not run against the current `bw.c`.** Each drove a
convergence/comparison sweep over a temporary env-var override
(`BW_WARMUP_COUNTS`, `BW_BENCH_COUNTS`, `BW_WINDOW`/`BW_SIGNAL_INTERVAL`
respectively) that has since been baked into fixed values
(`WARMUP_COUNTS`, `MSG_COUNTS`, `WINDOW`/`SIGNAL_INTERVAL`) and removed
from the source, per `docs/research/perf-experiments.md`'s "bake in and
delete the temporary mechanism" pattern used throughout that log.

Kept for reference — the sweep methodology (per-size convergence
testing, confound-controlling the W/K result against run-order drift by
reversing the level order) is reusable for future experiments even
though these specific scripts need the matching env-var read added back
to `bw.c` before they'd run again.
