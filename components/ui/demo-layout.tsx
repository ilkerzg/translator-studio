"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DemoLayoutProps {
  title: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
}

const maxWidthClasses = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

function FalLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 170 171"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M109.571 0.690002C112.515 0.690002 114.874 3.08348 115.155 6.01352C117.665 32.149 138.466 52.948 164.603 55.458C167.534 55.7394 169.927 58.0985 169.927 61.042V110.255C169.927 113.198 167.534 115.557 164.603 115.839C138.466 118.349 117.665 139.148 115.155 165.283C114.874 168.213 112.515 170.607 109.571 170.607H60.3553C57.4116 170.607 55.0524 168.213 54.7709 165.283C52.2608 139.148 31.4601 118.349 5.32289 115.839C2.39266 115.557 -0.000976562 113.198 -0.000976562 110.255V61.042C-0.000976562 58.0985 2.39267 55.7394 5.3229 55.458C31.4601 52.948 52.2608 32.149 54.7709 6.01351C55.0524 3.08348 57.4116 0.690002 60.3553 0.690002H109.571ZM34.1182 85.5045C34.1182 113.776 57.0124 136.694 85.2539 136.694C113.495 136.694 136.39 113.776 136.39 85.5045C136.39 57.2332 113.495 34.3147 85.2539 34.3147C57.0124 34.3147 34.1182 57.2332 34.1182 85.5045Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function DemoLayout({
  title,
  children,
  headerRight,
  maxWidth = "xl",
  className,
}: DemoLayoutProps) {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-black/80 backdrop-blur-xl">
        <div className={cn("mx-auto px-4 sm:px-6 lg:px-8", maxWidthClasses[maxWidth])}>
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="https://fal.ai" target="_blank" rel="noopener noreferrer" className="flex items-center">
                <FalLogo className="w-8 h-8 text-white" />
              </a>
              <div className="w-px h-6 bg-white/20" />
              <h1 className="text-lg font-semibold text-white">{title}</h1>
            </div>
            {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className={cn("mx-auto px-4 sm:px-6 lg:px-8 py-6", maxWidthClasses[maxWidth], className)}>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-4">
        <div className={cn("mx-auto px-4 sm:px-6 lg:px-8", maxWidthClasses[maxWidth])}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">
              Powered by{" "}
              <a href="https://fal.ai" target="_blank" rel="noopener noreferrer" className="text-[#e7083e] hover:underline">
                fal.ai
              </a>
            </p>
            <p className="text-xs text-white/40">
              <a href="https://github.com/ilkerzg/translator-studio" target="_blank" rel="noopener noreferrer" className="hover:text-white/60">
                GitHub
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
