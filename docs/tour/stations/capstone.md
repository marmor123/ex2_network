# The capstone: the whole run, end to end

- type: content
- tags: closing
- lines: none
- skip: no

Everything the tour has walked, in one pass: the header comment's claims, now earned — the run's shape, its numbers, and why the throughput curve looks the way it does. This station owns no lines of `bw.c`; it owns the whole run.

:::diagram
<svg viewBox="0 0 680 250" role="img" aria-label="The whole run at a glance: four phases — TCP handshake, QP connect, the 21-size sweep, teardown — with the client and server lanes.">
  <defs>
    <marker id="arrcp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
  </defs>

  <rect x="40" y="30" width="110" height="20" rx="4" fill="#0d1b2e" stroke="#38bdf8"/>
  <rect x="150" y="30" width="80" height="20" rx="4" fill="#0d1b2e" stroke="#38bdf8"/>
  <rect x="230" y="30" width="350" height="20" rx="4" fill="#134e4a" stroke="#2dd4bf"/>
  <rect x="580" y="30" width="60" height="20" rx="4" fill="#0d1b2e" stroke="#38bdf8"/>
  <text x="95" y="66" font-size="11" fill="#7dd3fc" text-anchor="middle">handshake (TCP)</text>
  <text x="190" y="66" font-size="11" fill="#7dd3fc" text-anchor="middle">QP connect</text>
  <text x="405" y="66" font-size="11" fill="#5eead4" text-anchor="middle">the size sweep — 21 sizes</text>
  <text x="610" y="66" font-size="11" fill="#7dd3fc" text-anchor="middle">teardown</text>

  <text x="20" y="114" font-size="12" fill="#e0f2fe" text-anchor="end">client</text>
  <line x1="40" y1="110" x2="640" y2="110" stroke="#334155" stroke-width="1.5"/>
  <text x="20" y="184" font-size="12" fill="#e0f2fe" text-anchor="end">server</text>
  <line x1="40" y1="180" x2="640" y2="180" stroke="#334155" stroke-width="1.5"/>

  <line x1="90" y1="110" x2="90" y2="180" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrcp)" marker-start="url(#arrcp)"/>
  <text x="90" y="148" font-size="10" fill="#7dd3fc" text-anchor="middle">address beats</text>

  <line x1="190" y1="110" x2="235" y2="110" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrcp)"/>
  <text x="212" y="102" font-size="10" fill="#7dd3fc" text-anchor="middle">RTR → RTS</text>

  <line x1="360" y1="110" x2="360" y2="180" stroke="#2dd4bf" stroke-width="3" marker-end="url(#arrcp)"/>
  <text x="372" y="148" font-size="10" fill="#5eead4" text-anchor="start">WRITEs — windowed stream</text>
  <line x1="470" y1="110" x2="470" y2="180" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrcp)"/>
  <text x="482" y="142" font-size="10" fill="#7dd3fc" text-anchor="start">done</text>
  <line x1="520" y1="180" x2="520" y2="110" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrcp)"/>
  <text x="532" y="142" font-size="10" fill="#7dd3fc" text-anchor="start">ack</text>
  <text x="405" y="200" font-size="10" fill="#93c5fd" text-anchor="middle">per size: warmup → timed → done → ack — one result line (station 41's window)</text>

  <text x="610" y="148" font-size="10" fill="#93c5fd" text-anchor="middle">QP → CQ → MRs → PD → dev</text>
</svg>
<figcaption>The run's four phases: the one-time TCP handshake and QP connect; the 21-size sweep, each size a windowed stream with a done/ack pair; teardown reversing the QP's creation.</figcaption>
:::

**The header comment, revisited.** Station 2's claims — what `bw.c` measures, one binary and two roles by argv, the streaming data path, the control protocol — are no longer promises: you have seen each become code. One binary: role by `argv` at station 49. Two roles: the client drives every WRITE and the clock (stations 40–42), the server absorbs into its registered buffer and acks (station 43). The run's shape is a pipeline: **handshake** (TCP, once) → QP lifecycle (RTR → RTS) → the **size sweep** (21 times the timed window of station 41) → teardown. The capstone's diagram is the tour's own route map from station 52, expanded to the whole run.

**The numbers, explained.** The Gbps curve is two regimes meeting at `max_inline_data` (≤ 1 KB). Below it, every message rides the **inline** path — CONTEXT.md: a per-message payload copy at ~853 MB/s — which caps ~1 KB messages at ~6.4 Gbps no matter how wide the link. Above it, WRITEs DMA from the registered buffer and the path becomes host-interface-bound: ~38 Gbps on the dev pair, ~42.5 Gbps on mlxstud03/04 (ADR-0007). That is why the curve climbs steadily at small sizes, then flattens at the interface's ceiling — the measurement is of the *host interface*, not the fabric, and the inline ceiling at the left is its second, quieter signature (ADR-0004).

**Why the run is correct.** The tour's three invariants hold together: the windowed stream never empties (the **refill**, station 36 — K-exact because only K-th WRs are signaled, station 38); the done always fits (the `k ≤ min(window, QP_SLACK)` guard, station 49); the ack always arrives in order (the **completion barrier** of station 34). Each size's line is timed from the first timed post to the ack's receive (ADR-0003), the 21 lines are ex1-identical (station 39), and `verify.sh` can diff them byte for byte.

**Where to go from here.** The tour ends where it began: the header comment's five paragraphs, each now a leg you walked. Re-read station 2 — then, if the metro-network upgrade ever comes, the station model's multi-valued tags and data-driven orderings are ready for it (map's Not-yet-specified).
