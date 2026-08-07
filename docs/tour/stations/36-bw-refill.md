# The refill: `bw_refill`

- type: function
- tags: data-path
- lines: 854-888
- skip: no

**Refill**-never-empty: while the window is full, reclaim only the completions that are ready — each accounts for exactly K WRs — then return so the caller reposts immediately; the SQ never empties and the NIC never idles.

**What.** Loop while `outstanding >= window || outstanding + k >= sq_depth`: poll one CQE, classify it with `bw_wc_bad` against `BW_DATA_WRID`, and subtract `k` from `outstanding`. Poll returning 0 is not an error — the last WQEs are still in flight — the loop just retries. Return 0 when the window has room again, 1 on any failure.

**How.** The first loop condition is the window discipline: when `outstanding` reaches **window depth (W)**, no more WRs may be posted until a completion frees capacity — the pipeline never drains below W, and each reclaim of K from one CQE makes room for exactly one K-WR list. The second condition is the device-clamped corner: if the QP was created shallower than W + K (the `max_qp_wr` clamp at station 25), the queue's own depth is the binding limit, and the refill keeps one list's worth of room so the next `ibv_post_send` always fits.

:::diagram
<svg viewBox="0 0 640 230" role="img" aria-label="The refill's steady state: outstanding stays between W minus K and W, sawtoothing down K per reclaimed CQE and up K per reposted list.">
  <defs>
    <marker id="arr36" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
  </defs>
  <line x1="50" y1="70" x2="590" y2="70" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="5 4"/>
  <line x1="50" y1="140" x2="590" y2="140" stroke="#7dd3fc" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="320" y="58" font-size="11" fill="#7dd3fc" text-anchor="middle">window depth W — full: the refill reclaims here</text>
  <text x="320" y="160" font-size="11" fill="#93c5fd" text-anchor="middle">W − K — the level the refill returns to each cycle</text>
  <polyline points="50,140 110,70 170,140 230,70 290,140 350,70 410,140 470,70 530,140 590,70"
            fill="none" stroke="#2dd4bf" stroke-width="2.5" stroke-linejoin="round"/>
  <line x1="110" y1="70" x2="110" y2="140" stroke="#2dd4bf" stroke-width="1.5" marker-end="url(#arr36)"/>
  <text x="110" y="122" font-size="11" fill="#5eead4" text-anchor="middle">reclaim −K</text>
  <line x1="170" y1="140" x2="170" y2="70" stroke="#38bdf8" stroke-width="1.5" marker-end="url(#arr36)"/>
  <text x="170" y="96" font-size="11" fill="#7dd3fc" text-anchor="middle">repost +K</text>
  <text x="320" y="200" font-size="10" fill="#93c5fd" text-anchor="middle">steady state: each data CQE accounts for exactly K WRs (in-order RC), so the sawtooth never drifts</text>
</svg>
<figcaption>The refill's steady state: reclaim K per ready CQE while the window is full, repost a K-WR list immediately after — outstanding oscillates between W−K and W and never empties the queue.</figcaption>
:::

**Why.** This is the whole data-path rhythm: the caller is a *writer* with a window, not a waiter. Draining the CQ to zero before reposting would idle the NIC between lists; reclaiming everything ready up front would let the SQ burst over the window. The refill takes exactly what frees the next list and no more — the **timed batch** flows at line rate, and the windowed pipeline of ADR-0002 never drains. Two corners are deliberately *not* handled here: a poll returning 0 (in-flight, not empty — retry) and the final list's CQE (no list follows, so the refill cannot run again; that CQE stays in the CQ for the ack wait to consume, in-order before the ack — station 34).

> ⚠ Only data WRITE completions may be pending while the refill runs — the `bw_wc_bad` mask admits `BW_DATA_WRID` alone. A done-send or ack completion arriving here would be a protocol error, and the shared classifier (station 32) reports it identically to the poll loop's.

**Cross-links:** `bw_refill`, `bw_wc_bad`, `bw_post_writes`, `bw_data_state`, `BW_DATA_WRID`, `sq_depth`, `bw_recv_ctrl`
