# `main` (6): the handshake dispatch and the client's QP connect

- type: function
- tags: main
- lines: 1278-1298
- skip: no

The role's exchange: the client sends its beats over TCP, the server advertises its buffer — the WRITEs land there — and then the *client* connects its QP, using the path MTU the port reports.

**What.** If client: `rem_dest = bw_exch_dest_client(servername, port, &my_dest)`. If server: fill `my_dest.buf_addr = ctx->buf` and `my_dest.rkey = ctx->mr->rkey`, then `rem_dest = bw_exch_dest_server(ctx, ib_port, ctx->portinfo.active_mtu, port, &my_dest, gidx)`. Then, client only: `bw_connect_qp(ctx, ib_port, my_dest.psn, ctx->portinfo.active_mtu, rem_dest, gidx)`.

**How.** The server's extra two fields are the run's one-directional memory contract: `buf_addr`/`rkey` advertise the registered buffer so the client's RDMA WRITEs have a target (the grant from station 26). The client sends no such fields — `bw_dest`'s server-only members stay zero on its side (station 12). `active_mtu` threads through both sides: the path MTU comes from the port's active MTU, so large messages use the largest packets the link allows.

**Why.** The asymmetry is the same one everywhere in this run: the client is the only writer, so only the server's memory is advertised. And the QP connect happens *after* the exchange for the client — it needs the server's `qpn`/`psn` from the beats to fill the RTR attributes (stations 16/17) — while the server's own connect already happened mid-exchange at station 22. The MTU flows from the port, not a constant, because the QP must be created with the MTU the fabric will actually carry: `active_mtu` is the link's negotiated value, and a QP advertising a larger MTU than the port supports would fail to modify or silently under-perform.

**Cross-links:** `main`, `bw_exch_dest_client`, `bw_exch_dest_server`, `bw_connect_qp`, `bw_dest`, `ctx->mr->rkey`, `active_mtu`
