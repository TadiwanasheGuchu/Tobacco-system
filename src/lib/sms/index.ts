import { MockSmsProvider } from "./mock";
import { SmsProvider } from "./provider";

export * from "./provider";

let provider: SmsProvider | undefined;

export function smsEnabled() {
  return process.env.SMS_ENABLED !== "false";
}

export function getSmsProvider(): SmsProvider {
  if (provider) return provider;
  const mode = process.env.SMS_MODE ?? "mock";
  if (mode === "mock") return (provider = new MockSmsProvider());
  throw new Error(`SMS_MODE "${mode}" is not implemented yet. Use SMS_MODE=mock.`);
}
