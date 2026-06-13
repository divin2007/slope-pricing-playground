# Kigali Slope Pricing Playground

Standalone research playground for collecting observed Kigali rider fares against
measured route and terrain data. It is intentionally separate from RMF.

## What it records

- Start and stop names and coordinates
- Live Kigali-biased place autocomplete from the OpenStreetMap-based Photon index
- Multi-reading, high-accuracy browser location for either route point, including
  the reported GPS accuracy radius
- A visible blue device marker and uncertainty circle that must be confirmed
- Manual correction by dragging the device marker to the actual road
- Latitude/longitude entry for both route endpoints
- Draggable start and stop markers with automatic route re-measurement on drop
- Road-route distance
- Start and stop elevation
- Cumulative climb and drop
- Average uphill grade and maximum absolute grade
- Share of route at 8% grade or steeper
- Route sample coordinates, elevation, slope, and slope band
- Slope-band transition milestones
- Vehicle, road condition, road surface, notes
- Actual amount paid to the rider

The application does not suggest a fare or expose pricing-formula controls. The
observed payment is the learning target.

The browser's position is never silently treated as exact. The researcher sees
the reported point and accuracy area, can drag the point to the correct road, and
must confirm it before it becomes a route endpoint.

## Excel export

The downloaded workbook contains:

- `Trips`
- `Route Samples`
- `Slope Transitions`
- `Data Dictionary`

## Local use

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173`.

## Data notes

Road geometry comes from OSRM when available. Elevation samples come from
Open-Elevation through the local Vite proxy in small batches and are smoothed
before grade calculation.
Offline fallbacks keep the interface usable for demonstration, but production
research should record the data source and validate elevation accuracy against a
trusted Rwanda DEM or commercial elevation provider.
