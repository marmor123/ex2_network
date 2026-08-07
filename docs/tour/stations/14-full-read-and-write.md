# Full-read and full-write: `bw_read_full` / `bw_write_full`

- type: function
- tags: handshake
- lines: 233-260
- skip: no

TCP is a byte stream: a single `read` or `write` may move fewer bytes than asked. These two loops move exactly `len` bytes or fail — the fixed-size **handshake** messages could not be parsed otherwise.

**What.** `bw_read_full` and `bw_write_full` loop until `len` bytes have moved or the stream ends. Each returns 1 on completion, 0 on a short stream or error.

**How.** A `got` accumulator; each iteration moves the remainder — `read(fd, buf + got, len - got)` / `write(fd, buf + sent, len - sent)` — and adds the count. `n <= 0` — end of stream or error — returns 0 immediately.

**Why.** The **handshake** messages are fixed 128 bytes (`DEST_MSG_LEN`); a short read would hand the parser a truncated message and break the exchange. The 0 return is the only failure signal — the callers print their own diagnostics, so the two functions stay dumb loops.

> ⚠ A 0 from `read` is end-of-stream, a negative is an error — both abort the loop with the same return. The caller's message is what distinguishes "peer closed" from "peer vanished" at the human level.

**Cross-links:** `bw_exch_dest_client`, `bw_exch_dest_server`, `DEST_MSG_LEN`
