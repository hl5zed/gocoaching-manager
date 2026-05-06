-- =============================================================================
-- Migration: 0016_accept_invitation_rpc.sql
-- Project:   GOThriveCoaching
-- Purpose:   Accept invitations atomically in one PostgreSQL RPC.
--
-- Notes:
--   - invitations stores token_hash, not the raw invitation token.
--   - p_token is hashed inside this function with SHA-256.
--   - p_actor_id is expected to be profiles.id because user_roles.profile_id
--     and invitations.accepted_by both reference profiles(id).
--   - Active-role deduplication depends on the existing partial unique indexes:
--       uq_user_roles_active_global
--       uq_user_roles_active_scoped
--     Verify those indexes exist before applying this migration.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token text,
  p_actor_id uuid
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
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_token_hash := encode(digest(btrim(p_token), 'sha256'), 'hex');

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

  UPDATE invitations
  SET status = 'accepted',
      accepted_at = v_now,
      accepted_by = p_actor_id,
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
      p_actor_id,
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
      p_actor_id,
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
    p_actor_id,
    'invitation_accepted',
    'invitations',
    v_invitation.id,
    NULL,
    jsonb_build_object(
      'invitation_id', v_invitation.id,
      'email', v_invitation.invited_email,
      'role', v_invitation.invited_role,
      'scope_type', v_invitation.scope_type,
      'scope_id', v_invitation.scope_id,
      'invited_by', v_invitation.invited_by
    ),
    NULL,
    v_now
  );

  RETURN to_jsonb(v_accepted_invitation);
END;
$$;
