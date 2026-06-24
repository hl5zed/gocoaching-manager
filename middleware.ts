import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRolesByProfileId } from "@/lib/auth/get-user-roles";
import { hasRole } from "@/lib/auth/has-role";
import {
  AUTH_EMAIL_HEADER,
  AUTH_USER_ID_HEADER,
  PROFILE_ID_HEADER,
  PROFILE_STATUS_HEADER,
} from "@/lib/auth/identity-headers";
import {
  getAllowedRolesForPath,
  isApiRoute,
  isProtectedPageRoute,
  isPublicRoute,
} from "@/lib/auth/route-access";
import type { Database, ProfileStatus } from "@/types/database";

const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

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

  return response;
}

/**
 * 다운스트림으로 forward할 요청 헤더에서 클라이언트가 위조해 보냈을 수 있는
 * 인증 식별자 헤더를 먼저 제거한다(스푸핑 차단). 검증된 값은 인증 성공 경로에서만
 * 다시 set한다. 모든 NextResponse.next forward 경로는 이 sanitized 헤더를 사용한다.
 */
function sanitizeForwardHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(AUTH_USER_ID_HEADER);
  headers.delete(AUTH_EMAIL_HEADER);
  headers.delete(PROFILE_ID_HEADER);
  headers.delete(PROFILE_STATUS_HEADER);
  return headers;
}

/**
 * 인증/권한 검증을 통과한 경로에서만 호출. 검증된 식별자를 요청 헤더에 실어
 * 다운스트림(getSession 등)이 getUser 원격 왕복을 생략할 수 있게 한다.
 * supabase 세션 갱신으로 baseResponse에 세팅된 쿠키를 새 응답에 그대로 복사한다.
 */
function buildAuthorizedResponse(
  requestHeaders: Headers,
  baseResponse: NextResponse,
  user: { id: string; email?: string | null },
  profileId: string,
  status: ProfileStatus | null,
) {
  requestHeaders.set(AUTH_USER_ID_HEADER, user.id);
  if (user.email) {
    requestHeaders.set(AUTH_EMAIL_HEADER, user.email);
  }
  requestHeaders.set(PROFILE_ID_HEADER, profileId);
  if (status) {
    requestHeaders.set(PROFILE_STATUS_HEADER, status);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  for (const cookie of baseResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }

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
): Promise<
  | { ok: true; profileId: string; status: ProfileStatus | null }
  | { ok: false }
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return { ok: false };
  }

  const row = data as { id: string; status: ProfileStatus };
  return { ok: true, profileId: row.id, status: row.status ?? null };
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

  // 모든 forward 경로는 클라이언트發 인증 헤더가 제거된 sanitized 헤더를 사용한다.
  const requestHeaders = sanitizeForwardHeaders(request);

  if (isPublicRoute(pathname)) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  const needsAuth = isProtectedPageRoute(pathname) || isApiRoute(pathname);

  if (!needsAuth) {
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
      ? createApiError(
          401,
          "UNAUTHORIZED",
          "로그인이 필요합니다.",
        )
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

  const profileForMiddleware = await getProfileForMiddleware(supabase, user.id);

  if (!profileForMiddleware.ok) {
    return getRoleErrorResponse(request);
  }

  if (
    profileForMiddleware.status !== null &&
    profileForMiddleware.status !== "active" &&
    pathname !== "/dashboard"
  ) {
    return getDisabledAccountResponse(request);
  }

  const allowedRoles = getAllowedRolesForPath(pathname);

  if (!allowedRoles) {
    return buildAuthorizedResponse(
      requestHeaders,
      getResponse(),
      user,
      profileForMiddleware.profileId,
      profileForMiddleware.status,
    );
  }

  try {
    const userRoles = await getRolesByProfileId(
      supabase,
      profileForMiddleware.profileId,
    );

    if (!hasRole(userRoles, allowedRoles)) {
      return getRoleErrorResponse(request);
    }
  } catch {
    return getRoleErrorResponse(request);
  }

  return buildAuthorizedResponse(
    requestHeaders,
    getResponse(),
    user,
    profileForMiddleware.profileId,
    profileForMiddleware.status,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
