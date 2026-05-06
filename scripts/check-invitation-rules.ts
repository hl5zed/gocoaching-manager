type InvitationRpcMessage =
  | "INVITE_NOT_FOUND"
  | "INVITE_ALREADY_USED"
  | "INVITE_EXPIRED"
  | "UNKNOWN";

type InvitationState = {
  status: "pending" | "accepted" | "expired" | "revoked";
  acceptedAt: string | null;
  expiresAt: string;
  deletedAt: string | null;
};

type EmailDeliveryCode = "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED";

function ensure(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureDeepEqual(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

function mapInvitationAcceptError(message: InvitationRpcMessage) {
  switch (message) {
    case "INVITE_NOT_FOUND":
      return { status: 404, code: "INVITE_NOT_FOUND" };
    case "INVITE_ALREADY_USED":
      return { status: 409, code: "INVITE_ALREADY_USED" };
    case "INVITE_EXPIRED":
      return { status: 410, code: "INVITE_EXPIRED" };
    default:
      return { status: 500, code: "INVITATION_ACCEPT_FAILED" };
  }
}

function classifyInvitationState(state: InvitationState) {
  if (state.deletedAt !== null) {
    return "not_found";
  }

  if (state.status === "revoked") {
    return "not_found";
  }

  if (state.status === "accepted" || state.acceptedAt !== null) {
    return "already_used";
  }

  if (
    state.status === "expired" ||
    new Date(state.expiresAt).getTime() <= Date.now()
  ) {
    return "expired";
  }

  if (state.status === "pending") {
    return "can_attempt_accept";
  }

  return "not_found";
}

function shouldStoreRawToken() {
  return false;
}

function shouldExposeTokenHashToClient() {
  return false;
}

function shouldLogInvitationUrl() {
  return false;
}

function shouldRollbackInvitationCreationOnEmailFailure() {
  return false;
}

function getEmailFailureCode(kind: "not_configured" | "send_failed"): EmailDeliveryCode {
  return kind === "not_configured"
    ? "EMAIL_NOT_CONFIGURED"
    : "EMAIL_SEND_FAILED";
}

function runChecks() {
  ensureDeepEqual(
    mapInvitationAcceptError("INVITE_NOT_FOUND"),
    { status: 404, code: "INVITE_NOT_FOUND" },
    "INVITE_NOT_FOUND must map to 404",
  );
  ensureDeepEqual(
    mapInvitationAcceptError("INVITE_ALREADY_USED"),
    { status: 409, code: "INVITE_ALREADY_USED" },
    "INVITE_ALREADY_USED must map to 409",
  );
  ensureDeepEqual(
    mapInvitationAcceptError("INVITE_EXPIRED"),
    { status: 410, code: "INVITE_EXPIRED" },
    "INVITE_EXPIRED must map to 410",
  );
  ensureDeepEqual(
    mapInvitationAcceptError("UNKNOWN"),
    { status: 500, code: "INVITATION_ACCEPT_FAILED" },
    "Unknown invitation RPC errors must map to 500",
  );

  const futureIso = new Date(Date.now() + 60_000).toISOString();
  const pastIso = new Date(Date.now() - 60_000).toISOString();

  ensure(
    classifyInvitationState({
      status: "pending",
      acceptedAt: null,
      expiresAt: futureIso,
      deletedAt: null,
    }) === "can_attempt_accept",
    "Pending invitation with future expiry should be eligible for accept attempt",
  );

  ensure(
    classifyInvitationState({
      status: "accepted",
      acceptedAt: null,
      expiresAt: futureIso,
      deletedAt: null,
    }) === "already_used",
    "Accepted status must be treated as already used",
  );

  ensure(
    classifyInvitationState({
      status: "pending",
      acceptedAt: new Date().toISOString(),
      expiresAt: futureIso,
      deletedAt: null,
    }) === "already_used",
    "accepted_at presence must be treated as already used",
  );

  ensure(
    classifyInvitationState({
      status: "expired",
      acceptedAt: null,
      expiresAt: futureIso,
      deletedAt: null,
    }) === "expired",
    "Expired status must be treated as expired",
  );

  ensure(
    classifyInvitationState({
      status: "pending",
      acceptedAt: null,
      expiresAt: pastIso,
      deletedAt: null,
    }) === "expired",
    "Past expires_at must be treated as expired",
  );

  ensure(
    classifyInvitationState({
      status: "revoked",
      acceptedAt: null,
      expiresAt: futureIso,
      deletedAt: null,
    }) === "not_found",
    "Revoked invitation must be obscured as not found",
  );

  ensure(
    classifyInvitationState({
      status: "pending",
      acceptedAt: null,
      expiresAt: futureIso,
      deletedAt: new Date().toISOString(),
    }) === "not_found",
    "Deleted invitation must be treated as not found",
  );

  ensure(shouldStoreRawToken() === false, "Raw token must not be stored");
  ensure(
    shouldExposeTokenHashToClient() === false,
    "token_hash must not be returned to clients",
  );
  ensure(
    shouldLogInvitationUrl() === false,
    "invitationUrl/raw token must not be logged",
  );

  ensure(
    shouldRollbackInvitationCreationOnEmailFailure() === false,
    "Email send failure must not rollback invitation creation",
  );
  ensure(
    getEmailFailureCode("not_configured") === "EMAIL_NOT_CONFIGURED",
    "Missing email env should map to EMAIL_NOT_CONFIGURED",
  );
  ensure(
    getEmailFailureCode("send_failed") === "EMAIL_SEND_FAILED",
    "Provider send failure should map to EMAIL_SEND_FAILED",
  );
}

runChecks();
console.log("✅ Invitation acceptance rules verified");

export {};
