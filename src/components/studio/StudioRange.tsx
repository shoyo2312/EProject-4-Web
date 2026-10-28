"use client";

import { createContext, useContext, useState } from "react";

import type { RangeDays } from "@/lib/studio/metrics";

interface RangeValue {
  days: RangeDays;
  setDays: (days: RangeDays) => void;
}

const RangeContext = createContext<RangeValue | null>(null);

/**
 * The window every analytics screen reads. One for the whole Studio, as on
 * TikTok: switching from Overview to Viewers keeps the 28 days just picked.
 */
export function StudioRangeProvider({ children }: { children: React.ReactNode }) {
  const [days, setDays] = useState<RangeDays>(7);
  return <RangeContext.Provider value={{ days, setDays }}>{children}</RangeContext.Provider>;
}

export function useStudioRange(): RangeValue {
  const value = useContext(RangeContext);
  if (!value) throw new Error("useStudioRange outside StudioRangeProvider");
  return value;
}
