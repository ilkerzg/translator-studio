"use client";

import React, { useState, useCallback, useRef } from "react";
import { fal } from "@fal-ai/client";
import { FalSpinner } from "@/components/ui/fal-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AudioPlayer } from "@/components/ui/audio-player";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Upload, X, Square, Copy, Download, Languages, Clock, FileAudio, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, MODELS, getLanguageByCode, formatDuration } from "@/lib/constants";
import type { ProcessingStatus, TranscriptSegment } from "@/lib/types";

interface AudioTranscriberProps {
  hasFalKey: boolean;
}

export function AudioTranscriber({ hasFalKey }: AudioTranscriberProps) {
  const [status, setStatus] = useState<ProcessingStatus>("idle");

  // Audio input
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Settings
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [translateToEnglish, setTranslateToEnglish] = useState(false);

  // Results
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [detectedLanguage, setDetectedLanguage] = useState<string>("");
  const [processingTime, setProcessingTime] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0] as File;
      if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
        setError("Please select an audio or video file");
        return;
      }
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioFile(file);
      setAudioPreviewUrl(URL.createObjectURL(file));
      setError(null);
      resetResults();
    },
    [audioPreviewUrl]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const file = new File([audioBlob], `recording.${mimeType.split("/")[1]}`, { type: mimeType });
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioFile(file);
        setAudioPreviewUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      resetResults();
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
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
    setTranscriptText("");
    setSegments([]);
    setDetectedLanguage("");
    setProcessingTime(0);
    setStatus("idle");
  };

  const handleTranscribe = async () => {
    if (!hasFalKey || !audioFile) return;

    setStatus("uploading");
    setError(null);
    resetResults();
    const startTime = Date.now();

    try {
      const audioUrl = await fal.storage.upload(audioFile);
      setStatus("processing");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: any = {
        audio_url: audioUrl,
        chunk_level: "segment",
        task: translateToEnglish ? "translate" : "transcribe",
        version: "3",
      };
      if (sourceLanguage !== "auto") input.language = sourceLanguage;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fal.subscribe(MODELS.whisper, { input, logs: true }) as any;
      const data = result?.data || result;

      setTranscriptText(data?.text || "");
      if (data?.chunks?.length > 0) {
        setSegments(data.chunks.map((c: { timestamp: number[]; text: string }) => ({
          start: c.timestamp[0],
          end: c.timestamp[1],
          text: c.text,
        })));
      }
      if (data?.inferred_languages?.[0]) setDetectedLanguage(data.inferred_languages[0]);
      setProcessingTime((Date.now() - startTime) / 1000);
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
      setStatus("idle");
    }
  };

  const copyToClipboard = () => navigator.clipboard.writeText(transcriptText);
  const downloadTranscript = () => {
    const blob = new Blob([transcriptText], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "transcript.txt";
    a.click();
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
            <p className="text-sm text-white/40">Record or upload audio</p>
          </div>

          {/* Record Button */}
          <div className="flex gap-4">
            {!isRecording ? (
              <Button onClick={startRecording} className="flex-1 h-12 bg-[#e7083e] hover:bg-[#c4072f]" disabled={isProcessing}>
                <Mic className="w-5 h-5 mr-2" />
                Record
              </Button>
            ) : (
              <Button onClick={stopRecording} className="flex-1 h-12 bg-red-500 hover:bg-red-600 animate-pulse">
                <Square className="w-5 h-5 mr-2" />
                Stop ({formatDuration(recordingTime)})
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30">or upload</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 min-h-[150px] flex items-center justify-center transition-all",
              isDragging ? "border-[#e7083e] bg-[#e7083e]/10" : "border-white/20 hover:border-white/30"
            )}
          >
            {audioPreviewUrl ? (
              <div className="w-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileAudio className="w-8 h-8 text-[#e7083e]" />
                    <span className="text-sm text-white">{audioFile?.name || "Recording"}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <AudioPlayer src={audioPreviewUrl} title="input" showDownload={false} variant="compact" />
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <Upload className="w-10 h-10 text-white/30 mb-3" />
                <p className="text-sm text-white/40">Drop audio/video or click to upload</p>
                <input type="file" accept="audio/*,video/*" onChange={(e) => handleFileSelect(e.target.files)} className="hidden" />
              </label>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-white/50 uppercase">Source Language</Label>
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] border-white/[0.08] max-h-[200px]">
                  <SelectItem value="auto">Auto Detect</SelectItem>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.flag} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-white/40" />
                <Label className="text-sm text-white/60">Translate to English</Label>
              </div>
              <Switch checked={translateToEnglish} onCheckedChange={setTranslateToEnglish} />
            </div>
          </div>

          {/* Transcribe Button */}
          <Button
            className="w-full h-12 bg-[#e7083e] hover:bg-[#c4072f]"
            onClick={handleTranscribe}
            disabled={isProcessing || !audioFile || !hasFalKey}
          >
            {isProcessing ? <><FalSpinner className="w-5 h-5 mr-2" />Processing...</> : <><FileAudio className="w-5 h-5 mr-2" />Transcribe</>}
          </Button>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Results */}
      <Card className="bg-[#0a0a0a] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-white">Transcript</h3>
              {detectedLanguage && (
                <Badge variant="secondary" className="bg-white/10">{getLanguageByCode(detectedLanguage)?.name || detectedLanguage}</Badge>
              )}
              {processingTime > 0 && (
                <Badge variant="secondary" className="bg-white/10"><Clock className="w-3 h-3 mr-1" />{processingTime.toFixed(1)}s</Badge>
              )}
            </div>
            {transcriptText && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={copyToClipboard}><Copy className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={downloadTranscript}><Download className="w-4 h-4" /></Button>
              </div>
            )}
          </div>

          <ScrollArea className="h-[400px]">
            {segments.length > 0 ? (
              <div className="space-y-2">
                {segments.map((seg, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded">
                    <span className="text-xs text-white/30 font-mono min-w-[50px]">{formatDuration(seg.start)}</span>
                    <p className="text-sm text-white/80">{seg.text}</p>
                  </div>
                ))}
              </div>
            ) : transcriptText ? (
              <p className="text-sm text-white/80 whitespace-pre-wrap">{transcriptText}</p>
            ) : (
              <p className="text-white/30 text-center py-12">Transcript will appear here...</p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
