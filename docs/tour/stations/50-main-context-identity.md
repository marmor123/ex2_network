# `main` (5): context, the receive pool, and the local identity

- type: function
- tags: main
- lines: 1245-1277
- skip: no

The run becomes a Verbs program: the context is built, the whole **control receive pool** is posted *before* the handshake so the RQ can never find itself empty, and the local identity — portinfo, LID, GID, QPN, PSN — is assembled into the `bw_dest` the handshake will send.

**What.** `ctx = bw_init_ctx(ib_dev, ib_port, window, !servername)` — the fourth argument is `is_server`, derived from the role; then `bw_post_control_recvs(ctx)`; then `ibv_query_port` into `ctx->portinfo`; `my_dest.lid = portinfo.lid`; the IB LID check; the gid branch (`gidx >= 0` queries, else all-zero); `my_dest.qpn = ctx->qp->qp_num`; `my_dest.psn = lrand48() & 0xffffff`.

**How.** `!servername` is the role bit: a client (servername set) passes 0, the server passes 1 — the same boolean the buffer fill byte and the remote-write grant switched on (stations 24/26). The receive pool is posted immediately after init, *before* any exchange: every receive WR is in the RQ before the first **control message** can arrive (ADR-0001). The identity fills the destination struct JIT — `struct bw_dest` (station 12) was defined in isolation at its own station; here its fields become real: LID, GID (zeroed for LID-based mode, the course fabric's normal path), the QP's number from the driver, and a random PSN drawn from `lrand48` — seeded at station 46 — masked to 24 bits.

**Why.** The order is the protocol's spine: the context must exist before the pool (the pool needs the QP), the pool before the handshake (the RQ must be armed), and the identity before the beats (the handshake sends it). The all-zero GID branch is the LID-mode detail: without `-g`, `my_dest.gid` is zeros and the QP's AH uses LID-only addressing (station 16) — the gid index `−1` default from station 46 is what selects it. And `psn & 0xffffff` is the wire format's field width: the PSN must fit the 24-bit packet header, not just be random.

**Cross-links:** `main`, `bw_init_ctx`, `bw_post_control_recvs`, `ibv_query_port`, `bw_dest`, `bw_exch_dest_client`, `lrand48`, `ibv_query_gid`
