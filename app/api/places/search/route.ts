import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Force Node runtime (we need fetch with custom UA + no Edge constraints).
export const runtime = "nodejs";

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    municipality?: string;
    suburb?: string;
    county?: string;
    state_district?: string;
    state?: string;
    country?: string;
  };
};

export type PlaceSuggestion = {
  displayName: string;
  name: string;
  department: string | null;
  region: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // Country filter (ISO 3166-1 alpha-2, lowercased).
  const cc = (req.nextUrl.searchParams.get("cc") ?? "").trim().toLowerCase();
  const ccSafe = /^[a-z]{2}$/.test(cc) ? cc : null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "8");
  url.searchParams.set("accept-language", "fr");
  if (ccSafe) url.searchParams.set("countrycodes", ccSafe);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        // Nominatim usage policy requires a meaningful User-Agent.
        "User-Agent":
          "Genealogie-Chazeau/1.0 (https://chazeau-genealogie.fr; contact: chazeau.a@gmail.com)",
      },
      // Nominatim allows ~1 req/sec; the user-side debounce caps that already.
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json({ error: "upstream-unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "upstream-error" }, { status: 502 });
  }

  const data = (await res.json()) as NominatimResult[];

  const suggestions: PlaceSuggestion[] = data.map((item) => {
    const a = item.address ?? {};
    const name =
      a.city ??
      a.town ??
      a.village ??
      a.hamlet ??
      a.municipality ??
      a.suburb ??
      a.county ??
      a.state ??
      item.display_name.split(",")[0]?.trim() ??
      item.display_name;

    return {
      displayName: item.display_name,
      name,
      department: a.county ?? a.state_district ?? null,
      region: a.state ?? null,
      country: a.country ?? null,
      latitude: Number.parseFloat(item.lat),
      longitude: Number.parseFloat(item.lon),
    };
  });

  return NextResponse.json(suggestions, {
    headers: {
      // Cache identical queries briefly to be polite to Nominatim.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
