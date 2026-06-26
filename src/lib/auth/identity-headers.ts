/**
 * 미들웨어 → 다운스트림(서버 컴포넌트/route handler) 인증 식별자 전달용 헤더 이름.
 *
 * 미들웨어는 forward 전에 클라이언트發 동일 이름 헤더를 반드시 제거(strip)한 뒤,
 * auth.getUser() 검증에 성공한 경우에만 이 헤더들을 set한다. 따라서 다운스트림에서
 * 이 헤더가 존재한다면 "같은 요청에서 이미 검증된 값"임이 보장된다(스푸핑 불가).
 *
 * 인증/권한 판정 규칙을 우회하는 용도로 쓰지 말 것. getUser 원격 왕복/조회 절약 전용.
 */
export const AUTH_USER_ID_HEADER = "x-gothrive-auth-user-id";
export const AUTH_EMAIL_HEADER = "x-gothrive-auth-email";
export const PROFILE_ID_HEADER = "x-gothrive-profile-id";
export const PROFILE_STATUS_HEADER = "x-gothrive-profile-status";
/** active preferred_locale — middleware 검증값만 */
export const PROFILE_LOCALE_HEADER = "x-gothrive-profile-locale";
/** "1"이면 middleware가 preferred_locale(active 또는 null) 조회를 완료했음을 의미 */
export const PROFILE_LOCALE_KNOWN_HEADER = "x-gothrive-profile-locale-known";
/** comma-separated active UserRole — role-gated route 통과 후 middleware만 set */
export const VERIFIED_ROLES_HEADER = "x-gothrive-verified-roles";
/** middleware가 profile locale을 검증한 뒤 클라이언트 hint용 (내부 header 미노출) */
export const LOCALE_HINT_COOKIE = "gothrive-locale-hint";
