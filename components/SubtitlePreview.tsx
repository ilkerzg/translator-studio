"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { SubtitleStyle } from "@/lib/types";
import { FONT_COLORS, HIGHLIGHT_COLORS } from "@/lib/constants";

interface SubtitlePreviewProps {
  videoFile: File | null;
  style: SubtitleStyle;
  className?: string;
}

// Sample text for preview - needs enough words to demonstrate words_per_subtitle
const PREVIEW_WORDS = ["This", "is", "a", "sample", "subtitle", "text"];

// Map font_color value to hex
function getColorHex(colorValue: string, colors: readonly { value: string; hex: string }[]): string {
  const found = colors.find((c) => c.value === colorValue);
  return found?.hex || "#FFFFFF";
}

// Map font weight to CSS value
function getFontWeight(weight: string): number {
  switch (weight) {
    case "normal":
      return 400;
    case "bold":
      return 700;
    case "black":
      return 900;
    default:
      return 700;
  }
}

// Get position styles - fixed positions for clear preview
function getPositionStyles(position: string): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    textAlign: "center",
    width: "90%",
  };

  switch (position) {
    case "top":
      return { ...base, top: "8%" };
    case "center":
      return { ...base, top: "50%", transform: "translate(-50%, -50%)" };
    case "bottom":
    default:
      return { ...base, bottom: "8%" };
  }
}

export function SubtitlePreview({ videoFile, style, className }: SubtitlePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frameUrl, setFrameUrl] = useState<string>("");
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });

  // Extract first frame from video
  useEffect(() => {
    if (!videoFile) {
      setFrameUrl("");
      return;
    }

    const video = document.createElement("video");
    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.muted = true;
    video.preload = "metadata";

    video.onloadeddata = () => {
      // Seek to first frame
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      setDimensions({ width: video.videoWidth, height: video.videoHeight });

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setFrameUrl(canvas.toDataURL("image/jpeg", 0.8));
      }
      URL.revokeObjectURL(url);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [videoFile]);

  // Calculate scaled font size based on preview container
  const scaledFontSize = Math.max(16, Math.round(style.font_size * 0.25));

  const textColor = getColorHex(style.font_color, FONT_COLORS);
  const hasHighlight = style.highlight_color !== "none";
  const highlightColor = hasHighlight
    ? getColorHex(style.highlight_color, HIGHLIGHT_COLORS)
    : textColor;

  // Get the words to display based on words_per_subtitle setting
  const wordsToShow = PREVIEW_WORDS.slice(0, style.words_per_subtitle);

  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-black", className)}>
      {/* Video frame background */}
      {frameUrl ? (
        <img
          src={frameUrl}
          alt="Video preview"
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="w-full aspect-video bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-lg bg-white/5 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xs text-white/30">Upload video to preview</p>
          </div>
        </div>
      )}

      {/* Subtitle overlay */}
      <div
        style={{
          ...getPositionStyles(style.position),
          fontFamily: `"${style.font_name}", sans-serif`,
          fontSize: `${scaledFontSize}px`,
          fontWeight: getFontWeight(style.font_weight),
          textShadow: `0 0 ${style.stroke_width * 2}px ${style.stroke_color},
                       0 0 ${style.stroke_width * 4}px ${style.stroke_color}`,
          letterSpacing: "0.02em",
        }}
      >
        <span className="inline-flex flex-wrap justify-center gap-x-2">
          {wordsToShow.map((word, index) => {
            // Only the first word gets highlight color (if highlight is enabled)
            const isCurrentWord = index === 0 && hasHighlight;
            return (
              <span
                key={index}
                style={{
                  color: isCurrentWord ? highlightColor : textColor,
                }}
              >
                {word}
              </span>
            );
          })}
        </span>
      </div>

      {/* Style info overlay */}
      <div className="absolute top-2 left-2 flex gap-1.5">
        <span className="px-1.5 py-0.5 text-[10px] bg-black/60 text-white/70 rounded">
          {style.font_name}
        </span>
        <span className="px-1.5 py-0.5 text-[10px] bg-black/60 text-white/70 rounded">
          {style.font_size}px
        </span>
        <span className="px-1.5 py-0.5 text-[10px] bg-black/60 text-white/70 rounded capitalize">
          {style.position}
        </span>
      </div>
    </div>
  );
}
