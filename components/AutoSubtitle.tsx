"use client";

import React, { useState, useCallback } from "react";
import { fal } from "@fal-ai/client";
import { FalSpinner } from "@/components/ui/fal-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  X,
  Download,
  Subtitles,
  Sparkles,
  AlertCircle,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LANGUAGES,
  FONTS,
  FONT_WEIGHTS,
  FONT_COLORS,
  HIGHLIGHT_COLORS,
  POSITIONS,
  MODELS,
  SUBTITLE_PRESETS,
} from "@/lib/constants";
import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle, type ProcessingStatus } from "@/lib/types";
import { SubtitlePreview } from "./SubtitlePreview";
import { CustomVideoPlayer } from "./CustomVideoPlayer";

interface AutoSubtitleProps {
  hasFalKey: boolean;
}

export function AutoSubtitle({ hasFalKey }: AutoSubtitleProps) {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState("");

  // Video
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [resultVideoUrl, setResultVideoUrl] = useState("");

  // Style
  const [style, setStyle] = useState<SubtitleStyle>({ ...DEFAULT_SUBTITLE_STYLE });
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // View mode
  const [showPreview, setShowPreview] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0] as File;
      if (!file.type.startsWith("video/")) {
        setError("Please select a video file");
        return;
      }
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setError(null);
      setResultVideoUrl("");
      setStatus("idle");
    },
    [videoPreviewUrl]
  );

  const updateStyle = <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
    setStyle((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
  };

  const applyPreset = (preset: (typeof SUBTITLE_PRESETS)[number]) => {
    setStyle((prev) => ({ ...prev, ...preset.style }));
    setActivePreset(preset.name);
  };

  const handleGenerate = async () => {
    if (!hasFalKey || !videoFile) return;

    setStatus("uploading");
    setError(null);
    setResultVideoUrl("");
    setProgress("Uploading...");

    try {
      const videoUrl = await fal.storage.upload(videoFile);

      setStatus("processing");
      setProgress("Generating subtitles...");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: any = {
        video_url: videoUrl,
        language: style.language,
        font_name: style.font_name,
        font_size: style.font_size,
        font_weight: style.font_weight,
        font_color: style.font_color,
        highlight_color: style.highlight_color,
        stroke_width: style.stroke_width,
        stroke_color: style.stroke_color,
        position: style.position,
        y_offset: style.y_offset,
        words_per_subtitle: style.words_per_subtitle,
        enable_animation: style.enable_animation,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fal.subscribe(MODELS.autoSubtitle, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs?.length) {
            const lastLog = update.logs[update.logs.length - 1];
            if (lastLog?.message) setProgress(lastLog.message);
          }
        },
      })) as any;
      const data = result?.data || result;

      const outputUrl = data?.video?.url || data?.video_url || "";
      if (!outputUrl) throw new Error("Failed to generate subtitled video");

      setResultVideoUrl(outputUrl);
      setStatus("complete");
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStatus("idle");
      setProgress("");
    }
  };

  const handleDownload = async () => {
    if (!resultVideoUrl) return;
    const res = await fetch(resultVideoUrl);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `subtitled-${Date.now()}.mp4`;
    a.click();
  };

  const handleReset = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl("");
    setResultVideoUrl("");
    setStatus("idle");
    setError(null);
  };

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {SUBTITLE_PRESETS.map((preset) => (
          <Button
            key={preset.name}
            variant={activePreset === preset.name ? "default" : "ghost"}
            size="sm"
            onClick={() => applyPreset(preset)}
            className={cn(
              "text-xs",
              activePreset === preset.name
                ? "bg-[#e7083e] hover:bg-[#c4072f]"
                : "bg-white/[0.03] text-white/60"
            )}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {preset.name}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video & Preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* Toggle between video player and preview */}
          {videoPreviewUrl && !resultVideoUrl && (
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className={cn(
                  "text-xs gap-1.5",
                  showPreview ? "bg-[#e7083e]/20 text-[#e7083e]" : "text-white/50"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                {showPreview ? "Style Preview" : "Show Preview"}
              </Button>
            </div>
          )}

          {/* Video Input / Preview / Result */}
          <Card className="bg-[#0a0a0a] border-white/[0.08]">
            <CardContent className="p-4">
              {resultVideoUrl ? (
                // Result video
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white">Result</h3>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setResultVideoUrl("")}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CustomVideoPlayer
                    src={resultVideoUrl}
                    className="w-full aspect-video"
                    showDownload
                    onDownload={handleDownload}
                    autoPlay
                  />
                </div>
              ) : videoPreviewUrl ? (
                // Input video or style preview
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white">
                      {showPreview ? "Style Preview" : "Video"}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {showPreview ? (
                    <SubtitlePreview
                      videoFile={videoFile}
                      style={style}
                      className="aspect-video"
                    />
                  ) : (
                    <CustomVideoPlayer
                      src={videoPreviewUrl}
                      className="w-full aspect-video"
                    />
                  )}
                </div>
              ) : (
                // Upload zone
                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileSelect(e.dataTransfer.files);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  className={cn(
                    "border-2 border-dashed rounded-lg aspect-video flex items-center justify-center",
                    isDragging ? "border-[#e7083e] bg-[#e7083e]/10" : "border-white/20"
                  )}
                >
                  <label className="flex flex-col items-center cursor-pointer py-12">
                    <div className="w-14 h-14 mb-4 bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                      <Upload className="w-6 h-6 text-white/30" />
                    </div>
                    <p className="text-sm text-white/40 mb-1">Drop video or click to upload</p>
                    <p className="text-xs text-white/20">MP4, MOV, WebM</p>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleFileSelect(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generate Button (below video on mobile) */}
          <div className="lg:hidden">
            <Button
              className="w-full h-12 bg-[#e7083e] hover:bg-[#c4072f]"
              onClick={handleGenerate}
              disabled={isProcessing || !videoFile || !hasFalKey}
            >
              {isProcessing ? (
                <>
                  <FalSpinner className="w-5 h-5 mr-2" />
                  {progress}
                </>
              ) : (
                <>
                  <Subtitles className="w-5 h-5 mr-2" />
                  Generate Subtitles
                </>
              )}
            </Button>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm mt-3">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right: Settings */}
        <Card className="bg-[#0a0a0a] border-white/[0.08]">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-white mb-4">Style Settings</h3>

            <ScrollArea className="h-[380px] pr-3">
              <div className="space-y-5">
                {/* Language */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/50 uppercase">Language</Label>
                  <Select value={style.language} onValueChange={(v) => updateStyle("language", v)}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f0f0f] border-white/[0.08] max-h-[180px]">
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.flag} {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/50 uppercase">Font</Label>
                  <Select value={style.font_name} onValueChange={(v) => updateStyle("font_name", v)}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f0f0f] border-white/[0.08]">
                      {FONTS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs text-white/50 uppercase">Size</Label>
                    <span className="text-xs text-white/40">{style.font_size}px</span>
                  </div>
                  <Slider
                    value={[style.font_size]}
                    onValueChange={(v) => updateStyle("font_size", v[0] ?? 80)}
                    min={40}
                    max={150}
                    step={5}
                  />
                </div>

                {/* Font Weight */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/50 uppercase">Weight</Label>
                  <Select value={style.font_weight} onValueChange={(v) => updateStyle("font_weight", v)}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f0f0f] border-white/[0.08]">
                      {FONT_WEIGHTS.map((w) => (
                        <SelectItem key={w.value} value={w.value}>
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Colors side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50 uppercase">Text</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {FONT_COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => updateStyle("font_color", c.value)}
                          className={cn(
                            "w-6 h-6 rounded-full border-2",
                            style.font_color === c.value
                              ? "border-white scale-110"
                              : "border-white/20"
                          )}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-white/50 uppercase">Highlight</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {HIGHLIGHT_COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => updateStyle("highlight_color", c.value)}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                            style.highlight_color === c.value
                              ? "border-white scale-110"
                              : "border-white/20"
                          )}
                          style={{
                            backgroundColor: c.value === "none" ? "transparent" : c.hex,
                          }}
                        >
                          {c.value === "none" && <X className="w-2.5 h-2.5 text-white/40" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Position */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/50 uppercase">Position</Label>
                  <Select value={style.position} onValueChange={(v) => updateStyle("position", v)}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.08] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f0f0f] border-white/[0.08]">
                      {POSITIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Words per subtitle */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs text-white/50 uppercase">Words/Subtitle</Label>
                    <span className="text-xs text-white/40">{style.words_per_subtitle}</span>
                  </div>
                  <Slider
                    value={[style.words_per_subtitle]}
                    onValueChange={(v) => updateStyle("words_per_subtitle", v[0] ?? 1)}
                    min={1}
                    max={6}
                    step={1}
                  />
                </div>

                {/* Animation */}
                <div className="flex items-center justify-between py-2">
                  <Label className="text-sm text-white/60">Animation</Label>
                  <Switch
                    checked={style.enable_animation}
                    onCheckedChange={(v) => updateStyle("enable_animation", v)}
                  />
                </div>
              </div>
            </ScrollArea>

            {/* Generate Button (desktop) */}
            <div className="hidden lg:block mt-4 pt-4 border-t border-white/[0.06]">
              <Button
                className="w-full h-11 bg-[#e7083e] hover:bg-[#c4072f]"
                onClick={handleGenerate}
                disabled={isProcessing || !videoFile || !hasFalKey}
              >
                {isProcessing ? (
                  <>
                    <FalSpinner className="w-5 h-5 mr-2" />
                    {progress}
                  </>
                ) : (
                  <>
                    <Subtitles className="w-5 h-5 mr-2" />
                    Generate
                  </>
                )}
              </Button>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm mt-3">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
