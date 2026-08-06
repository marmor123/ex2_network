# The DMA regime's shape: 2 KB ramp, 1 MB dip, pair gap (issue #13)

Research ticket #13. Three unexplained shapes in the measured envelope (ADR-0006/0007):
the 2 KB ramp point, the 1 MB dip, and the 38 vs 42.5 Gbps pair gap. All facts below
are traced to the primary sources: `bw.c` (the counts table, the window, the timed/
warmup structure, the clock), ADR-0003/0004/0005/0006/0007 (the measured numbers),
the assignment (hardware), and the ConnectX-3 / FDR specifications (link facts).

**Summary.** The 1 MB dip and the entire 32 KB → 1 MB decline are *quantitatively
explained* (to 0.1%) by pure counts-table arithmetic: the warmup batch's wire time is
inside the measured window, so the reported rate is `R × timed/(timed + warmup)` —
80/84 at 1 MB. The 2 KB ramp is a per-message processing floor of the mlx4 DMA path
(~490–500 ns/message, pair-invariant): at 2 KB the wire time (~385–430 ns) is shorter
than the floor, so the HCA is the bound; from 4 KB the wire time hides it. The pair
gap is the host interface: FDR can carry ~54 Gbps (ADR-0004's "~6.3 GB/s"), far above
both 38.28 and 42.57, and the two pairs' machines differ in effective DMA read
bandwidth — the exact cause (slot generation, CPU, BIOS, firmware) is not recorded
anywhere in the repo and needs the user's on-node probes.

---

## Preliminaries: what the measured window actually contains

The clock starts immediately before the first timed post and stops at the ack-receive
completion (ADR-0003; `bw.c:1004–1019`). The warmup batch is posted right before t0
(`bw.c:1000–1002`), but with `WARMUP_COUNTS[1 MB] = 4` the pipe holds **four** WRITEs
when the clock starts — not `W = 256`. Those four warmup WRITEs are still being
transmitted after t0 (a 1 MB WRITE takes ~197 µs on the wire; the gap between the
warmup post and t0 is a few µs), so their wire time is *inside* the measured window:

```
elapsed ≈ (timed + warmup) × wire_time(size) + ack RTT
reported_rate = R × timed / (timed + warmup),   R = the pair's true flat DMA rate
```

This is the "80-WR stream" of ADR-0007: 80 timed + 4 warmup = 84 WRs total.

## Anomaly 2 — the 1 MB dip: explained, it is warmup-in-the-window arithmetic

**Mechanism.** `MSG_COUNTS[1 MB] = 80`, `WARMUP_COUNTS[1 MB] = 4` (`bw.c:111–121`).
The 4 warmup WRITEs' wire time (~0.79 ms) is counted in the elapsed, so the 1 MB point
reports `R × 80/84 = 95.2%` of the flat rate. The formula predicts **every** DMA size
32 KB–1 MB on the final pair to within 0.05%, and the 64 KB/1 MB points on the dev
pair to within 0.03%, with a single per-pair R:

| size | timed (n) | n/(n+4) | R·n/(n+4), R=42.57 | ADR-0007 mean | Δ |
|---|---|---|---|---|---|
| 32 KB | 2560 | 0.99844 | 42.50 | 42.50 | 0.00 |
| 64 KB | 640 | 0.99379 | 42.31 | 42.30 | −0.01 |
| 128 KB | 320 | 0.98765 | 42.04 | 42.04 | 0.00 |
| 256 KB | 160 | 0.97561 | 41.53 | 41.53 | 0.00 |
| 512 KB | 160 | 0.97561 | 41.53 | 41.55 | +0.02 |
| 1 MB | 80 | 0.95238 | 40.54 | 40.57 | +0.03 |

Dev pair with R_dev = 38.28: 64 KB predicted 38.04 vs measured 38.03; 1 MB predicted
36.46 vs 36.47. The ADR-0007 text says 1 MB sits "~1.8 Gbps below the 64 KB rate" —
the formula gives exactly 42.57·(640/644 − 80/84) = **1.76 Gbps**.

**Fingerprints that confirm the mechanism** (each independently diagnostic):

- The whole 32 KB → 1 MB monotone decline is one formula, no free parameters per
  size: 4/84 = 4.8% penalty at 1 MB, 4/164 = 2.4% at 256/512 KB, 4/324 = 1.2% at
  128 KB, 4/644 = 0.6% at 64 KB.
- 256 KB and 512 KB have *different* sizes but the *same* count (160), so the formula
  says equal rates — measured 41.53 vs 41.55. A wire-rate or per-byte mechanism
  cannot produce that.
- The dip reproduces identically on both pairs (dev: 36.47 = 38.28·80/84 vs 64 KB
  38.03 = 38.28·640/644) — it is counts-table arithmetic applied to each pair's own R,
  so pair-independent by construction.
- The same formula also fits the message-rate regime (1 B: 1310720/1310736 →
  6.1199M msg/s vs measured 6.12M) and the inline plateau — the warmup residual is
  negligible there because the wire time per message is tiny.

**Ruled out** (candidate mechanisms the data excludes):

- *The pipeline can never saturate (window never fills).* True as structure — the
  stream is 84 < W = 256, so the refill condition `outstanding >= window`
  (`bw.c:868–888`) never fires during the 1 MB data path and the batch is posted in
  three lists, then waited on — but it does not *cost* anything: 84 WQEs sit in the SQ
  and each takes ~190 µs to transmit, so the SQ never empties and the steady-state
  rate is R. Moreover 256 KB and 512 KB also never fill the window (164 < 256) yet
  sit at the formula's value — the window-fill structure is inert, not causal.
- *Ramp-up/tail (head) dominates.* The head is the warmup wire time (~0.79 ms at
  1 MB), which **is** the mechanism — but as *counted warmup bytes*, not as a
  pipeline-refill cost. The tail (ack RTT ~10 µs, ADR-0003) is 75× too small.
- *Per-message HCA cost at 1 MB.* Not needed: with the warmup inside the window, the
  1 MB per-message time is exactly `R`-consistent; the "excess" that appears when the
  warmup is ignored is an artifact of the comparison.
- *Signal/refill pressure.* Only 2 data CQEs exist in the 1 MB batch (t = 64 and the
  final WR, `bw.c:918–920`), and the W/K A/B does not move the point (ADR-0007:
  40.567 vs 40.59/40.65/40.53).

**What's uncertain.** Nothing about the shape: the formula fits every measured point
on both pairs within 0.1%. Residuals of ±0.03 Gbps are at the CV level (0.18%,
ADR-0007) plus the ack RTT inside the noise. The per-pair R itself is a measured
constant (42.56–42.60 across 32 KB–1 MB on the final pair; ~38.27–38.29 on the dev
pair) — R's *cause* is anomaly 3.

**Viva note.** The warmup's stated purpose — "the pipe is full when the clock starts"
(CONTEXT.md, warmup batch) — is unachievable at DMA sizes with ack-stopped timing:
the warmup WRITEs are always transmitted after t0 (their wire time ≫ the µs gap), so
a larger warmup would *add* to the elapsed, not hide it. The 4-message warmup is
ex1-inherited (the counts table is "ex1's converged counts table, verbatim",
`bw.c:107–110`) and costs 1 MB 4.8% of its reported rate. Setting the warmup to 0 at
large sizes (a measurement fix, not a throughput fix) would report 1 MB at ~42.6.

## Anomaly 1 — the 2 KB ramp: a ~500 ns per-message floor of the DMA path

**Mechanism.** 2 KB is the first size above `max_inline_data` (1024 B, read back at
QP creation; the inline decision is `size <= ctx->max_inline_data`, `bw.c:906–907`),
so it is fully DMA. The mlx4 DMA path processes each message with a fixed per-message
cost of ~490–500 ns (hypothesis: WQE fetch + payload-read setup over PCIe, pipelined
by the HCA). The per-message wire time at the flat rate is 385 ns (final pair) /
429 ns (dev pair) — *shorter than the floor*. So the HCA's per-message processing is
the bound at 2 KB: 2048 B × 8 / 501 ns = 32.67 Gbps (final), 33.53 (dev). From 4 KB
up the wire time (≥ 771 ns) exceeds the floor and the interface rate R is the bound.

**Evidence.**

- Same count, same window structure as 4 KB (both 20480 timed + 4 warmup, 321 lists,
  identical K=64 signal schedule) — yet 4 KB sits on the flat line (42.36) and 2 KB
  does not (32.67). The mechanism is therefore per-message, not per-batch, not
  window/refill, not CQE pressure.
- The per-message time at 2 KB is *pair-invariant in absolute time*: 501.5 ns
  (final) vs 488.6 ns (dev) — 2.6% apart — while the flat rates R differ by 11%
  (42.57 vs 38.28). A rate-proportional cause would scale the 2 KB excess by the same
  11%; it doesn't. That is the fingerprint of a fixed per-message cost, and it fixes
  the crossover size at R·floor/8 ≈ 2.4–2.6 KB — between 2 KB and 4 KB on *both*
  pairs, which is why exactly one sweep point (2 KB) is transitional on both.
- The point predates the streaming pipeline: the T4 naive path measured the same
  value ("identical to T4 to three digits (33.5–38.2)", ADR-0005), so the floor is
  not the client's post loop (T4 posted one WQE per doorbell — if the client were the
  cost, T4's 2 KB would be far worse, and the T5 K-batched doorbells would have fixed
  it as they fixed ≤ 64 B, ADR-0005).
- T4/T5/T6 on both pairs: same shape, ~33 Gbps at 2 KB — 23% below the final pair's
  model value, 12% below the dev pair's.

**Ruled out.** Counts (same as 4 KB), window/refill structure (identical to 4 KB),
client post loop (T4 = T5), CQEs (320 at 2 KB — trivial), inline path (2048 > 1024 —
fully DMA), link packetization: at MTU 4096 a 2 KB message is one half-full packet
and a 4 KB message one full packet — the ~23% deficit is far beyond the ~1% framing
difference, and at MTU 2048 both are full packets (identical framing).

**What's uncertain.** The floor's *source* is inferred, not documented: the data
supports "a fixed per-message cost of the mlx4 DMA data path, ~490–500 ns" but cannot
distinguish WQE-fetch latency from firmware per-WQE processing, and the exact value
is fitted from two points (one per pair). The intermediate-size prediction — 1.5 KB
should sit at ~500 ns/message (~24.5 Gbps), 3 KB at ~565 ns/message (~41.9 Gbps) —
is the falsifiable test.

**Update (2026-08-06, ticket 18 probes, dev pair) — count-independence falsified.**
The bonus prediction "2 KB stays ~32.7, the floor is count-independent" failed: with
`-n 640` (640 timed + 4 warmup) the 2 KB point reads **36.44 Gbps** — on the
wire+ack model (predicted 36.71, −0.7%) — and with `-n 80` it reads **29.23 Gbps**
(also on the wire+ack curve: predicted 28.52). Only the default count 20480 carries
the excess: 60.5 ns/message over wire (33.53). Per-message excess over wire time:
~61 ns @ 20480, ~19 ns @ 640 (≈ the ack RTT share, ~15.5 ns — i.e. none), ~0 @ 80.
The excess is therefore a **long-stream effect, not a per-message floor**: it appears
only at count 20480. (T4 = T5 = T6 at 2 KB all ran the default 20480 count — the
"T4 naive path also shows it" evidence is consistent with this: the common factor
was the count, not the post loop.) The intermediate-size probe (1536/2560/3072/
3584 B) is now a measurement-campaign item (issue #19), and the floor's replacement
mechanism (CQE/refill interaction, PCIe read depth at stream length) is open.

## Anomaly 3 — 38 Gbps (dev pair) vs 42.5 Gbps (final pair): the host interface

**Mechanism.** The DMA flat rate R is the HCA's effective payload-read bandwidth from
host memory over PCIe — the host interface — and it is machine-dependent. Both pairs
run the same HCA family (ConnectX-3, assignment.md) on FDR links that can carry far
more than either R, so the link is not the cap on either pair; the difference is the
host platform (PCIe slot generation/lanes negotiation, CPU/memory subsystem, BIOS,
firmware).

**Is FDR (56 Gbps) plausible as the 42.5 Gbps cap? No.** FDR is 14.0625 Gb/s per
lane × 4; with 64b/66b encoding that is ~54.5 Gbps of data, and after the per-packet
IB framing (LRH 8 + BTH 12 + RETH 16 + ICRC 4 + VCRC 2 ≈ 42 B, at MTU 4096) the
payload capacity is ~54 Gbps ≈ 6.7 GB/s — consistent with ADR-0004's own "the FDR
link could carry ~6.3 GB/s" (50.4 Gbps). Measured R_final = 42.57 Gbps is 78–79% of
that. The gap to 56 Gbps decomposes as: ~3% FDR encoding (known, spec), ~1% packet
framing (known, spec), and the remaining ~21% *not a known overhead* — it is the
host interface, proven machine- and software-invariant: no W/K parameter set moves R
(ADR-0005 A/B; ADR-0006/0007 A/B) while the two pairs differ by 11%.

**What differs between the machines.** Not recorded anywhere in the repo (no lspci,
firmware, CPU, or BIOS data exists). The ConnectX-3 datasheet bounds the space: the
card is PCIe 3.0 x8 (8 GT/s, auto-negotiating to Gen2/Gen1 and x8/x4/x2/x1). Because
the dev pair measured 38.2 Gbps — above Gen2 x8's 32 Gbps ceiling — its link cannot
be Gen2 x8; both pairs are most plausibly Gen3 x8, with the dev pair's effective DMA
read efficiency ~61% of Gen3 x8's ~63 Gbps vs the final pair's ~68%. Plausible
causes of an 11% read-bandwidth difference between otherwise similar Gen3 x8 setups:
CPU/memory controller generation (the final pair's post loop is 1.1% slower at
6.12M vs 6.19M msg/s — ADR-0007 — so the CPUs differ), BIOS PCIe settings (ASPM,
MaxPayload), or HCA firmware. Each is checkable only on the nodes (checklist below).

**Supporting split.** The envelope separates cleanly into machine-invariant and
machine-dependent parts, which corroborates the host-interface story: the inline copy
plateau (853 MB/s → 5.84/6.29/6.55 Gbps, identical to three digits on both pairs,
ADR-0006/0007) and the 2 KB per-message floor (~490–500 ns) are HCA-internal and
pair-invariant; only the DMA flat rate R differs (38.28 vs 42.57) — exactly the
component that crosses the host interface.

## User-mediated experiment checklist (confirm/refute; do not run remotely yourself)

1. **Anomaly 2 — count vs size (no code change; two runs, final pair).**
   - `./client -n 640 mlxstud03` (server on mlxstud03): read line 21 (1 MB). Warmup
     model predicts ~42.3 (R·640/644); a size-driven mechanism predicts ~40.6.
   - `./client -n 80 mlxstud03`: read line 17 (64 KB). Warmup model predicts ~40.5
     (R·80/84); a size-driven mechanism predicts ~42.3.
   - Bonus: in both runs the 2 KB line moves to counts 640/80 — the per-message floor
     model predicts 2 KB stays ~32.7 (floor is count-independent).
2. **Anomaly 1 — floor vs batch cost (no code change; one run, final pair).**
   - `./client -n 2560 mlxstud03`: 2 KB with 8 KB's count. Floor model: per-message
     time unchanged → still ~32.7; fixed-batch-cost model: → ~42.4.
   - Stronger, needs a scratch build: add sizes 1536 / 2560 / 3072 / 3584 B to a copy
     of `bw.c` (sizes are `1 << seq` in `bw_client_bench`). Floor model predicts
     ~24.5 Gbps at 1.5 KB, ~41.9 at 3 KB, full rate at 4 KB — a sharp transition; a
     gradual ramp predicts intermediate values.
3. **Anomaly 3 — machine facts (one SSH session per pair; read-only).**
   - `lspci | grep -i mellanox` then `lspci -vvv -s <bdf>`: LnkCap/LnkSta (negotiated
     generation and lanes), MaxPayload. Prediction: both pairs Gen3 x8 (Gen2 x8 is
     ruled out by 38.2 > 32 Gbps).
   - `ibstat` (or `ibv_devinfo`): port rate (56 Gb/s = FDR), active MTU, firmware
     version — MTU also tests the packetization corner of anomaly 1.
   - `lscpu | grep "Model name"` and, if present, `mstflint -d mlx4_0 q` for HCA
     firmware/PSID.

## Sources

- `bw.c` — counts table (`MSG_COUNTS`/`WARMUP_COUNTS`, lines 111–121), inline
  decision (906–907), window/refill (868–888), warmup-before-t0 and clock
  start/stop (1000–1019), `-n` count override (1109).
- ADR-0003 (clock until the ack; ~10 µs control round trip), ADR-0004 (envelope;
  853 MB/s inline copy; "FDR link could carry ~6.3 GB/s"), ADR-0005 (T4 = T5 at
  2 KB; A/B proves the bus is the bound), ADR-0006 (dev-pair campaign; 33.53 /
  38.03 / 36.47), ADR-0007 (final campaign envelope; "80-WR stream"; 1.8 Gbps gap;
  W/K A/B invariance).
- assignment.md (both pairs: Mellanox ConnectX-3, 56 Gb).
- Mellanox ConnectX-3 VPI datasheet — PCIe 3.0 x8 (8 GT/s) host interface, FDR
  56 Gb/s, MTU 256–4K, auto-negotiation (e.g. `PB_ConnectX3_VPI_Card_Dell.pdf`).
- NVIDIA/Mellanox hardware user manuals — FDR: 14.0625 Gb/s per lane, 64b/66b,
  56.25 Gb/s per 4X port (net ~54.5 Gb/s after encoding).
