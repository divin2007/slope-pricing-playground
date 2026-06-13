import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import * as XLSX from "xlsx";
import {
  ArrowsClockwise,
  ArrowsDownUp,
  ChartLineUp,
  DownloadSimple,
  FloppyDisk,
  Crosshair,
  MapTrifold,
  MagnifyingGlass,
  MapPin,
  Mountains,
  NavigationArrow,
  RoadHorizon,
  Trash,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import "leaflet/dist/leaflet.css";

const KIGALI = [-1.9441, 30.0619];

const markerIcon = (color) =>
  L.divIcon({
    className: "custom-pin",
    html: `<span style="background:${color}"></span>`,
    iconSize: [24, 30],
    iconAnchor: [12, 28],
  });

const startIcon = markerIcon("#20d9a0");
const stopIcon = markerIcon("#ff5574");
const deviceIcon = L.divIcon({
  className: "device-location-pin",
  html: "<span></span>",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function haversine(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function category(slope) {
  const n = Math.abs(slope);
  if (n < 3) return "Flat";
  if (n < 8) return "Moderate";
  if (n < 14) return "Steep";
  return "Extreme";
}

function syntheticElevation(lat, lng) {
  return Math.round(
    1460 +
      (lat + 2.02) * 2300 +
      Math.sin((lng - 30) * 38) * 62 +
      Math.cos((lat + 1.95) * 45) * 38,
  );
}

function fallbackRoute(start, stop) {
  const count = 70;
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const curve = Math.sin(t * Math.PI) * 0.008;
    return {
      lat: start.lat + (stop.lat - start.lat) * t + curve * (stop.lng - start.lng),
      lng: start.lng + (stop.lng - start.lng) * t - curve * (stop.lat - start.lat),
    };
  });
}

function analyzeRoute(points) {
  const elevations = points.map(
    (point) =>
      Number.isFinite(Number(point.elevation))
        ? Number(point.elevation)
        : syntheticElevation(point.lat, point.lng),
  );
  const smoothedElevations = elevations.map((_, index) => {
    const window = elevations.slice(Math.max(0, index - 2), index + 3);
    return Math.round(window.reduce((sum, value) => sum + value, 0) / window.length);
  });
  const cumulativeDistances = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulativeDistances[index] =
      cumulativeDistances[index - 1] + haversine(points[index - 1], points[index]);
  }

  let distance = 0;
  let climb = 0;
  let drop = 0;
  let steepDistance = 0;
  let uphillDistance = 0;
  let downhillDistance = 0;
  let steepUphillDistance = 0;
  let steepDownhillDistance = 0;
  const samples = points.map((point, index) => {
    const elevation = smoothedElevations[index];
    if (index === 0) {
      return { ...point, elevation, distanceKm: 0, slope: 0, band: "Flat" };
    }
    const segmentDistance = haversine(points[index - 1], point);
    const segmentRise = elevation - smoothedElevations[index - 1];
    distance += segmentDistance;
    if (segmentRise > 0) climb += segmentRise;
    else drop += Math.abs(segmentRise);

    let comparisonIndex = index - 1;
    while (
      comparisonIndex > 0 &&
      cumulativeDistances[index] - cumulativeDistances[comparisonIndex] < 50
    ) {
      comparisonIndex -= 1;
    }
    const gradeDistance = Math.max(
      cumulativeDistances[index] - cumulativeDistances[comparisonIndex],
      30,
    );
    const rawSlope =
      ((elevation - smoothedElevations[comparisonIndex]) / gradeDistance) * 100;
    const slope = Math.max(-35, Math.min(35, rawSlope));
    if (Math.abs(slope) >= 8) steepDistance += segmentDistance;
    if (slope > 0) {
      uphillDistance += segmentDistance;
      if (slope >= 8) steepUphillDistance += segmentDistance;
    } else if (slope < 0) {
      downhillDistance += segmentDistance;
      if (slope <= -8) steepDownhillDistance += segmentDistance;
    }
    return {
      ...point,
      elevation,
      distanceKm: distance / 1000,
      slope: Number(slope.toFixed(1)),
      band: category(slope),
    };
  });

  const transitions = samples
    .filter((sample, index) => index > 0 && sample.band !== samples[index - 1].band)
    .map((sample, index) => ({
      id: index + 1,
      distanceKm: sample.distanceKm,
      from: samples[samples.indexOf(sample) - 1].band,
      to: sample.band,
      slope: sample.slope,
      elevation: sample.elevation,
    }));

  const slopes = samples.map((sample) => Math.abs(sample.slope));
  const uphillSlopes = samples.filter((sample) => sample.slope > 0);
  return {
    samples,
    transitions,
    distanceKm: distance / 1000,
    climb: Math.round(climb),
    drop: Math.round(drop),
    startElevation: samples[0]?.elevation ?? 0,
    stopElevation: samples.at(-1)?.elevation ?? 0,
    netElevationChange:
      (samples.at(-1)?.elevation ?? 0) - (samples[0]?.elevation ?? 0),
    maxSlope: Math.max(...slopes, 0),
    maxUphillSlope: Math.max(...samples.map((sample) => sample.slope), 0),
    maxDownhillSlope: Math.min(...samples.map((sample) => sample.slope), 0),
    avgSlope:
      uphillSlopes.reduce((sum, sample) => sum + sample.slope, 0) /
        Math.max(uphillSlopes.length, 1) || 0,
    steepRatio: distance ? (steepDistance / distance) * 100 : 0,
    uphillRatio: distance ? (uphillDistance / distance) * 100 : 0,
    downhillRatio: distance ? (downhillDistance / distance) * 100 : 0,
    steepUphillRatio: distance ? (steepUphillDistance / distance) * 100 : 0,
    steepDownhillRatio: distance ? (steepDownhillDistance / distance) * 100 : 0,
  };
}

function MapEvents({ mode, onPick }) {
  useMapEvents({
    click(event) {
      onPick(mode, {
        name: `${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`,
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });
  return null;
}

function FitRoute({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points.map((point) => [point.lat, point.lng]), {
        padding: [44, 44],
      });
    }
  }, [map, points]);
  return null;
}

function FocusLocation({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) map.setView([location.lat, location.lng], 17);
  }, [location, map]);
  return null;
}

function Metric({ label, value, detail, accent }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong style={{ color: accent }}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function placeName(feature) {
  const properties = feature.properties || {};
  return [
    properties.name,
    properties.street,
    properties.district,
    properties.city,
    properties.state,
  ]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .slice(0, 3)
    .join(", ");
}

function addressName(address = {}) {
  return [
    address.road || address.pedestrian || address.neighbourhood,
    address.suburb || address.quarter,
    address.city_district || address.county,
    address.city || address.town,
  ]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .slice(0, 3)
    .join(", ");
}

function PlaceSearch({
  type,
  value,
  onChange,
  onSelect,
  onUseCurrentLocation,
  locating,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [coordinateValue, setCoordinateValue] = useState("");
  const [coordinateError, setCoordinateError] = useState("");

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2 || !open) {
      setSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/places?q=${encodeURIComponent(query)}&lat=${KIGALI[0]}&lon=${KIGALI[1]}&bbox=29.85,-2.15,30.25,-1.75&limit=10`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json();
        setSuggestions(
          (data.features || [])
            .filter((feature) => feature.geometry?.coordinates?.length === 2)
            .map((feature) => ({
              id:
                feature.properties?.osm_id ||
                `${feature.geometry.coordinates[0]}-${feature.geometry.coordinates[1]}`,
              name: placeName(feature) || "Mapped place",
              detail: [
                feature.properties?.type,
                feature.properties?.country,
              ]
                .filter(Boolean)
                .join(" · "),
              lat: Number(feature.geometry.coordinates[1]),
              lng: Number(feature.geometry.coordinates[0]),
            })),
        );
      } catch (error) {
        if (error.name !== "AbortError") setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [open, value]);

  function choose(place) {
    onChange(place.name);
    setOpen(false);
    setSuggestions([]);
    onSelect(type, place);
  }

  function useCoordinates() {
    const numbers = coordinateValue
      .trim()
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map(Number);
    if (
      numbers.length !== 2 ||
      !numbers.every(Number.isFinite) ||
      numbers[0] < -90 ||
      numbers[0] > 90 ||
      numbers[1] < -180 ||
      numbers[1] > 180
    ) {
      setCoordinateError("Use latitude, longitude, for example -1.9441, 30.0619");
      return;
    }
    const [lat, lng] = numbers;
    const point = {
      name: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      lat,
      lng,
      source: "coordinates",
    };
    setCoordinateError("");
    onChange(point.name);
    onSelect(type, point);
  }

  return (
    <div className="place-search">
      <div className="search-field">
        <MagnifyingGlass size={18} />
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions[0]) choose(suggestions[0]);
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search roads, schools, businesses..."
          autoComplete="off"
          aria-label={`Search ${type} place`}
        />
        <button
          className="location-button"
          onClick={() => onUseCurrentLocation(type)}
          title={`Use current location as ${type}`}
          aria-label={`Use current location as ${type}`}
          type="button"
        >
          <Crosshair size={18} className={locating ? "spin" : ""} />
        </button>
      </div>
      <div className="coordinate-field">
        <MapTrifold size={17} />
        <input
          value={coordinateValue}
          onChange={(event) => {
            setCoordinateValue(event.target.value);
            setCoordinateError("");
          }}
          onKeyDown={(event) => event.key === "Enter" && useCoordinates()}
          placeholder="Latitude, longitude"
          aria-label={`${type} coordinates`}
        />
        <button type="button" onClick={useCoordinates}>
          Set pin
        </button>
      </div>
      {coordinateError && <small className="coordinate-error">{coordinateError}</small>}
      {open && value.trim().length >= 2 && (
        <div className="suggestions">
          {loading && <div className="suggestion-state">Searching mapped places...</div>}
          {!loading &&
            suggestions.map((place) => (
              <button type="button" key={place.id} onClick={() => choose(place)}>
                <MapPin size={17} />
                <span>
                  <strong>{place.name}</strong>
                  <small>{place.detail}</small>
                </span>
              </button>
            ))}
          {!loading && !suggestions.length && (
            <div className="suggestion-state">
              Keep typing to search Kigali’s OpenStreetMap place index.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function App() {
  const [mapStyle, setMapStyle] = useState("terrain");
  const [pickMode, setPickMode] = useState("start");
  const [start, setStart] = useState(null);
  const [stop, setStop] = useState(null);
  const [route, setRoute] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [fare, setFare] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [roadCondition, setRoadCondition] = useState("");
  const [surface, setSurface] = useState("");
  const [notes, setNotes] = useState("");
  const [trips, setTrips] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("kigali-slope-trips") || "[]");
    } catch {
      return [];
    }
  });
  const [status, setStatus] = useState("Choose start A and stop B");
  const [searchStart, setSearchStart] = useState("");
  const [searchStop, setSearchStop] = useState("");
  const [locating, setLocating] = useState(null);
  const [locationCandidate, setLocationCandidate] = useState(null);
  const locationWatchRef = useRef(null);
  const locationTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("kigali-slope-trips", JSON.stringify(trips));
  }, [trips]);

  useEffect(
    () => () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
      clearTimeout(locationTimerRef.current);
    },
    [],
  );

  async function buildRoute(nextStart = start, nextStop = stop) {
    if (!nextStart || !nextStop) {
      setRoute([]);
      setAnalysis(null);
      setStatus(
        !nextStart && !nextStop
          ? "Choose start A and stop B"
          : !nextStart
            ? "Choose start A"
            : "Choose stop B",
      );
      return;
    }
    setStatus("Measuring road route...");
    let points;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${nextStart.lng},${nextStart.lat};${nextStop.lng},${nextStop.lat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Routing unavailable");
      const json = await response.json();
      const coordinates = json.routes?.[0]?.geometry?.coordinates;
      if (!coordinates?.length) throw new Error("No route");
      const step = Math.max(1, Math.ceil(coordinates.length / 120));
      points = coordinates
        .filter((_, index) => index % step === 0)
        .map(([lng, lat]) => ({ lat, lng }));
      const last = coordinates.at(-1);
      if (points.at(-1)?.lng !== last[0]) points.push({ lat: last[1], lng: last[0] });
    } catch {
      points = fallbackRoute(nextStart, nextStop);
      setStatus("Using offline route estimate");
    }

    try {
      const batches = [];
      for (let index = 0; index < points.length; index += 40) {
        batches.push(points.slice(index, index + 40));
      }
      const elevationBatches = await Promise.all(
        batches.map(async (batch) => {
          const locations = batch.map((point) => `${point.lat},${point.lng}`).join("|");
          const response = await fetch(
            `/api/elevation?locations=${encodeURIComponent(locations)}`,
          );
          if (!response.ok) return [];
          return (await response.json()).results || [];
        }),
      );
      const elevations = elevationBatches.flat();
      points = points.map((point, index) => {
        const elevation = Number(elevations[index]?.elevation);
        return {
          ...point,
          elevation: Number.isFinite(elevation) ? elevation : undefined,
        };
      });
    } catch {
      // Synthetic Kigali terrain remains available for offline collection demos.
    }

    setRoute(points);
    setAnalysis(analyzeRoute(points));
    setStatus("Route measured");
  }

  function pickPoint(type, point) {
    if (type === "start") {
      setStart(point);
      setSearchStart(point.name);
      if (stop) buildRoute(point, stop);
      else {
        setRoute([]);
        setAnalysis(null);
        setStatus("Start A selected. Choose stop B.");
      }
      setPickMode("stop");
    } else {
      setStop(point);
      setSearchStop(point.name);
      if (start) buildRoute(start, point);
      else {
        setRoute([]);
        setAnalysis(null);
        setStatus("Stop B selected. Choose start A.");
      }
    }
  }

  function moveEndpoint(type, latlng) {
    const point = {
      name: `Dropped pin · ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`,
      lat: latlng.lat,
      lng: latlng.lng,
      source: "drag",
    };
    pickPoint(type, point);
    setStatus(
      `${type === "start" ? "Start A" : "Stop B"} pin moved. Route re-measured.`,
    );
  }

  function swapEndpoints() {
    if (!start && !stop) return;
    stopLocationWatch();
    setLocating(null);
    setLocationCandidate(null);

    const previousStart = start;
    const previousStop = stop;
    const previousStartSearch = searchStart;
    const previousStopSearch = searchStop;

    setStart(previousStop);
    setStop(previousStart);
    setSearchStart(previousStopSearch);
    setSearchStop(previousStartSearch);
    setPickMode(previousStop ? "stop" : "start");

    if (previousStart && previousStop) {
      setStatus("Direction reversed. Re-measuring rider effort...");
      buildRoute(previousStop, previousStart);
    } else {
      setRoute([]);
      setAnalysis(null);
      setStatus(
        previousStop
          ? "Previous stop is now start A. Choose stop B."
          : "Previous start is now stop B. Choose start A.",
      );
    }
  }

  function stopLocationWatch() {
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
    clearTimeout(locationTimerRef.current);
  }

  function useCurrentLocation(type) {
    if (!navigator.geolocation) {
      setStatus("Current location is not supported by this browser.");
      return;
    }
    stopLocationWatch();
    setLocating(type);
    setLocationCandidate(null);
    setStatus("Improving GPS accuracy...");
    locationWatchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const accuracy = Math.round(position.coords.accuracy);
        const current = {
          type,
          name: `Device location (±${accuracy} m)`,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: accuracy,
          source: "gps",
        };
        setLocationCandidate((previous) => {
          if (
            !previous ||
            (previous.source === "gps" && accuracy <= previous.accuracyM)
          ) {
            return current;
          }
          return previous;
        });
        setStatus(
          accuracy <= 50
            ? `Good device fix · ±${accuracy} m`
            : `Device location is approximate · ±${accuracy} m`,
        );

        try {
          const response = await fetch(
            `/api/reverse?format=jsonv2&lat=${current.lat}&lon=${current.lng}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en" } },
          );
          if (response.ok) {
            const data = await response.json();
            const resolvedName = addressName(data.address);
            if (resolvedName) {
              setLocationCandidate((candidate) =>
                candidate
                  ? { ...candidate, name: `${resolvedName} (±${candidate.accuracyM} m)` }
                  : candidate,
              );
            }
          }
        } catch {
          // The visible coordinates and accuracy remain authoritative.
        }
      },
      (error) => {
        stopLocationWatch();
        setLocating(null);
        if (error.code === 1) setStatus("Location permission was not granted.");
        else if (error.code === 3) setStatus("Current location timed out. Try again.");
        else setStatus("Could not determine current location.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
    locationTimerRef.current = setTimeout(() => {
      stopLocationWatch();
      setLocating(null);
    }, 20000);
  }

  function confirmCurrentLocation() {
    if (!locationCandidate) return;
    stopLocationWatch();
    setLocating(null);
    pickPoint(locationCandidate.type, locationCandidate);
    setStatus(
      `${locationCandidate.type === "start" ? "Start A" : "Stop B"} confirmed at ±${locationCandidate.accuracyM} m`,
    );
    setLocationCandidate(null);
  }

  function cancelCurrentLocation() {
    stopLocationWatch();
    setLocating(null);
    setLocationCandidate(null);
    setStatus("Device location cancelled.");
  }

  function logTrip() {
    if (!analysis || !Number(fare) || !vehicle || !roadCondition || !surface) return;
    const tripId = `KSP-${String(trips.length + 1).padStart(4, "0")}`;
    const trip = {
      tripId,
      recordedAt: new Date().toISOString(),
      startName: start.name,
      startLat: start.lat,
      startLng: start.lng,
      startAccuracyM: start.accuracyM ?? "",
      stopName: stop.name,
      stopLat: stop.lat,
      stopLng: stop.lng,
      stopAccuracyM: stop.accuracyM ?? "",
      actualFareRwf: Number(fare),
      vehicle,
      roadCondition,
      roadSurface: surface,
      distanceKm: Number(analysis.distanceKm.toFixed(3)),
      startElevationM: analysis.startElevation,
      stopElevationM: analysis.stopElevation,
      cumulativeClimbM: analysis.climb,
      cumulativeDropM: analysis.drop,
      averageUphillSlopePct: Number(analysis.avgSlope.toFixed(2)),
      maximumAbsoluteSlopePct: Number(analysis.maxSlope.toFixed(2)),
      steepRouteRatioPct: Number(analysis.steepRatio.toFixed(2)),
      netElevationChangeM: analysis.netElevationChange,
      maximumUphillSlopePct: Number(analysis.maxUphillSlope.toFixed(2)),
      maximumDownhillSlopePct: Number(analysis.maxDownhillSlope.toFixed(2)),
      uphillRouteRatioPct: Number(analysis.uphillRatio.toFixed(2)),
      downhillRouteRatioPct: Number(analysis.downhillRatio.toFixed(2)),
      steepUphillRouteRatioPct: Number(analysis.steepUphillRatio.toFixed(2)),
      steepDownhillRouteRatioPct: Number(analysis.steepDownhillRatio.toFixed(2)),
      routeSampleCount: analysis.samples.length,
      slopeTransitionCount: analysis.transitions.length,
      notes,
      samples: analysis.samples,
      transitions: analysis.transitions,
    };
    setTrips((current) => [trip, ...current]);
    setStatus(`${tripId} added to dataset`);
    setNotes("");
  }

  function exportWorkbook() {
    if (!trips.length) return;
    const summaries = trips.map(({ samples, transitions, ...trip }) => trip);
    const sampleRows = trips.flatMap((trip) =>
      trip.samples.map((sample, index) => ({
        tripId: trip.tripId,
        sampleIndex: index,
        latitude: sample.lat,
        longitude: sample.lng,
        distanceKm: Number(sample.distanceKm.toFixed(4)),
        elevationM: sample.elevation,
        slopePct: sample.slope,
        slopeBand: sample.band,
      })),
    );
    const transitionRows = trips.flatMap((trip) =>
      trip.transitions.map((transition) => ({ tripId: trip.tripId, ...transition })),
    );
    const dictionary = [
      ["Field", "Meaning"],
      ["actualFareRwf", "Observed amount paid to the rider. This is the target variable."],
      ["distanceKm", "Road-route distance between selected points."],
      ["cumulativeClimbM", "Sum of all positive elevation changes along the route."],
      ["cumulativeDropM", "Sum of all negative elevation changes along the route."],
      ["averageUphillSlopePct", "Mean positive road grade across sampled uphill segments."],
      ["maximumAbsoluteSlopePct", "Largest absolute sampled road grade."],
      ["steepRouteRatioPct", "Share of route distance with absolute grade of at least 8%."],
      ["netElevationChangeM", "Stop elevation minus start elevation. Positive means the trip ends higher."],
      ["maximumUphillSlopePct", "Largest positive road grade in the selected A-to-B direction."],
      ["maximumDownhillSlopePct", "Most negative road grade in the selected A-to-B direction."],
      ["uphillRouteRatioPct", "Share of A-to-B route distance with positive grade."],
      ["downhillRouteRatioPct", "Share of A-to-B route distance with negative grade."],
      ["steepUphillRouteRatioPct", "Share of route distance climbing at 8% grade or steeper."],
      ["steepDownhillRouteRatioPct", "Share of route distance descending at -8% grade or steeper."],
      ["slopeBand", "Flat <3%, Moderate 3-8%, Steep 8-14%, Extreme >=14%."],
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaries), "Trips");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sampleRows), "Route Samples");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(transitionRows),
      "Slope Transitions",
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(dictionary), "Data Dictionary");
    XLSX.writeFile(workbook, "kigali-rider-slope-pricing-dataset.xlsx");
  }

  const chartData = useMemo(
    () =>
      (analysis?.samples || []).map((sample) => ({
        distance: Number(sample.distanceKm.toFixed(2)),
        elevation: sample.elevation,
      })),
    [analysis],
  );

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">Independent route research tool</span>
          <h1>Kigali slope pricing playground</h1>
          <p>
            Collect observed rider fares against measured road distance, elevation and
            steepness. No fare formula is imposed while the dataset is being built.
          </p>
        </div>
        <div className="hero-actions">
          <div className="map-switch">
            <button
              className={mapStyle === "normal" ? "active" : ""}
              onClick={() => setMapStyle("normal")}
            >
              <RoadHorizon size={18} /> Normal map
            </button>
            <button
              className={mapStyle === "terrain" ? "active terrain" : ""}
              onClick={() => setMapStyle("terrain")}
            >
              <Mountains size={18} /> Terrain map
            </button>
          </div>
          <div className="status-dot">
            <span />
            {status}
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="left-column">
          <div className="panel route-builder">
            <div className="section-heading">
              <div>
                <span className="step">01</span>
                <h2>Choose the route</h2>
              </div>
              <button
                className="secondary"
                onClick={() => buildRoute()}
                disabled={!start || !stop}
              >
                <ArrowsClockwise size={17} /> Re-measure
              </button>
            </div>
            <div className="point-grid">
              <label>
                <span className="point-label start-label">Start point A</span>
                <PlaceSearch
                  type="start"
                  value={searchStart}
                  onChange={setSearchStart}
                  onSelect={pickPoint}
                  onUseCurrentLocation={useCurrentLocation}
                  locating={locating === "start"}
                />
              </label>
              <button
                className="swap-route"
                type="button"
                onClick={swapEndpoints}
                disabled={!start && !stop}
                title="Swap start A and stop B"
                aria-label="Swap start and stop"
              >
                <ArrowsDownUp size={20} weight="bold" />
                <span>Reverse</span>
              </button>
              <label>
                <span className="point-label stop-label">Stop point B</span>
                <PlaceSearch
                  type="stop"
                  value={searchStop}
                  onChange={setSearchStop}
                  onSelect={pickPoint}
                  onUseCurrentLocation={useCurrentLocation}
                  locating={locating === "stop"}
                />
              </label>
            </div>
            <p className="map-instruction">
              Search mapped places, use the crosshair for GPS, or click the map to place{" "}
              <strong>{pickMode === "start" ? "start A" : "stop B"}</strong>.
              <button onClick={() => setPickMode(pickMode === "start" ? "stop" : "start")}>
                Switch to {pickMode === "start" ? "stop B" : "start A"}
              </button>
            </p>
          </div>

          <div className="map-panel">
            <MapContainer center={KIGALI} zoom={12} scrollWheelZoom className="map">
              <TileLayer
                key={mapStyle}
                attribution={
                  mapStyle === "terrain"
                    ? "Tiles © Esri"
                    : "© OpenStreetMap contributors"
                }
                url={
                  mapStyle === "terrain"
                    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                }
              />
              <MapEvents mode={pickMode} onPick={pickPoint} />
              <FitRoute points={route} />
              <FocusLocation location={locationCandidate} />
              {start && (
                <Marker
                  position={[start.lat, start.lng]}
                  icon={startIcon}
                  draggable
                  eventHandlers={{
                    dragend(event) {
                      moveEndpoint("start", event.target.getLatLng());
                    },
                  }}
                >
                  <Tooltip permanent direction="top">A · drag me</Tooltip>
                </Marker>
              )}
              {stop && (
                <Marker
                  position={[stop.lat, stop.lng]}
                  icon={stopIcon}
                  draggable
                  eventHandlers={{
                    dragend(event) {
                      moveEndpoint("stop", event.target.getLatLng());
                    },
                  }}
                >
                  <Tooltip permanent direction="top">B · drag me</Tooltip>
                </Marker>
              )}
              {route.length > 1 && (
                <>
                  <Polyline
                    positions={route.map((point) => [point.lat, point.lng])}
                    pathOptions={{ color: "#0c1a2f", weight: 8, opacity: 0.55 }}
                  />
                  <Polyline
                    positions={route.map((point) => [point.lat, point.lng])}
                    pathOptions={{ color: "#20d9a0", weight: 4, opacity: 0.95 }}
                  />
                </>
              )}
              {locationCandidate && (
                <>
                  <Circle
                    center={[locationCandidate.lat, locationCandidate.lng]}
                    radius={locationCandidate.accuracyM}
                    pathOptions={{
                      color: "#43bfff",
                      fillColor: "#43bfff",
                      fillOpacity: 0.16,
                      weight: 2,
                    }}
                  />
                  <Marker
                    position={[locationCandidate.lat, locationCandidate.lng]}
                    icon={deviceIcon}
                    draggable
                    eventHandlers={{
                      dragend(event) {
                        const next = event.target.getLatLng();
                        setLocationCandidate((candidate) => ({
                          ...candidate,
                          lat: next.lat,
                          lng: next.lng,
                          name: `Adjusted map point (±${candidate.accuracyM} m)`,
                          source: "manual",
                        }));
                      },
                    }}
                  >
                    <Tooltip permanent direction="top">
                      Device · ±{locationCandidate.accuracyM} m
                    </Tooltip>
                  </Marker>
                </>
              )}
            </MapContainer>
            <div className="map-legend">
              <span><i className="flat" /> Flat &lt;3%</span>
              <span><i className="moderate" /> Moderate 3–8%</span>
              <span><i className="steep" /> Steep 8–14%</span>
              <span><i className="extreme" /> Extreme ≥14%</span>
            </div>
            {locationCandidate && (
              <div className="location-review">
                <div>
                  <strong>Confirm device position on the map</strong>
                  <span>
                    {locationCandidate.lat.toFixed(6)}, {locationCandidate.lng.toFixed(6)}
                    {" · "}accuracy ±{locationCandidate.accuracyM} m
                  </span>
                  <small>
                    The blue circle is the possible area. Drag the blue dot if your
                    device placed it on the wrong road.
                  </small>
                </div>
                <button className="secondary" onClick={cancelCurrentLocation}>
                  Cancel
                </button>
                <button className="primary" onClick={confirmCurrentLocation}>
                  Use as {locationCandidate.type === "start" ? "start A" : "stop B"}
                </button>
              </div>
            )}
          </div>

          <div className="panel chart-panel">
            <div className="section-heading compact">
              <div>
                <span className="step">Route evidence</span>
                <h2>Elevation profile</h2>
              </div>
              {analysis && (
                <span className="sample-count">{analysis.samples.length} samples</span>
              )}
            </div>
            {analysis ? (
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#20d9a0" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#20d9a0" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#293950" strokeDasharray="4 6" vertical={false} />
                    <XAxis dataKey="distance" stroke="#7f91aa" fontSize={11} unit=" km" />
                    <YAxis stroke="#7f91aa" fontSize={11} domain={["dataMin - 20", "dataMax + 20"]} />
                    <ChartTooltip
                      contentStyle={{
                        background: "#101b2d",
                        border: "1px solid #33445d",
                        borderRadius: 10,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="elevation"
                      stroke="#20d9a0"
                      strokeWidth={3}
                      fill="url(#elevationFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-panel">
                Select start A and stop B to generate the elevation profile.
              </div>
            )}
          </div>
        </div>

        <aside className="right-column">
          <div className="panel analytics">
            <div className="section-heading compact">
              <div>
                <span className="step">02</span>
                <h2>Measured terrain facts</h2>
              </div>
            </div>
            {analysis ? (
              <>
                <div className="metric-grid">
                  <Metric label="Road distance" value={`${analysis.distanceKm.toFixed(2)} km`} detail="A to B routed path" accent="#20d9a0" />
                  <Metric label="Cumulative climb" value={`+${analysis.climb} m`} detail="Uphill in A to B direction" accent="#ffc331" />
                  <Metric label="Cumulative drop" value={`-${analysis.drop} m`} detail="Downhill in A to B direction" accent="#43bfff" />
                  <Metric label="Net elevation" value={`${analysis.netElevationChange >= 0 ? "+" : ""}${analysis.netElevationChange} m`} detail="Stop B minus start A" accent="#9f8cff" />
                  <Metric label="Steep uphill share" value={`${analysis.steepUphillRatio.toFixed(1)}%`} detail="Climbing grade 8% or more" accent="#ff8a42" />
                  <Metric label="Steep downhill share" value={`${analysis.steepDownhillRatio.toFixed(1)}%`} detail="Descending grade -8% or less" accent="#ff5574" />
                  <Metric label="Max uphill slope" value={`+${analysis.maxUphillSlope.toFixed(1)}%`} detail="Hardest climb A to B" accent="#ffc331" />
                  <Metric label="Max downhill slope" value={`${analysis.maxDownhillSlope.toFixed(1)}%`} detail="Steepest descent A to B" accent="#43bfff" />
                </div>
                <div className="elevation-strip">
                  <span>A altitude <strong>{analysis.startElevation} m</strong></span>
                  <NavigationArrow size={22} />
                  <span>B altitude <strong>{analysis.stopElevation} m</strong></span>
                </div>
              </>
            ) : (
              <div className="empty-panel">
                Terrain facts will appear after both route points are selected.
              </div>
            )}
          </div>

          <div className="panel transitions">
            <div className="section-heading compact">
              <div>
                <span className="step">Slope changes</span>
                <h2>Terrain milestones</h2>
              </div>
            </div>
            <div className="transition-list">
              {(analysis?.transitions || []).slice(0, 8).map((transition) => (
                <div className="transition" key={`${transition.id}-${transition.distanceKm}`}>
                  <span>{transition.distanceKm.toFixed(2)} km</span>
                  <strong>{transition.from} → {transition.to}</strong>
                  <b>{transition.slope}%</b>
                </div>
              ))}
              {!analysis && <p>Select both locations to measure slope changes.</p>}
              {analysis && !analysis.transitions.length && <p>No slope-band changes were measured on this route.</p>}
            </div>
          </div>

          <div className="panel fare-entry">
            <div className="section-heading compact">
              <div>
                <span className="step">03 · observed result</span>
                <h2>Record the rider payment</h2>
              </div>
            </div>
            <p className="muted">
              Enter what the rider was actually paid. This app does not suggest or modify
              the amount.
            </p>
            <label className="fare-label">
              Actual amount paid
              <div className="fare-input">
                <input
                  type="number"
                  min="0"
                  value={fare}
                  onChange={(event) => setFare(event.target.value)}
                />
                <span>RWF</span>
              </div>
            </label>
            <div className="metadata-grid">
              <label>Vehicle
                <select value={vehicle} onChange={(event) => setVehicle(event.target.value)}>
                  <option value="" disabled>Select vehicle</option>
                  <option>Motorcycle</option><option>Cab</option><option>Bicycle</option>
                </select>
              </label>
              <label>Road condition
                <select value={roadCondition} onChange={(event) => setRoadCondition(event.target.value)}>
                  <option value="" disabled>Select condition</option>
                  <option>Dry</option><option>Wet</option><option>Mixed</option>
                </select>
              </label>
              <label>Road surface
                <select value={surface} onChange={(event) => setSurface(event.target.value)}>
                  <option value="" disabled>Select surface</option>
                  <option>Paved / mixed</option><option>Paved</option><option>Unpaved</option>
                </select>
              </label>
              <label>Notes
                <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
              </label>
            </div>
            <button
              className="primary log-button"
              onClick={logTrip}
              disabled={
                !analysis ||
                !Number(fare) ||
                !vehicle ||
                !roadCondition ||
                !surface
              }
            >
              <FloppyDisk size={19} weight="bold" /> Log ride data
            </button>
          </div>
        </aside>
      </section>

      <section className="panel dataset">
        <div className="dataset-header">
          <div>
            <span className="step">04 · learning dataset</span>
            <h2>Collected Kigali hillside rides</h2>
            <p>{trips.length} observed {trips.length === 1 ? "fare" : "fares"} stored locally in this browser.</p>
          </div>
          <button className="primary" disabled={!trips.length} onClick={exportWorkbook}>
            <DownloadSimple size={19} weight="bold" /> Download multi-sheet Excel
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trip</th><th>Route</th><th>Distance</th><th>Climb / drop</th>
                <th>Avg / max slope</th><th>Steep share</th><th>Actual paid</th><th />
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.tripId}>
                  <td><strong>{trip.tripId}</strong><small>{new Date(trip.recordedAt).toLocaleDateString()}</small></td>
                  <td><strong>{trip.startName}</strong><small>to {trip.stopName}</small></td>
                  <td>{trip.distanceKm} km</td>
                  <td>+{trip.cumulativeClimbM} / -{trip.cumulativeDropM} m</td>
                  <td>{trip.averageUphillSlopePct}% / {trip.maximumAbsoluteSlopePct}%</td>
                  <td>{trip.steepRouteRatioPct}%</td>
                  <td className="paid">{trip.actualFareRwf.toLocaleString()} RWF</td>
                  <td><button className="icon-button" title="Delete trip" onClick={() => setTrips((rows) => rows.filter((row) => row.tripId !== trip.tripId))}><Trash size={17} /></button></td>
                </tr>
              ))}
              {!trips.length && (
                <tr className="empty-row">
                  <td colSpan="8"><ChartLineUp size={30} />Choose a route, enter the observed payment, and log the first ride.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
