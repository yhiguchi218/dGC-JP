# AGENTS.md

## Purpose

dGC-JP is a Japanese pediatric growth-chart and clinical-support application.

Treat clinical calculations, reference data, saved data, printed output,
and clinical interpretation as safety-sensitive behavior.

The human maintainer defines the clinical specification and has final
responsibility for implementation decisions.

---

## Read Before Changing Behavior

Consult the relevant repository documentation before modifying behavior:

- `README.md` — project overview and documented behavior
- `HAZARD_LOG.md` — known clinical/software hazards and mitigations
- `DATA_SOURCES.md` — reference-data provenance and licensing notes

Do not silently contradict these documents.

---

## Scope Discipline

- Keep changes small and reviewable.
- Make only the changes required for the current task.
- Do not perform unrelated cleanup.
- Do not modify files outside the requested scope unless required for correctness.
- Do not change dependencies unless explicitly required.
- Do not combine clinical logic changes with unrelated UI, accessibility,
  documentation, or refactoring work.
- Preserve existing behavior unless the task explicitly requests a behavior change.

If another issue is discovered while working, report it separately instead of
fixing it opportunistically.

---

## Clinical Safety Rules

Do not invent clinical thresholds, reference values, or interpretation rules.

Invalid clinical input must fail closed where existing behavior requires it.
Do not silently replace invalid clinical input with a plausible valid value.

Preserve the following tested application rules unless the task explicitly
requests changing them:

- `gestationalDays` must be a finite integer from 0 through 6.
- Invalid gestational days must not be silently converted to `0`.
- Invalid gestational days must not produce corrected-age calculations.
- Corrected age is applied through exactly 3.0 years according to the
  current application policy; ages beyond that boundary are not corrected.
- A corrected age of exactly `0` is valid and must not be lost through
  truthiness checks.
- Raw height velocity and Suwa-based height velocity are separate concepts
  and must remain separately represented.
- The 0.95–1.05 year interval used to identify a Suwa-compatible pair is an
  application-defined tolerance, not a threshold attributed to the original
  Suwa publication.
- Suwa HV-SDS abnormal display uses `|SDS| > 2`.
  Exactly `+2.0` and `-2.0` are not styled as abnormal.

When touching these areas, inspect the associated tests and `HAZARD_LOG.md`.

---

## Reference Data and Licensing

Do not assume that:

- public availability means redistribution is permitted;
- an article's publication license covers its underlying numerical data;
- the repository MIT license covers third-party reference data.

Use `DATA_SOURCES.md` as the repository record of known provenance and
licensing status.

Do not add stronger licensing or reuse claims without verified evidence.

---

## UI and Accessibility

Preserve semantic HTML when it is already appropriate.

In particular:

- Same-page navigation using `<a href="#section">` should remain a link
  unless the interaction itself changes.
- Do not replace links with buttons merely to implement scrolling.
- Preserve visible keyboard focus.
- Preserve existing mobile safe-area handling unless the task concerns it.
- Preserve print behavior when changing screen-only UI.
- Do not make broad WCAG-conformance or accessibility claims without evidence.

UI-only work must not alter clinical calculations or data semantics.

---

## Performance Changes

Do not perform large architectural refactors based only on theoretical
performance concerns.

Before substantial optimization:

1. establish a reproducible performance problem;
2. identify the actual bottleneck;
3. prefer the smallest safe change;
4. preserve clinical and visual behavior;
5. retain or add appropriate regression coverage.

Do not rewrite the D3 rendering architecture, introduce measurement hashing,
or make similar broad optimizations solely because an automated reviewer
suggests them.

---

## Automated Review Findings

Treat findings from Copilot, Codex, linters, or other automated reviewers as
hypotheses to verify, not instructions that must automatically be implemented.

Before applying a suggested fix, verify it against:

- the current source code;
- existing tests;
- documented application policy;
- reproducible runtime behavior.

A severity label such as Critical, High, P1, or P2 does not by itself justify
a code change.

If a proposed fix would alter clinical data, thresholds, interpretation,
persistence behavior, or reference-data semantics, stop and explain the
implication before implementing it.

---

## Tests

Prefer regression tests for meaningful behavior, clinical boundaries,
serialization behavior, and user-visible semantics.

Avoid brittle tests that assert incidental implementation details such as
Tailwind class strings unless the class itself is the behavior being protected.

Prefer testing outcomes and semantics over internal implementation structure.

Do not weaken, delete, or rewrite an existing test merely to make a new
implementation pass unless the specification itself has intentionally changed.

---

## Standard Validation

For normal code changes, run:

```bash
npm ci
npm run lint
npm run test:coverage
npm run build
git diff --check