---
name: ui-ux-design
description: Procedure for the Designer agent to produce implementation-ready UX flows, wireframes, component specs, responsive and accessibility requirements from approved requirements, and to review an implementation against them.
---

# UI/UX design procedure (Designer)

1. **Inputs**: approved REQs/ACs only. Inspect existing UI/design tokens in the repo; extend, don't diverge. If none, define minimal tokens (color, type scale, spacing, radius) and request an ADR.
2. **Flows**: `.ai-team/design/ux-flows/<slug>.md` - Mermaid flowchart per journey incl. error and empty paths, each node tagged with REQ IDs.
3. **Information architecture**: pages/screens, navigation, content hierarchy.
4. **Wireframes** (when a screen is new/changed): ASCII or SVG per breakpoint (mobile 360, tablet 768, desktop 1280).
5. **Specs** `.ai-team/design/design-specs/<slug>.md`: per component - purpose, props/content, exact tokens/sizes, **all states** (default, hover, focus, active, disabled, loading, empty, error, success), validation messages and copy, keyboard behavior, responsive rules.
6. **Accessibility** (WCAG 2.2 AA): contrast >= 4.5:1 text, focus order and visible focus, labels/ARIA roles, touch targets >= 24px (prefer 44), reduced motion, error association.
7. **Ambiguity**: any undefined behavior -> OPEN_QUESTION to `ba`; never decide business behavior.
8. **Implementation review**: read the code/screens, list deviations as `location | spec reference | required correction`.
9. Return the HANDOFF block.
