# Control messages ride the data QP as SENDs

Both control messages per size — the client's **done** and the server's **ack** — are `IBV_WR_SEND` work requests on the data QP, not TCP bytes. The assignment mandates the ack as a SEND; we made the done a SEND too because the ack must be a true completion barrier: RC in-order delivery means the server's done-receive completion proves every prior WRITE has landed in server memory, and the ack carries that guarantee back. A done sent over the TCP socket would not be ordered against the WRITEs, so the ack could arrive while the last WRITEs are still on the wire — the client's clock would stop early and throughput would be overstated.

TCP is used only for the one-time handshake (LID/QPN/PSN/GID + server buffer addr/rkey), which happens before any data flows.

Consequence: each side must always have a receive posted before the other can send. We post the entire **control receive pool** (32 receives per side, covering the 21 per-direction control messages) once at init — never refreshed — so the RQ can never be found empty.
