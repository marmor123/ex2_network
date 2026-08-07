# `bw_init_ctx` (5): read-back

- type: function
- tags: setup
- lines: 648-661
- skip: no

The negotiated truth: what the QP was actually created with, queried back and stored — the numbers the data path uses from here on.

**What.** `ibv_query_qp(ctx->qp, &attr, IBV_QP_CAP, &init_attr)`; then `ctx->max_inline_data = init_attr.cap.max_inline_data` and `ctx->sq_depth = init_attr.cap.max_send_wr`.

**How.** `IBV_QP_CAP` asks the driver to fill the capability fields of the *init* attributes; the two values of interest are copied into the context, where the rest of the run reads them.

**Why.** **max_inline_data** is defined here: the device-advertised inline limit, queried at runtime. The driver may have clamped the request (station 25's clamp, station 27's step-down), so the *request* is history — the read-back is the value the data path actually compares message sizes against (station 37's inline decision), and `sq_depth` is the true send-queue depth the **refill** reasons about (station 36).

> ⚠ After this point, never trust the declared constants: `MAX_INLINE_DATA_DECLARE` is a request ceiling, not a fact. If the run's inline decisions and its queue-depth arithmetic ever surprise you, check the read-backs — they are the runtime truth.

**Cross-links:** `bw_init_ctx`, `bw_post_writes`, `bw_refill`, `bw_post_ctrl_send`
