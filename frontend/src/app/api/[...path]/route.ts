import { NextRequest, NextResponse } from "next/server";

function getBackendUrl(): string {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000"
  ).replace(/\/$/, "");
}

const HOP_BY_HOP = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function resolveUpstreamPath(pathSegments: string[]): string {
  const path = pathSegments.join("/");

  // Backend health check lives at /health, not /api/health.
  if (path === "health") {
    return "/health";
  }

  return `/api/${path}`;
}

function wouldProxyLoop(req: NextRequest, backendUrl: string): boolean {
  try {
    const requestHost = req.nextUrl.hostname.toLowerCase();
    const backendHost = new URL(backendUrl).hostname.toLowerCase();
    return requestHost === backendHost;
  } catch {
    return false;
  }
}

async function proxyRequest(
  req: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const backendUrl = getBackendUrl();

  if (wouldProxyLoop(req, backendUrl)) {
    console.error(
      `[API proxy] Refusing loop: API_URL host matches request host (${req.nextUrl.hostname})`,
    );
    return NextResponse.json(
      { error: "API_URL must point to the Railway backend, not the Vercel frontend." },
      { status: 500 },
    );
  }

  const upstreamPath = resolveUpstreamPath(pathSegments);
  const target = `${backendUrl}${upstreamPath}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
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

  if (!upstream.ok) {
    console.error(
      `[API proxy] ${req.method} ${upstreamPath} -> ${target} returned ${upstream.status}`,
    );
  } else {
    console.log(
      `[API proxy] ${req.method} ${upstreamPath} -> ${target} ${upstream.status}`,
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxyRequest(req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
