# `bw_init_ctx` (1): the context object and the buffers

- type: function
- tags: setup
- lines: 537-562
- skip: no

Where every resource the run owns is born: the zeroed context, the 1 MB buffer with its role-distinguishing fill, and the 64-byte control area.

**What.** `calloc` the `struct bw_context`; `buf = malloc(roundup(BUFFER_SIZE, page_size))`; fill it with `0x7b + is_server`; `ctrl_buf = malloc(CTRL_MSG_LEN)`.

**How.** `roundup` to the page size so the registered region (station 26) covers whole pages. The fill byte is `0x7b` — `'{'` — on the client, `0x7c` — `'|'` — on the server, one more on the server because `is_server` is 1 there and 0 on the client.

**Why.** The buffer is filled exactly once, at init, and never modified again (station 4's invariant, ADR-0002) — safe only because every WRITE's payload is DMA-read from this one static region. The fill makes that immutability *visible*: a buffer that never changed still shows its maker's mark.

> **Predict** — Why a different fill byte per role?
> **Reveal** — So the two sides' buffers are distinguishable. If server memory shows `0x7c` in a hex dump, those bytes were never overwritten by the client's WRITEs — the fill is a marker, and a per-role marker tells you *which side's buffer* you are looking at. It is a debugging affordance, not a protocol.

> ⚠ `roundup` sizes the allocation, it does not align it — `malloc` already returns an aligned pointer; the rounding just guarantees a whole number of pages is registered. And until station 26 registers them, both regions are anonymous host memory the HCA cannot touch.

**Cross-links:** `bw_init_ctx`, `struct bw_context`, `bw_close_ctx`, `BUFFER_SIZE`, `CTRL_MSG_LEN`
