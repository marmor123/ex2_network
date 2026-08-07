# The result line: `bw_print_result`

- type: function
- tags: measurement
- lines: 950-965
- skip: no

The output contract, byte-identical to ex1: the size, the throughput in auto-scaled units, and nothing else — the one line every measured size is reduced to.

**What.** `bps = size * count * 8.0 / elapsed`; then a four-way scale: under 1000 prints `size\t%.2f\tbps`, then Kbps, Mbps, Gbps — each dividing by the next power of 1000.

**How.** The scaling is thresholds on `bps`, not on size: the same formula for every message size, with the unit chosen by magnitude. `%.2f` keeps exactly two decimals at every scale, so the columns of a full run line up run after run. The `\t`-separated fields are the whole interface — `verify.sh` parses exactly this shape.

**Why.** This is what the entire measurement exists to produce: the elapsed time from station 41's timed window, converted to bits per second at the size's count. And it is an *ex1 contract*, not a local choice — the course's TCP exercise prints the same lines, so the two runs are comparable column by column. Anything extra here — a unit suffix, a status column, a blank line — would break the comparison and the verifier.

> ⚠ The scaling is by 1000 (Kbps, Mbps, Gbps), not 1024 — this is a throughput number, so decimal prefixes; `%.2f` would hide a misplaced factor of 1.024 entirely.

**Cross-links:** `bw_print_result`, `bw_client_bench`, `MSG_COUNTS`, `verify.sh`
