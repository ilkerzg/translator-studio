"use client";

import * as React from "react";
import { useState } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface FalKeyInputProps {
  value: string;
  hasKey: boolean;
  onSave: (key: string) => void;
  onClear: () => void;
  className?: string;
}

export function FalKeyInput({
  value,
  hasKey,
  onSave,
  onClear,
  className,
}: FalKeyInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    if (inputValue.trim()) {
      onSave(inputValue.trim());
    }
  };

  const handleClear = () => {
    setInputValue("");
    onClear();
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <input
          type={showKey ? "text" : "password"}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter your FAL API key"
          className="w-full h-9 px-3 pr-10 text-sm bg-white/[0.03] border border-white/[0.08] rounded-md focus:outline-none focus:ring-1 focus:ring-[#e7083e] text-white placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
        >
          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {hasKey ? (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          <X className="w-4 h-4 mr-1" />
          Clear
        </Button>
      ) : (
        <Button size="sm" onClick={handleSave} disabled={!inputValue.trim()}>
          <Check className="w-4 h-4 mr-1" />
          Save
        </Button>
      )}
    </div>
  );
}
