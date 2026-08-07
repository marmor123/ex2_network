# The handshake wire format

- type: constant
- tags: handshake
- lines: 159-168
- skip: no

The **handshake**'s message shape, kept in one place so the send and parse sides cannot drift — and one number, 128, that makes the exchange deterministic.

**What.** `DEST_MSG_LEN` (128 bytes, fixed both directions) and three format strings built from one base: `DEST_FMT`, `DEST_FMT_SERVER`, `DEST_FMT_PARSE`.

:::table
| Format | Carries | Used by |
|---|---|---|
| `DEST_FMT` | `lid:qpn:psn:gid` | the client's address message |
| `DEST_FMT_SERVER` | `DEST_FMT` + `:buf_addr:rkey` | the server's address message |
| `DEST_FMT_PARSE` | the same six fields, bounded | both sides' parse |
:::

**How.** The three strings are one definition: `DEST_FMT_SERVER` is `DEST_FMT` with two fields appended, and `DEST_FMT_PARSE` reads the same shape — `%04x:%06x:%06x` for lid/qpn/psn, the GID as exactly 32 hex characters (`%32[0-9a-fA-F]`), then the 64-bit buffer address (`PRIx64`/`SCNx64`) and the rkey in hex. The client's message carries only the first four fields; addr/rkey are the server's to give.

**Why.** One definition site means send and parse cannot drift — a field added to the format lands on both sides. And the fixed 128-byte length is what lets the exchange use full-read/full-write: both sides know exactly how many bytes to move, no framing needed.

> ⚠ The send side prints the GID with `%s`; the parse side reads it with `%32[0-9a-fA-F]`. The asymmetry is deliberate: the bounded scan cannot overrun, and it accepts exactly what the wire carries — 32 hex characters.

**Cross-links:** `bw_parse_dest`, `bw_exch_dest_client`, `bw_exch_dest_server`, `wire_gid_to_gid`, `bw_read_full`
