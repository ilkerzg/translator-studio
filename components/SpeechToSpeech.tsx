"use client";

import React, { useState, useCallback, useRef } from "react";
import { fal } from "@fal-ai/client";
import { FalSpinner } from "@/components/ui/fal-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AudioPlayer } from "@/components/ui/audio-player";
import { Mic, Upload, X, Square, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, VOICES, MODELS, getLanguageByCode, formatDuration } from "@/lib/constants";
import type { ProcessingStatus } from "@/lib/types";

interface SpeechToSpeechProps {
  hasFalKey: boolean;
}

export function SpeechToSpeech({ hasFalKey }: SpeechToSpeechProps) {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState("");

  // Audio input
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Settings
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [selectedVoice, setSelectedVoice] = useState("same_voice");

  // Results
  const [originalText, setOriginalText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [resultAudioUrl, setResultAudioUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0] as File;
    if (!file.type.startsWith("audio/")) {
      setError("Please select an audio file");
      return;
    }
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioFile(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
    setError(null);
    resetResults();
  }, [audioPreviewUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const file = new File([blob], `recording.${mimeType.split("/")[1]}`, { type: mimeType });
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioFile(file);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      resetResults();
      timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch {
      setError("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetResults = () => {
    setOriginalText("");
    setTranslatedText("");
    setResultAudioUrl("");
    setStatus("idle");
    setProgress("");
  };

  const handleTranslate = async () => {
    if (!hasFalKey || !audioFile) return;

    setStatus("uploading");
    setError(null);
    resetResults();
    setProgress("Uploading...");

    try {
      const audioUrl = await fal.storage.upload(audioFile);

      // Step 1: Transcribe
      setStatus("processing");
      setProgress("Transcribing...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sttResult = await fal.subscribe(MODELS.wizper, {
        input: { audio_url: audioUrl, task: "transcribe", chunk_level: "segment", version: "3" },
      }) as any;
      const sttData = sttResult?.data || sttResult;
      const transcript = sttData?.text || "";
      if (!transcript) throw new Error("No speech detected");
      setOriginalText(transcript);

      // Step 2: Translate with structured output for TTS optimization
      setProgress("Translating...");
      const targetLang = getLanguageByCode(targetLanguage)?.name || targetLanguage;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const translateResult = await fal.subscribe(MODELS.llm, {
        input: {
          prompt: `Translate the following text to ${targetLang}.

Return a JSON object with:
1. "translation": The translated text
2. "language_boost": The target language name for TTS (e.g., "Turkish", "German", "French", "English")
3. "pronunciation_hints": Array of pronunciation hints for difficult words, names, or technical terms. Format: ["word/(pronunciation)", ...]. Leave empty array if not needed.

Only return valid JSON, nothing else.

Text to translate:
"""${transcript}"""`,
          system_prompt: "You are a professional translator. Always return valid JSON format.",
          model: MODELS.llmModel,
          temperature: 0.3,
        },
      }) as any;
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

      if (!translated) throw new Error("Translation failed");
      setTranslatedText(translated);

      // Step 3: Voice clone if needed
      let voiceId = selectedVoice;
      if (selectedVoice === "same_voice") {
        setProgress("Cloning voice...");
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cloneResult = await fal.subscribe(MODELS.voiceClone, { input: { audio_url: audioUrl } }) as any;
          const cloneData = cloneResult?.data || cloneResult;
          voiceId = cloneData?.custom_voice_id || cloneData?.voice_id || "Friendly_Person";
        } catch {
          voiceId = "Friendly_Person";
        }
      }

      // Step 4: Generate speech with language boost and pronunciation hints
      setProgress("Generating speech...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ttsInput: any = {
        prompt: translated,
        voice_setting: {
          speed: 1,
          vol: 1,
          voice_id: voiceId,
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
      const ttsResult = await fal.subscribe(MODELS.tts, {
        input: ttsInput,
      }) as any;

      const ttsData = ttsResult?.data || ttsResult;
      const resultUrl = ttsData?.audio?.url || ttsData?.audio_url || "";
      if (!resultUrl) throw new Error("Failed to generate speech");
      setResultAudioUrl(resultUrl);
      setStatus("complete");
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
      setStatus("idle");
      setProgress("");
    }
  };

  const handleReset = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioFile(null);
    setAudioPreviewUrl("");
    resetResults();
    setError(null);
  };

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input */}
      <Card className="bg-[#0a0a0a] border-white/[0.08]">
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Audio Input</h3>
            <p className="text-sm text-white/40">Record or upload speech</p>
          </div>

          <div className="flex gap-4">
            {!isRecording ? (
              <Button onClick={startRecording} className="flex-1 h-12 bg-[#e7083e] hover:bg-[#c4072f]" disabled={isProcessing}>
                <Mic className="w-5 h-5 mr-2" />Record
              </Button>
            ) : (
              <Button onClick={stopRecording} className="flex-1 h-12 bg-red-500 hover:bg-red-600 animate-pulse">
                <Square className="w-5 h-5 mr-2" />Stop ({formatDuration(recordingTime)})
              </Button>
            )}
          </div>

          <div
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 min-h-[120px] flex items-center justify-center",
              isDragging ? "border-[#e7083e] bg-[#e7083e]/10" : "border-white/20"
            )}
          >
            {audioPreviewUrl ? (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">{audioFile?.name || "Recording"}</span>
                  <Button variant="ghost" size="sm" onClick={handleReset}><X className="w-4 h-4" /></Button>
                </div>
                <AudioPlayer src={audioPreviewUrl} title="input" showDownload={false} variant="compact" />
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <Upload className="w-8 h-8 text-white/30 mb-2" />
                <p className="text-sm text-white/40">Drop or click to upload</p>
                <input type="file" accept="audio/*" onChange={(e) => handleFileSelect(e.target.files)} className="hidden" />
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
                    <SelectItem key={l.code} value={l.code}>{l.flag} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-white/50 uppercase">Voice</Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] border-white/[0.08]">
                  {VOICES.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name} - {v.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full h-12 bg-[#e7083e] hover:bg-[#c4072f]"
            onClick={handleTranslate}
            disabled={isProcessing || !audioFile || !hasFalKey}
          >
            {isProcessing ? <><FalSpinner className="w-5 h-5 mr-2" />{progress}</> : <><Mic className="w-5 h-5 mr-2" />Translate Speech</>}
          </Button>

          {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
        </CardContent>
      </Card>

      {/* Right: Results */}
      <Card className="bg-[#0a0a0a] border-white/[0.08]">
        <CardContent className="p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white">Results</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-white/50 uppercase">Original</Label>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded min-h-[100px]">
                <p className="text-sm text-white/70">{originalText || "..."}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-white/50 uppercase">Translated ({getLanguageByCode(targetLanguage)?.name})</Label>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded min-h-[100px]">
                <p className="text-sm text-white/70">{translatedText || "..."}</p>
              </div>
            </div>
          </div>

          {resultAudioUrl && (
            <div className="space-y-2">
              <Label className="text-xs text-white/50 uppercase">Generated Audio</Label>
              <AudioPlayer src={resultAudioUrl} title={`translated-${targetLanguage}`} showDownload />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
