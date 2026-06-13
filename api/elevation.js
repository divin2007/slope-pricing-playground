const ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup";

export default async function handler(request, response) {
  const locations = String(request.query.locations || "").trim();
  const points = locations.split("|").filter(Boolean);
  if (!points.length || points.length > 40) {
    return response.status(400).json({ error: "Provide between 1 and 40 locations." });
  }
  const valid = points.every((point) => {
    const [lat, lng] = point.split(",").map(Number);
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  });
  if (!valid) {
    return response.status(400).json({ error: "Invalid elevation coordinates." });
  }

  try {
    const upstream = await fetch(
      `${ELEVATION_URL}?locations=${encodeURIComponent(locations)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!upstream.ok) {
      return response.status(502).json({ error: "Elevation service is unavailable." });
    }
    response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return response.status(200).json(await upstream.json());
  } catch {
    return response.status(502).json({ error: "Elevation service is unavailable." });
  }
}
