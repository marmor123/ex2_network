# `bw_connect_qp` (1): the RTR attributes

- type: function
- tags: handshake, setup
- lines: 286-327
- skip: no

The first half of the QP state machine's second step: everything the local QP must know about the remote before it will accept a single packet. This is the **RTR** — *ready to receive* — transition.

**What.** Build the RTR attribute struct and make one `ibv_modify_qp` call with an explicit mask. The fields: `dest_qpn` = the remote's QP number, `rq_psn` = the remote's starting PSN, `max_dest_rd_atomic` = 1, `min_rnr_timer` = 12, `path_mtu` = the port's MTU, and the address-handle attributes (`dlid`, `sl` 0, `src_path_bits` 0, `port_num`).

:::table
| Field | Holds |
|---|---|
| `dest_qpn` | the remote QP's number — the HCA matches it against incoming packets |
| `rq_psn` | the remote's starting PSN — the order the remote's packets must start from |
| `max_dest_rd_atomic` | 1 — how many outstanding RDMA reads/atomics the remote may direct at us |
| `min_rnr_timer` | 12 — the RNR backoff encoding (~655 ns × 2¹² ≈ 2.68 ms) |
| `path_mtu` | the port's active MTU, passed from `main` |
| `ah_attr` | how to reach the remote: LID + port (or GRH, see below) |
:::

**How.** `is_global` starts 0 (LID-based addressing — the course fabric's normal mode). The GRH conditional flips it: if the remote advertised a nonzero GID **and** we have a GID index of our own, the handle becomes global — `hop_limit` 1, the remote's `dgid`, and our `sgid_index`. Then the modify applies the mask listing exactly the changed fields.

**Why.** RTR records the peer's QP identity so the HCA recognizes and orders the packets that will soon arrive. The mask is the Verbs idiom: each state transition lists the attributes it touches — the driver applies only those. The GRH conditional is the graceful-degradation rule: a remote GID with no local index (`-g` on one side only) drops to LID addressing instead of failing RTR on `sgid_index = -1`.

> ⚠ The QP state machine is one of the tour's beacons — you will meet it again in station 17 (RTS) and station 29 (INIT). Every QP the run creates travels INIT → RTR → RTS; this station and the next are one transition pair split into two stations.

**Cross-links:** `bw_connect_qp`, `bw_exch_dest_server`, `struct bw_dest`, `bw_init_ctx`
