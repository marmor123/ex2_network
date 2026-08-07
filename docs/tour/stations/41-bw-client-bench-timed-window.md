# `bw_client_bench` (2): the timed window — warmup, clock, timed batch, done, ack

- type: function
- tags: measurement, data-path
- lines: 991-1016
- skip: no

The per-size run, and the whole mechanism frame: the **warmup batch** rides the windowed stream ahead of the **timed batch**, the clock starts at the first timed post, and stops at the **ack**-receive completion — then the next size begins.

**What.** For each size of the sweep (`seq` 0..20): `size = 1 << seq`, `count = count_override ?: MSG_COUNTS[seq]`; post `WARMUP_COUNTS[seq]` WRITEs (not final); `clock_gettime` → t0; post `count` WRITEs (final); send the **done** control message; `bw_recv_ctrl` for the ack, stamping t1.

:::diagram
<svg viewBox="0 0 640 220" role="img" aria-label="The per-size timed window: warmup WRITEs ride the stream, the clock starts at the first timed post (t0) and stops at the ack receive (t1), the done closing the timed batch.">
  <defs>
    <marker id="arr41" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
  </defs>
  <rect x="30" y="24" width="130" height="30" rx="6" fill="#0d1b2e" stroke="#38bdf8"/>
  <text x="95" y="44" font-size="12" fill="#e0f2fe" text-anchor="middle">client</text>
  <rect x="480" y="24" width="130" height="30" rx="6" fill="#0d1b2e" stroke="#38bdf8"/>
  <text x="545" y="44" font-size="12" fill="#e0f2fe" text-anchor="middle">server</text>

  <rect x="40" y="84" width="560" height="16" rx="3" fill="#0d1b2e" stroke="#2dd4bf"/>
  <rect x="40" y="84" width="100" height="16" rx="3" fill="#134e4a" stroke="#2dd4bf"/>
  <text x="90" y="78" font-size="11" fill="#5eead4" text-anchor="middle">warmup</text>
  <text x="330" y="78" font-size="11" fill="#e0f2fe" text-anchor="middle">timed batch — the measured window</text>
  <text x="330" y="120" font-size="10" fill="#93c5fd" text-anchor="middle">the windowed stream: W-deep, refill-never-empty (station 36)</text>

  <line x1="140" y1="64" x2="140" y2="150" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="3 3"/>
  <text x="140" y="170" font-size="11" fill="#fbbf24" text-anchor="middle">t0 — clock starts</text>
  <line x1="600" y1="64" x2="600" y2="150" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="3 3"/>
  <text x="600" y="170" font-size="11" fill="#fbbf24" text-anchor="middle">t1 — ack received</text>

  <line x1="560" y1="100" x2="500" y2="54" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr41)"/>
  <text x="532" y="60" font-size="11" fill="#7dd3fc" text-anchor="middle">done</text>
  <line x1="500" y1="54" x2="570" y2="100" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr41)"/>
  <text x="560" y="60" font-size="11" fill="#7dd3fc" text-anchor="middle">ack</text>
</svg>
<figcaption>One size's timed window (ADR-0003): the warmup batch rides the stream ahead, the clock starts at the first timed post and stops when the ack's receive completes — the elapsed time defines the size's throughput.</figcaption>
:::

**How.** The per-size order is the protocol: warmup first (not final — its WRs must not disturb the signal schedule's tail), then the clock, then the timed batch (final — its last WR carries the stream's closing signal), then the done SEND, then the ack wait. The `pass` mask of the ack wait is `done | data`: all the size's own completions are consumed on the way. `st` is zeroed fresh per size — the ack wait consumes the residual completions without touching it, so the state must not survive into the next size.

**Why.** The **counts table** (station 5) and the **control message** (station 6) meet here: `MSG_COUNTS[seq]` sizes the timed batch, `WARMUP_COUNTS[seq]` the warmup, and the done/ack carry `seq` as the **sequence counter** the server echoes back. The clock is the measurement's heart: it spans exactly the timed batch's transmission plus its completion, and the ack's arrival is the **completion barrier** that closes the window on the far side — every timed WRITE is in server memory before t1.

> **Predict** — The comments — this function's, and the file header's — say the **warmup batch** fills the pipe so the clock starts with the pipe full. The warmup count for this size is **16 WRs**. The window is **W = 256**. When the clock starts, how full is the pipe?
>
> **Reveal** — It is not full. 16 of 256 slots: the pipe is 6% full at t0. The **timed batch** then ramps to depth W over the first ~40 µs of the measured window — under 1% of even the shortest batch (~2–3 ms at 32 B). The measured records say it is invisible: ADR-0006/0007 show each size doubling "within a hair of 2.0" at CV ≤ 0.40%.
>
> **So there are two true statements.** CONTEXT.md states the *intent* — "pipelined with it so the pipe is full when the clock starts" — and the code delivers the *letter*: a ~40 µs ramp-in inside the measured window. The measurement is unaffected. If you ever see these comments and the counts disagree, this is the gap: the comments describe the design's purpose, the counts are the code's actual arithmetic.

**Cross-links:** `bw_client_bench`, `bw_post_writes`, `bw_post_ctrl_send`, `bw_recv_ctrl`, `bw_data_state`, `WARMUP_COUNTS`, `MSG_COUNTS`, `BW_SEND_DONE_WRID`
