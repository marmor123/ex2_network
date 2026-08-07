# The streaming writes (2): building and posting each K-WR list

- type: function
- tags: data-path
- lines: 916-949
- skip: no

The heart of the stream: each K-WR linked list built, addressed into the server's buffer, and posted with one `ibv_post_send` — the signal schedule choosing exactly which WRs generate completions.

**What.** For `i` in `0..chunk-1`: `t = st->posted + i + 1` — this WR's position in the size's stream; `signal = (t % k == 0) || (final && n == chunk && i == chunk - 1)`. Build the SGE (always `ctx->buf`, `size`, `mr->lkey`) and the WR (`BW_DATA_WRID`, `IBV_WR_RDMA_WRITE`, `remote_addr = dest->buf_addr`, `rkey = dest->rkey`), chaining `next` through the list. One `ibv_post_send(ctx->qp, &wrs[0], &bad_wr)`; then `posted += chunk`, `outstanding += chunk`.

**How.** Every WR in the list targets the same server address — the remote side's registered buffer, whose address and key arrived in the **handshake** (station 23) — so the SGEs differ only in their link slot. The signal schedule is the accounting contract: the K-th WR of the stream (`t % k == 0`) and the stream's final WR are signaled; mid-stream lists yield exactly one CQE per K WRs, while the warmup residual and the final remainder are caught by the `final && last` clause — exactly one extra CQE for the final list's tail. The K-deep `wrs`/`sges` arrays are the caller's, reused for every list of the sweep.

**Why.** Signaling is where measurement meets the **poll loop**: every signaled WR produces a CQE, every CQE the refill consumes reclaims exactly K outstanding WRs (in-order RC), and the **signal interval (K)** — not the list size — is the unit of accounting. Signal too few and the refill's arithmetic loses the stream; signal every WR and the completion storm throttles the pipe. The `ibv_post_send` here is one of the tour's beacons — the stereotypical Verbs plan: create QP → post WR → poll CQ (stations 16/17, 26, 32/33).

> **Predict** — Which WRs of the stream get signaled?
> **Reveal** — The K-th WR of the size's stream (positions K, 2K, 3K, …) and the stream's final WR. The K-ths give the refill its K-exact completions; the final one is the safety net for whatever the last list's remainder leaves unsignaled — without it, the tail of the timed batch would never complete, and the ack wait would stall waiting for a CQE that never arrives.

**Cross-links:** `bw_post_writes`, `bw_refill`, `bw_data_state`, `bw_client_bench`, `BW_DATA_WRID`, `dest->buf_addr`, `dest->rkey`, `IBV_SEND_SIGNALED`
