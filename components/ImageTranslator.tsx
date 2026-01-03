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
import { Upload, X, Download, Image as ImageIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, MODELS, getLanguageByCode } from "@/lib/constants";
import type { ProcessingStatus } from "@/lib/types";

interface ImageTranslatorProps {
  hasFalKey: boolean;
}

export function ImageTranslator({ hasFalKey }: ImageTranslatorProps) {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState("");

  // Image input
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  // Settings
  const [targetLanguage, setTargetLanguage] = useState("en");

  // Results
  const [resultImageUrl, setResultImageUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0] as File;
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setError(null);
      setResultImageUrl("");
      setStatus("idle");
    },
    [imagePreviewUrl]
  );

  const handleTranslate = async () => {
    if (!hasFalKey || !imageFile) return;

    setStatus("uploading");
    setError(null);
    setResultImageUrl("");
    setProgress("Uploading image...");

    try {
      const imageUrl = await fal.storage.upload(imageFile);

      setStatus("processing");
      setProgress("Translating text in image...");

      const targetLang = getLanguageByCode(targetLanguage)?.name || targetLanguage;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await fal.subscribe(MODELS.imageEdit, {
        input: {
          prompt: `Translate all text in this image to ${targetLang}. Keep the same style, font, and layout. Only change the language of the text.`,
          image_urls: [imageUrl],
          num_images: 1,
          aspect_ratio: "auto",
          output_format: "png",
          resolution: "1K",
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs?.length) {
            const lastLog = update.logs[update.logs.length - 1];
            if (lastLog?.message) setProgress(lastLog.message);
          }
        },
      })) as any;

      const data = result?.data || result;
      const outputUrl = data?.images?.[0]?.url || "";
      if (!outputUrl) throw new Error("Failed to translate image");

      setResultImageUrl(outputUrl);
      setStatus("complete");
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
      setStatus("idle");
      setProgress("");
    }
  };

  const handleDownload = async () => {
    if (!resultImageUrl) return;
    const res = await fetch(resultImageUrl);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `translated-${targetLanguage}-${Date.now()}.png`;
    a.click();
  };

  const handleReset = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl("");
    setResultImageUrl("");
    setStatus("idle");
    setError(null);
  };

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input */}
      <Card className="bg-[#0a0a0a] border-white/[0.08]">
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Image Input</h3>
            <p className="text-sm text-white/40">Upload image with text to translate</p>
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
              "border-2 border-dashed rounded-lg min-h-[250px] flex items-center justify-center",
              isDragging ? "border-[#e7083e] bg-[#e7083e]/10" : "border-white/20"
            )}
          >
            {imagePreviewUrl ? (
              <div className="w-full p-4 relative">
                <img
                  src={imagePreviewUrl}
                  alt="Input"
                  className="w-full max-h-[250px] object-contain rounded"
                />
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer py-8">
                <Upload className="w-10 h-10 text-white/30 mb-3" />
                <p className="text-sm text-white/40">Drop image or click to upload</p>
                <p className="text-xs text-white/20 mt-1">PNG, JPG, WebP</p>
                <input
                  type="file"
                  accept="image/*"
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
          </div>

          <Button
            className="w-full h-12 bg-[#e7083e] hover:bg-[#c4072f]"
            onClick={handleTranslate}
            disabled={isProcessing || !imageFile || !hasFalKey}
          >
            {isProcessing ? (
              <>
                <FalSpinner className="w-5 h-5 mr-2" />
                {progress}
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5 mr-2" />
                Translate Image
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

      {/* Right: Result */}
      <Card className="bg-[#0a0a0a] border-white/[0.08]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Translated Image</h3>
            {resultImageUrl && (
              <Button variant="ghost" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            )}
          </div>

          <div className="min-h-[300px] flex items-center justify-center border border-white/[0.06] rounded-lg bg-white/[0.02]">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <FalSpinner className="w-10 h-10 text-[#e7083e]" />
                <p className="text-sm text-white/40">{progress}</p>
              </div>
            ) : resultImageUrl ? (
              <img
                src={resultImageUrl}
                alt="Translated"
                className="w-full max-h-[350px] object-contain rounded"
              />
            ) : (
              <p className="text-white/30">Translated image will appear here...</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
