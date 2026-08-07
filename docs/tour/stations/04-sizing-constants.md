# Sizing constants

- type: constant
- tags: setup, control
- lines: 91-105
- skip: no

Four numbers size everything else: the 1 MB buffer, the 32-deep **control receive pool**, the 64-byte control area, and the 21-entry **size sweep**.

**What.** One buffer of `BUFFER_SIZE` (1 MB) per side; `CTRL_POOL_DEPTH` (32) receives per side; `CTRL_MSG_LEN` (64) bytes per control area; `SWEEP_SIZES` (21) message sizes.

:::table
| Constant | Value | What it sizes |
|---|---|---|
| `BUFFER_SIZE` | 1u << 20 | the one 1 MB buffer each side registers once |
| `CTRL_POOL_DEPTH` | 32 | the **control receive pool**: receives posted once, never refreshed |
| `CTRL_MSG_LEN` | 64 | the control area each receive SGE points at |
| `SWEEP_SIZES` | 21 | the **size sweep**: 21 sizes, 2⁰..2²⁰, one done/ack pair per size |
:::

**How.** The pool-covers-the-sweep proof is in the pairing: a full sweep produces 21 per-direction control exchanges, the pool holds 32 receives posted at init — it never runs out, so it never needs a refresh. `CTRL_MSG_LEN` 64 is comfortable room for the 8-byte **control message** (station 6).

**Why.** The buffer constant carries a design invariant, not just a size: the 1 MB buffer is registered once and never modified after init, so there is no buffer-reuse hazard at full **window depth (W)** (ADR-0002) — every WRITE's payload is DMA-read from this one region, which is safe only because its content is static (filled once at init, station 24).

> ⚠ `BUFFER_SIZE` is not a message-size cap. The sweep tops out at exactly 1 MB (2²⁰), but the constant's job is the registration — and the same region is the source of every WRITE in the run.

**Cross-links:** `bw_init_ctx`, `bw_post_control_recvs`, `bw_post_writes`, `MSG_COUNTS`
