# Contributing to RailEffect

## Historical corrections
Open a **Data correction** issue with the town, year, proposed value and evidence (census table + page, or archival item). A maintainer checks the page image. Accepted corrections are added to `data/metadata/visual_verification.csv` (with the source page) and the pipeline is re-run; the change is visible in the commit history.

## New sources
Open a **Source contribution** issue. Include reuse terms. Do not upload material whose licence forbids redistribution.

## Code
1. `npm ci`, `pip install -r pipeline/requirements.txt`.
2. Keep every published number computed from data; never hard-code findings in UI copy.
3. Run `npm run typecheck && npm run lint && npm test && npm run test:e2e` and `pytest pipeline/tests`.
4. Label statements as observed fact, computed result, historical interpretation or uncertain inference.

## Rules
- Never synthesise or interpolate historical observations.
- Never cite a source you have not inspected.
- Test fixtures must stay inside `tests/` and must not be presented as historical records.
