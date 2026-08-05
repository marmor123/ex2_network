# Data-path pipeline: deep window, batch signaling, refill-never-empty

The data path uses a window of `W=256` outstanding RDMA WRITEs, signaled every `K=64` (one CQE per batch, completion accounting exact because RC completions are in-order), posted K WRs per `ibv_post_send` call as a linked list, and a refill discipline: poll only the CQEs that are ready, then immediately repost — the SQ never drains to zero and the NIC never idles. The template's `pp_wait_completions` pattern (post a window, wait for all of it, repost) was rejected: it empties the queue for roughly an RTT every window and re-pays the ramp-up dip each time.

All data WRITEs — inline or SGE — reference a single 1 MB buffer that is registered once and never modified after init, so there is no buffer-reuse hazard at full window depth and no buffer cycling.

Messages ≤ `max_inline_data` are sent with `IBV_SEND_INLINE`; larger ones use the registered buffer. The declaration is made at QP creation and the created value read back via `ibv_query_qp` — that read-back is the runtime `max_inline_data` the data path uses. mlx4 rejects QP creation when the declared value (plus WQE overhead) exceeds what the hardware accepts and no portable query exposes that ceiling on every stack, so the declaration is stepped down (1024 → 0) until creation succeeds; `max_send_wr`/`max_recv_wr` are likewise clamped to the device-advertised `max_qp_wr`. (Deviation from the original "queried via `ibv_query_device`" wording: `ibv_device_attr.max_inline_data` no longer exists on modern rdma-core, and the declare-then-read-back mechanism works identically on the course nodes' old OFED and the WSL compile gate.)

Kept tunable at runtime (`-r` window, `-k` signal interval) to adapt to measured hardware behavior.
