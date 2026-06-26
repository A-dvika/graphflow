import { NextResponse } from "next/server";

export function requireIngestAuth(request: Request) {
  const expectedToken = process.env.GRAPHFLOW_INGEST_TOKEN;

  if (!expectedToken) {
    return null;
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (token === expectedToken) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Unauthorized.",
    },
    {
      status: 401,
    },
  );
}
