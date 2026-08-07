# The server's handshake (2): listen and accept

- type: function
- tags: handshake
- lines: 472-484
- skip: no

The one-connection door: `listen` with a backlog of one, then the blocking `accept` where the client arrives. Small, but the whole server-side rendezvous in three lines.

**What.** `listen(sockfd, 1)`; `connfd = accept(sockfd, NULL, 0)`; close the listening socket; bail if `connfd` is negative.

**How.** The backlog of 1 declares the run's shape — one client at a time, one slot in the listen queue. `accept` blocks until the client's connection attempt completes and returns the connected socket; the listening socket is closed immediately, only the connection survives.

**Why.** Everything the server needs to know about the remote arrives later in the address message (station 22) — TCP's own peer info is irrelevant, so `accept(NULL, 0)` discards it. The listening socket's only job was the rendezvous.

> ⚠ If the client never arrives, the server blocks here forever — no timeout. The run's deadline discipline is entirely on the RDMA side (station 33); a missing client is a manual kill or the verify script's own timeout.

**Cross-links:** `bw_exch_dest_server`, `bw_connect_qp`
