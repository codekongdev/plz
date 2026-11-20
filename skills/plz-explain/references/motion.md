# Motion rules

How each step moves, how long it takes, and when the caption appears. SKILL.md gives each step a motion kind (question 4 of "Choosing a form per chapter"); this file gives the rules and numbers behind it, with their sources. The engine already applies the defaults (the director, `a.move`, `a.along`, auto-play); you choose the kind of each step, the waits, and what moves together.

Each rule is marked:

- **evidence**: an experiment or meta-analysis measured it;
- **standard**: an accessibility success criterion (WCAG 2.2);
- **heuristic**: practice guidance or a starting value we chose; no experiment fixed the number.

## Why motion is kept small

The average learning gain of animation over static pictures is small. A meta-analysis of 140 comparisons found g = 0.226 overall, and 59.3% of the comparisons showed no significant difference. It was weakest for abstract depictions (g ≈ 0.006), for computing topics (g ≈ 0.11) and for animation accompanied by written text (g = 0.105) ([Berney & Bétrancourt 2016](https://archive-ouverte.unige.ch/unige:92234)), which is exactly what these pages are. Animation helps when the visible change itself is what is learned ([Ploetzner et al. 2021](https://link.springer.com/article/10.1007/s11251-021-09541-w)). Readers also like animation that lowers their accuracy, so judge a page by what the reader understands, not by how lively it is ([Heer & Robertson 2007](https://homes.cs.washington.edu/~jheer/files/2007-AnimatedTrans-InfoVis.pdf), [Robertson et al. 2008](https://faculty.cc.gatech.edu/~stasko/papers/infovis08-anim.pdf)).

So: motion only on the change being learned, one kind of change per step, and the result left on the stage as a static trace.

## Motion kinds

Give every step exactly one kind. The kind decides the timing and the wording of its caption.

| Kind | What happens | How to build it | Caption |
|---|---|---|---|
| **causes** | A really makes B happen: a request hits a wall and the wall blocks it, a row reaches a filter and is dropped | Start B within about 100 ms of A's arrival: no `a.wait` between them (`await a.move(p, wall); await a.flash(wall, …)`), at most a few tens of ms (the filter pattern uses `a.wait(60)`) | "so", "which", or the effect stated as the result: "The wall blocked it." |
| **follows** | B only comes after A; A does not make B happen | Leave a visible pause (`a.wait(300–600)`) and do not let A touch B | "then", "next", "after that" |
| **appears** | A part, a token or a value enters | `a.fade(part, 1)` (250 ms), `a.scaleTo(obj, 1)` (500 ms), a new token in the group that moves it | What appeared and why |
| **leaves** | Something is dropped, removed or taken out | Its own step, apart from other movement; fade it, leave a trace, and count it when there are several (`box.tally(n)` with `a.tick`). Traces: a struck-through row (`row(i).mark('gone')`), a struck-through lane value (`mark('lost')`), a part faded to about 0.3 (`a.fade(part, 0.3)`), a label that now says what is gone | What left and how many |
| **highlight** | Attention moves to a part without changing state | `a.flash(part)` (svg 200 ms), `mark('active')`; one cue per step | What the reader should look at |

The camera is not a kind you author: the axo kit moves the camera only on chapter changes.

## Rules and numbers

| Rule | Value | Kind of rule | Source | In the engine |
|---|---|---|---|---|
| Duration of a tracked move | About 1 s per step; 0.5 s steps made viewers lose objects. Do not go below 0.7 s | evidence (the 0.7 s floor is a heuristic) | [Heer & Robertson 2007](https://homes.cs.washington.edu/~jheer/files/2007-AnimatedTrans-InfoVis.pdf) | `a.move` (axo) and `a.along` (svg) default to 1000 ms |
| Easing | Slow-in/slow-out tracks best | evidence | [Dragicevic et al. 2011](https://cs.au.dk/~elm/pdf/timedistort.pdf) | The director's default ease |
| Objects moving at once | 3–4 at most; 1–2 when the reader must keep track of which is which | evidence | [Jiang et al. 2026](https://openaccess.city.ac.uk/id/eprint/37310/) | `a.groups` moves 3 at a time by default, 4 at most |
| Staggered starts | No help for tracking, sometimes harmful; use only to keep tokens from overlapping | evidence | [Chevalier et al. 2014](https://archivesic.ccsd.cnrs.fr/CRISTAL-MINT/hal-01054408v1) | Move a group together |
| Entering and leaving | More than four at once are easily missed; in a large set about 10–15% must change before the change is noticed | evidence | [Jiang et al. 2026](https://openaccess.city.ac.uk/id/eprint/37310/) | A "leaves" step of its own, with a counter |
| Gap between cause and effect | Contact then launch reads as causation, strongest at 30–40 ms and reliable up to about 100 ms; longer gaps or a distance between the objects weaken it | evidence | [Scholl & Nakayama 2002](https://www.ocf.berkeley.edu/~knakayama/wp-content/uploads/2019/03/116psycholsciScholl2002.pdf) | No wait between a cause and its effect |
| Things that move together | Unrelated objects starting at the same moment, an effect moving before its signal arrives, or a part that idles and breathes all suggest causes that do not exist | evidence (from the same work) | [Scholl & Nakayama 2002](https://www.ocf.berkeley.edu/~knakayama/wp-content/uploads/2019/03/116psycholsciScholl2002.pdf) | Nothing animates unless a run asks for it |
| Staging | Split a change of several properties into steps, but do not over-split: minimise unnecessary motion rather than doing one thing at a time | evidence | [Heer & Robertson 2007](https://homes.cs.washington.edu/~jheer/files/2007-AnimatedTrans-InfoVis.pdf) | One kind of change per step, several objects in it if they move alike |
| Highlights and feedback | 100–300 ms | heuristic | [NN/g, animation duration](https://www.nngroup.com/articles/animation-duration/), [Material motion](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md) | svg `a.flash` 200 ms, `a.fade` 250 ms. The axo `a.flash` defaults to 700 ms because it marks a state ("blocked", "breached"); pass `ms` of 300 or less for a cue that only points |
| Entrances and exits | Entrance about 300 ms (decelerating), exit 200–250 ms (accelerating) | heuristic | [NN/g](https://www.nngroup.com/articles/animation-duration/), [Material](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md) | `a.fade` 250 ms; `a.scaleTo` 500 ms |
| Camera | Only in its own beat, before the causal motion; rotation is harder to follow than panning or zooming; duration grows with distance (450–1000 ms) | evidence (rotation, own beat) and heuristic (durations) | [Heer & Robertson 2007](https://homes.cs.washington.edu/~jheer/files/2007-AnimatedTrans-InfoVis.pdf), [d3.interpolateZoom](https://d3js.org/d3-interpolate/zoom), [Material](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md) | The axo camera moves only on chapter changes |
| Captions after the motion, next to the change | Show the caption when the step has happened, at the changed element; keep every caption of the run | evidence (lab medians: temporal contiguity d = 1.31, spatial contiguity d = 0.82) | [Mayer 2023](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-research-based-principles-for-designing-multimedia-instruction-mayer.pdf) | `say()` after the `await`; `{ anchor }` puts the number on the part; the rail accumulates captions |
| Leave the result | Animation shows the process but not the resulting structure; keep the end state as a static trace (matched rows stay marked, lane arrows stay drawn) | heuristic (expert practice) | [Bostock, Visualizing Algorithms](https://bost.ocks.org/mike/algorithms/) | svg marks, dimmed links and lane traces stay until reset |
| Same object, same mark | An object stays the same graphic element through a transition; labels move with their marks, entering and leaving items fade | heuristic (expert practice) | [Bostock, Object Constancy](https://bost.ocks.org/mike/constancy/) | Tokens carry their key; axo labels are children of what they label |
| Reading time per caption | About 1000–1300 ms of `a.wait` after a caption before the next step | heuristic (no study found) | — | You set it with `a.wait` |
| Auto-play hold | 600 ms to see the start state, 2800 ms to read the end state | heuristic | — | `AUTORUN_DELAY`, `AUTORUN_HOLD` |
| Auto-play | Off by default. Motion that starts by itself (scrolling into view counts) and lasts more than 5 s needs a way to stop it | standard (WCAG 2.2.2, Level A) | [WCAG 2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) | The auto-play switch is off by default and stops the loop |
| Flashing | No more than three flashes in any one second | standard (WCAG 2.3.1, Level A) | [WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) | One `a.flash` per step; never loop a flash |
| Reduced motion | Reduce, do not remove: keep the step order and every dwell; movement becomes a cut; colour and opacity changes may still animate | standard (WCAG 2.3.3, Level AAA) and heuristic | [WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), [Val Head, Smashing 2020](https://www.smashingmagazine.com/2020/09/design-reduced-motion-sensitivities/) | The director does this under `prefers-reduced-motion: reduce` |
| Pace | The designed pace by default; learner controls are secondary. In the meta-analysis the gain held only when the system set the pace (g = 0.309), not when learners controlled it (g ≈ −0.12) | evidence | [Berney & Bétrancourt 2016](https://archive-ouverte.unige.ch/unige:92234) | Run plays at the chosen speed; Step and the speed menu are aids |
| Predict before watching | Watching a demonstration passively taught no more than not seeing it; predicting first did. What learners do with a visualization matters more than what it shows | evidence | [Crouch et al. 2004](https://www.compadre.org/IntroPhys/items/detail.cfm?ID=2329), [Hundhausen et al. 2002](https://faculty.cc.gatech.edu/~stasko/papers/jvlc02.pdf) | `step: true`, and a question in the body before the run |
| No decoration | Leave out decorative motion, idle spinning and side attractions; novices pick up what is salient, not what is relevant | evidence (coherence d = 0.86, lab median) | [Mayer 2023](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-research-based-principles-for-designing-multimedia-instruction-mayer.pdf), [Lowe 2003](https://www.bohrium.com/paper-details/animation-and-learning-selective-processing-of-information-in-dynamic-graphics/812418101759967235-11581) | Nothing moves outside a run |

## Between chapters

- One form per chapter; the stage changes at the chapter boundary.
- Between chapters that share no structure, cut (the engine switches the stage). Do not connect unrelated diagrams with motion: animation between states that share no data suggests relations that do not exist ([Heer & Robertson 2007](https://homes.cs.washington.edu/~jheer/files/2007-AnimatedTrans-InfoVis.pdf)).
- Keep the three semantic colours (actor red, bound blue, matter brass) and the same label for the same thing in every chapter and both kits, so the reader recognises an object across a change of form.
- Order chapters from small to large ([Nicky Case](https://blog.ncase.me/explorable-explanations/)): author-led step chapters first, a comparison after the reader knows one variant, free exploration (playgrounds) last, as in the martini-glass structure ([Segel & Heer 2010](https://homes.cs.washington.edu/~jheer/files/narrative.pdf)).
