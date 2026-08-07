# The client's handshake (2): the three address beats

- type: function
- tags: handshake
- lines: 393-424
- skip: no

Three messages over the one TCP connection — our address out, the server's address in, the ready beat to close — the exchange that makes each side's QP reachable by the other.

:::diagram
<svg viewBox="0 0 640 240" role="img" aria-label="The client's three handshake beats over one TCP connection: the client's four address fields, the server's six fields with its buffer key, then the ready beat.">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
  </defs>
  <rect x="60" y="16" width="120" height="36" rx="6" fill="#0d1b2e" stroke="#38bdf8"/>
  <text x="120" y="39" font-size="13" fill="#e0f2fe" text-anchor="middle">client</text>
  <rect x="460" y="16" width="120" height="36" rx="6" fill="#0d1b2e" stroke="#38bdf8"/>
  <text x="520" y="39" font-size="13" fill="#e0f2fe" text-anchor="middle">server</text>
  <line x1="120" y1="52" x2="120" y2="212" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4"/>
  <line x1="520" y1="52" x2="520" y2="212" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 4"/>
  <line x1="124" y1="80" x2="516" y2="80" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr)"/>
  <text x="300" y="72" font-size="11" fill="#7dd3fc" text-anchor="middle">1 · our 4 fields — lid:qpn:psn:gid (128 B)</text>
  <line x1="516" y1="124" x2="124" y2="124" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr)"/>
  <text x="300" y="116" font-size="11" fill="#7dd3fc" text-anchor="middle">2 · 6 fields + buf_addr:rkey (128 B)</text>
  <line x1="124" y1="168" x2="516" y2="168" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr)"/>
  <text x="300" y="160" font-size="11" fill="#7dd3fc" text-anchor="middle">3 · ready (6 B)</text>
  <text x="300" y="200" font-size="10" fill="#93c5fd" text-anchor="middle">one TCP connection — the run's only TCP traffic, gone before any RDMA</text>
</svg>
<figcaption>The three beats: the client's four fields, the server's six (its buffer keys included), then the ready beat the server waits on before closing.</figcaption>
:::

**What.** Send our four-field address (`DEST_FMT` with lid/qpn/psn/gid), read the server's 128-byte message, send `"ready"`, then parse the server's message with `expect_addr` 1.

**How.** `gid_to_wire_gid` renders our GID into `gid[33]`; the message is zeroed and formatted with `sprintf`; `bw_write_full` moves all 128 bytes. The server's reply is read fully into the same buffer, then `"ready"` goes out — `sizeof "ready"`, NUL included, is the beat's length. Only then is the reply parsed.

**Why.** The ready beat is the exchange's handshake-within-the-handshake: the server keeps the socket open until the client confirms receipt (station 23), so a client that closed early would never be detected. And every field of the server's message is needed before the client can connect its QP — its `qpn` and `psn` become the RTR attributes' `dest_qpn` and `rq_psn` (station 16).

> ⚠ The beat helpers are the station family this leg is built on, defined just-in-time: GID conversions (station 13), the wire format (station 9), full-read/full-write (station 14), and the parse (station 15). The beats are pure plumbing — the interesting logic lives in those four.

**Cross-links:** `bw_exch_dest_client`, `wire_gid_to_gid`, `gid_to_wire_gid`, `bw_read_full`, `bw_write_full`, `bw_parse_dest`, `DEST_FMT`
