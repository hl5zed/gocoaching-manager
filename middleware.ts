import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getRolesByProfileId,
  serializeVerifiedRoles,
} from "@/lib/auth/get-user-roles";
import { hasRole } from "@/lib/auth/has-role";
import {
  AUTH_EMAIL_HEADER,
  AUTH_USER_ID_HEADER,
  LOCALE_HINT_COOKIE,
  PROFILE_ID_HEADER,
  PROFILE_LOCALE_HEADER,
  PROFILE_LOCALE_KNOWN_HEADER,
  PROFILE_STATUS_HEADER,
  VERIFIED_ROLES_HEADER,
} from "@/lib/auth/identity-headers";
import {
  getAllowedRolesForPath,
  getMiddlewareAuthRequirement,
  isApiRoute,
  isPublicRoute,
} from "@/lib/auth/route-access";
import { isActiveLocale, type ActiveLocale } from "@/lib/i18n/config";
import type { Database, ProfileStatus, UserRole } from "@/types/database";

const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const CSP_REPORT_ONLY_ENABLED =
  (process.env.CSP_REPORT_ONLY === "1" || process.env.CSP_REPORT_ONLY === "true") &&
  process.env.VERCEL_ENV !== "production";

const LOCALE_HINT_MAX_AGE_SECONDS = 300;

function buildContentSecurityPolicy(options: { reportOnly: boolean }) {
  const directives = [
    "default-src 'self'",
    options.reportOnly
      ? "script-src 'self'"
      : "script-src 'self' 'unsafe-inline'",
    options.reportOnly
      ? "style-src 'self'"
      : "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ];

  if (options.reportOnly) {
    directives.push("report-uri /api/csp-report");
  }

  return directives.join("; ");
}

const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy({ reportOnly: false });
const CONTENT_SECURITY_POLICY_REPORT_ONLY = buildContentSecurityPolicy({
  reportOnly: true,
});

const securityHeaders = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
} as const;

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  if (CSP_REPORT_ONLY_ENABLED) {
    response.headers.set(
      "Content-Security-Policy-Report-Only",
      CONTENT_SECURITY_POLICY_REPORT_ONLY,
    );
  }

  return response;
}

function sanitizeForwardHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(AUTH_USER_ID_HEADER);
  headers.delete(AUTH_EMAIL_HEADER);
  headers.delete(PROFILE_ID_HEADER);
  headers.delete(PROFILE_STATUS_HEADER);
  headers.delete(PROFILE_LOCALE_HEADER);
  headers.delete(PROFILE_LOCALE_KNOWN_HEADER);
  headers.delete(VERIFIED_ROLES_HEADER);
  return headers;
}

type ProfileMiddlewareContext = {
  profileId: string;
  status: ProfileStatus | null;
  preferredLocale: ActiveLocale | null;
};

function setLocaleHintCookie(response: NextResponse, preferredLocale: ActiveLocale | null) {
  response.cookies.set(LOCALE_HINT_COOKIE, preferredLocale ?? "none", {
    path: "/",
    sameSite: "lax",
    maxAge: LOCALE_HINT_MAX_AGE_SECONDS,
  });
}

function setProfileContextHeaders(
  requestHeaders: Headers,
  context: ProfileMiddlewareContext,
) {
  requestHeaders.set(PROFILE_ID_HEADER, context.profileId);
  if (context.status) {
    requestHeaders.set(PROFILE_STATUS_HEADER, context.status);
  }
  requestHeaders.set(PROFILE_LOCALE_KNOWN_HEADER, "1");
  if (context.preferredLocale) {
    requestHeaders.set(PROFILE_LOCALE_HEADER, context.preferredLocale);
  }
}

function buildAuthOnlyResponse(
  requestHeaders: Headers,
  baseResponse: NextResponse,
  user: { id: string; email?: string | null },
) {
  requestHeaders.set(AUTH_USER_ID_HEADER, user.id);
  if (user.email) {
    requestHeaders.set(AUTH_EMAIL_HEADER, user.email);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  for (const cookie of baseResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  return applySecurityHeaders(response);
}

function buildProfileAuthorizedResponse(
  requestHeaders: Headers,
  baseResponse: NextResponse,
  user: { id: string; email?: string | null },
  context: ProfileMiddlewareContext,
  verifiedRoles?: UserRole[],
) {
  requestHeaders.set(AUTH_USER_ID_HEADER, user.id);
  if (user.email) {
    requestHeaders.set(AUTH_EMAIL_HEADER, user.email);
  }
  setProfileContextHeaders(requestHeaders, context);

  if (verifiedRoles) {
    requestHeaders.set(VERIFIED_ROLES_HEADER, serializeVerifiedRoles(verifiedRoles));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  for (const cookie of baseResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  setLocaleHintCookie(response, context.preferredLocale);

  return applySecurityHeaders(response);
}

function createLoginRedirect(request: NextRequest) {
  const redirectUrl = new URL("/login", request.url);
  const redirectTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  redirectUrl.searchParams.set("redirectTo", redirectTo);
  return applySecurityHeaders(NextResponse.redirect(redirectUrl));
}

function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  return (
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found")
  );
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith("sb-")) {
      continue;
    }

    request.cookies.delete(cookie.name);
    response.cookies.set(cookie.name, "", {
      maxAge: 0,
      path: "/",
    });
  }

  return response;
}

function createExpiredSessionResponse(request: NextRequest) {
  const response = isApiRoute(request.nextUrl.pathname)
    ? createApiError(401, "SESSION_EXPIRED", "세션이 만료되었습니다. 다시 로그인해 주세요.")
    : createLoginRedirect(request);

  return clearSupabaseAuthCookies(request, response);
}

function createUnauthorizedRedirect(request: NextRequest) {
  return applySecurityHeaders(
    NextResponse.redirect(new URL("/unauthorized", request.url)),
  );
}

function createApiError(status: number, code: string, message: string) {
  return applySecurityHeaders(
    NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message,
        },
      },
      { status },
    ),
  );
}

function createMiddlewareSupabaseClient(
  request: NextRequest,
  requestHeaders: Headers,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase middleware environment variables.");
  }

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request: { headers: requestHeaders },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return {
    supabase,
    getResponse() {
      return response;
    },
  };
}

function getRoleErrorResponse(request: NextRequest) {
  return isApiRoute(request.nextUrl.pathname)
    ? createApiError(403, "FORBIDDEN", "접근 권한이 없습니다.")
    : createUnauthorizedRedirect(request);
}

async function getProfileForMiddleware(
  supabase: SupabaseClient<Database>,
  authUserId: string,
): Promise<{ ok: true; context: ProfileMiddlewareContext } | { ok: false }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, status, preferred_locale")
    .eq("auth_user_id", authUserId)
    .neq("status", "anonymized")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return { ok: false };
  }

  const row = data as {
    id: string;
    status: ProfileStatus;
    preferred_locale: string | null;
  };
  const preferredLocale = isActiveLocale(row.preferred_locale)
    ? row.preferred_locale
    : null;

  return {
    ok: true,
    context: {
      profileId: row.id,
      status: row.status ?? null,
      preferredLocale,
    },
  };
}

function getDisabledAccountResponse(request: NextRequest) {
  return isApiRoute(request.nextUrl.pathname)
    ? createApiError(
        403,
        "ACCOUNT_DISABLED",
        "비활성화된 계정입니다. 관리자에게 문의하세요.",
      )
    : createUnauthorizedRedirect(request);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = sanitizeForwardHeaders(request);

  if (pathname === "/api/csp-report") {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  if (isPublicRoute(pathname)) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  const authRequirement = getMiddlewareAuthRequirement(pathname);

  if (!authRequirement) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  let supabase: SupabaseClient<Database>;
  let getResponse: () => NextResponse;

  try {
    ({ supabase, getResponse } = createMiddlewareSupabaseClient(
      request,
      requestHeaders,
    ));
  } catch {
    return isApiRoute(pathname)
      ? createApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.")
      : createLoginRedirect(request);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (isInvalidRefreshTokenError(userError)) {
      return createExpiredSessionResponse(request);
    }

    return isApiRoute(pathname)
      ? createApiError(401, "UNAUTHORIZED", "로그인이 필요합니다.")
      : createLoginRedirect(request);
  }

  if (authRequirement === "auth_only") {
    return buildAuthOnlyResponse(requestHeaders, getResponse(), user);
  }

  const profileForMiddleware = await getProfileForMiddleware(supabase, user.id);

  if (!profileForMiddleware.ok) {
    return getRoleErrorResponse(request);
  }

  const { context } = profileForMiddleware;

  if (
    context.status !== null &&
    context.status !== "active" &&
    pathname !== "/dashboard"
  ) {
    return getDisabledAccountResponse(request);
  }

  if (authRequirement === "profile") {
    return buildProfileAuthorizedResponse(
      requestHeaders,
      getResponse(),
      user,
      context,
    );
  }

  const allowedRoles = getAllowedRolesForPath(pathname);

  if (!allowedRoles) {
    return buildProfileAuthorizedResponse(
      requestHeaders,
      getResponse(),
      user,
      context,
    );
  }

  try {
    const userRoles = await getRolesByProfileId(supabase, context.profileId);

    if (!hasRole(userRoles, allowedRoles)) {
      return getRoleErrorResponse(request);
    }

    return buildProfileAuthorizedResponse(
      requestHeaders,
      getResponse(),
      user,
      context,
      userRoles,
    );
  } catch {
    return getRoleErrorResponse(request);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
