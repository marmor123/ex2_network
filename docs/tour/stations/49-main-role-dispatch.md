# `main` (4): role dispatch and the device list

- type: function
- tags: main
- lines: 1204-1244
- skip: no

The one argv decides the role — a hostname makes the client, none makes the server — and the K guard that keeps the refill's done-slot promise; then the device list: `sysconf(_SC_PAGESIZE)`, and the selection by name or first found.

**What.** After getopt: `optind == argc - 1` → `servername = strdup(argv[optind])` (client); `optind < argc` (more than one leftover) → `usage` + 1; else server. Then the guard `k > window || k > QP_SLACK` → `usage` + 1. `page_size = sysconf(_SC_PAGESIZE)`; `ibv_get_device_list`; pick `*dev_list` (first device) or scan by name.

**How.** The role rule is argv's shape, not a flag: exactly one positional argument names the server; zero means "be the server" — the predict from station 2, now concrete. The K guard sits *after* the loop because it compares two parsed values: `k ≤ window` keeps the signal schedule inside the window (the refill must see a CQE before the window stalls), and `k ≤ QP_SLACK` keeps `W − 1 + K ≤ sq_depth − 1` — the done SEND always finds a free SQ slot after the last list (stations 36/41's arithmetic). The device pick is `*dev_list` — a pointer to the first entry — with the by-name scan the same loop shape as the bind loop at station 20.

**Why.** Role dispatch is the whole "one binary, two roles" story in two lines: the client and server are not separate programs, they are the same program pointed at different jobs by argv. And the K guard is the invariant the entire **windowed stream** leans on — without it, a `-k` larger than the window would deadlock the refill, and a `-k` beyond the slack would let the final list crowd the done out of the SQ.

> **Predict** — Why must K be capped at `min(window, QP_SLACK)`?
> **Reveal** — Two distinct failures, one guard. First, `k ≤ window`: the refill only reclaims when a CQE is ready, and a CQE needs a signaled WR; if K exceeds W, the first signal lands beyond the window, the window fills with no completion to reclaim, and the refill polls forever — deadlock. Second, `k ≤ QP_SLACK`: after the final list, at most `W − 1 + K` WRs are outstanding; with K ≤ QP_SLACK that is ≤ `W − 1 + QP_SLACK` = `sq_depth − 1`, so the done SEND always finds a free SQ slot. Either bound alone is insufficient — both are needed for the stream to flow and the run to finish.

**Cross-links:** `main`, `usage`, `bw_init_ctx`, `ibv_get_device_list`, `sysconf`, `QP_SLACK`, `WINDOW_DEFAULT`, `SIGNAL_INTERVAL_DEFAULT`
