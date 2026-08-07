# The completion classifier: `bw_wc_bad`

- type: function
- tags: control
- lines: 749-767
- skip: no

The **poll loop**'s gate: one completion, judged — good status and a wr_id the caller is expecting — or a protocol error, printed the same way at every poll site.

**What.** Given one `struct ibv_wc` and a 64-bit `allowed` mask, return 0 if `wc->status == IBV_WC_SUCCESS` *and* bit `wc->wr_id` is set in `allowed`; otherwise print the reason and return 1.

**How.** The two checks are the two ways a completion can be wrong. A bad status means the WR itself failed in the HCA — the status string names it. A good status with a wr_id outside `allowed` means the completion is not one this site may consume — an unexpected send completing, or a receive arriving where none should. The `1ull << wr_id` bit idiom is the wr_id taxonomy of station 10, expressed as a set.

**Why.** Both poll sites need identical classification — the **poll loop** (station 33) and the **refill** (station 36) — and sharing it keeps their protocol-error reports from drifting. If the two sites classified independently, a bug fixed in one could linger in the other, and the error text a student sees would depend on which poll happened to catch the failure.

**Cross-links:** `bw_wc_bad`, `bw_poll_until`, `bw_refill`, `BW_DATA_WRID`, `BW_RECV_WRID`, `ibv_wc_status_str`
