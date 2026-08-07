# The server's handshake (4): our address, the rkey, and the ready beat

- type: function
- tags: handshake
- lines: 504-536
- skip: no

The exchange's last beats: the server's six-field message — carrying the buffer address and key the client's RDMA WRITEs land in — and the ready beat the template left unchecked.

**What.** Build the `DEST_FMT_SERVER` message (lid/qpn/psn/gid + `buf_addr` + `rkey`), `bw_write_full` it, then `bw_read_full` the client's `"ready"` (6 bytes, NUL included) into a scoped buffer.

**How.** `my_dest->buf_addr` and `rkey` were filled in `main` from the context's registration (station 26). The ready read sizes its buffer with `sizeof "ready"` — the beat is the six bytes including the NUL. The read's return is checked; the template's wasn't.

**Why.** The keys are the whole point of the message: an RDMA WRITE carries the destination's `buf_addr` and `rkey` in its work request, and the server's HCA validates them (station 12). Without them the client has no valid target for its WRITEs. The ready beat closes the exchange: the client has confirmed receipt, so the server can drop the connection — and a client that died mid-exchange is caught here instead of in the run.

> ⚠ The template left this read unchecked — the code comment flags it: *"The template leaves this read unchecked"*. A client that vanished after its address message would otherwise let the server proceed into a run whose first control message can never arrive. The fix is the check, and the comment that explains the check.

**Cross-links:** `bw_exch_dest_server`, `bw_write_full`, `bw_read_full`, `bw_parse_dest`, `DEST_FMT_SERVER`, `struct bw_dest`
