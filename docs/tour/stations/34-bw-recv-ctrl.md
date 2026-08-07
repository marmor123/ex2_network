# Receiving and verifying: `bw_recv_ctrl`

- type: function
- tags: control
- lines: 810-838
- skip: no

The control receive: wait for the next **control message** on the pre-posted **control receive pool**, stamp the client's clock stop, and verify the message — the fixed tag and the expected **sequence counter**.

**What.** `bw_poll_until(ctx, BW_RECV_WRID, pass, &wc)`; if a `t_stamp` is given, take `CLOCK_MONOTONIC` at the completion; then read the message out of the shared `ctx->ctrl_buf` and check `msg.tag == BW_CTRL_TAG` and `msg.seq == seq`, failing with a named error otherwise.

**How.** The receive WRs of the pool are never reposted — every control message lands in the same 64-byte area, so the message is read from where it arrived, not from a per-call buffer. The `pass` mask is handed straight through to `bw_poll_until`: the client passes its data and done-send completions while waiting for the ack, the server passes none while waiting for the done. The stamp happens at the completion, before verification — the client's t1 is the moment the ack's receive completed, the clock stop per ADR-0003.

**Why.** Verification is the desynchronization detector: the tag proves the message is a control message and not data, and the **sequence counter** proves it is the message *for this size* — the ack echoing the done's `seq`. A mismatch means the two sides' size sweeps have drifted apart, which the per-size protocol makes nearly impossible and this check makes loud. And on the client, the ack's arrival is the **completion barrier**: since the done SEND preceded the ack on the same QP, RC in-order delivery means every WRITE of the timed batch has landed in the server's buffer before the clock stops — the measured window is complete, not just sent.

**Cross-links:** `bw_recv_ctrl`, `bw_poll_until`, `bw_post_control_recvs`, `BW_CTRL_TAG`, `BW_RECV_WRID`, `bw_data_state`, `bw_client_bench`
