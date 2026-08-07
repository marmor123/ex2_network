# The control receive pool: `bw_post_control_recvs`

- type: function
- tags: control
- lines: 684-709
- skip: no

The definition site of the **control receive pool**: 32 receives posted once at init, all aimed at one 64-byte area, never refreshed — the RQ that cannot run dry.

**What.** One SGE (`ctrl_buf`, `CTRL_MSG_LEN`, `ctrl_mr`'s lkey), one receive WR with `wr_id = BW_RECV_WRID`, posted `CTRL_POOL_DEPTH` times in a loop. Returns 0 when all 32 are posted, 1 if a post failed.

**How.** The same WR is posted repeatedly — the HCA consumes receives in order, and every incoming **control message** (the done on the server, the ack on the client) lands in one of them. A failed post breaks the loop; the `i == CTRL_POOL_DEPTH` check distinguishes "all posted" from "stopped early".

**Why.** **Control receive pool**: the 32 receive WRs each side posts once at init to absorb all 21 per-direction control messages; never refreshed. The sizing is the proof from station 4: a full **size sweep** produces 21 messages per direction, the pool holds 32 — it never runs out, so it never needs a refresh. And it is posted *before* the handshake (station 50), so no control message can ever find the RQ empty. One shared `wr_id` — the taxonomy of station 10: every receive points at the same area, so *which* receive completed never matters; the id says only "a control message arrived".

> ⚠ The pool is never refreshed — that is the whole design. If a control message ever found no posted receive, the RQ would drop it and the exchange would hang; the 32-deep sizing is what prevents that, and the never-refresh rule is what makes the sizing sufficient. The stack-allocated SGE and WR are safe: the driver copies the work request at post time.

**Cross-links:** `bw_post_control_recvs`, `bw_recv_ctrl`, `bw_post_ctrl_send`, `CTRL_POOL_DEPTH`, `CTRL_MSG_LEN`, `BW_RECV_WRID`, `main`
