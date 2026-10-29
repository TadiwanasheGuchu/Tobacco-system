import { TimbAdapter, TimbTransientError } from "./adapter";

/**
 * Stand-in for TIMB during development and training.
 *
 * - Grower numbers of 5-12 letters/digits verify, except ones starting with "X",
 *   which are treated as unknown to TIMB.
 * - TIMB_MOCK_FAIL_RATE (0-1) makes submissions fail at random so retry
 *   behaviour can be exercised.
 */
export class MockTimbAdapter implements TimbAdapter {
  readonly name = "mock";

  async verifyGrower(timbGrowerNumber: string) {
    const number = timbGrowerNumber.trim().toUpperCase();
    if (!/^[A-Z0-9]{5,12}$/.test(number)) {
      return { valid: false, reason: "Grower number format is not recognised by TIMB." };
    }
    if (number.startsWith("X")) {
      return { valid: false, reason: "Grower number is not registered with TIMB for this season." };
    }
    return { valid: true };
  }

  async submit(message: { id: string }) {
    const failRate = Number(process.env.TIMB_MOCK_FAIL_RATE ?? 0);
    if (failRate > 0 && Math.random() < failRate) {
      throw new TimbTransientError("Mock TIMB is unavailable (simulated).");
    }
    return { reference: `MOCK-${message.id}` };
  }
}
