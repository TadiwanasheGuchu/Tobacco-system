"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

const STEP = 0.05;

/** Price entry with big +/- buttons for bidding on a phone. Submits as "price". */
export function BidPad({ start, minimum }: { start: number; minimum?: number }) {
  const [price, setPrice] = useState(start);
  const set = (v: number) => setPrice(Math.max(0.01, Math.round(v * 100) / 100));
  const tooLow = minimum !== undefined && price <= minimum;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button type="button" className="btn h-16 w-16 !rounded-2xl" onClick={() => set(price - STEP)} aria-label="Lower by 5 cents">
          <Minus size={22} />
        </button>
        <label className="flex-1 text-center">
          <span className="block text-xs text-muted">US$ per kg</span>
          <input
            name="price"
            inputMode="decimal"
            className="w-full bg-transparent text-center text-4xl font-semibold tabular-nums outline-none"
            value={price.toFixed(2)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setPrice(v);
            }}
          />
        </label>
        <button type="button" className="btn h-16 w-16 !rounded-2xl" onClick={() => set(price + STEP)} aria-label="Raise by 5 cents">
          <Plus size={22} />
        </button>
      </div>
      {tooLow && <p className="text-center text-xs text-danger">Must be higher than the current US${minimum!.toFixed(2)}</p>}
    </div>
  );
}
