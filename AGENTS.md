# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Product decisions

- This is an independent research playground, not part of the RMF application.
- Route and terrain values are measured dataset features; they are not user-tweakable pricing inputs.
- The only fare entered by the researcher is the actual observed rider payment.
- Do not show a suggested fare or a configurable hillside pricing formula during data collection.
- Export summaries, route samples, slope transitions, and a data dictionary to Excel.
- Start and stop fields support live mapped-place suggestions and current location.
- The initial screen contains no demo route, landmark presets, sample count, fare,
  metrics, chart values, or other pre-populated research data.
- Both endpoints support coordinate entry and draggable map pins.
- Terrain effort features are directional. Reversing A and B must swap ascent and
  descent semantics and re-measure the reverse route.
