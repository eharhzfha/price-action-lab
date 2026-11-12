import { NextResponse, type NextRequest } from "next/server";

const REALM = 'Basic realm="Price Action Lab"';

function unauthorized() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": REALM,
      "Cache-Control": "no-store",
      Vary: "Authorization",
    },
  });
}

function misconfigured() {
  return new NextResponse("Authentication is not configured on the server.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Constant-time string comparison. The length difference is folded into the
 * accumulator so the loop still walks the full expected length.
 */
function safeEqual(candidate: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(candidate);
  const right = encoder.encode(expected);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

function decodeBasic(header: string | null): { username: string; password: string } | null {
  if (!header) return null;

  const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
  if (!match) return null;

  let decoded: string;
  try {
    const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch {
    return null;
  }

  const separator = decoded.indexOf(":");
  if (separator <= 0) return null;

  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

export function middleware(request: NextRequest) {
  const expectedPassword = process.env.SITE_PASSWORD;

  // Fail closed: never expose the app when the deployment secret is missing.
  if (!expectedPassword) return misconfigured();

  const credentials = decodeBasic(request.headers.get("authorization"));
  if (!credentials || !credentials.username || !safeEqual(credentials.password, expectedPassword)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
