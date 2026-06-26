import { NextResponse } from "next/server";

async function tokenFingerprint(token: string | undefined) {
  if (!token) {
    return null;
  }

  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));

  return [...new Uint8Array(bytes)]
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function requireIngestAuth(request: Request) {
  const expectedToken = process.env.GRAPHFLOW_INGEST_TOKEN;

  if (!expectedToken) {
    return null;
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (token === expectedToken) {
    return null;
  }

  const [expectedFingerprint, receivedFingerprint] = await Promise.all([
    tokenFingerprint(expectedToken),
    tokenFingerprint(token),
  ]);

  return NextResponse.json(
    {
      error: "Unauthorized.",
      auth: {
        tokenConfigured: Boolean(expectedToken),
        receivedToken: Boolean(token),
        expectedFingerprint,
        receivedFingerprint,
      },
    },
    {
      status: 401,
    },
  );
}
