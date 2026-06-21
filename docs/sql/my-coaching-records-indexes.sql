-- My Coaching records 목록 성능 개선용 인덱스 제안
-- 적용 전: staging에서 EXPLAIN ANALYZE로 확인 후 migration으로 반영하세요.
-- 이 파일은 제안용이며, 자동 적용되지 않습니다.

-- daily_records: 피코치별 최신순 + 날짜 범위
CREATE INDEX IF NOT EXISTS idx_daily_records_profile_record_date
  ON public.daily_records (profile_id, record_date DESC)
  WHERE deleted_at IS NULL;

-- weekly_logs: 피코치별 주 시작일 최신순
CREATE INDEX IF NOT EXISTS idx_weekly_logs_coachee_week_start
  ON public.weekly_logs (coachee_profile_id, week_start DESC)
  WHERE deleted_at IS NULL;

-- monthly_reflections: 피코치별 연월 최신순
CREATE INDEX IF NOT EXISTS idx_monthly_reflections_profile_year_month
  ON public.monthly_reflections (profile_id, year DESC, month DESC)
  WHERE deleted_at IS NULL;
