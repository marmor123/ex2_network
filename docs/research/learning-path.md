# Sequencing a learning path through an unfamiliar codebase (issue #23)

Research ticket #23. Question: what do evidence and practice say about the best ORDER and
PRESENTATION for bringing a newcomer to full understanding of an unfamiliar codebase —
to inform a hand-authored "tour route" of ~40–60 code stations over the 1320-line bw.c
(InfiniBand RDMA throughput benchmark, client + server in one file, Verbs API on
ConnectX-3). All claims below are traced to the primary source that owns them: academic
papers (title, authors, year, venue/DOI), first-party product docs and repos, and the
two practitioner books most often cited as the practice canon (Spinellis 2003; Hermans
2021), which are themselves syntheses of the papers cited here. Product engineering
blogs are used only for facts the products themselves document.

**Summary.** The evidence lands on a hybrid route, ordered by the *story of a run*
(entry point → setup → data path → teardown), not by file layout and not by pure
dependency order. Start with a one-paragraph model of the whole program (Brooks's
"primary hypothesis"; "global before local"): what bw.c is, that one binary runs both
roles, and the three verbs that make a message move (QP → post WR → poll CQ). Then walk
execution order from `main`: experts read the entry point early and comprehensively,
and novices who are shown this do better (Busjahn et al. 2021); the mental model that
forms first is a control-flow program model (Pennington 1987), and experienced readers
follow execution flow (Peitek et al. 2020). Introduce the central data structures at the
entry-point overview, but define each field just-in-time at its first use site. Every
station keeps its explanation physically on the same screen as the code it explains —
the split-attention evidence is unambiguous (Tarmizi & Sweller 1988; Ginns 2006). The
route should be guided and mostly linear (worked examples beat unguided exploration for
novices; Kirschner, Sweller & Clark 2006), ramp from single-function stations to
multi-part mechanisms (cognitive apprenticeship's increasing complexity), and give the
experienced reader a way out (summaries, skip): guidance reverses for experts (Kalyuga
et al. 2003). Anchor stations to file+line ranges in the repo and pin the route to a
commit so it cannot silently rot — the one design pitfall every tour product exists to
solve (Swimm auto-sync, CodeTour drift CI).

---

## Thread 1 — Program comprehension: what the newcomer's mind does

**Comprehension is neither purely bottom-up nor purely top-down; the classic models
differ on which is primary, and the modern consensus is that readers switch between
both, opportunistically.** The two poles:

- **Bottom-up** (Shneiderman & Mayer 1979, "Syntactic/semantic interactions in
  programmer behavior", *International Journal of Parallel Programming* 8(3):219–238,
  DOI 10.1007/BF00977789): comprehension aggregates statements into higher-level
  semantic chunks; long-term memory holds two stores — *syntactic* knowledge
  (language/API specifics) and *semantic* knowledge (application-domain concepts,
  language-independent). A newcomer to bw.c must fill both stores at once: the Verbs
  API call sequence (syntactic) and the RDMA/wire semantics (semantic).
- **Top-down** (Brooks 1983, "Towards a theory of the comprehension of computer
  programs", *Int. J. Man-Machine Studies* 18(6):543–554, DOI 10.1016/S0020-7373(83)
  80031-5): comprehension is hypothesis-driven. A *primary hypothesis* about the
  program's global structure (inputs, outputs, major data structures, processing
  sequence) is formed "often merely upon hearing the program's name or a brief
  descriptive phrase", then refined by successive hypotheses that direct attention to
  specific code. Bottom-up is "a degenerate special case". Crucially for tour design:
  even a weak early hypothesis dramatically shrinks the space of interpretations —
  the tour's opening station is itself a comprehension aid, not decoration.

**Experts read with plans and beacons; unplan-like code collapses them to novice
level.** Soloway & Ehrlich (1984, "Empirical studies of programming knowledge", *IEEE
TSE* SE-10(5):595–609, DOI 10.1109/TSE.1984.5010283): experts hold *programming plans*
(stereotypic action sequences) and *rules of discourse* (name-means-function, no dead
code, consistent initialization/update, etc.); programs that violate the rules are
recalled and completed at novice level even by experts. Wiedenbeck (1986, "Beacons in
computer program comprehension", *IJMMS* 25(6):697–709, DOI 10.1016/S0020-7373(86)
80083-9): *beacons* — highly recognizable, stereotypical lines (a swap sequence, a
sort call) — are focal points; experienced programmers recall them far better than
other lines. Implication: the tour should name bw.c's beacons explicitly (e.g. the
`ibv_post_send` call, the doorbell write, the poll-CQ loop) and point out the
stereotypical RDMA "plan" (create QP → post WR → reap CQ) so the reader can recognize
it in other code later; where bw.c violates a discourse rule, the tour must flag it
rather than let the reader silently misread it.

**The integrated model: three interleaved mental models, with beacons as the switch.**
von Mayrhauser & Vans (1995, "Program comprehension during software maintenance and
evolution", *IEEE Computer* 28(8):44–55, DOI 10.1109/2.402076): maintainers build a
*program model* (bottom-up: control/data flow of the code), a *situation model*
(bottom-up: real-world/domain abstractions), and a *top-down domain model*
(hypotheses), switching among all three; a beacon (e.g. a recognizable pattern or
function name) triggers a jump to top-down hypothesizing, and unfamiliar code pulls
back to bottom-up. Their observation of professional maintainers: a purely systematic
line-by-line pass is "associated with more successful code modification" but
unrealistic at scale, and requiring a *complete* program model before abstracting to
domain level would create cognitive overload — the abstraction happens early, on
partial knowledge. Pennington (1987, "Stimulus structures and mental representations
in expert comprehension of computer programs", *Cognitive Psychology* 19:295–341,
DOI 10.1016/0010-0285(87)90007-7; and "Comprehension strategies in programming",
*Empirical Studies of Programmers* 2, 100–113): experts' initial mental representation
is dominated by *control-flow (procedural) relations*, not goal/function hierarchies;
the domain model comes later. Letovsky (1986, "Cognitive processes in program
comprehension", *Empirical Studies of Programmers* 1, 58–79): readers are
"opportunistic processors" driven by *inquiries* — a fact prompts a question
("why/how/what"), a conjecture, a search, a conclusion. Implication: a tour station
should pre-answer the inquiry the reader would otherwise launch (why is the count
table like this? how does the window refill? what does this field hold?).

**Where the newcomer's eye actually goes.** Busjahn, Simon & Paterson (2021,
"Looking at the main method — an educator's perspective", *Koli Calling '21*, DOI
10.1145/3488042.3488068): gaze-tracking shows experts deliberately find the entry
point (`main`) early and read it comprehensively; novices arrive at it late, after
wandering through whatever came before it in the file; the authors conclude novices
should be *explicitly taught* to start at the entry point. Peitek, Siegmund & Apel
(2020, "What drives the reading order of programmers? An eye tracking study", *ICPC
'20*, DOI 10.1145/3387904.3389279, a replication of Busjahn et al. 2015): experience
makes reading less linear (experts follow execution flow), the *linearity of the code
itself* affects reading order even more than experience, and the reader's declared
top-down/bottom-up strategy has only a minor effect. Both say the same practical
thing: a route that orders stations by the run's execution flow is teaching the
behavior experts already have.

**What professionals actually do.** Roehm, Tiarks, Koschke & Maalej (2012, "How do
professional developers comprehend software?", *ICSE '12*, 255–265, DOI 10.1109/
ICSE.2012.6227188): developers *avoid* comprehension where possible, adopt structured
recurring strategies, and often start by running the program and inspecting user
interfaces (end-user role). Ko, Myers, Coblenz & Aung (2006, "An exploratory study of
how developers seek, relate, and collect relevant information during software
maintenance tasks", *IEEE TSE* 32(12):971–987, DOI 10.1109/TSE.2006.116): developers
on unfamiliar code search on thin cues, then *relate* by following dependencies in
both directions, and *collect* relevant snippets (information foraging). Implications
for the route: (a) make the program *runnable/observable* at or near the first station
(what the user sees, what the counters report) — comprehension is in service of the
run; (b) every station should give the incoming/outgoing dependency context of the
piece (who calls this, what it feeds), because dependency-following is how readers
navigate — a station that drops the reader at a bare function with no pointer to its
caller breaks the foraging loop.

## Thread 2 — Cognitive load & worked examples

**The worked-example effect.** Sweller (1988, "Cognitive load during problem solving:
Effects on learning", *Cognitive Science* 12(2):257–285): novices solving problems by
means-ends search spend working memory on search, leaving little for schema
acquisition — the thing learning actually is. Sweller & Cooper (1985, "The use of
worked examples as a substitute for problem solving in learning algebra", *Cognition
and Instruction* 2(1):59–89): studying worked examples beats solving the same
problems. Direct instruction beats minimal guidance for novices: Kirschner, Sweller &
Clark (2006, "Why minimal guidance during instruction does not work", *Educational
Psychologist* 41(2):75–86, DOI 10.1207/s15326985ep4102_1) — free exploration of a
difficult environment generates heavy working-memory load and less learning; guidance
dominates until prior knowledge is high enough to provide "internal" guidance. In
programming specifically, the worked-example/completion line is the best-evidenced
cognitive-load intervention: van Merriënboer (1990, "Strategies for programming
instruction in high school programs") and van Merriënboer & de Croock (1992,
"Strategies for computer-based programming instruction: program completion vs. program
generation"): learners who *complete* partially worked programs (fill the blanks /
predict the next piece) outperform learners who generate whole programs from scratch;
the systematic review by Berssanette & de Francisco (2022, "Cognitive load theory in
the context of teaching and learning computer programming: a systematic literature
review", *IEEE Trans. Education* 65(3):440–454, DOI 10.1109/TE.2021.3127215) finds the
worked-example effect among the two most-studied CLT constructs in programming
education, with most of the positive evidence attached to it. Translation for the
tour: stations that ask the reader to *predict before confirming* ("what does this
function return when the queue is empty? — here is the answer") are completion
problems; a tour of fully-solved stations is a chain of worked examples. Both beat
"go read the file yourself".

**The split-attention effect — the strongest single constraint on our side-bubble
design.** Tarmizi & Sweller (1988, "Guidance during mathematical problem solving",
*Journal of Educational Psychology* 80(4):424–436): worked examples *failed* when the
diagram and its text were separate; the same examples *won* when physically
integrated. Chandler & Sweller (1991, "Cognitive load theory and the format of
instruction", *Cognition and Instruction* 8(4):293–332): the effect generalizes
beyond geometry, and the complement — the *redundancy effect* — bites when the
integrated material is already self-explanatory for the learner: extra explanation
that is redundant *hurts*. Ginns (2006, "Integrating information: a meta-analysis of
the spatial contiguity and temporal contiguity effects", *Learning and Instruction*
16(6):511–525, DOI 10.1016/j.learninstruc.2006.10.001): meta-analysis of 50 studies —
bringing related information closer together in space or time produces substantial
learning gains *especially for complex materials*. Practical consequences:
- The explanation must appear on the same screen as the code it explains, never on a
  separate page — the side-bubble layout is exactly the integrated format the
  evidence prescribes, provided it does not displace the code it annotates.
- The bubble must be *short*: long prose is its own split-attention hazard (code + a
  wall of text); the redundancy effect warns that a bubble re-explaining what the
  code already says should be omitted, not padded.
- Code and bubble should be introduced together (temporal contiguity), not "read the
  station text, then open the code".

**Where guidance stops helping: expertise reversal.** Kalyuga, Ayres, Chandler &
Sweller (2003, "The expertise reversal effect", *Educational Psychologist* 38(1):
23–31, DOI 10.1207/S15326985EP3801_4): instructional techniques that work for novices
lose effectiveness — and can harm — experienced learners, because for them the
explanation is redundant processing. The tour therefore needs (a) difficulty ramping
rather than a flat wall of explanation, and (b) an explicit escape hatch for the
reader who already knows C, sockets-style APIs, or RDMA: per-station summaries that
can be skimmed, and stations that can be skipped without breaking the story.

**Element interactivity.** Sweller, van Merriënboer & Paas (1998, "Cognitive
architecture and instructional design", *Educational Psychology Review* 10(3):
251–296): materials differ in *element interactivity* — how many mutually-dependent
concepts must be held in working memory at once; high-interactivity material should be
presented with fewer interacting elements per step (the isolated-elements effect).
For bw.c: the counts-table-plus-window-plus-warmup mechanism (ADR-0003/0007,
research/audit-bw-c.md) is high-interactivity; the tour should introduce its parts in
isolation (what the table is; what the window is; what warmup is) before showing their
interaction in the measured-rate formula.

## Thread 3 — Sequencing strategies

**"Big picture first" is the best-supported ordering principle.** Collins, Brown &
Newman (1989, "Cognitive apprenticeship: teaching the crafts of reading, writing, and
mathematics", in Resnick (ed.), *Knowing, Learning, and Instruction*, 453–494, Erlbaum)
specify three sequencing principles for instruction: **increasing complexity**,
**increasing diversity**, and **global before local skills** — learners should "build
a conceptual map, so to speak, before attending to the details of the terrain",
because even a partial task makes sense once its place in the whole is known. This
aligns with Brooks (1983): the primary hypothesis is formed before code is seen, from
a one-phrase description. von Mayrhauser & Vans (1995) add the scaling argument:
requiring a complete program model before abstracting is overload at real code sizes —
the abstraction must come early, on partial knowledge. So the route opens with the
map (what bw.c measures, the run structure, the two roles) before the first function
is read in depth — but the map must stay small (one paragraph + one diagram's worth),
because the map itself is a worked example, and long overviews drown the newcomer in
exactly the load they exist to reduce.

**Entry-point first, then execution order.** The eye-tracking line (Busjahn et al.
2021; Peitek et al. 2020) and Pennington (1987) together support: station #2 of the
code tour is `main`; the route then follows the run's control flow — parse args →
init verbs resources → create QP → post WRs → poll CQ → teardown — rather than the
file's declaration order (which in bw.c buries the entry point under headers,
structs, constants, and the counts table). This is also the practice canon: Spinellis
(*Code Reading: The Open Source Perspective*, Addison-Wesley 2003, ch. 6 "Tackling
large projects") frames "where do you start?" as the first question of reading a
large program, and the main-first technique (start at `main`/the main loop, work
deeper) is the book's canonical answer; Hermans (*The Programmer's Brain*, Manning
2021, ch. 4) applies cognitive-load theory to reading complex code and prescribes
reducing working-memory demand (state tables, dependency graphs, temporary
refactoring) rather than reading order per se.

**Dependency-ordered (definitions before uses) vs execution-ordered: the evidence
does not pick a winner for *teaching*; it shapes how each is used.** What exists:
- For *navigation*, dependency-following is what readers do (Ko et al. 2006 — the
  "relate" activity; von Mayrhauser & Vans 1995 — cross-referencing). When a reader
  hits a use of an unknown function, they chase its definition.
- For *mental model formation*, the control-flow/program model comes first (Pennington
  1987), and experienced readers follow execution flow (Peitek et al. 2020).
- A route that makes the reader stop the story to read every definition in full would
  become a line-by-line systematic pass — the strategy von Mayrhauser & Vans found
  thorough but unrealistic, and the one novices already fail at by default.
- Therefore the defensible synthesis: **order the stations by execution flow, and
  attach definitions just-in-time at the first use site** — the definition of a
  struct field or helper appears as a station when the story first needs it, not
  earlier in file order, not later in a glossary. This keeps element interactivity
  low (thread 2) while matching both the control-flow-first mental model and the
  dependency-following navigation habit. (The one structure that *is* worth
  visiting early despite being a definition: the central data structures the primary
  hypothesis needs — Brooks's primary hypothesis names "major data structures".)
- Note the caveat Peitek et al. add: code linearity affected reading order more than
  experience or strategy — bw.c's own physical layout (structs and tables at the
  top, `main` lower) will fight a naive reader's execution-order scanning; the tour's
  ordering is exactly the compensation for that.

**Difficulty-ramped ordering.** Evidence for ramp rather than plateau: cognitive
apprenticeship's *increasing complexity* and *increasing diversity* (Collins et al.
1989); the completion strategy's fading (fewer blanks filled by the material,
more by the learner — van Merriënboer 1990); expertise reversal (Kalyuga et al.
2003); element interactivity (Sweller et al. 1998). For bw.c: single-function
stations first (usage.c-style one-liners: "this call posts a work request"), then
compound mechanisms (the window/refill condition, the warmup-in-the-window
arithmetic, the counts table), with the tour's hardest station (why the envelope has
its shapes — see research/dma-regime-shape.md) last, built from parts already
visited. The ramp also implies *diversity*: not everything follows the data path;
setup, signaling, and teardown should all be touched before the finish, or the
newcomer's schema overfits the hot path.

**Guided route vs free exploration.** Kirschner et al. (2006) and the worked-example
line (Sweller & Cooper 1985; van Merriënboer 1990) favor the guided route for a
newcomer to a specific codebase; the OSS onboarding evidence adds that "finding a way
to start" is one of the named newcomer barriers (Steinmacher, Graciotto Silva,
Gerosa & Redmiles 2015, "A systematic literature review on the barriers faced by
newcomers to open source software projects", *Information and Software Technology*
59:67–85, DOI 10.1016/j.infsof.2014.11.001). The tour's existence removes that
barrier. The boundary is the expertise-reversal line: the route must degrade
gracefully for the reader who already knows C/RDMA (skimmable summaries, skip
stations), and the tour itself should not be the *only* door — free exploration
remains the right mode for an expert (Roehm et al. 2012 found professionals use
structured strategies they already own).

## Thread 4 — Code-tour product conventions

**Swimm** (first-party: swimm.io blog, "Walk developers through your codebase with
Documentation Playlists"; product docs live behind docs.swimm.io):
- Structure: *walkthrough documentation* — "a guided tour of the codebase from
  landmark to landmark", code-coupled, explaining patterns and multi-file flows;
  delivered as *Documentation Playlists* — ordered collections of docs, links,
  videos, Markdown files, images, stored *as Markdown in the repo* (`.pl.sw.md`),
  git-tracked, PR-reviewable; progress is tracked per user.
- Ordering principle: the product's stated one is minimal — playlists exist "for
  docs to be consumed in a particular order"; the order itself is left to the author
  (no difficulty/dependency heuristic documented). Steps can be added/ordered/removed
  in a drag-and-drop editor; playlists nest inside playlists.
- Station sizing: "keep docs long enough to be worthwhile but not so long they
  become cumbersome"; when a doc needs splitting, split it into a playlist —
  i.e. prefer many small steps over few large ones.
- Onboarding is "the most straightforward and powerful use case" (also offboarding,
  runbooks).
- Pitfall it exists to solve: staleness — live code snippets plus Auto-sync keep the
  tour attached to the code as it changes.

**CodeTour (VS Code)** (first-party: microsoft/codetour README):
- Structure: a tour is an ordered list of steps; each step anchors to a `file`+`line`
  (or directory/URI/selection/regex) with a markdown `description`; *content steps*
  (title + markdown, no file anchor) exist for intro/closing; steps have optional
  `title`, can run `commands`, and markdown supports step references (`[#2]`), tour
  references, shell-command links, and insertable code blocks.
- Storage: JSON `.tour` files in `.tours/` (or `.vscode/tours`) — in the repo, like
  Swimm; a tour can be `isPrimary` (auto-prompted on repo open); `ref` pins a tour to
  a branch/tag/commit and can be "rebased"; tours can be exported as self-contained
  files.
- Station size convention: steps are small — one file and line range, one function's
  worth of code, description on the spot; tours typically run 5–20 steps.
- Pitfall it exists to solve: *tour drift* — the CodeTour Watch GitHub Action fails
  CI when a PR/commit changes code referenced by a tour.
- GitHub itself ships no native code-tour product (no first-party tour feature found
  in GitHub's docs; the "code tours" convention is the VS Code extension above).
  GitHub's first-party `github/awesome-copilot` repo now carries a *code-tour skill*
  (SKILL.md) codifying authoring conventions: persona-targeted tours (new joiner,
  external contributor, tech lead) with audience-named files; step-count calibration
  (Quick 5–8, Standard 9–13, Deep 14–18); a narrative arc — orientation (anchored to
  a real file/directory, not content-only), high-level map, core path, closing with
  follow-up tour suggestions; and a description formula (Situation, Mechanism,
  Implication, Gotcha).

**Sourcegraph** (first-party: sourcegraph.com blog, release 3.39; "notebooks-ci"
post): no guided-tour product; the nearest is *Sourcegraph Notebooks* (GA in 3.39,
2022) — markdown + *live search-query blocks* + *file blocks* rendering
syntax-highlighted code at a pinned repo+revision+file+line-range. Positioning is
"living documentation" that "doesn't go stale", used for onboarding and for
explaining flows (their CI explainer). The transferable convention: **anchor
explanations to file+line ranges that render from the live repo**, not to
copy-pasted snippets that can rot.

**JetBrains**: in-IDE walkthrough/tutorial support exists for plugin onboarding, but
its public SDK documentation could not be located in this research pass
(plugins.jetbrains.com docs pages returned 404s); no convention is cited from it.

**Cross-product synthesis of conventions:** tours live *in the repo* as editable
files; steps are small (one file+line anchor, markdown description); the narrative is
orientation → map → core path → closing; progress is tracked; the headline pitfall
is staleness, addressed by pinning to refs/commits and by CI checks; ordering beyond
"the order you author" is left to the author in every product — none of the products
document a difficulty-, dependency-, or execution-based ordering principle, so the
route draft must take its ordering from threads 1–3, not from the products.

---

## What the evidence does NOT settle

1. **Definitions-before-uses vs execution-order as a *learning* route.** No
   experiment found directly compares presentation orders for teaching an unfamiliar
   program. The route draft must decide; the evidence leans execution-order with
   just-in-time definitions (Pennington 1987; Peitek et al. 2020; Ko et al. 2006), but
   that is a synthesis, not a measured result.
2. **Data-first vs control-first.** Pennington (1987) shows the program model forms
   around control flow; Brooks (1983) puts major data structures inside the primary
   hypothesis. Which to present *first* is untested. Draft decision: structures in
   the overview, details at use sites.
3. **Station granularity and total length.** No experimental literature on step size
   for code tours. Practice (CodeTour steps, GitHub-skill counts 5–18/tour, Swimm's
   "split when cumbersome") points to small stations and, at 40–60 stations, a route
   that should be structured as *several sequential tours* (CodeTour `nextTour`,
   Swimm nested playlists) rather than one marathon — but that is convention, not
   evidence. Similarly, whether a newcomer should do the whole route in one sitting
   (spacing/interleaving research exists for practice, not for tours) is open.
4. **Where exactly the expertise-reversal line sits for a "knows C, knows networking,
   not RDMA" reader.** The effect is established (Kalyuga et al. 2003); its
   application point in this specific audience is not. The route needs the skimmable
   escape hatch; how aggressively to use it is a judgment call for the draft.
5. **How much prediction the stations should demand.** Completion problems beat
   generation for *learning to program* (van Merriënboer 1990); no study applies the
   completion effect to *learning an existing program*. "Predict-then-confirm"
   stations are well-motivated but unmeasured at this scale.
6. **Whether narrative order should ever break execution order for comprehension
   payoff.** For bw.c, one candidate break exists (visiting the counts table and the
   measurement window before the data path so the run's result is interpretable);
   there is no evidence either way for such breaks — the draft must decide on
   pedagogical grounds (element interactivity argues for early, isolated
   introduction of the table).
7. **Long-term retention vs immediate understanding.** The studies above measure
   comprehension and transfer in the lab; none measures what a newcomer retains of a
   codebase weeks later. The draft should not over-optimize for retention claims.

---

## Sources

**Program comprehension**
- Shneiderman & Mayer, 1979, "Syntactic/semantic interactions in programmer behavior:
  a model and experimental results", Int. J. Parallel Programming 8(3):219–238,
  DOI 10.1007/BF00977789
- Brooks, 1983, "Towards a theory of the comprehension of computer programs", Int. J.
  Man-Machine Studies 18(6):543–554, DOI 10.1016/S0020-7373(83)80031-5
- Soloway & Ehrlich, 1984, "Empirical studies of programming knowledge", IEEE TSE
  SE-10(5):595–609, DOI 10.1109/TSE.1984.5010283
- Letovsky, 1986, "Cognitive processes in program comprehension", Empirical Studies
  of Programmers 1, 58–79 (Ablex)
- Wiedenbeck, 1986, "Beacons in computer program comprehension", Int. J. Man-Machine
  Studies 25(6):697–709, DOI 10.1016/S0020-7373(86)80083-9
- Pennington, 1987, "Stimulus structures and mental representations in expert
  comprehension of computer programs", Cognitive Psychology 19:295–341,
  DOI 10.1016/0010-0285(87)90007-7; and "Comprehension strategies in programming",
  Empirical Studies of Programmers 2, 100–113
- von Mayrhauser & Vans, 1995, "Program comprehension during software maintenance and
  evolution", IEEE Computer 28(8):44–55, DOI 10.1109/2.402076
- Ko, Myers, Coblenz & Aung, 2006, "An exploratory study of how developers seek,
  relate, and collect relevant information during software maintenance tasks", IEEE
  TSE 32(12):971–987, DOI 10.1109/TSE.2006.116
- Roehm, Tiarks, Koschke & Maalej, 2012, "How do professional developers comprehend
  software?", ICSE '12, 255–265, DOI 10.1109/ICSE.2012.6227188
- Busjahn, Simon & Paterson, 2021, "Looking at the main method — an educator's
  perspective", Koli Calling '21, DOI 10.1145/3488042.3488068
- Busjahn, Schulte, Sharif, Begel, Hansen, Bednarik, Orlov, Parnin, Sasankar &
  Weiskopf, 2015, "Eye movements in code reading: relaxing the linear order", ICPC
  '15 (as replicated by Peitek et al.)
- Peitek, Siegmund & Apel, 2020, "What drives the reading order of programmers? An
  eye tracking study", ICPC '20, 342–353, DOI 10.1145/3387904.3389279

**Cognitive load & worked examples**
- Sweller, 1988, "Cognitive load during problem solving: effects on learning",
  Cognitive Science 12(2):257–285
- Sweller & Cooper, 1985, "The use of worked examples as a substitute for problem
  solving in learning algebra", Cognition and Instruction 2(1):59–89
- Tarmizi & Sweller, 1988, "Guidance during mathematical problem solving", Journal of
  Educational Psychology 80(4):424–436
- Chandler & Sweller, 1991, "Cognitive load theory and the format of instruction",
  Cognition and Instruction 8(4):293–332
- Ginns, 2006, "Integrating information: a meta-analysis of the spatial contiguity
  and temporal contiguity effects", Learning and Instruction 16(6):511–525,
  DOI 10.1016/j.learninstruc.2006.10.001
- Kalyuga, Ayres, Chandler & Sweller, 2003, "The expertise reversal effect",
  Educational Psychologist 38(1):23–31, DOI 10.1207/S15326985EP3801_4
- Kirschner, Sweller & Clark, 2006, "Why minimal guidance during instruction does not
  work", Educational Psychologist 41(2):75–86, DOI 10.1207/s15326985ep4102_1
- van Merriënboer, 1990, "Strategies for programming instruction in high school
  programs"; van Merriënboer & de Croock, 1992, "Strategies for computer-based
  programming instruction: program completion vs. program generation" (completion
  effect; results summarized per the sources above)
- Sweller, van Merriënboer & Paas, 1998, "Cognitive architecture and instructional
  design", Educational Psychology Review 10(3):251–296
- Berssanette & de Francisco, 2022, "Cognitive load theory in the context of teaching
  and learning computer programming: a systematic literature review", IEEE
  Transactions on Education 65(3):440–454, DOI 10.1109/TE.2021.3127215

**Sequencing**
- Collins, Brown & Newman, 1989, "Cognitive apprenticeship: teaching the crafts of
  reading, writing, and mathematics", in Resnick (ed.), Knowing, Learning, and
  Instruction, 453–494 (Erlbaum) — increasing complexity, increasing diversity,
  global before local
- Steinmacher, Graciotto Silva, Gerosa & Redmiles, 2015, "A systematic literature
  review on the barriers faced by newcomers to open source software projects",
  Information and Software Technology 59:67–85, DOI 10.1016/j.infsof.2014.11.001
- Spinellis, 2003, Code Reading: The Open Source Perspective (Addison-Wesley),
  esp. ch. 6 "Tackling large projects" — practice canon (secondary synthesis of the
  papers above)
- Hermans, 2021, The Programmer's Brain (Manning), ch. 4 "How to read complex code"
  — cognitive-load application to code reading (secondary synthesis)

**Code-tour products (first-party)**
- Swimm — "Walk developers through your codebase with Documentation Playlists",
  https://swimm.io/blog/documentation-playlists (and product docs at docs.swimm.io)
- CodeTour (VS Code), microsoft/codetour README,
  https://github.com/microsoft/codetour (schema, refs, CodeTour Watch CI drift check)
- GitHub awesome-copilot "code-tour" skill (SKILL.md),
  https://github.com/github/awesome-copilot/blob/main/skills/code-tour/SKILL.md
- Sourcegraph — release 3.39 (Notebooks GA), https://sourcegraph.com/blog/release-3-39;
  "How we used Notebooks to make our CI more accessible and understandable",
  https://sourcegraph.com/blog/notebooks-ci
