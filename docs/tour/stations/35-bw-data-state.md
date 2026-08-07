# `struct bw_data_state`

- type: struct
- tags: data-path, types
- lines: 839-853
- skip: no

The client's streaming accounting for one size: how many WRs the stream has posted, and how many of them are still outstanding — the two numbers every **refill** decision reads.

**What.** Two counters: `posted` counts every WR of the size's stream — **warmup batch** and **timed batch** together — so the signal schedule can find the K-th ones; `outstanding` is `posted` minus the WRs the refill has reclaimed, which is exactly K per reclaimed CQE because only K-th WRs are signaled and RC completions are in-order.

**How.** The struct lives on `bw_client_bench`'s stack, one instance per size, zeroed fresh at each size's turn. It is threaded into `bw_post_writes` and `bw_refill` by pointer; neither keeps it. The **signal interval (K)** arithmetic is the whole story: `posted` marks stream position, `outstanding` tracks the windowed pipeline, and the refill's reclaim of K per completion is what keeps the two consistent without ever draining the queue.

**Why.** Two counters, not one: the pipeline discipline needs both the stream position (to decide the signal schedule at station 38) and the in-flight count (to decide when the window is full at station 36). And it must not survive the size — the ack wait consumes the residual data and done completions *without* touching this struct, so if it lived across sizes the next run would inherit stale accounting.

> ⚠ The comment above the struct attributes the "warmup residual" to CQEs the ack wait consumes. That part is inaccurate — the warmup counts (4–32) are below K (64 by default), so the **warmup batch** generates no completions at all: no signaled WR, no CQE. The residual that the ack wait absorbs is the *timed* batch's tail: the final list's remainder and the done send's completion, which arrive after the refill's last call. The code is right; the comment over-generous.

**Cross-links:** `bw_data_state`, `bw_post_writes`, `bw_refill`, `bw_client_bench`, `BW_DATA_WRID`, `BW_SEND_DONE_WRID`
