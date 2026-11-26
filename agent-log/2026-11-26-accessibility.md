# Website accessibility (IS 5568 / WCAG 2.0 AA)

## Asked
Apply, in order, the website accessibility requirements from the Kol Zchut page on accessibility of websites and apps for people with disabilities.

## What the page requires of this site
1. Conform to Israeli Standard 5568, which adopts WCAG 2.0. The page does not name a level; AA is the level the regulations use.
2. Publish an accessibility statement. It must say how the site was made accessible, how to operate it, what is not accessible (with alternatives), and how to contact the operator about accessibility.

The page's video, PDF and app rules do not apply yet: the site has no videos, no PDFs, and no app. The duty lies with the site operator (the business), not with the builder.

## Done (branch `feature/accessibility` from `dev`)
- Contrast:
  - The brand orange `#c2652a` becomes `#9e4e1c` (tokens `primary`, `sahara-primary` and `sienna`, plus hard-coded uses); the hover colour becomes `#8a4518`.
  - The `secondary` and `subtle-text` greys become `#675f58`.
  - Text in `outline` grey now uses `on-surface-variant`, and text with reduced opacity was made fully opaque.
- Names: aria-labels on the dimension inputs and sliders, the pagination buttons and the currency select.
- On every page: a skip link to `#main`; a visible `:focus-visible` outline that overrides `outline-none` utilities; `aria-hidden` on Material icon glyphs (in the HTML and in interior.js); a footer link to the statement.
- 3D canvas: `role="img"` and a description that points to the text panel.
- New page `frontend/accessibility.html`. Contact details are placeholders until the business supplies them.
- `css/styles.css` rebuilt with Tailwind 3.4.17.

## Verified
- axe-core 4.10.2 with the wcag2a and wcag2aa rules, run in Edge through playwright-core on all 12 pages. It started at 89 contrast, 9 label, 2 button-name and 1 select-name violations, and ended at 0. The scripts are in the session scratchpad and are not committed.
- Keyboard: on 5 pages, the first Tab focuses the skip link with a 3px solid outline, and Enter moves to `#main`.
- At a 640px viewport (200% zoom): no horizontal scroll on any page.
- `pytest`: 73 passed. `node --test frontend/tests/geometry.test.mjs`: 5 passed.

## Open
- The business must fill in the accessibility coordinator's name, phone and email in `accessibility.html`. The statement is not complete without them.
- At narrow widths the header's step navigation hides (`hidden md:flex`, pre-existing). The other links still give access to every page, but a menu button would be better.
- Not tested: real screen readers (NVDA/VoiceOver). Automated tools catch only part of WCAG.
- The statement is in English, like the site. If a Hebrew version of the site is added, the statement should be translated too.
- Pushing needs write access: the `dornachman` account has `push: false` on `JonathanZouari/ai-wardrobe-configurator`.
