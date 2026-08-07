# The control deadline and the SQ slack

- type: constant
- tags: control, data-path
- lines: 134-149
- skip: no

Two mechanisms' constants — the control wait's deadline and the send queue's slack — and the first definitions of **window depth (W)** and **signal interval (K)**, isolated from the machinery that uses them.

**What.** `CTRL_POLL_TIMEOUT_SEC` (10 s): every control wait — the done on the server, the ack on the client, the ack-send's completion on the server — carries a deadline. `QP_SLACK` (1024): the send queue's headroom above the window. `WINDOW_DEFAULT` (256) and `SIGNAL_INTERVAL_DEFAULT` (64): the run's **window depth (W)** and **signal interval (K)**.

**How.** The SQ depth is the window plus slack: `sq_depth = W + QP_SLACK`. The slack absorbs two overshoots — the last K-WR list can leave up to `W − 1 + K` WRs outstanding (K ≤ `QP_SLACK`), and the per-size done SEND posts on top of that — so neither the final data list nor the done can ever find the SQ full.

**Why.** The deadline exists because a peer may die: a hung busy poll would tie up a course node until the verify script's own timeout fires, and 10 s beats that. The slack exists to make one invariant true: done always fits. And here, before any machinery, is where the run's two knobs — **window depth (W)** and **signal interval (K)** — get their names; the window discipline at station 36 and the signal schedule at station 38 use them.

> ⚠ These are *defaults*, not rules: main's option switch overrides them (`-r` window, `-k` signal-interval), and the guards at the role dispatch (`k ≤ window && k ≤ QP_SLACK`) keep the slack invariant true for whatever values arrive.

**Cross-links:** `bw_poll_until`, `bw_refill`, `bw_post_writes`, `bw_init_ctx`, `main`
