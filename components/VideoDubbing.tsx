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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Download, Video, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, MODELS, getLanguageByCode } from "@/lib/constants";
import { extractAudioFromVideo } from "@/lib/audio-utils";
import { CustomVideoPlayer } from "./CustomVideoPlayer";
import type { ProcessingStatus } from "@/lib/types";

interface VideoDubbingProps {
  hasFalKey: boolean;
}

interface DubbingStep {
  id: string;
  label: string;
  status: "pending" | "processing" | "complete" | "error";
}

export function VideoDubbing({ hasFalKey }: VideoDubbingProps) {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState("");

  // Video input
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");

  // Settings
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [translationContext, setTranslationContext] = useState("");

  // Pipeline steps tracking
  const [steps, setSteps] = useState<DubbingStep[]>([
    { id: "upload", label: "Upload video", status: "pending" },
    { id: "extract", label: "Extract audio", status: "pending" },
    { id: "clone", label: "Clone voice", status: "pending" },
    { id: "transcribe", label: "Transcribe audio", status: "pending" },
    { id: "translate", label: "Translate text", status: "pending" },
    { id: "tts", label: "Generate dubbed audio", status: "pending" },
    { id: "lipsync", label: "Sync lips with audio", status: "pending" },
  ]);

  // Results
  const [transcript, setTranscript] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [resultVideoUrl, setResultVideoUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateStep = (stepId: string, stepStatus: DubbingStep["status"]) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status: stepStatus } : step))
    );
  };

  const resetSteps = () => {
    setSteps((prev) => prev.map((step) => ({ ...step, status: "pending" })));
  };

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
      resetResults();
    },
    [videoPreviewUrl]
  );

  const resetResults = () => {
    setTranscript("");
    setTranslatedText("");
    setResultVideoUrl("");
    setStatus("idle");
    setProgress("");
    resetSteps();
  };

  const handleDub = async () => {
    if (!hasFalKey || !videoFile) return;

    setStatus("uploading");
    setError(null);
    resetResults();

    try {
      // Step 1: Upload video
      updateStep("upload", "processing");
      setProgress("Uploading video...");
      const videoUrl = await fal.storage.upload(videoFile);
      updateStep("upload", "complete");

      setStatus("processing");

      // Step 2: Extract audio from video (browser-side)
      updateStep("extract", "processing");
      setProgress("Extracting audio from video...");
      const audioFile = await extractAudioFromVideo(videoFile);
      updateStep("extract", "complete");

      // Step 3: Upload extracted audio and clone voice
      updateStep("clone", "processing");
      setProgress("Uploading audio and cloning voice...");
      const audioUrl = await fal.storage.upload(audioFile);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cloneResult = (await fal.subscribe(MODELS.voiceClone, {
        input: {
          audio_url: audioUrl,
        },
      })) as any;
      const clonedVoiceId = cloneResult?.custom_voice_id || cloneResult?.voice_id || cloneResult?.data?.custom_voice_id || "";
      if (!clonedVoiceId) throw new Error("Failed to clone voice - response: " + JSON.stringify(cloneResult));
      updateStep("clone", "complete");

      // Step 4: Transcribe with Whisper (accepts video directly)
      updateStep("transcribe", "processing");
      setProgress("Transcribing audio...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sttInput: any = {
        audio_url: videoUrl,
        task: "transcribe",
        chunk_level: "segment",
        version: "3",
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sttResult = (await fal.subscribe(MODELS.whisper, {
        input: sttInput,
      })) as any;
      const sttData = sttResult?.data || sttResult;
      const transcriptText = sttData?.text || "";
      if (!transcriptText) throw new Error("Failed to transcribe audio - no speech detected");
      setTranscript(transcriptText);
      updateStep("transcribe", "complete");

      // Step 5: Translate with structured output for TTS optimization
      updateStep("translate", "processing");
      setProgress("Translating...");
      const targetLang = getLanguageByCode(targetLanguage)?.name || targetLanguage;

      // Build context section if provided
      const contextSection = translationContext.trim()
        ? `\nAdditional context from user (use this for accurate translation of names, terms, etc.):
"""${translationContext.trim()}"""\n`
        : "";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const translateResult = (await fal.subscribe(MODELS.llm, {
        input: {
          prompt: `Translate the following text to ${targetLang}.
${contextSection}
Return a JSON object with:
1. "translation": The translated text
2. "language_boost": The target language name for TTS (e.g., "Turkish", "German", "French", "English")
3. "pronunciation_hints": Array of pronunciation hints for difficult words, names, or technical terms. Format: ["word/(pronunciation)", ...]. Leave empty array if not needed.

Only return valid JSON, nothing else.

Text to translate:
"""${transcriptText}"""`,
          system_prompt:
            "You are a professional translator. Always return valid JSON format. Pay special attention to any context provided by the user regarding names, terms, or proper nouns.",
          model: MODELS.llmModel,
          temperature: 0.3,
        },
      })) as any;
      const translateData = translateResult?.data || translateResult;
      const rawOutput = (translateData?.output || translateData?.text || "").trim();

      // Parse structured translation response
      let translated = "";
      let languageBoost = targetLang;
      let pronunciationHints: string[] = [];

      try {
        const parsed = JSON.parse(rawOutput.replace(/```json\n?|\n?```/g, ""));
        translated = parsed.translation || "";
        languageBoost = parsed.language_boost || targetLang;
        pronunciationHints = parsed.pronunciation_hints || [];
      } catch {
        // Fallback: treat as plain text
        translated = rawOutput.replace(/^["']|["']$/g, "");
      }

      if (!translated) throw new Error("Failed to translate text");
      setTranslatedText(translated);
      updateStep("translate", "complete");

      // Step 6: Generate dubbed audio with cloned voice, language boost & pronunciation hints
      updateStep("tts", "processing");
      setProgress("Generating dubbed audio with cloned voice...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ttsInput: any = {
        prompt: translated,
        voice_setting: {
          voice_id: clonedVoiceId,
          speed: 1.0,
          vol: 1.0,
          pitch: 0,
          english_normalization: true,
        },
        output_format: "url",
        language_boost: languageBoost,
      };
      // Add pronunciation hints if available
      if (pronunciationHints.length > 0) {
        ttsInput.pronunciation_dict = { tone_list: pronunciationHints };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ttsResult = (await fal.subscribe(MODELS.tts, {
        input: ttsInput,
      })) as any;
      const ttsData = ttsResult?.data || ttsResult;
      const dubbedAudioUrl = ttsData?.audio?.url || ttsData?.audio_url || "";
      if (!dubbedAudioUrl) throw new Error("Failed to generate dubbed audio");
      updateStep("tts", "complete");

      // Step 7: Lipsync with sync-lipsync v2
      updateStep("lipsync", "processing");
      setProgress("Syncing lips with audio...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lipsyncInput: any = {
        model: "lipsync-2-pro",
        video_url: videoUrl,
        audio_url: dubbedAudioUrl,
        sync_mode: "cut_off",
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lipsyncResult = (await fal.subscribe(MODELS.lipsync, {
        input: lipsyncInput,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs?.length) {
            const lastLog = update.logs[update.logs.length - 1];
            if (lastLog?.message) setProgress(lastLog.message);
          }
        },
      })) as any;

      const lipsyncData = lipsyncResult?.data || lipsyncResult;
      const outputVideoUrl = lipsyncData?.video?.url || lipsyncData?.video_url || "";
      if (!outputVideoUrl) throw new Error("Failed to generate lip-synced video");
      updateStep("lipsync", "complete");

      setResultVideoUrl(outputVideoUrl);
      setStatus("complete");
      setProgress("");
    } catch (err) {
      // Mark current processing step as error
      setSteps((prev) =>
        prev.map((step) =>
          step.status === "processing" ? { ...step, status: "error" } : step
        )
      );
      const errorMessage = err instanceof Error ? err.message : "Dubbing failed";
      setError(errorMessage);
      setStatus("idle");
      setProgress("");
      console.error("Dubbing error:", err);
    }
  };

  const handleReset = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl("");
    resetResults();
    setError(null);
  };

  const handleDownload = async () => {
    if (!resultVideoUrl) return;
    const res = await fetch(resultVideoUrl);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dubbed-${targetLanguage}-${Date.now()}.mp4`;
    a.click();
  };

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input */}
      <Card className="bg-[#0a0a0a] border-white/[0.08]">
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Video Input</h3>
            <p className="text-sm text-white/40">Upload video to dub with lip sync</p>
          </div>

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
              "border-2 border-dashed rounded-lg min-h-[200px] flex items-center justify-center",
              isDragging ? "border-[#e7083e] bg-[#e7083e]/10" : "border-white/20"
            )}
          >
            {videoPreviewUrl ? (
              <div className="w-full relative">
                <CustomVideoPlayer
                  src={videoPreviewUrl}
                  className="w-full aspect-video"
                />
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 rounded-full z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer py-8">
                <Upload className="w-10 h-10 text-white/30 mb-3" />
                <p className="text-sm text-white/40">Drop video or click to upload</p>
                <p className="text-xs text-white/20 mt-1">MP4, MOV, WebM</p>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-white/50 uppercase">Target Language</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] border-white/[0.08] max-h-[200px]">
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.flag} {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-white/[0.02] border border-white/[0.08] rounded-lg">
              <p className="text-xs text-white/50">
                Voice will be automatically cloned from the original video
              </p>
            </div>

            {/* Translation Context */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-white/50 uppercase">Translation Context</Label>
                <span className="text-[10px] text-white/30 uppercase">(Optional)</span>
              </div>
              <Textarea
                value={translationContext}
                onChange={(e) => setTranslationContext(e.target.value)}
                placeholder="E.g., 'The speakers are John and Maria. Keep brand names like TechCorp unchanged. API and SDK are technical terms.'"
                className="bg-white/[0.03] border-white/[0.08] min-h-[80px] text-sm resize-none placeholder:text-white/20"
              />
              <div className="flex items-start gap-1.5 text-[11px] text-white/40">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                <span>This helps the AI understand names, terms, or context that may be missed during transcription.</span>
              </div>
            </div>
          </div>

          <Button
            className="w-full h-12 bg-[#e7083e] hover:bg-[#c4072f]"
            onClick={handleDub}
            disabled={isProcessing || !videoFile || !hasFalKey}
          >
            {isProcessing ? (
              <>
                <FalSpinner className="w-5 h-5 mr-2" />
                {progress}
              </>
            ) : (
              <>
                <Video className="w-5 h-5 mr-2" />
                Generate Dubbed Video
              </>
            )}
          </Button>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Pipeline & Results */}
      <div className="space-y-6">
        {/* Pipeline Progress */}
        <Card className="bg-[#0a0a0a] border-white/[0.08]">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pipeline</h3>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                      step.status === "complete" && "bg-green-500/20 text-green-400",
                      step.status === "processing" && "bg-[#e7083e]/20 text-[#e7083e]",
                      step.status === "error" && "bg-red-500/20 text-red-400",
                      step.status === "pending" && "bg-white/5 text-white/30"
                    )}
                  >
                    {step.status === "complete" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : step.status === "processing" ? (
                      <FalSpinner className="w-4 h-4" />
                    ) : step.status === "error" ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      step.status === "complete" && "text-green-400",
                      step.status === "processing" && "text-white",
                      step.status === "error" && "text-red-400",
                      step.status === "pending" && "text-white/40"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Text Results */}
        {(transcript || translatedText) && (
          <Card className="bg-[#0a0a0a] border-white/[0.08]">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Text</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-white/50 uppercase">Original</Label>
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded min-h-[80px] max-h-[120px] overflow-y-auto">
                    <p className="text-sm text-white/70">{transcript || "..."}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-white/50 uppercase">
                    {getLanguageByCode(targetLanguage)?.name}
                  </Label>
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded min-h-[80px] max-h-[120px] overflow-y-auto">
                    <p className="text-sm text-white/70">{translatedText || "..."}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result Video */}
        {resultVideoUrl && (
          <Card className="bg-[#0a0a0a] border-white/[0.08]">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Dubbed Video</h3>
                <Button variant="ghost" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </div>
              <CustomVideoPlayer
                src={resultVideoUrl}
                className="w-full aspect-video"
                showDownload
                onDownload={handleDownload}
                autoPlay
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
