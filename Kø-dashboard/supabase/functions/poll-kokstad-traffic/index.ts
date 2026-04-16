import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type LatLng = {
  lat: number;
  lng: number;
};

type SpeedInterval = {
  startPolylinePointIndex?: number;
  endPolylinePointIndex?: number;
  speed?: "NORMAL" | "SLOW" | "TRAFFIC_JAM" | string;
};

const ORIGIN = {
  label: "Odfjell Drilling, Kokstadflaten 35",
  location: { lat: 60.29487, lng: 5.29056 },
};

const DESTINATION = {
  label: "Kokstadflaten x Kokstadvegen",
  location: { lat: 60.29292, lng: 5.29427 },
};

function decodePolyline(encoded: string): LatLng[] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: LatLng[] = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coordinates;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function parseSeconds(duration: string): number {
  return Math.round(Number.parseFloat(duration.replace("s", "")));
}

function estimateQueueLength(
  encodedPolyline: string,
  intervals: SpeedInterval[],
): number {
  const points = decodePolyline(encodedPolyline);
  if (points.length < 2 || !intervals.length) {
    return 0;
  }

  let queueLength = 0;

  for (const interval of intervals) {
    const start = interval.startPolylinePointIndex ?? 0;
    const end = interval.endPolylinePointIndex ?? points.length - 1;
    const speed = interval.speed ?? "NORMAL";

    if (speed === "NORMAL") {
      continue;
    }

    for (let index = start; index < Math.min(end, points.length - 1); index += 1) {
      queueLength += haversineMeters(points[index], points[index + 1]);
    }
  }

  return Math.round(queueLength);
}

function classifySeverity(delaySec: number, queueLengthM: number): string {
  if (delaySec >= 300 || queueLengthM >= 300) {
    return "TRAFFIC_JAM";
  }
  if (delaySec >= 120 || queueLengthM >= 120) {
    return "SLOW";
  }
  return "NORMAL";
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey || !googleMapsApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing required environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleMapsApiKey,
      "X-Goog-FieldMask": [
        "routes.distanceMeters",
        "routes.duration",
        "routes.staticDuration",
        "routes.polyline.encodedPolyline",
        "routes.travelAdvisory.speedReadingIntervals"
      ].join(","),
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: ORIGIN.location,
        },
      },
      destination: {
        location: {
          latLng: DESTINATION.location,
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      departureTime: new Date().toISOString(),
      languageCode: "nb-NO",
      units: "METRIC",
      polylineQuality: "HIGH_QUALITY",
      extraComputations: ["TRAFFIC_ON_POLYLINE"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({ error: "Google Routes API failed.", detail: errorText }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const payload = await response.json();
  const route = payload.routes?.[0];

  if (!route) {
    return new Response(
      JSON.stringify({ error: "No route returned from Google Routes API." }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const durationSec = parseSeconds(route.duration);
  const staticDurationSec = parseSeconds(route.staticDuration);
  const delaySec = Math.max(durationSec - staticDurationSec, 0);
  const intervals: SpeedInterval[] = route.travelAdvisory?.speedReadingIntervals ?? [];
  const encodedPolyline = route.polyline?.encodedPolyline ?? "";
  const queueLengthM = estimateQueueLength(encodedPolyline, intervals);
  const severity = classifySeverity(delaySec, queueLengthM);

  const { error } = await supabase.from("route_snapshots").insert({
    origin_label: ORIGIN.label,
    destination_label: DESTINATION.label,
    distance_m: route.distanceMeters,
    duration_sec: durationSec,
    static_duration_sec: staticDurationSec,
    delay_sec: delaySec,
    queue_length_m: queueLengthM,
    traffic_severity: severity,
    speed_intervals: intervals,
    route_polyline: encodedPolyline,
    raw_response: payload,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to store snapshot in Supabase.", detail: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      capturedAt: new Date().toISOString(),
      durationSec,
      staticDurationSec,
      delaySec,
      queueLengthM,
      severity,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
