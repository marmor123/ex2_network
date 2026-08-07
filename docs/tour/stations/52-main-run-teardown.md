# `main` (7): the run and teardown

- type: function
- tags: main
- lines: 1299-1320
- skip: no

The tour's route map: the role's run — client benchmarks, server exchanges — then teardown, the frees, and the exit code.

**What.** If client: `bw_client_bench(ctx, rem_dest, window, k, count_override)`; else: `bw_server_ctrl_exchange(ctx)`; then `bw_close_ctx(ctx)`, `free(rem_dest)`, `ibv_free_device_list(dev_list)`, and return teardown's code.

**How.** The role branch is the same `servername` test as station 49 — the client drives the sweep, the server mirrors it. Every call site's failure propagates by `return 1`. The final block runs after the sweep: the 21 result lines are already printed (station 39), teardown is the closing act (station 44), and `rem_dest`/`dev_list` are the two remaining allocations, freed in order.

**Why.** Every leg of this tour expands one call site of this station. The client's `bw_client_bench` is the whole measured run — legs 4 (stations 40–42) and the mechanism frame (station 41); the server's `bw_server_ctrl_exchange` is leg 5's mirror (station 43); `bw_close_ctx` is teardown (station 44); the parameters fed in — `window`, `k`, `count_override` — are the values parsed at station 48 and guarded at station 49. The exit code is the run's last contract: a sweep that completed prints 21 lines and exits 0; any failure along the way exits 1, which is what a scripted run judges.

**Cross-links:** `main`, `bw_client_bench`, `bw_server_ctrl_exchange`, `bw_close_ctx`, `bw_exch_dest_client`, `bw_exch_dest_server`, `ibv_free_device_list`
