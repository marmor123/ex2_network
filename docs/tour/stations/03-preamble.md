# The preamble: `_GNU_SOURCE` and the includes

- type: file
- tags: orientation
- lines: 68-90
- skip: no

The file's prologue: one `#define` and fifteen includes, and only one include matters to the tour — `infiniband/verbs.h`, the API everything else builds on. Skimmable.

**What.** `_GNU_SOURCE` defined first, the system headers, then the Verbs header last.

**Why.** `asprintf` and the `srand48`/`lrand48` family are GNU/SVID extensions: newer glibc exposes them by default, but the course nodes' older glibc only with `_GNU_SOURCE`. The define is a feature-test macro — it must be in effect before the first system header is read, because headers may include each other, and once a header is read its declarations are fixed.

**How.** Define first, include after; the comment names the two functions that need it. Beyond the standard set, the run needs exactly one header: `infiniband/verbs.h`, where the whole `ibv_*` API lives.

> ⚠ Put the `#define` after any system include and the build breaks on the course nodes with an error that names the function, not the macro — the comment at line 69 exists because someone hit exactly that.

**Cross-links:** `srand48`, `lrand48`, `asprintf`, `infiniband/verbs.h`
