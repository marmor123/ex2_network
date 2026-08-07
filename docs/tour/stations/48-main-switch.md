# `main` (3): the switch — parsing and validating each option

- type: function
- tags: main
- lines: 1149-1203
- skip: no

The seven option cases, each validated at parse time — bad values fail the run here, with `usage` printed, instead of failing halfway through the sweep.

**What.** The `switch (c)` on getopt's letter: `p` port, `d` device name, `i` ib-port, `r` window, `k` signal interval, `n` count override, `g` gid index — plus `default` for unknown letters. Numeric options are parsed with `strtol`/`strtoull` and range-checked; failures print `usage` and return 1.

:::table
| Letter | Option | Meaning | Guard |
|---|---|---|---|
| `p` | `--port` | handshake TCP port | 0 ≤ port ≤ 65535 |
| `d` | `--ib-dev` | IB device name | any string (`strdup`) |
| `i` | `--ib-port` | device port number | ≥ 0 |
| `r` | `--window` | **window depth (W)** | > 0 |
| `k` | `--signal-interval` | **signal interval (K)** | ≥ 1 |
| `n` | `--count` | override every size's timed count | ≥ 1 |
| `g` | `--gid-idx` | local port gid index | any int (−1 = LID mode) |
:::

**How.** Parse and check in the same breath: `strtol(optarg, NULL, 0)` — base 0, so `0x400` and `1024` both parse — then the guard, then store into the local from station 46. `d` stores a copy of the string (`strdup`) because `optarg` points into argv and must outlive the parse; `g` has no guard because negative values are meaningful (`−1` selects LID-based addressing at station 50). Anything the switch doesn't know falls to `default`: `usage` + exit 1 — getopt has already printed its own "invalid option" line.

**Why.** Validation at parse time is the run's fail-fast contract: a `window` of 0 or a `k` of 0 would otherwise crash or hang deep inside the **refill**'s arithmetic (station 36's K-exact accounting divides by nothing), and a negative `ib_port` would fail later at `ibv_query_port` with a less helpful error. The guards are exactly the set `usage` advertises — the two texts agree, by construction, because both live in the same file.

> ⚠ Note what is *not* checked here: `k`'s upper bound. `k ≥ 1` passes at the switch, but `k > window` or `k > QP_SLACK` is rejected later, at station 49 — because that guard needs the parsed values of two options at once.

**Cross-links:** `main`, `usage`, `getopt_long`, `strtol`, `WINDOW_DEFAULT`, `SIGNAL_INTERVAL_DEFAULT`
