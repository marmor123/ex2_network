# The server's control exchange: `bw_server_ctrl_exchange`

- type: function
- tags: control
- lines: 1029-1053
- skip: no

The server's whole run: for each size, receive the **done**, verify it, send the **ack** back — and consume the ack's own send completion before ever awaiting the next done.

**What.** For `seq` 0..20: `bw_recv_ctrl(ctx, 0, seq, "Done", NULL)` — wait on the **control receive pool** for the done, verifying tag and **sequence counter**; build the ack with the same tag and `seq`; `bw_post_ctrl_send(ctx, BW_SEND_ACK_WRID, &ack)`; then `bw_poll_until(ctx, BW_SEND_ACK_WRID, 0, &wc)`.

**How.** The `pass` mask is 0 on both waits — on the server, nothing may complete during the exchange but the control message being waited for: the server posts no data WRs and has no other completions in flight. The ack is sent on the data QP with the same opcode as the done (`IBV_WR_SEND`), per the assignment. The final step is the one the naive version omits: the ack's *send* completion must be consumed before the loop's next iteration blocks on the next done.

**Why.** The consume-before-await is a liveness guarantee, not tidiness: `bw_recv_ctrl`'s wait is a poll with a deadline, and the CQ is the only queue — if the ack's send completion were left unread, the next done's receive completion would still arrive (the client's sweep continues regardless), but the CQ would carry both, and the next `bw_poll_until` would return the *ack's* completion first, misclassifying it as the next done. The comment names it exactly: it is the guarantee the ack left the HCA.

> **Predict** — Why does the server consume the ack's own send completion before waiting for the next done?
> **Reveal** — Because the CQ is in-order and shared: the ack's send completion sits ahead of the next done's receive completion, and the next `bw_poll_until` polls one CQE at a time. Left unread, the ack's completion would be the first thing the next wait sees — an unexpected wr_id that fails the classifier (station 32) and kills the run. Consuming it proves the ack reached the wire *and* keeps the CQ exactly one message ahead.

**Cross-links:** `bw_server_ctrl_exchange`, `bw_recv_ctrl`, `bw_post_ctrl_send`, `bw_poll_until`, `bw_wc_bad`, `BW_SEND_ACK_WRID`, `BW_CTRL_TAG`
