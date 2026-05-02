-- =============================================================================
-- Migration: 0013_seed_basic_i18n_values.sql
-- Project:   GOThriveCoaching / GoCoaching Manager
-- Purpose:   Seed initial approved UI translations for early app screens.
--
-- Uses existing tables only:
--   translation_namespaces
--   translation_keys
--   translation_values
--   supported_languages
--
-- Idempotency:
--   - namespaces:        ON CONFLICT (name)
--   - translation_keys:  ON CONFLICT (namespace_id, key)
--   - translation_values: ON CONFLICT (translation_key_id, language_code)
-- =============================================================================

BEGIN;

-- Ensure the profile namespace exists. The other namespaces are seeded in 0009.
INSERT INTO translation_namespaces (name, description, is_active)
VALUES (
  'profile',
  'Profile screen labels, actions, read-only field labels, and validation messages.',
  true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

-- Seed keys for the initial UI namespaces.
WITH seed_keys(namespace_name, key_name, description) AS (
  VALUES
    -- common
    ('common', 'save', 'Generic save action.'),
    ('common', 'cancel', 'Generic cancel action.'),
    ('common', 'loading', 'Generic loading state.'),
    ('common', 'error', 'Generic error label.'),
    ('common', 'success', 'Generic success label.'),
    ('common', 'edit', 'Generic edit action.'),
    ('common', 'back', 'Generic back navigation action.'),
    ('common', 'language', 'Generic language label.'),
    ('common', 'timezone', 'Generic timezone label.'),

    -- auth
    ('auth', 'login', 'Login action or page title.'),
    ('auth', 'logout', 'Logout action.'),
    ('auth', 'email', 'Email input label.'),
    ('auth', 'password', 'Password input label.'),
    ('auth', 'login_success', 'Successful login message.'),
    ('auth', 'login_required', 'Message shown when authentication is required.'),

    -- dashboard
    ('dashboard', 'title', 'Dashboard title.'),
    ('dashboard', 'current_user_id', 'Current Supabase Auth user id label.'),
    ('dashboard', 'my_profile', 'My profile section title.'),
    ('dashboard', 'profile_not_created', 'Message shown when profile does not exist.'),
    ('dashboard', 'go_to_profile', 'Link label to profile page.'),
    ('dashboard', 'display_name', 'Display name label.'),
    ('dashboard', 'email', 'Email label.'),
    ('dashboard', 'primary_role', 'Primary role label.'),
    ('dashboard', 'status', 'Status label.'),
    ('dashboard', 'preferred_language', 'Preferred language label.'),
    ('dashboard', 'timezone', 'Timezone label.'),

    -- profile
    ('profile', 'title', 'Profile page title.'),
    ('profile', 'edit_profile', 'Edit profile section title.'),
    ('profile', 'display_name', 'Editable display name label.'),
    ('profile', 'phone', 'Editable phone label.'),
    ('profile', 'email_readonly', 'Read-only email label.'),
    ('profile', 'primary_role_readonly', 'Read-only primary role label.'),
    ('profile', 'status_readonly', 'Read-only status label.'),
    ('profile', 'preferred_language', 'Editable preferred language label.'),
    ('profile', 'timezone', 'Editable timezone label.'),
    ('profile', 'save_profile', 'Save profile button label.'),
    ('profile', 'profile_saved', 'Profile saved success message.'),
    ('profile', 'profile_save_failed', 'Profile save failed message.'),
    ('profile', 'invalid_language', 'Invalid language error message.'),
    ('profile', 'disallowed_fields', 'Disallowed profile fields error message.')
)
INSERT INTO translation_keys (namespace_id, key, description, is_active)
SELECT
  tn.id,
  sk.key_name,
  sk.description,
  true
FROM seed_keys sk
JOIN translation_namespaces tn ON tn.name = sk.namespace_name
ON CONFLICT (namespace_id, key) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

-- Seed approved translation values for ko, en, and th.
WITH seed_values(namespace_name, key_name, language_code, value) AS (
  VALUES
    -- common: ko
    ('common', 'save', 'ko', '저장'),
    ('common', 'cancel', 'ko', '취소'),
    ('common', 'loading', 'ko', '불러오는 중'),
    ('common', 'error', 'ko', '오류'),
    ('common', 'success', 'ko', '성공'),
    ('common', 'edit', 'ko', '수정'),
    ('common', 'back', 'ko', '뒤로'),
    ('common', 'language', 'ko', '언어'),
    ('common', 'timezone', 'ko', '시간대'),

    -- common: en
    ('common', 'save', 'en', 'Save'),
    ('common', 'cancel', 'en', 'Cancel'),
    ('common', 'loading', 'en', 'Loading'),
    ('common', 'error', 'en', 'Error'),
    ('common', 'success', 'en', 'Success'),
    ('common', 'edit', 'en', 'Edit'),
    ('common', 'back', 'en', 'Back'),
    ('common', 'language', 'en', 'Language'),
    ('common', 'timezone', 'en', 'Timezone'),

    -- common: th
    ('common', 'save', 'th', 'บันทึก'),
    ('common', 'cancel', 'th', 'ยกเลิก'),
    ('common', 'loading', 'th', 'กำลังโหลด'),
    ('common', 'error', 'th', 'ข้อผิดพลาด'),
    ('common', 'success', 'th', 'สำเร็จ'),
    ('common', 'edit', 'th', 'แก้ไข'),
    ('common', 'back', 'th', 'กลับ'),
    ('common', 'language', 'th', 'ภาษา'),
    ('common', 'timezone', 'th', 'เขตเวลา'),

    -- auth: ko
    ('auth', 'login', 'ko', '로그인'),
    ('auth', 'logout', 'ko', '로그아웃'),
    ('auth', 'email', 'ko', '이메일'),
    ('auth', 'password', 'ko', '비밀번호'),
    ('auth', 'login_success', 'ko', '로그인되었습니다'),
    ('auth', 'login_required', 'ko', '로그인이 필요합니다'),

    -- auth: en
    ('auth', 'login', 'en', 'Log in'),
    ('auth', 'logout', 'en', 'Log out'),
    ('auth', 'email', 'en', 'Email'),
    ('auth', 'password', 'en', 'Password'),
    ('auth', 'login_success', 'en', 'Logged in successfully'),
    ('auth', 'login_required', 'en', 'Login is required'),

    -- auth: th
    ('auth', 'login', 'th', 'เข้าสู่ระบบ'),
    ('auth', 'logout', 'th', 'ออกจากระบบ'),
    ('auth', 'email', 'th', 'อีเมล'),
    ('auth', 'password', 'th', 'รหัสผ่าน'),
    ('auth', 'login_success', 'th', 'เข้าสู่ระบบสำเร็จ'),
    ('auth', 'login_required', 'th', 'กรุณาเข้าสู่ระบบ'),

    -- dashboard: ko
    ('dashboard', 'title', 'ko', 'GO Coaching Dashboard'),
    ('dashboard', 'current_user_id', 'ko', '현재 로그인한 사용자 ID'),
    ('dashboard', 'my_profile', 'ko', '내 프로필'),
    ('dashboard', 'profile_not_created', 'ko', '프로필이 아직 생성되지 않았습니다'),
    ('dashboard', 'go_to_profile', 'ko', '프로필로 이동'),
    ('dashboard', 'display_name', 'ko', '표시 이름'),
    ('dashboard', 'email', 'ko', '이메일'),
    ('dashboard', 'primary_role', 'ko', '기본 역할'),
    ('dashboard', 'status', 'ko', '상태'),
    ('dashboard', 'preferred_language', 'ko', '선호 언어'),
    ('dashboard', 'timezone', 'ko', '시간대'),

    -- dashboard: en
    ('dashboard', 'title', 'en', 'GO Coaching Dashboard'),
    ('dashboard', 'current_user_id', 'en', 'Current signed-in user ID'),
    ('dashboard', 'my_profile', 'en', 'My profile'),
    ('dashboard', 'profile_not_created', 'en', 'Profile has not been created yet'),
    ('dashboard', 'go_to_profile', 'en', 'Go to profile'),
    ('dashboard', 'display_name', 'en', 'Display name'),
    ('dashboard', 'email', 'en', 'Email'),
    ('dashboard', 'primary_role', 'en', 'Primary role'),
    ('dashboard', 'status', 'en', 'Status'),
    ('dashboard', 'preferred_language', 'en', 'Preferred language'),
    ('dashboard', 'timezone', 'en', 'Timezone'),

    -- dashboard: th
    ('dashboard', 'title', 'th', 'GO Coaching Dashboard'),
    ('dashboard', 'current_user_id', 'th', 'รหัสผู้ใช้ที่เข้าสู่ระบบอยู่'),
    ('dashboard', 'my_profile', 'th', 'โปรไฟล์ของฉัน'),
    ('dashboard', 'profile_not_created', 'th', 'ยังไม่ได้สร้างโปรไฟล์'),
    ('dashboard', 'go_to_profile', 'th', 'ไปที่โปรไฟล์'),
    ('dashboard', 'display_name', 'th', 'ชื่อที่แสดง'),
    ('dashboard', 'email', 'th', 'อีเมล'),
    ('dashboard', 'primary_role', 'th', 'บทบาทหลัก'),
    ('dashboard', 'status', 'th', 'สถานะ'),
    ('dashboard', 'preferred_language', 'th', 'ภาษาที่ต้องการ'),
    ('dashboard', 'timezone', 'th', 'เขตเวลา'),

    -- profile: ko
    ('profile', 'title', 'ko', '내 프로필'),
    ('profile', 'edit_profile', 'ko', '프로필 수정'),
    ('profile', 'display_name', 'ko', '표시 이름'),
    ('profile', 'phone', 'ko', '전화번호'),
    ('profile', 'email_readonly', 'ko', '이메일 (읽기 전용)'),
    ('profile', 'primary_role_readonly', 'ko', '기본 역할 (읽기 전용)'),
    ('profile', 'status_readonly', 'ko', '상태 (읽기 전용)'),
    ('profile', 'preferred_language', 'ko', '선호 언어'),
    ('profile', 'timezone', 'ko', '시간대'),
    ('profile', 'save_profile', 'ko', '프로필 저장'),
    ('profile', 'profile_saved', 'ko', '프로필이 저장되었습니다'),
    ('profile', 'profile_save_failed', 'ko', '프로필 저장에 실패했습니다'),
    ('profile', 'invalid_language', 'ko', '지원하지 않는 언어입니다'),
    ('profile', 'disallowed_fields', 'ko', '수정할 수 없는 필드가 포함되어 있습니다'),

    -- profile: en
    ('profile', 'title', 'en', 'My profile'),
    ('profile', 'edit_profile', 'en', 'Edit profile'),
    ('profile', 'display_name', 'en', 'Display name'),
    ('profile', 'phone', 'en', 'Phone'),
    ('profile', 'email_readonly', 'en', 'Email (read-only)'),
    ('profile', 'primary_role_readonly', 'en', 'Primary role (read-only)'),
    ('profile', 'status_readonly', 'en', 'Status (read-only)'),
    ('profile', 'preferred_language', 'en', 'Preferred language'),
    ('profile', 'timezone', 'en', 'Timezone'),
    ('profile', 'save_profile', 'en', 'Save profile'),
    ('profile', 'profile_saved', 'en', 'Profile saved'),
    ('profile', 'profile_save_failed', 'en', 'Failed to save profile'),
    ('profile', 'invalid_language', 'en', 'Unsupported language'),
    ('profile', 'disallowed_fields', 'en', 'Disallowed fields were included'),

    -- profile: th
    ('profile', 'title', 'th', 'โปรไฟล์ของฉัน'),
    ('profile', 'edit_profile', 'th', 'แก้ไขโปรไฟล์'),
    ('profile', 'display_name', 'th', 'ชื่อที่แสดง'),
    ('profile', 'phone', 'th', 'โทรศัพท์'),
    ('profile', 'email_readonly', 'th', 'อีเมล (อ่านอย่างเดียว)'),
    ('profile', 'primary_role_readonly', 'th', 'บทบาทหลัก (อ่านอย่างเดียว)'),
    ('profile', 'status_readonly', 'th', 'สถานะ (อ่านอย่างเดียว)'),
    ('profile', 'preferred_language', 'th', 'ภาษาที่ต้องการ'),
    ('profile', 'timezone', 'th', 'เขตเวลา'),
    ('profile', 'save_profile', 'th', 'บันทึกโปรไฟล์'),
    ('profile', 'profile_saved', 'th', 'บันทึกโปรไฟล์แล้ว'),
    ('profile', 'profile_save_failed', 'th', 'บันทึกโปรไฟล์ไม่สำเร็จ'),
    ('profile', 'invalid_language', 'th', 'ไม่รองรับภาษานี้'),
    ('profile', 'disallowed_fields', 'th', 'มีฟิลด์ที่ไม่สามารถแก้ไขได้')
)
INSERT INTO translation_values (
  translation_key_id,
  language_code,
  value,
  is_machine_translated,
  review_status
)
SELECT
  tk.id,
  sv.language_code,
  sv.value,
  false,
  'approved'
FROM seed_values sv
JOIN translation_namespaces tn ON tn.name = sv.namespace_name
JOIN translation_keys tk
  ON tk.namespace_id = tn.id
 AND tk.key = sv.key_name
JOIN supported_languages sl
  ON sl.code = sv.language_code
 AND sl.is_active = true
ON CONFLICT (translation_key_id, language_code) DO UPDATE SET
  value = EXCLUDED.value,
  is_machine_translated = false,
  review_status = 'approved',
  updated_at = now();

COMMIT;

-- =============================================================================
-- End of 0013_seed_basic_i18n_values.sql
-- =============================================================================
