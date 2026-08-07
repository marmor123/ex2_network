# `bw_client_bench` (1): the K-deep WR arrays

- type: function
- tags: measurement, data-path
- lines: 966-990
- skip: no

The client's whole-sweep harness — and its one up-front allocation: the K-deep WR and SGE arrays every linked list of the sweep reuses.

**What.** The function's frame: `wrs = calloc(k, sizeof *wrs)` and `sges = calloc(k, sizeof *sges)`, each **K** entries deep, one shared failure path (`goto out`) that frees both and returns 1.

**How.** The arrays are the raw material of every `bw_post_writes` list — each call rebuilds them in place, so all 21 sizes of the **size sweep** recycle the same two allocations. `calloc` zeroes them once; the "couldn't allocate" check fails the whole run, not one size.

**Why.** Allocation is a one-time, per-run cost moved out of the per-size loop: 21 sizes × 2 arrays × K entries would be the alternative, and the HCA sees the arrays' contents in flight — a fresh, re-zeroed buffer per list is also the subtle kind of bug this shape avoids. The frame also declares what the loop owns: `seq` (the **sequence counter** for this size), `rc` (the run's success bit, flipped only after the last size), and the per-size `done` message the loop will build each iteration.

**Cross-links:** `bw_client_bench`, `bw_post_writes`, `bw_data_state`, `bw_print_result`, `SIGNAL_INTERVAL_DEFAULT`, `MSG_COUNTS`
