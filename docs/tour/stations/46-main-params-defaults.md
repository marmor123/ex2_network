# `main` (1): the run's parameters and their defaults

- type: function
- tags: main
- lines: 1113-1130
- skip: no

The entry point, read early and comprehensively: the run's whole parameter surface — port, device, window, signal interval, count, gid index — with its defaults, and the random seed that names the QP's PSN.

**What.** Declarations and defaults: `port = 18515`, `ib_port = 1`, `window = WINDOW_DEFAULT` (256), `k = SIGNAL_INTERVAL_DEFAULT` (64), `count_override = 0` (no `-n`), `gidx = -1` (LID-based addressing); then `srand48(getpid() * time(NULL))`.

**How.** Every default is either a named constant or an explicit literal — `18515` matching `usage`'s text, `-1` meaning "no gid index" (the branch at station 50). `srand48` seeds the libc PRNG once, at startup, from the pid and the time: `lrand48` draws the random PSN later (station 50), so each run's QP numbers are effectively unique — a stale PSN from a previous run would desynchronize the handshake.

**Why.** These are the run's knobs in one place, the values station 48's switch will overwrite. The research's main-first rule is why the tour reads this early: W and K are defined in isolation at station 7 (JIT from these defaults), and every later station's arithmetic assumes the values declared here — the window, the signal interval, the gid mode. The seed, meanwhile, is the quiet correctness story: the PSN is the peer's window into our QP, and it must be unpredictable enough that two consecutive runs never collide.

**Cross-links:** `main`, `usage`, `srand48`, `lrand48`, `WINDOW_DEFAULT`, `SIGNAL_INTERVAL_DEFAULT`, `bw_dest`
