const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

export default async function handler(request, response) {
  const lat = Number(request.query.lat);
  const lng = Number(request.query.lon);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return response.status(400).json({ error: "Valid latitude and longitude are required." });
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    zoom: "18",
    addressdetails: "1",
  });

  try {
    const upstream = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "KigaliSlopePricingPlayground/1.0",
      },
    });
    if (!upstream.ok) {
      return response.status(502).json({ error: "Reverse geocoding is unavailable." });
    }
    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    return response.status(200).json(await upstream.json());
  } catch {
    return response.status(502).json({ error: "Reverse geocoding is unavailable." });
  }
}
