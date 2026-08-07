# The wr_id taxonomy

- type: constant
- tags: control, data-path
- lines: 169-184
- skip: no

Four work-request ids — the **poll loop**'s routing table: every completion in the run is classified by the wr_id it carries back.

**What.** An enum of four ids: `BW_RECV_WRID` (1), `BW_SEND_DONE_WRID` (2), `BW_SEND_ACK_WRID` (3), `BW_DATA_WRID` (4) — and the reason each exists.

:::table
| wr_id | Posted by | Signaled? | Why it has its own id |
|---|---|---|---|
| `BW_RECV_WRID` | all 32 **control receive pool** receives | — | they share one control area; which receive completed never matters |
| `BW_SEND_DONE_WRID` | the client's done SEND | always | the done's arrival is the size's endpoint on the server |
| `BW_SEND_ACK_WRID` | the server's ack SEND | always | the server must consume its own completion before exiting |
| `BW_DATA_WRID` | every data WRITE | every K-th | one shared id keeps data completions distinguishable from control |
:::

**How.** The wr_id is attached at post time and returned in the completion. All 32 receives share one id because they all point at the same control area — when the CQ reports a receive completed, which of the 32 it was is irrelevant. The two SENDs are always signaled: the done so the server's control wait ends, the ack so the server's own send completion is consumed before teardown. All data WRITEs share the fourth id, so their completions are distinguishable from control at a glance.

**Why.** The **poll loop** routes by wr_id: when a completion arrives, its id says whether the run is waiting on it, should pass over it, or has desynchronized. The taxonomy is the protocol's class system — a completion's id *is* its meaning.

> ⚠ The values are labels, not wire data: `BW_RECV_WRID` is pinned to 1 explicitly and the rest follow. Any new id must be distinct from all four, or the poll loop misroutes — renumbering is safe, aliasing is not.

**Cross-links:** `bw_post_control_recvs`, `bw_post_ctrl_send`, `bw_wc_bad`, `bw_poll_until`, `bw_recv_ctrl`
