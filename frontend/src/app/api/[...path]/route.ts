import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeBackendUrl(raw: string): string {
  let url = raw.trim().replace(/\/$/, "");
  if (!url) {
    return "http://localhost:4000";
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

function getBackendUrl(): string {
  // Prefer API_URL on the server (runtime on Vercel). Fall back to NEXT_PUBLIC_API_URL.
  const raw =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";
  return normalizeBackendUrl(raw);
}

const HOP_BY_HOP = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept"];

function resolveUpstreamPath(pathSegments: string[]): string {
  const path = pathSegments.join("/");

  if (path === "health") {
    return "/health";
  }

  return `/api/${path}`;
}

function wouldProxyLoop(req: NextRequest, backendUrl: string): boolean {
  try {
    const backend = new URL(backendUrl);
    // Compare host:port so localhost:3000 and localhost:4000 are not treated as a loop.
    return backend.host === req.nextUrl.host;
  } catch {
    return false;
  }
}

function buildProxyRequestHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

async function proxyRequest(
  req: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const backendUrl = getBackendUrl();

  if (wouldProxyLoop(req, backendUrl)) {
    console.error(
      `[API proxy] Refusing loop: backend host ${backendUrl} matches request host ${req.nextUrl.host}`,
    );
    return NextResponse.json(
      { error: "API_URL must point to the Railway backend, not the Vercel frontend." },
      { status: 500 },
    );
  }

  const upstreamPath = resolveUpstreamPath(pathSegments);
  const target = `${backendUrl}${upstreamPath}${req.nextUrl.search}`;

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: buildProxyRequestHeaders(req),
      body: hasBody ? body : undefined,
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    console.error(
      `[API proxy] ${req.method} ${upstreamPath} -> ${target} failed:`,
      message,
    );
    return NextResponse.json(
      {
        error: `Cannot reach backend (${backendUrl}). Check API_URL on Vercel.`,
      },
      { status: 502 },
    );
  }

  const responseBody = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") ?? "application/json";

  if (!upstream.ok) {
    console.error(
      `[API proxy] ${req.method} ${upstreamPath} -> ${target} returned ${upstream.status}`,
    );
  } else {
    console.log(
      `[API proxy] ${req.method} ${upstreamPath} -> ${target} ${upstream.status}`,
    );
  }

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { path } = await ctx.params;

    if (!Array.isArray(path) || path.length === 0) {
      return NextResponse.json({ error: "Missing API path" }, { status: 400 });
    }

    return await proxyRequest(req, path);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown proxy error";
    console.error("[API proxy] Unhandled error:", message);
    return NextResponse.json({ error: "API proxy internal error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
