# `MAX_INLINE_DATA_DECLARE`

- type: constant
- tags: data-path
- lines: 150-158
- skip: no

The largest **max_inline_data** the program will *try* to declare at QP creation — the first touch of the **inline** mechanism.

**What.** `MAX_INLINE_DATA_DECLARE` = 1024 bytes: the initial declaration value tried when the QP is created. The comment above it explains the whole dance in one paragraph.

**How.** mlx4 — the course hardware — rejects QP creation when the declared `max_inline_data` exceeds what its WQEs can carry, and no portable query exposes that ceiling on every stack. So the declaration is stepped down (1024 → 0 in 64-byte steps, at `bw_init_ctx`) until creation succeeds. The value the QP was actually created with is then read back via `ibv_query_qp` — that read-back is the runtime `max_inline_data` the data path uses.

**Why.** Declaring the largest legal value lets every small message ride the WQE **inline** — the payload travels inside the work request instead of being DMA-read from a buffer — and the read-back is what keeps the data path honest: it never assumes the declaration succeeded.

> ⚠ 1024 is a ceiling tried, not a promise. The runtime value comes from the read-back at station 28, and the inline decision (`size ≤ max_inline_data`) at the post loop uses that value, never this constant.

**Cross-links:** `bw_init_ctx`, `ibv_query_qp`, `bw_post_writes`, `IBV_SEND_INLINE`
