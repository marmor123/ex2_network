# The streaming writes (1): the stream's frame

- type: function
- tags: data-path
- lines: 889-915
- skip: no

The frame of the streaming WRITE loop: the per-message inline decision, the K-WR chunking, and the **refill** gate that must pass before any list is built.

**What.** `bw_post_writes(ctx, dest, size, n, window, k, wrs, sges, st, final)` posts `n` RDMA WRITEs of `size` bytes into the server's registered buffer. The frame: compute `inline_flag` once — `size <= ctx->max_inline_data` picks `IBV_SEND_INLINE`; then loop while `n > 0`, each pass taking a `chunk = n < k ? n : k`, gated by `bw_refill(ctx, window, k, st)`.

**How.** The inline decision is per *size*, not per WR — every message of the batch is the same size, so the flag is computed once, outside the loop. The chunk is the **signal interval (K)** (or the remainder on the last list): the stream is chopped into K-WR linked lists, each posted by one `ibv_post_send`. The refill gate sits at the top of each pass so the window can never be exceeded by construction: before a single WR of the new list is built, the window has room for the whole list.

**Why.** The frame separates the two rhythms that compose the stream: the *bounded* writer (the windowed refill discipline of station 36) and the *unbounded* stream (the caller's `n` WRs, spanning **warmup batch** and **timed batch** across two calls). The inline flag is also the run's performance fork — CONTEXT.md's **Inline** entry: messages at or below `max_inline_data` ride the inline path, larger ones DMA from the registered buffer. `final` marks the call that posts the stream's last list (the timed one) — the station that needs the extra signal on its last WR.

**Cross-links:** `bw_post_writes`, `bw_refill`, `bw_data_state`, `max_inline_data`, `IBV_SEND_INLINE`, `BW_DATA_WRID`, `bw_client_bench`
