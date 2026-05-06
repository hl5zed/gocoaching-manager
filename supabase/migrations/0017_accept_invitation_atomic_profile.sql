-- =============================================================================
-- Migration: 0017_accept_invitation_atomic_profile.sql
-- Project:   GOThriveCoaching
-- Purpose:   Make invitation acceptance fully atomic by resolving or creating
--            the accepting profile inside the PostgreSQL RPC transaction.
--
-- Notes:
--   - invitations stores token_hash, not the raw invitation token.
--   - user_roles uses profiles.id through user_roles.profile_id.
--   - profiles.auth_user_id has a unique partial index for live accounts:
--       uq_profiles_auth_user_id
--   - Active-role deduplication depends on:
--       uq_user_roles_active_global
--       uq_user_roles_active_scoped
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS public.accept_invitation(text, uuid);

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token text,
  p_auth_user_id uuid,
  p_email text,
  p_full_name text DEFAULT NULL,
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_now timestamptz := now();
  v_invitation invitations%ROWTYPE;
  v_accepted_invitation invitations%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_email text;
  v_display_name text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_email := lower(btrim(coalesce(p_email, '')));

  IF v_email = '' THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_display_name := nullif(btrim(coalesce(p_display_name, '')), '');

  IF v_display_name IS NULL THEN
    v_display_name := split_part(v_email, '@', 1);
  END IF;

  v_token_hash := encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');

  -- FOR UPDATE is intentionally used instead of SKIP LOCKED so concurrent
  -- accepts wait and receive an accurate already-used result rather than a
  -- misleading not-found result.
  SELECT *
  INTO v_invitation
  FROM invitations
  WHERE token_hash = v_token_hash
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_invitation.status = 'accepted' OR v_invitation.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITE_ALREADY_USED' USING ERRCODE = 'P0001';
  END IF;

  IF v_invitation.status = 'expired' OR v_invitation.expires_at <= v_now THEN
    RAISE EXCEPTION 'INVITE_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  IF v_invitation.status = 'revoked' THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_profile
  FROM profiles
  WHERE auth_user_id = p_auth_user_id
    AND deleted_at IS NULL
    AND status <> 'anonymized'
  LIMIT 1;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO profiles (
        auth_user_id,
        full_name,
        display_name,
        email,
        primary_role,
        status,
        preferred_language,
        timezone
      )
      VALUES (
        p_auth_user_id,
        nullif(btrim(coalesce(p_full_name, '')), ''),
        v_display_name,
        v_email,
        NULL,
        'active',
        'ko',
        'Asia/Bangkok'
      )
      RETURNING *
      INTO v_profile;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT *
        INTO v_profile
        FROM profiles
        WHERE auth_user_id = p_auth_user_id
          AND deleted_at IS NULL
          AND status <> 'anonymized'
        LIMIT 1;

        IF NOT FOUND THEN
          RAISE;
        END IF;
    END;
  END IF;

  UPDATE invitations
  SET status = 'accepted',
      accepted_at = v_now,
      accepted_by = v_profile.id,
      updated_at = v_now
  WHERE id = v_invitation.id
  RETURNING *
  INTO v_accepted_invitation;

  IF v_invitation.scope_id IS NULL THEN
    INSERT INTO user_roles (
      profile_id,
      role,
      scope_type,
      scope_id,
      granted_by,
      granted_at,
      expires_at,
      status,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      v_profile.id,
      v_invitation.invited_role,
      v_invitation.scope_type,
      NULL,
      v_invitation.invited_by,
      v_now,
      NULL,
      'active',
      true,
      v_now,
      v_now
    )
    ON CONFLICT (profile_id, role, scope_type)
      WHERE status = 'active'
        AND is_active = true
        AND deleted_at IS NULL
        AND scope_id IS NULL
    DO UPDATE
      SET status = 'active',
          is_active = true,
          granted_by = EXCLUDED.granted_by,
          granted_at = v_now,
          expires_at = NULL,
          updated_at = v_now;
  ELSE
    INSERT INTO user_roles (
      profile_id,
      role,
      scope_type,
      scope_id,
      granted_by,
      granted_at,
      expires_at,
      status,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      v_profile.id,
      v_invitation.invited_role,
      v_invitation.scope_type,
      v_invitation.scope_id,
      v_invitation.invited_by,
      v_now,
      NULL,
      'active',
      true,
      v_now,
      v_now
    )
    ON CONFLICT (profile_id, role, scope_type, scope_id)
      WHERE status = 'active'
        AND is_active = true
        AND deleted_at IS NULL
        AND scope_id IS NOT NULL
    DO UPDATE
      SET status = 'active',
          is_active = true,
          granted_by = EXCLUDED.granted_by,
          granted_at = v_now,
          expires_at = NULL,
          updated_at = v_now;
  END IF;

  INSERT INTO audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    reason,
    created_at
  )
  VALUES (
    v_profile.id,
    'invitation_accepted',
    'invitations',
    v_invitation.id,
    NULL,
    jsonb_build_object(
      'invitation_id', v_invitation.id,
      'profile_id', v_profile.id,
      'auth_user_id', p_auth_user_id,
      'email', v_email,
      'role', v_invitation.invited_role,
      'scope_type', v_invitation.scope_type,
      'scope_id', v_invitation.scope_id,
      'invited_by', v_invitation.invited_by
    ),
    NULL,
    v_now
  );

  RETURN jsonb_build_object(
    'invitation', to_jsonb(v_accepted_invitation),
    'profile_id', v_profile.id,
    'role', v_invitation.invited_role,
    'scope_type', v_invitation.scope_type,
    'scope_id', v_invitation.scope_id
  );
END;
$$;
