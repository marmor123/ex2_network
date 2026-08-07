# `bw_init_ctx` (3): PD, MRs, and the CQ

- type: function
- tags: setup
- lines: 583-612
- skip: no

The protection domain, the two registrations that make host memory addressable by the HCA, and the one completion queue everything completes into.

**What.** `ibv_alloc_pd`; register the buffer with `IBV_ACCESS_LOCAL_WRITE | (is_server ? IBV_ACCESS_REMOTE_WRITE : 0)`; register the control area with `IBV_ACCESS_LOCAL_WRITE`; create the CQ sized `max_send_wr + max_recv_wr`.

**How.** The registrations grant access, they don't copy: `mr` covers the 1 MB buffer, `ctrl_mr` the 64-byte control area, each carrying its own key. The CQ is one queue shared by the QP's send and receive sides — sized to the sum of both capacities, since every posted WR may complete.

**Why.** The asymmetric grant is the run's memory-safety story: the server's registration opens its buffer to the peer, the client's does not.

> **Predict** — Why does only the server's buffer get the remote-write key?
> **Reveal** — Because only the server's memory is ever written remotely. An RDMA WRITE is a request from the client's HCA to write into the *server's* buffer; the server's HCA validates that request against the access flags its registration granted — no grant, no write. The client's own buffer is never a WRITE target — it only ever reads back what it wrote itself — so it needs no remote-write grant. One key, granted to exactly the memory that must accept remote writes.

**Why.** The keys are how the run reaches across: `mr`'s `rkey` travels to the client in the handshake (station 23) and rides every data WRITE (station 38); `ctrl_mr`'s `lkey` lets the HCA write received SEND payloads into the control area. And this station is one of the tour's beacons: `ibv_reg_mr` belongs to the stereotypical Verbs plan — create QP → post WR → poll CQ — you will meet it again in any Verbs program (stations 16/17, 38, 32/33).

> ⚠ The CQ serves both directions of the QP; its depth is the *sum* of the two queue depths, because a completion is possible for every posted WR of either kind. Sizing it to one side alone would overflow the first time both sides complete in one batch.

**Cross-links:** `bw_init_ctx`, `bw_exch_dest_server`, `bw_post_writes`, `bw_post_ctrl_send`, `bw_post_control_recvs`
