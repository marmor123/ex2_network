# Teardown: `bw_close_ctx`

- type: function
- tags: closing
- lines: 1054-1092
- skip: no

The run's end in reverse: QP → CQ → MRs → PD → device, then the frees — the mirror image of `bw_init_ctx`, in the order Verbs requires.

**What.** Destroy the QP, destroy the CQ, deregister the control MR, deregister the data MR, deallocate the PD, close the device — each checked, each failing the whole teardown on error — then `free` the control buffer, the data buffer, and the context itself. Returns 0 when every step succeeded.

**How.** The order is the lifecycle's inverse and each step is a separate call so failures are named (`"Couldn't destroy QP"` vs `"Couldn't deallocate PD"`). The QP goes first because nothing may still be posting; the CQ goes while its completions are spent; the MRs go while their buffers are still mapped; the PD outlives them because both MRs belong to it; the device closes last, once nothing references it.

**Why.** Teardown is where the run proves it is finished *completely*: every WR of the sweep has completed before this station runs — the last ack wait (station 34) is a barrier, so there is nothing left in flight when the QP is destroyed. Each `ibv_destroy_*` returning nonzero means the kernel-side object is still busy — the run exits 1 rather than leaking a half-torn state. And `free(ctx)` is the last act because every buffer and the context's own members were released first: `ctx->ctrl_buf` and `ctx->buf` are the data MRs' memory, freed after the deregistration that unmaps them.

> ⚠ The frees are *after* the deregistrations, deliberately: freeing a registered buffer first would leave the MR pointing at unmapped memory. The destroy order is not style — it is the Verbs teardown rule, and the mirror of the creation order at station 26.

**Cross-links:** `bw_close_ctx`, `bw_init_ctx`, `bw_server_ctrl_exchange`, `bw_client_bench`, `ibv_destroy_qp`, `ibv_dereg_mr`, `ibv_dealloc_pd`
