import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isDashboard = pathname.startsWith("/dashboard");
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (isDashboard) {
      return NextResponse.json({ error: "سامانه احراز هویت پیکربندی نشده است." }, { status: 503 });
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  // A revoked/expired refresh token can remain in the browser cookie jar.
  // Clear only Supabase auth-token cookies for this specific invalid-token case,
  // then require a fresh sign-in instead of repeatedly reusing a broken session.
  const invalidRefreshToken = Boolean(
    error && /invalid refresh token|refresh token not found/i.test(error.message ?? "")
  );

  if (invalidRefreshToken) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(target);
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
        request.cookies.delete(cookie.name);
        redirectResponse.cookies.set(cookie.name, "", {
          path: "/",
          maxAge: 0,
          expires: new Date(0),
          httpOnly: false,
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
        });
      }
    }
    return redirectResponse;
  }

  if (isDashboard && (error || !user)) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", pathname);
    return NextResponse.redirect(target);
  }

  if (user && pathname === "/login") {
    const target = request.nextUrl.clone();
    target.pathname = "/dashboard";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/login"] };
