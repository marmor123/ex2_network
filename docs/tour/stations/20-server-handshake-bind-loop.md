# The server's handshake (1): getaddrinfo and the bind loop

- type: function
- tags: handshake
- lines: 425-471
- skip: no

The server's mirror of the client's resolve — `AI_PASSIVE`, `SO_REUSEADDR`, and the bind loop: where the passive side makes its port its own.

**What.** `getaddrinfo(NULL, service, AI_PASSIVE | AF_INET | SOCK_STREAM)`; a loop of `socket` + `setsockopt(SO_REUSEADDR)` + `bind` until one address binds; the port is now *ours*, not yet listening.

**How.** `AI_PASSIVE` yields wildcard addresses, bindable on any interface. Each attempt sets `SO_REUSEADDR` before `bind`; a failed bind closes the socket and tries the next address. The list and the service string are freed before the failure check.

**Why.** The bind loop mirrors the client's connect loop (station 18): `getaddrinfo` may return several bindable addresses, the first that binds wins. `SO_REUSEADDR` is the restart story: without it, a crashed server's lingering `TIME_WAIT` socket would block a quick restart on the same port — the verify script restarts servers often.

> ⚠ The failure message says "Couldn't listen to port %d", but the loop that failed is the *bind* — the `listen` is the next station's first act. The wording predates the split; the check itself (no address bound → NULL) is the important part.

**Cross-links:** `bw_exch_dest_server`, `bw_exch_dest_client`
