"use client";
import { useEffect } from "react";

export function ReducedMotion({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = enabled ? "true" : "false";
  }, [enabled]);
  return null;
}
