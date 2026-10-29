import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no cookie means straight to the login page. The real
// session check happens on the server in every page and action (lib/auth/dal.ts).
export function proxy(request: NextRequest) {
  if (!request.cookies.has("tf_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Public: login, Next assets, and the files a handheld needs to install the app.
  matcher: [
    "/((?!login|_next/static|_next/image|icon\\.png|icon-|apple-touch-icon|manifest\\.webmanifest|sw\\.js|offline\\.html).*)",
  ],
};
