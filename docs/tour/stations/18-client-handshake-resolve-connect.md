# The client's handshake (1): resolve and connect

- type: function
- tags: handshake
- lines: 348-392
- skip: no

The active side of the **handshake**: resolve the server's name, open the TCP connection, and — the part worth predicting — fail silently when nothing is listening.

**What.** `getaddrinfo` with `AF_INET`/`SOCK_STREAM` hints; a loop over the returned address list: `socket` + `connect` until one succeeds; then clean up the list and the service string.

**How.** The service string is built with `asprintf`; a resolution failure prints `gai_strerror` and returns NULL. The connect loop tries each address in turn, closing failed sockets, leaving `sockfd` at −1 if every address failed. `freeaddrinfo` and `free(service)` run before the failure checks.

**Why.** The loop exists because one name can resolve to several addresses — try them all, take the first that connects. And the silent failure is a deliberate contract, spelled out in the code: *"No server listening: fail silently — exit non-zero with nothing printed (T1 acceptance criterion)"* — the verify script starts client and server independently, so a client that cannot connect must not confuse the transcript.

> **Predict** — The client runs against a port no server is listening on. What does it print?
> **Reveal** — Nothing. `bw_exch_dest_client` returns NULL without a word, and `main` turns that into `exit 1` with an empty transcript (station 51). The silence *is* the T1 acceptance criterion: when the verify script pairs the client with no server, only the exit status may say it failed.

> ⚠ The connect loop opens at most one socket at a time: a failed attempt is closed before the next is tried, and `sockfd` — not the list — is what survives. The resource the loop guards is the single open connection the beats of station 19 will use.

**Cross-links:** `bw_exch_dest_client`, `main`, `bw_read_full`, `bw_write_full`
