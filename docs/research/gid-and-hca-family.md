# GID necessity and the mlx4→mlx5 hardware mismatch

Triggered by a direct question — "did we need GID?" — that wasn't willing
to accept the `085cf4a` commit message's stated reasoning at face value.
Checking it against real hardware surfaced a second, larger discrepancy.

## Verification method

`ibv_devinfo -v` run on both course nodes (mlx-stud-01, mlx-stud-02).

## Finding 1: GID/GRH is genuinely not needed — but not for the stated reason

`085cf4a` ("drop the GID/GRH handshake machinery") justified the removal
with: *"the local GID was always zero."* That's false on the actual
hardware:

| | mlx-stud-01 | mlx-stud-02 |
|---|---|---|
| `link_layer` | InfiniBand | InfiniBand |
| `sm_lid` | 3 | 3 |
| `GID[0]` | `fe80::...1403:0018:8470` | `fe80::...c903:0016:7470` |

`GID[0]` is a real, non-zero link-local address on both nodes (standard
IB behavior — every active port has one, derived from the port GUID).
Both nodes are on the **same subnet** (identical `sm_lid`), and neither
is on RoCE (`link_layer: InfiniBand`, not `Ethernet`).

**Corrected reasoning**: GID/GRH is unnecessary here because this is
**single-subnet native InfiniBand** — LID alone fully addresses the QP.
GRH only matters for RoCE (no LIDs exist there) or routing between IB
subnets. Neither applies. "GID is zero" was never the real reason; "LID
suffices on a single native-IB subnet" is — and that holds regardless of
whether GID happens to be populated.

**Why adding GRH back would be a net negative, not neutral**: reusing
the assignment template's exact trigger
(`if (dest->gid.global.interface_id) { ah_attr.is_global = 1; ... }`)
would actually *enable* GRH on this hardware, since `interface_id` is
non-zero — unlike whatever hardware the original commit tested against.
That adds a GRH header to every packet for zero addressing benefit, at
message-rate-bound sizes where this session's W/K experiment (see
`perf-experiments.md`) already showed sub-1% per-message costs are real
and measurable. Net effect: pure overhead in the wrong direction.

## Finding 2: the course hardware is mlx5 (Connect-IB), not mlx4 (ConnectX-3)

`assignment.md` says "Connect-X3 (56Gb) NICs." Actual hardware:

| | mlx-stud-01 | mlx-stud-02 |
|---|---|---|
| `hca_id` | `mlx5_0` | `mlx5_0` |
| `vendor_part_id` | 4113 (Connect-IB) | 4113 (Connect-IB) |
| `active_speed` (per lane) | 14.0 Gbps | 10.0 Gbps |

Both nodes report the `mlx5` driver family, not `mlx4`. This means
several existing research docs analyze the wrong provider's source code
for their mechanistic ("why") explanations, even though the throughput
numbers they measured are real:

- `docs/research/inline-copy.md` — cites `libmlx4`/`mlx4_ib` source
  (`mlx4_post_send`, `mlx4_calc_sq_wqe_size`, `struct mlx4_qp_context`)
  to explain inline-send behavior. mlx5 has a different WQE format and
  inline mechanism entirely.
- `docs/research/small-size-ceiling.md` — explains the message-rate
  ceiling via mlx4's doorbell/WQE-build internals
  (`mlx4_wqe_ctrl_seg`, `MLX4_SEND_DOORBELL`) and states the HCA family
  as "ConnectX-3, `mlx4`" directly.
- `docs/research/dma-regime-shape.md` — attributes the DMA-path
  processing floor to "the mlx4 DMA path."
- `docs/research/audit-bw-c.md` — a couple of "mlx4 does X" claims used
  as safety justification.
- `bw.c` (3 comments) and `docs/adr/0002` — say "mlx4 rejects QP
  creation when..." — harmless (the actual code, declare-then-step-down
  via `ibv_create_qp`/`ibv_query_qp`, is provider-agnostic and correct
  regardless of driver), but the attribution is wrong.

**Most likely explanation** (not confirmed, but coherent): both
mismatches — mlx4→mlx5 and "GID always zero"→non-zero GID — are
explained at once if the course's node hardware was upgraded at some
point after those research docs and that commit were originally written.
The conclusions reached (skip GID; the measured Gbps numbers) still
hold; the specific driver-source-level "why" in the three docs listed
above does not, and would need re-deriving against `providers/mlx5/qp.c`
and `mlx5_ib` to be accurate.

**Not fixed here**: re-deriving the mlx5-specific mechanistic
explanations in `inline-copy.md`/`small-size-ceiling.md`/
`dma-regime-shape.md` is a substantial research effort in its own right,
out of scope for this note. This is a flag for future work, not a
correction of those docs' content.
