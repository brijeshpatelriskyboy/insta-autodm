import { NextRequest, NextResponse } from "next/server";
import { isPlaceholderBackendUrl, resolveBackendUrl } from "@/lib/backend-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const backendUrl = resolveBackendUrl();

  if (isPlaceholderBackendUrl(backendUrl)) {
    console.error("[API proxy] API_URL / NEXT_PUBLIC_API_URL is still a placeholder.");
    return NextResponse.json(
      {
        error:
          "API_URL is a placeholder. Set it to your real Railway URL in Vercel and redeploy.",
      },
      { status: 500 },
    );
  }

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

  if (!upstream.ok) {
    console.error(
      `[API proxy] ${req.method} ${upstreamPath} -> ${target} returned ${upstream.status}`,
    );
  } else {
    console.log(
      `[API proxy] ${req.method} ${upstreamPath} -> ${target} ${upstream.status}`,
    );
  }

  // 204/205 must not include a body — returning one can throw in Next.js on Vercel.
  if (upstream.status === 204 || upstream.status === 205) {
    return new NextResponse(null, { status: upstream.status });
  }

  const responseBody = await upstream.arrayBuffer();

  if (responseBody.byteLength === 0) {
    return new NextResponse(null, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";

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
