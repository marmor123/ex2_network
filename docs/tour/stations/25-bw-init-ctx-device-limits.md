# `bw_init_ctx` (2): the device and its advertised limits

- type: function
- tags: setup
- lines: 563-582
- skip: no

The device handle — and the run's first negotiation: what the device advertises it can hold clamps what the run asks for.

**What.** `ibv_open_device`; `ibv_query_device` into `dev_attr`; then `max_send_wr = window + QP_SLACK` and `max_recv_wr = CTRL_POOL_DEPTH`, both clamped to `dev_attr.max_qp_wr`.

**How.** The send request is the **window depth (W)** plus `QP_SLACK` — the slack absorbs the last K-WR list's overshoot of the window *and* the per-size done SEND, so neither can find the SQ full (station 7's invariant: `K ≤ QP_SLACK`). The receive request is the **control receive pool**'s 32. The clamp: if the request exceeds the device's per-QP WQE ceiling, the device's number wins.

**Why.** mlx4 — the course hardware — caps the WQEs a QP may hold, and a declaration above `max_qp_wr` fails QP creation outright. The clamp makes the run work on shallow queues instead of dying on them — and the device-clamped corner is exactly why the **refill**'s second loop condition exists (station 36): when the SQ is device-shallow, the refill reclaims early rather than waiting for a full window.

> ⚠ `window` is a CLI option, so `max_send_wr` varies per run — but the clamp means the *effective* depth may be far below what the run asked for. Station 28's read-back records what actually got created; the data path reasons about that, never about the request.

**Cross-links:** `bw_init_ctx`, `QP_SLACK`, `CTRL_POOL_DEPTH`, `bw_refill`
