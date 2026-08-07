# `bw_init_ctx` (6): INIT

- type: function
- tags: setup
- lines: 662-683
- skip: no

The QP's first state: port association and the access flags — what the peer may do to our memory.

**What.** The attributes: `qp_state = IBV_QPS_INIT`, `pkey_index` 0, `port_num` = the port, `qp_access_flags = IBV_ACCESS_REMOTE_READ | IBV_ACCESS_REMOTE_WRITE`; one `ibv_modify_qp` with the mask `STATE | PKEY_INDEX | PORT | ACCESS_FLAGS`.

**How.** INIT binds the QP to its port and its partition (pkey 0 = the default partition), and declares the remote access rights its memory will honor. The mask lists exactly the fields this transition may change.

**Why.** The QP state machine (the beacon of stations 16/17) demands the sequence: every QP travels INIT → RTR → RTS before traffic. INIT is the state where the QP declares its identity and its permissions; the access flags are a capability grant — what a *remote* QP may do to *our* memory. The run exercises exactly one of them: the client's WRITEs into the server's buffer (station 26's REMOTE_WRITE). `REMOTE_READ` is declared but never exercised by this run — the flags declare what the peer may do, not what it does.

> ⚠ The flags face *outward*: they describe the peer's rights over this QP's memory, not this side's rights over the peer's. The counterpart grant lives at the other end — the client's WRITEs are legal precisely because the server's registration and QP both said so.

**Cross-links:** `bw_init_ctx`, `bw_connect_qp`, `bw_exch_dest_server`
