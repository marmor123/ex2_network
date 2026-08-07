# The control message: tag and sequence

- type: struct
- tags: control, types
- lines: 122-133
- skip: no

The run's only non-data message: 8 bytes — a fixed tag plus the **sequence counter** — carried as a `struct` and guarded by a compile-time size check.

**What.** `struct bw_ctrl_msg`: a `uint32_t tag` and a `uint32_t seq`. The tag `BW_CTRL_TAG` is a magic integer whose hex digits spell C-T-R-L; the **sequence counter** is the size index 0..20. The `typedef` below it is a compile-time assertion.

:::diagram
<svg viewBox="0 0 640 128" role="img" aria-label="The 8-byte control message: 4 bytes of fixed tag, 4 bytes of sequence counter.">
  <rect x="140" y="34" width="160" height="56" rx="6" fill="#0d1b2e" stroke="#38bdf8"/>
  <rect x="300" y="34" width="160" height="56" rx="6" fill="#0d1b2e" stroke="#38bdf8"/>
  <text x="220" y="56" font-size="13" fill="#e0f2fe" text-anchor="middle">tag</text>
  <text x="220" y="75" font-size="11" fill="#7dd3fc" text-anchor="middle">0x4354524c — "CTRL"</text>
  <text x="380" y="56" font-size="13" fill="#e0f2fe" text-anchor="middle">seq</text>
  <text x="380" y="75" font-size="11" fill="#7dd3fc" text-anchor="middle">size index 0..20</text>
  <text x="138" y="108" font-size="10" fill="#93c5fd">offset 0</text>
  <text x="360" y="108" font-size="10" fill="#93c5fd">offset 4</text>
  <text x="140" y="24" font-size="11" fill="#cbd5e1">struct bw_ctrl_msg — exactly 8 bytes, no padding</text>
</svg>
<figcaption>Two uint32_t fields — the fixed tag and the sequence counter — exactly 8 bytes, guaranteed by the assert below.</figcaption>
:::

**How.** The done and the ack are both one of these: the server's ack carries the received done's sequence verbatim, so a tag or **sequence counter** mismatch means the exchange desynchronized — the run stops rather than measures garbage. The assertion is the classic compile-time trick: a `typedef` of a char array whose size is `1` if the struct is 8 bytes and `-1` otherwise — a negative array size is a compile error, so a change that breaks the 8-byte contract fails the build, not the run.

**Why.** The message must always fit one inline send (8 ≤ any `max_inline_data`) and one 64-byte control area (`CTRL_MSG_LEN`, station 4); the assert pins both. Two `uint32_t`s pack to exactly 8 bytes, so the check is not just safe — it is exact.

> ⚠ The tag is compared as an integer, never as text. Its hex digits spell "CTRL", but the bytes on the wire are host-ordered — that is fine, because both ends of the run are the same architecture and only equality matters.

**Cross-links:** `bw_post_ctrl_send`, `bw_recv_ctrl`, `bw_server_ctrl_exchange`, `CTRL_MSG_LEN`
