# The server's handshake (3): the client's address and the mid-exchange connect

- type: function
- tags: handshake
- lines: 485-503
- skip: no

The leg's climax: the server reads the client's four fields and connects its QP *mid-exchange* — before it has sent a single word of its own address.

**What.** `bw_read_full` the client's message; `bw_parse_dest` it with `expect_addr` 0; then `bw_connect_qp` — the server's full RTR→RTS — before anything else happens.

**How.** The connect needs only the client's identity: `dest_qpn` and `rq_psn` come from the message just parsed (station 16), `sq_psn` is the server's own PSN, held in `my_dest` (station 17). Its own address — the fields it has not sent yet — plays no role in the connect.

**Why.** The placement is information-driven, and the asymmetry is the point: the client cannot connect until it holds the server's `qpn`/`psn`, which arrive only in the server's address message — so the client connects after the exchange, in `main` (station 51). The server holds everything it needs the moment the client's message lands, so it connects immediately — its QP is RTS before the exchange even finishes. Neither side can send an RDMA packet before the other's QP is RTR, so there is no race: the server's early connect is only possible because the client's data comes last.

> **Predict** — Why is the connect *inside* the exchange here, when the client's comes after it?
> **Reveal** — Because of what each side knows when. The client's connect needs the server's QP number and PSN — fields that arrive in the server's address message, so the client's connect must wait until the exchange is over. The server's connect needs only the client's QP number and PSN — present in the first message it reads — so it happens the moment that message lands. Connect when you know the peer's QP identity; the two sides' placements differ because their knowledge does.

> ⚠ A failed connect aborts the exchange: the parsed `rem_dest` is freed, NULL returned, and `main` exits 1 (station 51). The server never proceeds to send its address with an unconnected QP.

**Cross-links:** `bw_connect_qp`, `bw_parse_dest`, `bw_read_full`, `bw_exch_dest_client`, `bw_exch_dest_server`, `main`
