# GID conversions: `wire_gid_to_gid` / `gid_to_wire_gid`

- type: function
- tags: handshake
- lines: 212-232
- skip: no

The **handshake**'s GID as text: 32 hex characters on the wire, 16 raw bytes in memory — two tiny functions convert between the two, four 32-bit lanes at a time.

**What.** `wire_gid_to_gid` parses a 32-hex-char string into a `union ibv_gid`; `gid_to_wire_gid` does the reverse. Both work in four lanes of eight hex characters.

**How.** One lane per iteration: `tmp[9]` holds eight chars plus the forced NUL at `tmp[8]`, `sscanf(tmp, "%x", &v32)` parses them as one 32-bit value, and `ntohl(v32)` lands in `gid->raw[i * 4]`. The reverse: `sprintf(&wgid[i * 8], "%08x", htonl(...))` of the lane read from `gid->raw + i * 4`.

**Why.** The wire form is network-order hex text; the in-memory `union ibv_gid` is host-order bytes. `htonl`/`ntohl` convert per 32-bit lane, and because both directions apply the same lane mapping, the round trip is exact. The `tmp[9]` trick makes the parse safe: eight hex digits fill a `uint32_t` exactly, and the ninth byte guarantees the string is terminated for `sscanf`.

> ⚠ The `*(uint32_t *)(&gid->raw[i * 4])` cast type-puns the byte array — a strict-aliasing letter-of-the-law concern that rdma-core itself lives with, harmless on the course's x86/ARM. The lane mapping keeps each 32-bit unit aligned with the wire's octets: byte order is `ntohl`/`htonl`'s job, never the cast's.

**Cross-links:** `bw_parse_dest`, `bw_exch_dest_client`, `bw_exch_dest_server`, `DEST_FMT`
