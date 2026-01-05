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
import { Upload, X, Download, Volume2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, MODELS, getLanguageByCode } from "@/lib/constants";
import { extractAudioFromVideo, mergeAudioSegmentsAtTimestamps, type AudioSegment } from "@/lib/audio-utils";
import { CustomVideoPlayer } from "./CustomVideoPlayer";
import type { ProcessingStatus } from "@/lib/types";

interface VideoVoiceDubProps {
  hasFalKey: boolean;
}

interface DubbingStep {
  id: string;
  label: string;
  status: "pending" | "processing" | "complete" | "error";
}

export function VideoVoiceDub({ hasFalKey }: VideoVoiceDubProps) {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState("");

  // Video input
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");

  // Settings
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [translationContext, setTranslationContext] = useState("");

  // Pipeline steps tracking (no lipsync step)
  const [steps, setSteps] = useState<DubbingStep[]>([
    { id: "upload", label: "Upload video", status: "pending" },
    { id: "extract", label: "Extract audio", status: "pending" },
    { id: "clone", label: "Clone voice", status: "pending" },
    { id: "transcribe", label: "Transcribe audio", status: "pending" },
    { id: "translate", label: "Translate text", status: "pending" },
    { id: "tts", label: "Generate dubbed audio", status: "pending" },
    { id: "merge", label: "Merge audio with video", status: "pending" },
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
      if (!clonedVoiceId) throw new Error("Failed to clone voice");
      updateStep("clone", "complete");

      // Step 4: Transcribe with ElevenLabs STT (word-level timestamps)
      updateStep("transcribe", "processing");
      setProgress("Transcribing audio with word timestamps...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sttResult = (await fal.subscribe(MODELS.elevenlabsSTT, {
        input: {
          audio_url: videoUrl,
          tag_audio_events: true,
          diarize: true,
        },
        logs: true,
      })) as any;
      const sttData = sttResult?.data || sttResult;
      const transcriptText = sttData?.text || "";
      const words = sttData?.words || [];
      if (!transcriptText) throw new Error("Failed to transcribe audio - no speech detected");
      setTranscript(transcriptText);
      updateStep("transcribe", "complete");

      // Build word list with timestamps for AI segmentation
      interface WordData {
        text: string;
        start: number;
        end: number;
        type: string;
        speaker_id?: string;
      }
      interface TextSegment {
        text: string;
        startTime: number;
        endTime: number;
      }

      const wordList = (words as WordData[])
        .filter(w => w.type === "word")
        .map((w, idx) => ({ idx, text: w.text, start: w.start, end: w.end }));

      if (wordList.length === 0) throw new Error("No words found in transcript");

      // Use AI to intelligently segment the transcript
      setProgress("AI segmenting transcript...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const segmentResult = (await fal.subscribe(MODELS.llm, {
        input: {
          prompt: `You are an expert at segmenting speech for video dubbing. Analyze this transcript and split it into natural segments.

RULES:
1. NEVER split in the middle of a sentence or phrase
2. Each segment should be a complete thought (1-3 sentences max)
3. Keep segments SHORT - ideally 2-8 words each for dubbing
4. Consider natural speech pauses and meaning
5. Names, numbers, and lists can be their own segments
6. Maximum segment duration: 5 seconds

TRANSCRIPT WITH WORD TIMESTAMPS:
${wordList.map(w => `[${w.idx}] "${w.text}" (${w.start.toFixed(2)}s-${w.end.toFixed(2)}s)`).join('\n')}

Return JSON array of segments. Each segment has start_idx and end_idx (inclusive word indices):
[
  {"start_idx": 0, "end_idx": 3},
  {"start_idx": 4, "end_idx": 8},
  ...
]

Only return valid JSON array, nothing else.`,
          system_prompt: "Expert speech segmentation AI. Return only valid JSON array. Focus on natural sentence boundaries and meaning. Never cut mid-sentence.",
          model: MODELS.llmModel,
          temperature: 0.1,
        },
      })) as any;

      const segmentData = segmentResult?.data || segmentResult;
      const rawSegments = (segmentData?.output || segmentData?.text || "").trim();

      let aiSegments: { start_idx: number; end_idx: number }[] = [];
      try {
        aiSegments = JSON.parse(rawSegments.replace(/```json\n?|\n?```/g, ""));
      } catch {
        console.error("Failed to parse AI segments, falling back to simple split");
        // Fallback: one segment per ~5 words
        for (let i = 0; i < wordList.length; i += 5) {
          aiSegments.push({ start_idx: i, end_idx: Math.min(i + 4, wordList.length - 1) });
        }
      }

      // Convert AI segments to TextSegments with timestamps
      const textSegments: TextSegment[] = [];
      for (const seg of aiSegments) {
        const startWord = wordList[seg.start_idx];
        const endWord = wordList[seg.end_idx];
        if (!startWord || !endWord) continue;

        const segmentWords = wordList.slice(seg.start_idx, seg.end_idx + 1);
        textSegments.push({
          text: segmentWords.map(w => w.text).join(" "),
          startTime: startWord.start,
          endTime: endWord.end,
        });
      }

      if (textSegments.length === 0) throw new Error("No speech segments found");

      // Debug: Log AI-detected segments
      console.log(`[VideoVoiceDub] AI detected ${textSegments.length} speech segments:`);
      textSegments.forEach((seg, i) => {
        const duration = seg.endTime - seg.startTime;
        console.log(`  Segment ${i}: [${seg.startTime.toFixed(2)}s - ${seg.endTime.toFixed(2)}s] (${duration.toFixed(2)}s) "${seg.text}"`);
      });

      // Step 5: Translate each segment
      updateStep("translate", "processing");
      setProgress(`Translating ${textSegments.length} segments...`);
      const targetLang = getLanguageByCode(targetLanguage)?.name || targetLanguage;

      // Build context section if provided
      const contextSection = translationContext.trim()
        ? `\nAdditional context from user (use this for accurate translation of names, terms, etc.):
"""${translationContext.trim()}"""\n`
        : "";

      interface TranslatedSegment {
        originalText: string;
        translatedText: string;
        startTime: number;
        maxDuration: number; // Max allowed duration until next segment
        languageBoost: string;
      }

      const translatedSegments: TranslatedSegment[] = [];

      for (let i = 0; i < textSegments.length; i++) {
        const segment = textSegments[i]!;
        const nextSegment = textSegments[i + 1];

        // Calculate EXACT available time until next segment
        const maxDuration = nextSegment
          ? nextSegment.startTime - segment.startTime
          : 10; // Last segment gets 10s max

        // TTS speaks ~2.5 words/second, so calculate max words
        const maxWords = Math.floor(maxDuration * 2.5);

        setProgress(`Translating segment ${i + 1}/${textSegments.length}...`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const translateResult = (await fal.subscribe(MODELS.llm, {
          input: {
            prompt: `Translate to ${targetLang}. You have EXACTLY ${maxDuration.toFixed(1)} seconds. MAX ${maxWords} words.
${contextSection}
RULES:
- MAX ${maxWords} WORDS (this is critical - audio will be cut if longer)
- Keep names/brands as-is
- Natural spoken language
- Shorter is better

Original: "${segment.text}"

JSON only: {"translation": "...", "language_boost": "${targetLang}"}`,
            system_prompt: `Dubbing translator. STRICT LIMIT: ${maxWords} words max. Shorter = better. JSON only.`,
            model: MODELS.llmModel,
            temperature: 0.1,
          },
        })) as any;
        const translateData = translateResult?.data || translateResult;
        const rawOutput = (translateData?.output || translateData?.text || "").trim();

        let translated = "";
        let languageBoost = targetLang;

        try {
          const parsed = JSON.parse(rawOutput.replace(/```json\n?|\n?```/g, ""));
          translated = parsed.translation || "";
          languageBoost = parsed.language_boost || targetLang;
        } catch {
          translated = rawOutput.replace(/^["']|["']$/g, "");
        }

        // Log translation with word count
        const wordCount = translated.split(/\s+/).filter(w => w.length > 0).length;
        console.log(`[Translate] Segment ${i}: "${translated}" (${wordCount} words, max was ${maxWords})`);

        if (translated) {
          translatedSegments.push({
            originalText: segment.text,
            translatedText: translated,
            startTime: segment.startTime,
            maxDuration,
            languageBoost,
          });
        }
      }

      if (translatedSegments.length === 0) throw new Error("Failed to translate any segments");
      setTranslatedText(translatedSegments.map((s) => s.translatedText).join(" "));
      updateStep("translate", "complete");

      // Step 6: Generate TTS for each segment separately with speed estimation
      updateStep("tts", "processing");
      const audioSegments: AudioSegment[] = [];

      for (let i = 0; i < translatedSegments.length; i++) {
        const segment = translatedSegments[i]!;
        setProgress(`Generating audio ${i + 1}/${translatedSegments.length}...`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ttsInput: any = {
          prompt: segment.translatedText,
          voice_setting: {
            voice_id: clonedVoiceId,
            speed: 1.0, // ALWAYS 1.0 - NO SPEED CHANGES
            vol: 1.0,
            pitch: 0,
            english_normalization: true,
          },
          output_format: "url",
          language_boost: segment.languageBoost,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ttsResult = (await fal.subscribe(MODELS.tts, {
          input: ttsInput,
        })) as any;
        const ttsData = ttsResult?.data || ttsResult;
        const audioUrl = ttsData?.audio?.url || ttsData?.audio_url || "";

        if (audioUrl) {
          audioSegments.push({
            audioUrl,
            startTime: segment.startTime, // Position at original timestamp
            targetDuration: segment.maxDuration, // Used for trimming if audio is too long
          });
        }
      }

      if (audioSegments.length === 0) throw new Error("Failed to generate any dubbed audio");
      updateStep("tts", "complete");

      // Step 7: Merge positioned audio segments, then combine with video using FFmpeg (server-side)
      updateStep("merge", "processing");
      setProgress("Merging and time-stretching audio segments...");

      // Get video duration for merge
      const tempVideo = document.createElement("video");
      tempVideo.src = videoPreviewUrl;
      const videoDuration = await new Promise<number>((resolve, reject) => {
        tempVideo.onloadedmetadata = () => resolve(tempVideo.duration);
        tempVideo.onerror = () => reject(new Error("Failed to get video duration"));
      });

      // Create merged audio WAV locally (with time-stretching)
      const mergedAudioBlob = await mergeAudioSegmentsAtTimestamps(
        audioSegments,
        videoDuration,
        (p) => setProgress(`Processing audio... ${Math.round(p)}%`)
      );

      // Upload merged audio
      setProgress("Uploading merged audio...");
      const mergedAudioUrl = await fal.storage.upload(
        new File([mergedAudioBlob], "dubbed-audio.wav", { type: "audio/wav" })
      );

      // Use FFmpeg server-side to merge video + audio (no browser power-saving issues)
      setProgress("Merging audio with video (server-side)...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ffmpegResult = (await fal.subscribe(MODELS.mergeAudioVideo, {
        input: {
          video_url: videoUrl,
          audio_url: mergedAudioUrl,
        },
        logs: true,
      })) as any;
      const ffmpegData = ffmpegResult?.data || ffmpegResult;
      const outputVideoUrl = ffmpegData?.video?.url || ffmpegData?.video_url || "";
      if (!outputVideoUrl) throw new Error("Failed to merge audio with video");
      updateStep("merge", "complete");

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
      const errorMessage = err instanceof Error ? err.message : "Voice dubbing failed";
      setError(errorMessage);
      setStatus("idle");
      setProgress("");
      console.error("Voice dubbing error:", err);
    }
  };

  const handleReset = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    // Note: resultVideoUrl is now a remote fal.ai URL, no need to revoke
    setVideoFile(null);
    setVideoPreviewUrl("");
    resetResults();
    setError(null);
  };

  const handleDownload = async () => {
    if (!resultVideoUrl) return;
    // Fetch the remote video and download
    const res = await fetch(resultVideoUrl);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `voice-dubbed-${targetLanguage}-${Date.now()}.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input */}
      <Card className="bg-[#0a0a0a] border-white/[0.08]">
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Video Input</h3>
            <p className="text-sm text-white/40">Upload video to translate voice (no lip sync)</p>
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
                Voice will be cloned and translated. Original video visuals stay unchanged.
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
                <Volume2 className="w-5 h-5 mr-2" />
                Translate Voice
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
                <h3 className="text-lg font-semibold text-white">Voice Dubbed Video</h3>
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
