/**
 * Boundary between this system and TIMB (Tobacco Industry and Marketing Board).
 *
 * TIMB does not publish a public API; licensed buyers receive the integration
 * spec and credentials from TIMB. Everything TIMB-specific lives behind this
 * interface so the real integration can replace the mock without touching the
 * rest of the system.
 */

export interface GrowerVerification {
  valid: boolean;
  /** Name as registered with TIMB, used to cross-check what reception typed. */
  registeredName?: string;
  reason?: string;
}

export type TimbMessageType = "BALE_RECEIVED" | "BALE_SOLD" | "BALE_REJECTED" | "DAILY_SUMMARY";

export interface TimbMessage {
  id: string;
  type: TimbMessageType;
  payload: unknown;
}

export interface TimbSubmitResult {
  /** TIMB's acknowledgement reference. */
  reference: string;
}

export interface TimbAdapter {
  readonly name: string;
  verifyGrower(timbGrowerNumber: string, nationalId: string): Promise<GrowerVerification>;
  /** Must be idempotent on message.id: the outbox may deliver a message more than once. */
  submit(message: TimbMessage): Promise<TimbSubmitResult>;
}

/** Thrown for errors worth retrying (timeouts, TIMB unavailable). */
export class TimbTransientError extends Error {}
