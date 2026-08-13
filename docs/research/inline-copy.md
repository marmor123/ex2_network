# Research: what performs the ~853 MB/s per-message copy at ≤ 1 KB?

**Caveat (added later, not corrected in place):** this doc's mechanistic
argument is built on `libmlx4`/`mlx4_ib` source. `ibv_devinfo -v` on both
course nodes reports `mlx5_0` (Connect-IB, not ConnectX-3) — see
`docs/research/gid-and-hca-family.md`. The measured throughput numbers
below are still real; the driver-source-level explanation of *why* may
not describe the hardware actually in use.

Wayfinder ticket #12 — resolution record. Question: ADR-0004/0005 attribute the ≤ 1 KB
throughput plateau (per-message cost `L(size) = size / 853 MB/s + 0.05 µs`, capping
≤ 1 KB at ~6.4 Gbps on the dev pair, 5.84/6.29/6.55 Gbps at 256 B/512 B/1 KB on
mlxstud03/04) to a per-message payload copy — "the stack inlines small messages even
without `IBV_SEND_INLINE`" — without identifying the mechanism. What actually copies
the payload?

## Verdict

**The copy is not performed by any software component of the stack.** The evidence
localizes it to the **HCA's own per-message payload handling for messages that fit the
QP's inline configuration** (`max_inline_data` = 1024 on the course stack): the
plateau's per-message cost is byte-proportional (853 MB/s), bounded at exactly the
QP's inline limit, present with and without `IBV_SEND_INLINE`, and independent of the
post-loop structure — while every software path that could copy the payload is either
flag-gated (libmlx4), non-existent (kernel mlx4_ib, template), or too fast (CPU
memcpy ≈ 10 GB/s, wire ≈ 6.3 GB/s).

**Caveat, stated plainly:** no primary source (libmlx4, mlx4_ib/mlx4_core driver code
from the OFED era through current, vendor documentation found) documents a
ConnectX-3 send-side hardware inline that copies the payload at ~853 MB/s. The
attribution is an inference from elimination plus the sharp boundary at
`max_inline_data`; the exact HCA-internal mechanism and its ~1.17 ns/B rate are
undocumented. The user-mediated experiment in the checklist below (create the QP with
`max_inline_data = 0`) would confirm or refute it directly.

## What the measurements establish (repo primary sources)

- **T4, naive path, no flag** (ADR-0004; bw.c at commit `b6e415e`, data WRITEs posted
  with `IBV_SEND_SIGNALED` only — verified in the repo's git history): the plateau
  exists, `L(size) = size / 853 MB/s + 0.05 µs` over two independent intervals
  (256→512, 512→1024, both giving 853 MB/s to three digits), upper edge exactly at
  `max_inline_data` = 1024 B, DMA regime above (38 Gbps dev pair).
- **T5, streaming path, flag set** (ADR-0005; bw.c `bw_post_writes`:
  `inline_flag = size <= ctx->max_inline_data ? IBV_SEND_INLINE : 0`): plateau
  identical to three digits; the explicit flag changes nothing.
- **mlxstud03/04** (ADR-0007): 5.84/6.29/6.55 Gbps at 256 B/512 B/1 KB — same plateau,
  same 853 MB/s attribution.
- **The QP's inline configuration** (bw.c `bw_init_ctx`): `max_inline_data` declared
  1024, stepped down until mlx4 accepts QP creation, read back via `ibv_query_qp` as
  the runtime value the data path uses (1024). The template (`bw_template.c`) never
  sets `max_inline_data` at all (QP created with 0) and never uses `IBV_SEND_INLINE`.
- Per-message times: 1 KB = 1.25 µs (fit: 1.20 + 0.05), while 2 KB = 0.50 µs
  (32.67 Gbps). The cutoff at 1024 is a *discontinuity downward* in per-message time —
  the classic signature of a copy budget that expires at the inline limit, not a
  smooth transition.

## What the primary sources say

### libmlx4 (userspace provider; OFED era and rdma-core current)

`IBV_SEND_INLINE` is the **sole trigger** for inline sends, in both the OFED-era tree
(`src/qp.c`, e.g. commit `ef656a51`, 2012) and rdma-core (`providers/mlx4/qp.c`):

- Gate: `if (wr->send_flags & IBV_SEND_INLINE && wr->num_sge)`. `qp->max_inline_data`
  is referenced exactly once in `mlx4_post_send` — as the ENOMEM bound inside that
  block (`if (inl > qp->max_inline_data) { ... ret = ENOMEM; }`). No message size is
  ever compared to `max_inline_data` without the flag.
- The inline copy is a plain `memcpy` of the payload into the WQE in the SQ buffer,
  chunked so inline segments never cross 64-byte boundaries
  (`MLX4_INLINE_ALIGN = 64`), each segment published with
  `seg->byte_count = htonl(MLX4_INLINE_SEG | seg_len)` after a `wmb()`.
- BlueFlame (WQE written to the BF register page instead of the SQ + doorbell) is
  gated on `nreq == 1 && inl && size > 1 && size <= ctx->bf_buf_size / 16` where `inl`
  is nonzero only for flagged-inline WRs, RDMA reads, and SGE-less WRITEs. Neither
  measurement qualifies: T4 posts non-inline WRs (`inl == 0`); T5 posts K=64-WR lists
  (`nreq == 64`).
- `mlx4_query_qp` overrides the kernel's (zeroed) `max_inline_data` with the
  library-computed value — this is why bw.c's declare-then-read-back sees 1024.

Consequences: **T4's WQEs never contain payload data**, so no libmlx4 copy exists in
the T4 measurement at all; and even the flagged T5 copy is a cached-RAM memcpy
(~10 GB/s on era CPUs), an order of magnitude faster than 853 MB/s — it cannot be the
plateau's bottleneck either.

### Kernel mlx4_ib (Linux v4.0-era — brackets the course stack — and current master)

- User QPs: `set_user_sq_size` ignores `max_inline_data` entirely; no inline-related
  QPC field is written anywhere in `__mlx4_ib_modify_qp`. There is **no send-side
  hardware-inline configuration** in the mlx4 QPC.
- Kernel QPs: `/* We don't support inline sends for kernel QPs (yet) */` —
  `cap->max_inline_data = 0`.
- `mlx4_ib_post_send` inspects only SIGNALED/SOLICITED/IP_CSUM/FENCE; there is no
  `IB_SEND_INLINE` code path.
- `struct mlx4_qp_context` (include/linux/mlx4/qp.h) contains no inline fields at all;
  the only inline artifacts in mlx4 are the WQE inline-segment format
  (`MLX4_INLINE_SEG = 1 << 31`, `MLX4_INLINE_ALIGN = 64`).
- The only HCA inline feature the driver code documents is **receive-side**
  ("IB/mlx4: Add inline-receive support", 2017-07-24: a QPC bit plus RQ WQE sizing,
  delivering single-packet messages ≤ receive-WQE size into the WQE). Not applicable
  here: RDMA WRITE consumes no RQ WQEs, and the plateau is on the sender.

### Vendor documentation

Data-inlining is documented as a *software-driven* feature (e.g. DPDK mlx5 PMD copies
packet data into WQEs; ConnectX-4+ firmware requires a minimum inline for steering).
No found vendor material describes automatic firmware-level send inlining on
ConnectX-3.

## Candidates ruled out (with reasons)

1. **libmlx4 copying the payload into the WQE in the SQ buffer** — ruled out: the
   flag is the sole trigger (T4 never enters it); and even flagged, a cached-RAM
   memcpy is ~10× faster than 853 MB/s.
2. **A kernel/userspace path in the old OFED stack** — ruled out: user-QP posts never
   touch the kernel; the kernel configures no send-side inline; kernel QPs cannot
   inline at all.
3. **The template's behavior** — ruled out: the template has no `IBV_SEND_INLINE`,
   no `max_inline_data`, and no size-dependent post logic.
4. **The CPU post loop / doorbell / CQE path** — ruled out: all fixed per message,
   not byte-proportional; the structure differs between T4 (per-WR doorbell) and T5
   (K-batched) without changing the plateau.
5. **The wire (link time)** — ruled out: FDR wire rate ≈ 6.3 GB/s, 7.4× faster than
   the fitted 853 MB/s slope (1.17 ns/B vs 0.16 ns/B on the wire).
6. **The receive side** — ruled out: RDMA WRITE consumes no RQ WQEs; the server's
   only data-path role is DMA absorption (measured at 38–42 Gbps at ≥ 2 KB).
7. **The streaming DMA fetch** — ruled out as the bounded mechanism: the same fetch
   at ≥ 2 KB runs at 38–42 Gbps (6× faster per byte); the boundary at exactly
   `max_inline_data` cannot be produced by a pure size threshold in the DMA engine
   (nothing in the QPC carries the 1024 limit to the HCA except the SQ geometry).

## Attributed mechanism (ranked candidates)

1. **The HCA's per-message payload ingest for inline-capable messages** (best fit,
   not directly documented). For messages ≤ `max_inline_data`, the HCA buffers the
   payload into its WQE context before transmission (store-and-forward ingest at
   ~853 MB/s ≈ 1.17 ns/B), instead of the streaming fetch used above the limit. Fits:
   byte proportionality, sharp cutoff at exactly the inline limit, identical with and
   without the flag (the flag only selects the WQE *layout* — data in the WQE vs
   data in memory — it cannot tell the HCA which path to take), independence from
   post-loop structure. The QP's only inline-related configuration is the 1024
   declaration (→ 2 KB SQ WQE stride via `mlx4_calc_sq_wqe_size`); how the HCA turns
   that into a 1024-byte payload threshold is undocumented.
2. **Vendor-patched userspace on the course nodes** (MLNX_OFED ships modified
   libmlx4/libibverbs; an auto-inline without the flag would be invisible in the
   open-source trees and would exactly reproduce the observed flag-independence).
   Checkable only on the nodes (`ofed_info -s`, `rpm -qa`, `strings` on the lib).
3. **SQ-geometry side effect** (the 2 KB WQE stride from the inline declaration
   changing HCA WQE-fetch behavior). Weakly contradicted: a stride effect would be
   constant per message, not byte-proportional.

## What's still uncertain

- The exact HCA-internal mechanism and why its rate is ~853 MB/s (≈ 6× below the
  streaming DMA path, 7.4× below the wire). No primary source documents it.
- Whether the course nodes run stock OFED or MLNX_OFED-patched userspace (candidate 2
  is only distinguishable on the nodes).
- ADR-0004's wording "the stack inlines small messages even without `IBV_SEND_INLINE`"
  should be refined to "the HCA handles messages ≤ `max_inline_data` on the inline
  path regardless of the flag" — a wording refinement of the mechanism, not a
  contradiction of the measured numbers (plateau, boundary, and 853 MB/s fit all
  stand; this is also why the CONTEXT.md "Inline" entry's mechanism line now points
  here).

## User-mediated experiment checklist (confirmation)

Only the user can SSH to the mlxstud nodes; nothing here runs them.

1. **Identify the stack**: on one mlxstud node —
   `ofed_info -s`; `rpm -qa | grep -Ei 'mlx4|libibverbs|ofed'`; `uname -r`;
   `ibv_devinfo -v | grep -i inline` (expect max_inline_data 1024). Note whether the
   distribution is MLNX_OFED or stock OFED (candidate 2).
2. **Killer experiment — inline config off**: build bw.c with
   `MAX_INLINE_DATA_DECLARE` set to 0 (one-line local change, or add a
   `--inline-size` option; do not commit), run the full 21-size sweep client+server on
   mlxstud01/02. Prediction if the attribution is right: the ≤ 1 KB plateau collapses
   (256 B and 1 KB jump toward the DMA envelope, ~38 Gbps on that pair). If the
   plateau persists, ADR-0004's boundary-at-`max_inline_data` inference is wrong and
   the mechanism is a pure size threshold, not the inline configuration.
3. **Re-verify the no-flag baseline**: build the T4-era bw.c (`git show b6e415e:bw.c`)
   and confirm the plateau reproduces without `IBV_SEND_INLINE` (controls for
   candidate 2 drift: same result with two different libmlx4 behaviors would argue
   against a software copy).
4. **Boundary sharpness**: sweep 512–1536 B in 64 B steps (extend the sweep or use
   the count override) to confirm the cutoff is exactly at the QP's `max_inline_data`,
   not at the WQE stride (2 KB) or another round boundary.
5. **CPU-side confirmation (optional)**: run the client at 1 KB under
   `perf record -e mem-stores` / `ltrace -e memcpy` (or `perf stat`). A
   byte-scaled software memcpy would appear there; its absence supports the HCA
   attribution. (May need perf permissions on the nodes.)

## Sources

- Repo: ADR-0004 (`docs/adr/0004-measured-data-path-envelope.md`), ADR-0005, ADR-0007;
  `bw.c` (`bw_post_writes`, `bw_init_ctx`, `bw_post_ctrl_send`); `bw_template.c`;
  git history: `b6e415e` (T4 naive path — data WRITEs without `IBV_SEND_INLINE`),
  `8c2de20` (inline declare-then-read-back), `192141f` (T5).
- libmlx4, OFED-era: kernel.googlesource.com/pub/scm/libs/infiniband/libmlx4 —
  `src/qp.c` at `ef656a51` (2012); history: `f89e3921` (2007, "Handle IBV_SEND_INLINE
  for send work requests"), `cfe59bb9` (2007, multi-SGE inline fix), `f2533e88` (2008,
  no memcpy for BlueFlame), `7b47c7aa`/`ef656a51` (2012, BlueFlame).
- libmlx4, current: rdma-core `providers/mlx4/qp.c` (`mlx4_post_send`,
  `mlx4_calc_sq_wqe_size`, `mlx4_set_sq_sizes`) and `providers/mlx4/verbs.c`
  (`mlx4_query_qp` cap override).
- Kernel mlx4_ib: `drivers/infiniband/hw/mlx4/qp.c` at v4.0 (2015) and master
  (`set_user_sq_size`, `set_kernel_sq_size`, `__mlx4_ib_modify_qp` — no send-side
  inline fields); `include/linux/mlx4/qp.h` (`struct mlx4_qp_context`, no inline
  fields; `MLX4_INLINE_SEG`, `MLX4_INLINE_ALIGN`).
- Kernel commit "IB/mlx4: Add inline-receive support" (2017-07-24) — the one
  documented HCA inline feature (receive side).
- Vendor context: DPDK mlx5 PMD inline-send patches (data-inlining is a
  software-driven feature; no ConnectX-3 automatic send-inline documentation found).
