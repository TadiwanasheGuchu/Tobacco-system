import { TimbAdapter } from "./adapter";
import { MockTimbAdapter } from "./mock";

export * from "./adapter";

let adapter: TimbAdapter | undefined;

export function getTimbAdapter(): TimbAdapter {
  if (adapter) return adapter;
  const mode = process.env.TIMB_MODE ?? "mock";
  switch (mode) {
    case "mock":
      adapter = new MockTimbAdapter();
      return adapter;
    default:
      // The live adapter is written once TIMB issues the integration spec and
      // buyer credentials. Failing loudly beats silently not reporting sales.
      throw new Error(`TIMB_MODE "${mode}" is not implemented yet. Use TIMB_MODE=mock.`);
  }
}
