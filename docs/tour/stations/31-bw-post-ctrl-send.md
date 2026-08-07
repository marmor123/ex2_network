# Posting a control SEND: `bw_post_ctrl_send`

- type: function
- tags: control
- lines: 710-748
- skip: no

The carrier of the run's two **control messages** — the client's **Done** and the server's **Ack** — always signaled, and riding **inline** whenever the QP's `max_inline_data` allows it.

**What.** One SEND WR, `opcode = IBV_WR_SEND`, `wr_id` the caller's done or ack id, `IBV_SEND_SIGNALED` always set. If `ctx->max_inline_data >= sizeof *msg` the message rides the WQE (`IBV_SEND_INLINE`); otherwise it is staged in the registered control area and the SGE is repointed at `ctx->ctrl_buf` with `ctx->ctrl_mr->lkey`.

**How.** The two branches are the two ways an HCA obtains a message's data: **inline** copies it into the WQE at post time; the DMA path has the HCA read it from a registered buffer, which is why the fallback needs a buffer and a key. The inline branch is taken in practice — `CTRL_MSG_LEN` is 64, `max_inline_data` is read back at station 28, and no supported mlx4 value drops below 64 — but the fallback is not dead code: it is what keeps the message protocol honest if the device clamps harder.

**Why.** The done and the ack are SENDs on the data QP, so they share the wire with the WRITEs of the windowed stream — which is exactly the **completion barrier** property the ack wait relies on (station 34). And it is always signaled because the *sender* must see its own completion: the server cannot wait for the next done until its ack has provably left the HCA (station 43). `pass` sets in the poll sites compose with `bw_wc_bad`'s allowed mask — every signaled WR must be consumable somewhere.

**Cross-links:** `bw_post_ctrl_send`, `bw_recv_ctrl`, `bw_server_ctrl_exchange`, `bw_client_bench`, `max_inline_data`, `BW_SEND_DONE_WRID`, `BW_SEND_ACK_WRID`, `ctrl_mr`
