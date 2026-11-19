import type { MetadataRoute } from "next";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""
).replace(/\/+$/, "");

// 인증 기반 내부 도구. 공개 진입점(로그인/가입 신청)만 크롤링 허용하고
// 인증 뒤 경로와 API는 색인에서 제외한다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup"],
      disallow: [
        "/dashboard",
        "/my-coaching",
        "/coach",
        "/coach-maker",
        "/coachee",
        "/admin",
        "/super-admin",
        "/profile",
        "/api/",
      ],
    },
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}
