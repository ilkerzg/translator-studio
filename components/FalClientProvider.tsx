"use client";

import { useEffect, useRef } from "react";
import { fal } from "@fal-ai/client";
import { useFalKey } from "@/lib/fal-key-provider";

export function FalClientProvider({ children }: { children: React.ReactNode }) {
  const { falKey, hasEnvKey, isLoading } = useFalKey();
  const configuredRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    // User's own key takes priority over env key
    if (falKey) {
      // Use direct credentials when user provides their own key
      fal.config({
        credentials: falKey,
      });
      configuredRef.current = true;
    } else if (hasEnvKey) {
      // Use proxy mode when only env key is available
      fal.config({
        proxyUrl: "/api/fal/proxy",
      });
      configuredRef.current = true;
    }
  }, [falKey, hasEnvKey, isLoading]);

  return <>{children}</>;
}
