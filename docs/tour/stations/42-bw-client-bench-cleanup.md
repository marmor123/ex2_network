# `bw_client_bench` (3): the result line and the cleanup

- type: function
- tags: measurement
- lines: 1017-1028
- skip: no

The size's throughput number, printed; and the run's end — the success flag, the frees, the return.

**What.** `elapsed = (t1.tv_sec - t0.tv_sec) + (t1.tv_nsec - t0.tv_nsec) / 1e9`; `bw_print_result(size, count, elapsed)`; loop ends; `rc = 0`; `out:` frees `sges` and `wrs`, returns `rc`.

**How.** The nsec borrow is the one subtlety: `tv_nsec` is the full nanoseconds value (0..1e9), not a fraction — so the whole seconds are added as `double` and the nanoseconds divided by `1e9`. No manual borrow needed; the arithmetic is exact enough for the printed precision. `rc` starts 1 (failure) and only the completed sweep flips it to 0 — any `goto out` before that reports failure. The two frees are the arrays from station 40; the context, QP, and MRs are torn down by the caller in `main`.

**Why.** The print call is the size's whole output contract: **print_result** (station 39) renders `size`, the computed bps, and the unit — auto-scaled, nothing else, because `verify.sh` enforces the ex1-identical line. And `rc` is the run's exit semantics: a partial sweep must not report success, because the caller's exit code is what a scripted run judges.

**Cross-links:** `bw_client_bench`, `bw_print_result`, `bw_post_writes`, `bw_recv_ctrl`, `main`
