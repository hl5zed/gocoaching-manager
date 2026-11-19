import type { MetadataRoute } from "next";

// 인증 기반 내부 도구라 공개 진입점(로그인/가입 신청)만 사이트맵에 포함한다.
// 절대 URL이 필요하므로 사이트 주소 환경변수가 없으면 빈 사이트맵을 반환한다.
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ""
).replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteUrl) {
    return [];
  }

  return [
    {
      url: `${siteUrl}/login`,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteUrl}/signup`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
