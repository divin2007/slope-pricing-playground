# Design QA

- Source visual truth: `C:\Users\mahor\Pictures\Screenshots\Screenshot 2026-06-13 004020.png`
- Supporting source visuals: screenshots `004046`, `004114`, and `004132`
- Implementation screenshot: `qa-output\desktop-locations.png`
- Mobile screenshot: `qa-output\mobile-locations.png`
- Combined comparison: `qa-output\comparison.png`
- Viewport: 1840 x 1024 desktop and 390 x 844 mobile
- State: terrain map, measured default route, empty dataset before logging

**Findings**

- No actionable P0, P1, or P2 issues remain.
- Typography preserves the reference's bold operations-console hierarchy with a
  clearer display/body split.
- Spacing and layout retain the two-column desktop structure and collapse cleanly
  to one column on mobile without horizontal overflow.
- Colors map closely to the source's midnight navy, terrain yellow, mint green,
  red, blue, and violet semantic accents.
- The real Esri terrain layer and OpenStreetMap road layer replace decorative map
  approximations. Phosphor icons provide a consistent icon family.
- Copy now describes an independent research tool. Simulator, adjustable pricing
  formula, and suggested-fare copy were intentionally removed because they would
  bias the requested dataset.
- Route selection, map-mode switching, landmark presets, observed-fare logging,
  local persistence, row deletion, and multi-sheet Excel download were exercised.
- Live autocomplete selected a real Kimironko result from the mapped-place index.
- An approved browser geolocation fix was reverse-labelled and set as stop B,
  triggering a new route and terrain analysis.
- GPS now displays a blue device marker and uncertainty circle on the map before
  changing either endpoint. A precise 18 m fix was confirmed successfully; a
  deliberately coarse 900 m fix visibly showed its uncertainty and was cancelled
  without changing the route. The marker is draggable for manual road correction.
- Start A and stop B each accept validated latitude/longitude input. Both endpoint
  markers are draggable and a drop updates the stored coordinates and re-measures
  the route.
- Reversing A and B swaps the endpoints and requests the legal reverse driving
  route. Directional ascent, descent, net elevation, steep uphill share, and
  steep downhill share are recalculated. A QA route changed from `+229 m / -103 m`
  to `+54 m / -177 m`; the non-mirrored totals reflect different legal road
  geometry in the reverse direction.
- Mobile body width equals viewport width (390 px); no horizontal page overflow.
- Browser console finished with no errors.

**Patches Made**

- Smoothed elevation samples before climb/drop and grade calculations.
- Calculated grade over a minimum 50-meter road window and capped implausible
  outliers at 35%.
- Batched elevation requests so the profile covers the full route.
- Added a data dictionary sheet to document model-ready fields.

**Follow-up Polish**

- A production deployment should use an authenticated routing/elevation provider
  with published accuracy and service guarantees.

final result: passed
