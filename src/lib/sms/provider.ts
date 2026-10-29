/**
 * Boundary to the SMS gateway. Zimbabwe gateways differ in API and pricing;
 * pick one and add an adapter here. Nothing else changes.
 */
export interface SmsProvider {
  readonly name: string;
  /** Must not throw for an accepted message; return the gateway's message id. */
  send(to: string, body: string): Promise<{ reference: string }>;
}

/** Thrown for errors worth retrying (gateway down, rate limited). */
export class SmsTransientError extends Error {}
