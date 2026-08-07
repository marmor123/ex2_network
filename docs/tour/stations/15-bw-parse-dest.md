# `bw_parse_dest`

- type: function
- tags: handshake
- lines: 261-285
- skip: no

The parse half of the wire format: one `sscanf` turns a **handshake** message into a `struct bw_dest` — with the `expect_addr` asymmetry that keeps a truncated server message from ever passing.

**What.** `calloc` a `struct bw_dest`; parse the message with `DEST_FMT_PARSE` into `lid`, `qpn`, `psn`, `gid`, `buf_addr`, `rkey`; require at least four fields, and all six when `expect_addr` is set.

**How.** `expect_addr` is 1 on the client (its WRITEs land in the server's buffer, so it needs the server's addr/rkey), 0 on the server (the client's message never carries them — they stay zero by `calloc`). The GID scans into `gid[33]` via the bounded `%32[0-9a-fA-F]` conversion, then `wire_gid_to_gid` converts it.

**Why.** A truncated server message must not pass with `buf_addr`/`rkey` zero — the client's RDMA WRITEs would target address 0, and the server's HCA would reject the packets. Requiring six fields on the client makes the truncated message a parse failure instead of a crash; the server needs only the client's four fields to answer.

> ⚠ `sscanf`'s return counts successful conversions, not their lengths. A GID shorter than 32 hex characters does not fail the scan — the remaining fields just shift into the wrong positions, and a count of 6 can still come back. The bounded `%32[0-9a-fA-F]` scan prevents overrun (station 9); the count check cannot detect a short GID.

**Cross-links:** `bw_exch_dest_client`, `bw_exch_dest_server`, `DEST_FMT_PARSE`, `struct bw_dest`, `wire_gid_to_gid`
