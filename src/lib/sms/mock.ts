import { SmsProvider, SmsTransientError } from "./provider";

/** Logs messages instead of sending them. SMS_MOCK_FAIL_RATE (0-1) simulates failures. */
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";

  async send(to: string, body: string) {
    const failRate = Number(process.env.SMS_MOCK_FAIL_RATE ?? 0);
    if (failRate > 0 && Math.random() < failRate) throw new SmsTransientError("Mock SMS gateway unavailable (simulated).");
    console.log(`[sms:mock] to ${to}: ${body}`);
    return { reference: `MOCK-SMS-${Date.now().toString(36)}` };
  }
}
