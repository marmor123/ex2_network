# The wait with a deadline: `bw_poll_until`

- type: function
- tags: control
- lines: 768-809
- skip: no

The second half of the **poll loop**: poll one CQE at a time, route it by wr_id, consume what may pass, stop at the completion waited for — and never spin past a 10-second deadline.

**What.** Loop: `ibv_poll_cq(ctx->cq, 1, wc)`. On a completion, classify with `bw_wc_bad(wc, pass | (1ull << want))`; if the wr_id is `want`, return 0, else continue. If the poll returns 0, check `CLOCK_MONOTONIC` against a deadline set 10 seconds out and fail if passed. Poll error → fail.

**How.** The `pass | (1ull << want)` mask is the site's contract: `want` is the one completion waited for, `pass` is the set that may be consumed and ignored on the way — the client passes its done-send and data completions through while waiting for the ack. Any other wr_id fails the `bw_wc_bad` gate: a protocol error, because nothing else may complete during a control wait. The deadline is what makes a hung peer fail fast instead of busy-polling forever.

**Why.** This is the shared CQ's discipline — one completion at a time, `poll CQ` returns immediately whether or not anything is there, so "nothing" is not an error, only a reason to check the clock. The deadline beats a busy poll: if the peer dies mid-run, the loop would otherwise spin on an empty CQ forever, indistinguishable from a slow stream. `CTRL_POLL_TIMEOUT_SEC` (10 s) outlasts the slowest legitimate size — a full 1 MB timed batch at 40 Gbps is a couple of milliseconds.

**Cross-links:** `bw_poll_until`, `bw_wc_bad`, `bw_recv_ctrl`, `bw_refill`, `CTRL_POLL_TIMEOUT_SEC`, `CLOCK_MONOTONIC`, `BW_RECV_WRID`
