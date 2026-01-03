"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const FAL_KEY_STORAGE_KEY = "fal-api-key";

interface FalKeyContextValue {
  falKey: string;
  setFalKey: (key: string) => void;
  clearFalKey: () => void;
  hasFalKey: boolean;
  hasEnvKey: boolean;
  isLoading: boolean;
}

const FalKeyContext = createContext<FalKeyContextValue | null>(null);

export function FalKeyProvider({ children }: { children: React.ReactNode }) {
  const [falKey, setFalKeyState] = useState<string>("");
  const [hasEnvKey, setHasEnvKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkEnvKey() {
      try {
        const response = await fetch("/api/check-fal-key");
        const data = await response.json();
        setHasEnvKey(data.hasEnvKey);

        // Always check localStorage - user key takes priority
        const storedKey = localStorage.getItem(FAL_KEY_STORAGE_KEY);
        if (storedKey) {
          setFalKeyState(storedKey);
        }
      } catch {
        // Fallback to localStorage if API fails
        const storedKey = localStorage.getItem(FAL_KEY_STORAGE_KEY);
        if (storedKey) {
          setFalKeyState(storedKey);
        }
      } finally {
        setIsLoading(false);
      }
    }

    checkEnvKey();
  }, []);

  const setFalKey = useCallback((key: string) => {
    setFalKeyState(key);
    localStorage.setItem(FAL_KEY_STORAGE_KEY, key);
  }, []);

  const clearFalKey = useCallback(() => {
    setFalKeyState("");
    localStorage.removeItem(FAL_KEY_STORAGE_KEY);
  }, []);

  return (
    <FalKeyContext.Provider
      value={{
        falKey,
        setFalKey,
        clearFalKey,
        hasFalKey: hasEnvKey || Boolean(falKey),
        hasEnvKey,
        isLoading,
      }}
    >
      {children}
    </FalKeyContext.Provider>
  );
}

export function useFalKey() {
  const context = useContext(FalKeyContext);
  if (!context) {
    throw new Error("useFalKey must be used within a FalKeyProvider");
  }
  return context;
}
