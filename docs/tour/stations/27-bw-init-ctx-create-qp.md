# `bw_init_ctx` (4): creating the QP

- type: function
- tags: setup
- lines: 613-647
- skip: no

The QP is born through a step-down loop: declare the largest **max_inline_data** the run might want, and walk the declaration down until creation succeeds.

**What.** A `for` loop from `try_inline = MAX_INLINE_DATA_DECLARE` down by 64: build the init attributes and call `ibv_create_qp`; break when the QP exists or `try_inline <= 0`.

**How.** The attributes: `send_cq`/`recv_cq` = the CQ, `max_send_wr`/`max_recv_wr` from station 25, one SGE each way, `max_inline_data` = `try_inline`, and `qp_type = IBV_QPT_RC` — reliable connection. The step: 1024, then 960, …, down to 0.

**Why.** mlx4 rejects QP creation when the declared `max_inline_data` (plus WQE overhead) exceeds what its WQEs can carry, and no portable query exposes that ceiling on every stack — so the code negotiates by trying. The declaration is a *request*; the loop finds the largest one the hardware accepts.

> **Predict** — Why step the declaration down instead of not declaring it at all?
> **Reveal** — Declaring 0 would forfeit inline sends for every control message — and the run's control path depends on them: the 8-byte **control message** is always ≤ the negotiated `max_inline_data`, so it always rides **inline** (station 31). The step-down keeps the control path inline wherever the hardware allows, and station 28's read-back records what actually got created.

**Why.** `IBV_QPT_RC` is not a default: the reliable-connection service class is what gives the run its in-order, retransmitting transport — the property the **completion barrier** rests on (station 34). A datagram or unreliable QP would break the run's accounting model.

> ⚠ The loop is bounded only by the `try_inline <= 0` guard — 0 is the last attempt. If even that fails, `ctx->qp` stays NULL and the error line prints the final `try_inline`, `max_send_wr`, and `max_recv_wr` — the numbers that failed — with `strerror(errno)` from the failed create.

**Cross-links:** `bw_init_ctx`, `MAX_INLINE_DATA_DECLARE`, `bw_post_ctrl_send`, `bw_post_writes`
