# The counts tables: `MSG_COUNTS` and `WARMUP_COUNTS`

- type: constant
- tags: measurement
- lines: 106-121
- skip: no

The **counts table**, verbatim from ex1: how many WRITEs each size of the sweep needs for a stable measurement — and the **warmup batch** in isolation, the concept before the mechanism at station 41.

**What.** Two 21-entry arrays indexed by the size exponent: `MSG_COUNTS[i]` is the size 2ⁱ **timed batch**; `WARMUP_COUNTS[i]` is the **warmup batch** sent ahead of it.

:::table
| Size | `MSG_COUNTS[i]` | `WARMUP_COUNTS[i]` |
|---|---|---|
| 1 B (2⁰) | 1,310,720 | 16 |
| 32 B (2⁵) | 20,480 | 4 |
| 1 KB (2¹⁰) | 20,480 | 4 |
| 1 MB (2²⁰) | 80 | 4 |
:::

**How.** `MSG_COUNTS` is ex1's convergence numbers, verbatim: each count makes its batch long enough that variance between doubled counts is under 1%, but short enough that a full 21-size sweep fits in lab time. It is a converged table, not a formula — the row comments keep the size mapping visible at a glance.

**Why.** One entry per size of the **size sweep**, and the two tables must index together: each size's timed batch and warmup batch ride the same windowed stream. The 1 B entry (1,310,720) dwarfs every other count because a 1 B WRITE's cost is dominated by the wire-bound round trip of the message itself — it takes over a million of them to accumulate a stable number.

> ⚠ The **warmup batch** counts are 4–32, all below the default **window depth (W)** = 256. Whether that fills the pipe before the clock starts is the letter-vs-intent question taught at station 41.

**Cross-links:** `WARMUP_COUNTS`, `SWEEP_SIZES`, `CTRL_POOL_DEPTH`, `bw_client_bench`, `bw_print_result`
