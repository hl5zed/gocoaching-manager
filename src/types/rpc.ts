import type { Database, InvitationRow } from "@/types/database";

export type RpcDefinitions = Database["public"]["Functions"];

export type DatabaseWithRpc = Database;

export type AcceptInvitationRpcResult = {
  invitation: InvitationRow;
  profile_id: string;
  role: InvitationRow["invited_role"];
  scope_type: InvitationRow["scope_type"];
  scope_id: InvitationRow["scope_id"];
};
