# `struct bw_dest`

- type: struct
- tags: handshake, types
- lines: 201-211
- skip: no

The decoded **handshake**: everything one side needs to reach the other's QP and memory — a four-field address, and the server's two memory keys.

**What.** The remote's address — `lid`, `qpn`, `psn`, `gid` — plus, server-side only, `buf_addr` and `rkey`, the registered buffer's address and key.

:::table
| Field | Meaning |
|---|---|
| `int lid` | the remote's LID |
| `int qpn` | the remote's QP number |
| `int psn` | the remote's starting packet sequence number |
| `union ibv_gid gid` | the remote's GID (16 bytes; all-zero in LID mode) |
| `uint64_t buf_addr` | server only: the registered buffer's address |
| `uint32_t rkey` | server only: the buffer registration's key |
:::

**How.** Both directions carry the four address fields; the memory keys are the server's to give. The server fills them in its handshake beat, the client reads them into its own copy — and on the client's copy they stay zero.

**Why.** The two keys are what make the one-sided transfer possible: an RDMA WRITE carries the destination's `buf_addr` and `rkey` in the work request, and the server's HCA validates them. Nothing more is needed — the client never touches server memory beyond what these keys allow.

> ⚠ The client's copy is still typed `struct bw_dest`, but the zeros are a statement, not an address: the server never touches client memory — the client is the only writer in the run — so reading `buf_addr` off the client's copy is a bug, not "anywhere".

**Cross-links:** `DEST_FMT`, `bw_parse_dest`, `bw_exch_dest_client`, `bw_exch_dest_server`, `bw_post_writes`
