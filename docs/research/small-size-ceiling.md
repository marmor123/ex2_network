# What caps the ~6.1M msg/s small-message regime (1–32 B)?

**Caveat (added later, not corrected in place):** two things below don't
hold up. (1) The mechanistic argument cites `rdma-core`'s **mlx4**
provider and states the HCA family as "ConnectX-3, `mlx4`" — but
`ibv_devinfo -v` on both course nodes reports `mlx5_0` (Connect-IB); see
`docs/research/gid-and-hca-family.md`. (2) The "invariant to the window
and the signal interval" claim in the verdict below (based on the old
K=64 default) is contradicted by this session's own W/K re-test
(`docs/research/perf-experiments.md`): W=128/K=32 shows a small,
confound-controlled, reproducible throughput edge over W=256/K=64 —
re-run twice with the test order reversed to rule out session drift, and
the win held both times. W/K are not actually invariant. The measured
message-rate numbers below are still real; the "why" and the
invariance claim are not reliable as stated.

Research ticket [#11](https://github.com/marmor123/ex2_network/issues/11) — the T4 attribution of the message-rate ceiling to "one WQE + one doorbell per `ibv_post_send`" (ADR-0004) is stale for the K=64 streaming path: the doorbell is now one per 64 WRs. This note finds what per-message work actually remains in the post loop and the completion path, and what the measured numbers imply.

**Verdict in one line**: post-batching, the ceiling is a flat ~163 ns per message (6.1M msg/s) that is invariant to the window and the signal interval and independent of payload up to 32 B — a per-message (per-WQE) rate limit, machine-constant on each course pair, with exactly two surviving candidates: the client's per-WQE post-loop work on the old stack, or the HCA's per-QP WQE-processing rate (observed through the completion path, because the refill slaves the post rate to CQE availability). The repo data rules out every per-list and per-completion cost; only a user-mediated experiment (checklist at the end) separates the two survivors.

Sources: the measured ADRs (0004/0005/0006/0007), `bw.c` (line refs inline), rdma-core's mlx4 provider (`providers/mlx4/qp.c`), the InfiniBand Architecture Specification (IBTA Vol 1), and a 2013 linux-rdma measurement on the same HCA family (Kalia, CMU).

---

## 1. The measured facts the mechanism must fit

Per-message time across the size sweep, means of 3 default sweeps on mlxstud03/04 (ADR-0007):

| size | Gbps | msg/s | per-msg |
|---|---|---|---|
| 1 B | 0.049 | 6.12M | **163.3 ns** |
| 2 B | 0.098 | 6.12M | 163.3 ns |
| 4 B | 0.196 | 6.12M | 163.3 ns |
| 8 B | 0.392 | 6.12M | 163.3 ns |
| 16 B | 0.784 | 6.12M | 163.3 ns |
| 32 B | 1.560 | 6.09M | **164.1 ns** |
| 64 B | 2.620 | 5.12M | 195.4 ns |
| 128 B | 3.577 | 3.49M | 286.3 ns |
| 256 B | 5.840 | 2.85M | 350.7 ns |
| 1 KB | 6.550 | 0.80M | 1250.7 ns |

Three facts any mechanism must explain:

1. **Flat ~163 ns/msg across 1–32 B** (163.3 → 164.1 ns, slope +0.7 ns over 31 B). The doubling-with-size property of the ADR tables is exactly "constant message rate × doubled payload", not a payload-dependent cost.
2. **Invariance to (W, K)**. The dev-pair A/B measured all six anchor sizes; at 1 B the four sets agree within 0.07%: (256,64) 49.54, (256,128) 49.505, (512,64) 49.56, (512,128) 49.57 Mbps (ADR-0006). Doubling K halves the per-list work (one `ibv_post_send` call, one doorbell, the refill's CQE rate) — nothing moves. Doubling W halves the poll pressure — nothing moves.
3. **Machine-constant, not session-constant**. Dev pair 6.1925M msg/s (161.5 ns, ADR-0005/0006, two campaigns) vs final pair 6.121M (163.3 ns, ADR-0007): within a machine < 0.1% run-to-run, across machines 1.2%. Both pairs run the same HCA family (ConnectX-3, `mlx4`; bw.c:151).

The transition into the next regime is the inline copy: 64 B already shows 195 ns, and 256 B–1 KB fits `L = size / 853 MB/s + 50 ns` exactly (ADR-0004; verified at 512 B: 651 vs 650 ns modeled). So the ~163 ns flat cost is the ceiling *below* the copy's takeover.

## 2. The stale attribution: the doorbell is amortized to noise

In the T5/T6 data path the doorbell is rung once per K-WR list, not per WR: `bw_post_writes` builds one linked list of up to K WRs per `ibv_post_send` call (bw.c:909–947), and the mlx4 provider rings the send doorbell once per `ibv_post_send` call with the whole batch's producer index (rdma-core `providers/mlx4/qp.c`: after the per-WR loop, `qp->sq.head += nreq;` then a single `mmio_write32_be(ctx->uar + MLX4_SEND_DOORBELL, qp->doorbell_qpn)`). Per message that is 1/64 of a 32-bit posted MMIO write — a couple of ns at most.

The A/B quantifies it: at 1 B, K=128 (half the doorbells, half the `ibv_post_send` calls, half the CQEs) measured 49.505 vs 49.54 Mbps for K=64 — 0.07%, i.e. at the noise floor. The per-list cost (doorbell + call overhead + refill polls) is therefore ≲ a few ns per message — a few percent of the 163 ns budget at most. ADR-0004's "one WQE + one doorbell per `ibv_post_send`" was correct for the T4 naive path (4.5M msg/s, 221 ns, where the per-WR doorbell was real); ADR-0005 already noted the post-batching ceiling was unexplained. This note answers that open question.

## 3. What per-message work remains in the post loop

For each of the K messages in a list, in the client's loop and the provider:

1. **The caller fills two arrays per message** (bw.c:922–937): `sges[i]` (3 stores: addr/length/lkey) and `wrs[i]` (~7 stores: wr_id, opcode, send_flags, sg_list, num_sge, next, remote_addr, rkey). ~10 L1-resident stores, ~10–20 cycles.
2. **The provider builds one WQE in the SQ buffer** (rdma-core `qp.c`): `get_send_wqe` computes the slot, the 16-byte control segment (`mlx4_wqe_ctrl_seg`), one 16-byte data segment (`mlx4_wqe_data_seg`: byte_count/lkey/addr), the payload, the ownership-bit write, plus the `wrid` bookkeeping array. For an inline WRITE the WQE is ctrl 16 + dseg 16 + payload: **48 B at 1 B, 64 B at 32 B** — one or two 64-B cache lines of stores.
3. **The inline payload copy**: for `IBV_SEND_INLINE` the provider `memcpy`s the payload into the WQE (≤ 32 B here, one 64-byte chunk). At the 853 MB/s rate (the ≤ 1 KB plateau, ADR-0004) a 32 B copy costs ≤ 37.5 ns — but the measured slope across 1→32 B is +0.7 ns. The copy is effectively hidden below 32 B (it becomes the dominant cost only from 64 B up, where the per-msg time leaves the flat zone: 195 ns at 64 B).
4. **Amortized per-list items**: one doorbell per 64 messages (§2); one CQE poll per 256 messages (see §4).

Client-side estimate: on the order of 25–60 ns/msg on a modern core; the course stack (old OFED-era libmlx4, older Xeon) is slower but unknown — plausibly tens of ns. Either way, the post loop's residual per-message work is *smaller than the 163 ns ceiling* in expectation — which is why the client is not obviously the metronome, and why the question survives as a binary.

## 4. The completion path — where the ceiling is *observed*

The completion path's per-message cost is negligible, and that is provable from the code: with K=64 signaling, exactly every K-th WR generates a CQE (RC completions in-order, bw.c:855–857, ADR-0002); the refill polls **one** CQE per call (bw.c:874) and, at W=256, K=64, the `outstanding >= window` condition makes it run once every 4 lists — **one CQE poll per 256 messages** (~0.3–0.6 ns/msg amortized). Halving the CQE rate (K=128) changes nothing (ADR-0006), so even the HCA's CQE-generation rate is not the limit.

But the completion path is where the ceiling becomes visible: when the window is full, `bw_refill` spins on the empty CQ (`if (ne == 0) continue;`, bw.c:880–881) until the HCA produces the next CQE. The post rate is therefore **slaved to the HCA's completion-production rate for the QP** — the client cannot post faster than the HCA processes WQEs, and the measured 6.1M msg/s is, at minimum, an upper bound on the HCA's per-QP WQE rate. The residual per-message cost "in the completion path" is then: nothing on the client (amortized 1/256), and the HCA's per-WQE processing on the device — which is the same 163 ns whatever the client's CPU is doing.

## 5. What the arithmetic rules out

- **The doorbell / per-list cost**: 1 per 64, K=128 invariance (§2). Ruled out.
- **CQE polling / CQE generation**: 1 per 256, K=128 invariance (§4). Ruled out.
- **The wire**: a 1 B RDMA WRITE packet is BTH 12 B + RETH 16 B + payload + pad + ICRC 4 B ≈ 36 B (IBTA Vol 1 packet formats; BTH = 96 bits, RETH = 128 bits, ICRC = 4 B). 6.12M × 36 B × 8 = 1.76 Gbps — ~3–4% of the ~42.5–56 Gb/s the FDR link can carry (ADR-0007 peak 42.59 Gbps). Ruled out by two orders of magnitude.
- **PCIe posting / WQE fetch bandwidth**: the HCA DMA-reads 48–64 B per WQE ≈ 0.39 GB/s against a PCIe 3.0 x8 host interface (~7.9 GB/s per direction, ADR-0004's bus-bound analysis). The CPU's SQ-buffer stores are the same volume. Ruled out by an order of magnitude.
- **The receive side**: RDMA WRITE consumes no responder RQ WQE and generates no responder completion — the responder's HCA places the payload in the registered buffer and the server CPU does zero data-path work (IBTA Vol 1, RDMA WRITE semantics: only WRITE WITH IMMEDIATE carries a receive-visible notification; bw.c server loop confirms: `bw_server_ctrl_exchange` only polls control messages, bw.c:1034–1053). Ruled out structurally.
- **Pipeline latency effects (window too shallow)**: W=512 vs 256 is identical (ADR-0006) — 42 µs of in-flight work at W=256 covers any completion latency. Ruled out.
- **The inline copy as the flat cost**: the copy's own slope is absent below 32 B (+0.7 ns over 31 B vs 37.5 ns predicted at 853 MB/s) and the copy demonstrably dominates only ≥ 64 B. Ruled out for the 1–32 B zone (it is the *next* regime's cost, matching ADR-0004/0005's plateau analysis).

## 6. The two surviving candidates — and the corroborating evidence

What remains is a **flat, size-independent per-message cost of ~163 ns, invariant to (W,K), constant per machine**:

1. **The client's per-WQE post-loop work** (array fills + provider WQE build + inline copy, §3) on the course-era CPU and old libmlx4 — a host-side per-message cost.
2. **The HCA's per-QP WQE-processing rate** — the ConnectX-3's single-QP small-message engine, ~6.1M WQEs/s ≈ 163 ns/WQE, observed through the completion-slaved loop (§4).

The repo cannot separate them: both are per-message, size-flat ≤ 32 B, and per-machine constants (the 1.2% pair gap could be either machine's CPU or its HCA; the within-pair < 0.1% stability fits both). The strongest external corroboration is a primary measurement on the same HCA family: Kalia (CMU) reported on linux-rdma in 2013 that FDR ConnectX-3 delivers ~9M 16-byte RDMA reads/s with a 1 KB registered region, falling to ~2M at 1 GB, with vendor "137M msg/s" marketing figures being aggregate multi-QP numbers far above any single-QP rate — i.e., the single-QP small-message regime on this hardware is single-digit millions, HCA-side phenomena (translation lookups, per-QP engine service) among the proposed causes. Our 1 MB-registered 6.1M sits squarely inside that family. Note the wrinkle: for our WRITEs the *responder* HCA does the per-packet work (rkey validation + payload placement), so the binding device could be the responder's packet engine rather than the requester's WQE engine — indistinguishable from the client and from the repo data, but testable (checklist D).

**Residual per-message budget at the ceiling (163 ns)**: client post-loop ~25–60 ns (unknown on the old stack, plausibly ≤ ~150 ns); doorbell ≤ ~2 ns; completion ≤ ~0.6 ns; HCA per-WQE processing fills the rest. If the HCA is the metronome, the client has ~60–130 ns of headroom per message — nothing in the code needs to be faster to raise the rate, and no client-side change can beat ~163 ns/msg. If the client is the metronome, its old-stack provider path *is* the 163 ns and only a faster build path (or moving work off the critical path) helps. That is the binary the checklist decides.

## 7. What the mechanism implies

- **ADR-0004's attribution stays valid for T4 only** (per-WR doorbell, 221 ns); ADR-0005's "post-batching ceiling unexplained" is answered with a mechanism proposal: a per-message rate limit with two survivors, one of them device-side. Neither the doorbell nor CQE handling can be tuned further — ADR-0006's "no alternative beats the defaults" is not a coincidence, it is the flatness of the ceiling.
- The 1–32 B zone is **not** improvable by post-loop batching beyond K=64 (the A/B already shows K=128 is neutral); the only headroom candidates are the two survivors — and only the host one (if it wins) is addressable in software. If the HCA wins, ~6.1M msg/s is the pair's hardware envelope for one QP, and the honest viva story is "device per-QP message rate, observed through a completion-slaved refill".
- The measured envelope's shape (flat 163 ns → 853 MB/s copy takeover from 64 B → bus-bound DMA) is three different per-message costs stacked by size; the 1–32 B zone is the device/host per-WQE cost, not a copy cost.

## 8. Experiment checklist (user-mediated, in priority order)

Run on the course pair (mlxstud03/04 preferred). Each item states the prediction and what it falsifies. All artifacts (`ibv_devinfo`, sweep outputs, `perf stat`) should be pasted back to the issue.

- **A. Official-tool cross-check** — the cleanest bw.c-vs-environment discriminator.
  Server: `ib_write_bw -d mlx4_0 -i 1 -s 1 -b 64` — client: `ib_write_bw -d mlx4_0 -i 1 -s 1 -b 64 <server>`. Also repeat with `-b 1` (naive, should reproduce the T4 ~4.5M msg/s ≈ 36 Mbps) and `-b 128`.
  Prediction: `-b 64` also caps near ~6.1M msg/s (~49 Mbps at 1 B). If so, the ceiling is environmental (HCA), not bw.c's post loop. If ib_write_bw exceeds it substantially, bw.c's specific path (or its count/timing) is implicated.
- **B. CPU-clock scaling of the 1-B rate** — the decisive host-vs-device binary.
  Pin the client with `taskset -c <core>` and run the sweep (or a `-n`-extended run) under two CPU frequencies (e.g. `cpupower frequency-set -g performance` vs `-g powersave`, or turbo on/off), and/or record `perf stat -e cycles:u,instructions:u ./client mlxstud03`.
  Predictions: rate tracks the clock → the host post loop is the metronome (CPU-bound); rate stays ~6.1M while cycles/msg scales with the clock → the HCA is the metronome. (Both roles busy-spin, so CPU-utilization alone does not discriminate — the clock test does.)
- **C. Parameter sweep beyond the A/B** — confirms the ceiling's flatness in the post loop and completion path. Client `-k 64 / 128 / 256 / 512` and `-r 128 / 256 / 512` (server unchanged), read the 1 B and 32 B lines.
  Prediction: flat within ~0.1%. If the rate rises with K, a per-list cost is (re)introduced; if it rises with W, a latency effect is at play.
- **D. Two-QP aggregate** — per-QP vs shared-device. Run two independent client/server pairs concurrently (different `-p` ports), each measuring 1 B, and add the two rates.
  Prediction: ≈ 2 × 6.1M = 12.2M total → the limit is per-QP on the HCAs (each QP's engine); ≈ 6.1M total → a shared device resource (responder HCA aggregate, link, or similar). Note: this doubles client CPU too, so it does *not* separate host from device (B does); it separates per-QP from shared.
- **E. Registered-region size probe** — the sub-mechanism test (HCA translation lookups, Kalia's 1 KB→9M / 1 GB→2M finding). One-line change: rebuild with `BUFFER_SIZE` set to `(1 << 10)` and separately `(1 << 24)` (bw.c:94), rerun the 1 B point.
  Prediction: rate moves with region size → the per-message cost is HCA-side translation/validation work; rate stays ~6.1M → a fixed per-QP WQE-engine rate. Either way the mechanism is device-side.
- **F. Record the stack** (context for all of the above): `ibv_devinfo -v | head -40` and `rpm -qa | grep -iE 'ofed|rdma|ibverbs'` (or `dpkg -l`) on one node — HCA model, firmware, and provider version, so the old-stack assumption is pinned.
- **G. Server idle check** (validates the receive side does nothing): `mpstat -P ALL 1` on the server node during a 1 B run — the server CPU should be ~0% busy.

## Sources

- ADR-0004 (T4 baseline), ADR-0005 (T5 A/B), ADR-0006 (T6 dev-pair campaign), ADR-0007 (T6 final campaign) — all numbers quoted from their tables.
- `bw.c` — post loop `bw_post_writes` (900–949), refill `bw_refill` (868–888), `bw_poll_until` (775–809), counts table (111–121), defaults (148–149), inline read-back (655–661), server loop (1034–1053).
- rdma-core `providers/mlx4/qp.c` (`mlx4_post_send`): one doorbell per post batch (`mmio_write32_be` after the WR loop), per-WR WQE build (`get_send_wqe`, 16-B `mlx4_wqe_ctrl_seg` / `mlx4_wqe_data_seg`, inline `memcpy`), BlueFlame only for single-WR inline posts (not this path).
- InfiniBand Architecture Specification (IBTA Vol 1): RDMA WRITE semantics (no responder RQ WQE, no responder completion; only WRITE WITH IMMEDIATE is receive-visible), packet header sizes (BTH 96 bits, RETH 128 bits, ICRC 4 B). See also [qsysarch IB transport summary](https://qsysarch.com/posts/the-infiniband-transport-protocol-of-rocev2/) and [fpgasystems DeepWiki](https://deepwiki.com/fpgasystems/fpga-network-stack/3.2-ib-transport-protocol) for the header layout.
- [Kalia, linux-rdma, Oct 2013](https://marc.info/?l=linux-rdma&m=138300671322271&q=mbox): ~9M 16-B RDMA reads/s @ 1 KB region → ~2M @ 1 GB on FDR ConnectX-3; vendor aggregate figures (137M msg/s, 40M MPI msg/s) far above single-QP rates; HCA-side caching/TLB hypotheses.
