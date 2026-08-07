# `bw_connect_qp` (2): RTS — the retry knobs

- type: function
- tags: handshake, setup
- lines: 328-347
- skip: no

The second half of the connect: **RTS** — *ready to send* — the state where traffic may flow, plus the retry knobs that decide how long the reliable transport insists on a lost packet.

**What.** Flip `qp_state` to `IBV_QPS_RTS` and set the reliability contract: `timeout` 14, `retry_cnt` 7, `rnr_retry` 7, `sq_psn` = *our* PSN, `max_rd_atomic` 1 — then a second `ibv_modify_qp` with its own mask.

:::table
| Knob | Value | Meaning |
|---|---|---|
| `timeout` | 14 | ack-wait encoding (~4.096 µs × 2¹⁴ ≈ 67 ms) — how long before retransmitting |
| `retry_cnt` | 7 | retransmissions of an unacked packet before the QP errors out |
| `rnr_retry` | 7 | retries after an RNR (*receiver not ready*) response |
| `sq_psn` | `my_psn` | our starting PSN — the peer's RQ orders our packets from it |
| `max_rd_atomic` | 1 | outstanding RDMA reads/atomics we may direct at the peer |
:::

**How.** The second modify reuses the same `attr` struct, changes the fields, and applies the second mask (`STATE | TIMEOUT | RETRY_CNT | RNR_RETRY | SQ_PSN | MAX_QP_RD_ATOMIC`).

**Why.** The whole connect is written role-neutral — the client calls both halves after the exchange, the server calls them mid-exchange (station 22) — one function, two call sites. RTS is where the run's traffic actually begins; the retry knobs are the reliability contract of the RC service the run depends on for its **completion barrier**.

> ⚠ Which PSN goes where: `sq_psn` is *ours* (outgoing), while the RTR half's `rq_psn` was the *remote's* (incoming). Swapping them is the classic connect bug — both sides' QPs would accept and reject each other's packets at once.

**Cross-links:** `bw_connect_qp`, `bw_exch_dest_client`, `bw_exch_dest_server`, `bw_recv_ctrl`
