# `struct bw_context`

- type: struct
- tags: setup, types
- lines: 185-200
- skip: no

The central object: one struct holding every resource the run owns — the device handle, the protection domain, the registrations, the CQ and QP, the buffers, the negotiated limits, and the port's identity. Everything the data path and teardown touch travels in this handle.

**What.** Eleven fields in four groups: the resource chain, the buffers, the negotiated values, and the port's attributes.

:::table
| Field | Holds |
|---|---|
| `struct ibv_context *context` | the opened device handle |
| `struct ibv_pd *pd` | the protection domain |
| `struct ibv_mr *mr` | the registration of the 1 MB buffer |
| `struct ibv_mr *ctrl_mr` | the registration of the control receive area |
| `struct ibv_cq *cq` | the completion queue |
| `struct ibv_qp *qp` | the queue pair |
| `void *buf` | the 1 MB buffer |
| `void *ctrl_buf` | the control receive area |
| `uint32_t max_inline_data` | the QP's negotiated **max_inline_data** (read back) |
| `uint32_t sq_depth` | the QP's negotiated send-queue depth (read back) |
| `struct ibv_port_attr portinfo` | the port's attributes (LID, active MTU, …) |
:::

**How.** The construction order is the dependency order: device → PD → registrations → CQ → QP → read-backs (stations 24–28). The two `uint32_t` fields are *negotiated values*: the driver may clamp the request, so what the QP was actually created with is queried back and stored — the data path uses these, never the constants it asked for.

**Why.** The buffers carry their own registrations because each registration has its own key, and the keys alone cannot address memory without the pointers. One handle for everything means init fills it in one place, the data path reads it in another, and teardown destroys it in reverse (station 44).

> ⚠ Line 186 holds the file's one mutable global, `static int page_size`: set once at main from `sysconf(_SC_PAGESIZE)` and read by the init to round the buffer allocation up to a whole page. Everything else lives per-context — and after `bw_close_ctx`, the pointers in this struct are dangling; teardown reads them only while they are valid.

**Cross-links:** `bw_init_ctx`, `bw_close_ctx`, `bw_post_writes`, `main`
