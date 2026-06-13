const PHOTON_URL = "https://photon.komoot.io/api/";

export default async function handler(request, response) {
  const query = String(request.query.q || "").trim();
  if (query.length < 2 || query.length > 160) {
    return response.status(400).json({ error: "A valid place query is required." });
  }

  const params = new URLSearchParams({
    q: query,
    lat: String(Number(request.query.lat) || -1.9441),
    lon: String(Number(request.query.lon) || 30.0619),
    bbox: "29.85,-2.15,30.25,-1.75",
    limit: String(Math.min(Math.max(Number(request.query.limit) || 10, 1), 15)),
  });

  try {
    const upstream = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) {
      return response.status(502).json({ error: "Place search is unavailable." });
    }
    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return response.status(200).json(await upstream.json());
  } catch {
    return response.status(502).json({ error: "Place search is unavailable." });
  }
}
