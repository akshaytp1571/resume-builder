## What this changes

<!-- A sentence or two. What is different after this PR? -->

## Why

<!--
The reason, not the diff. If this fixes a bug: what was the bug, and how did it
manifest? Link the issue with "Closes #123" if there is one.
-->

Closes #

## How I verified it

<!--
"npm test passes" is the floor. Better: what did you try that failed before,
and what would catch this if it came back?
-->

- [ ] Reproduced the problem before the change
- [ ] Confirmed the new/updated test fails without the fix
- [ ] Ran the app and checked the change by hand

## The gate

```bash
npm test        # all four suites, chained with &&
npm run lint    # 0 errors
```

- [ ] `npm test` exits 0
- [ ] `npm run lint` reports 0 errors
- [ ] `npx vite build` succeeds (if you touched anything that ships)

## Checklist

- [ ] No new dependency — or, if there is one, I justified it below
- [ ] Tests assert observable behaviour, not call counts
- [ ] Any deliberate simplification is marked with a `ponytail:` comment
- [ ] Comments explain *why*, not *what*
- [ ] I have not committed credentials, API keys, `.env.local`,
      `.scraper-profile/`, or any real resume data

## Risk

<!--
Tick anything that applies and describe it. These are the changes most likely to
hurt a user, so reviewers need to know.
-->

- [ ] Changes the store shape or a `localStorage` key (migration considered?)
- [ ] Changes an exported file format (PDF / DOCX output differs)
- [ ] Changes the print CSS or the vector PDF path
- [ ] Touches the AI boundary — what is sent, or to where
- [ ] Touches the service worker or the offline cache
- [ ] Changes accessibility behaviour (focus, labels, keyboard)
- [ ] Changes the job agent's fill / submit / safety behaviour

## Screenshots

<!-- For anything visual. Blur or use the fictional sample resume. -->

## Dependency justification

<!-- Only if you added one: what it does, why a few lines cannot, what it costs. -->
