"use client";

import React, { useState } from "react";
import { fal } from "@fal-ai/client";
import { FalSpinner } from "@/components/ui/fal-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft, Copy, Check, Sparkles, Volume2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, MODELS, TRANSLATION_STYLES, getLanguageByCode, type TranslationStyle } from "@/lib/constants";

interface TextTranslatorProps {
  hasFalKey: boolean;
}

export function TextTranslator({ hasFalKey }: TextTranslatorProps) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [style, setStyle] = useState<TranslationStyle>("standard");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const swapLanguages = () => {
    if (sourceLanguage === "auto") return;
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
    if (translatedText) {
      setSourceText(translatedText);
      setTranslatedText(sourceText);
    }
  };

  const handleTranslate = async () => {
    if (!hasFalKey || !sourceText.trim()) return;

    setIsTranslating(true);
    setError(null);
    setTranslatedText("");

    try {
      const sourceLang = sourceLanguage === "auto" ? "the detected language" : getLanguageByCode(sourceLanguage)?.name || sourceLanguage;
      const targetLang = getLanguageByCode(targetLanguage)?.name || targetLanguage;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fal.subscribe(MODELS.llm, {
        input: {
          prompt: `Translate the following text from ${sourceLang} to ${targetLang}. Style: ${TRANSLATION_STYLES[style].description}. Only output the translation:\n\n"""${sourceText}"""`,
          system_prompt: "You are a professional translator. Provide accurate translations preserving meaning and tone.",
          model: MODELS.llmModel,
          temperature: 0.3,
        },
      }) as any;

      const data = result?.data || result;
      const translated = (data?.output || data?.text || "").trim().replace(/^["']|["']$/g, "");

      setTranslatedText(translated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const speakText = (text: string, lang: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-6">
      {/* Language Selection */}
      <Card className="bg-[#0a0a0a] border-white/[0.08]">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger className="h-12 bg-white/[0.03] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] border-white/[0.08] max-h-[300px]">
                  <SelectItem value="auto">Detect Language</SelectItem>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.flag} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={swapLanguages}
              disabled={sourceLanguage === "auto"}
              className="text-white/40 hover:text-white"
            >
              <ArrowRightLeft className="w-5 h-5" />
            </Button>

            <div className="flex-1 w-full">
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="h-12 bg-white/[0.03] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] border-white/[0.08] max-h-[300px]">
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.flag} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Style Selection */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TRANSLATION_STYLES) as TranslationStyle[]).map((s) => (
          <Button
            key={s}
            variant={style === s ? "default" : "ghost"}
            size="sm"
            onClick={() => setStyle(s)}
            className={cn(
              "text-xs",
              style === s ? "bg-[#e7083e] hover:bg-[#c4072f]" : "bg-white/[0.03] text-white/60 hover:text-white"
            )}
          >
            {TRANSLATION_STYLES[s].name}
          </Button>
        ))}
      </div>

      {/* Translation Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source */}
        <Card className="bg-[#0a0a0a] border-white/[0.08]">
          <CardContent className="p-0">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <Label className="text-sm text-white/60">
                {sourceLanguage === "auto" ? "Source" : getLanguageByCode(sourceLanguage)?.name}
              </Label>
              {sourceText && (
                <Button variant="ghost" size="sm" onClick={() => speakText(sourceText, sourceLanguage === "auto" ? "en" : sourceLanguage)}>
                  <Volume2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Enter text to translate..."
              className="min-h-[250px] resize-none border-0 bg-transparent p-4 focus-visible:ring-0"
            />
          </CardContent>
        </Card>

        {/* Target */}
        <Card className="bg-[#0a0a0a] border-white/[0.08]">
          <CardContent className="p-0">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <Label className="text-sm text-white/60">{getLanguageByCode(targetLanguage)?.name}</Label>
              {translatedText && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => speakText(translatedText, targetLanguage)}>
                    <Volume2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>
            <div className="min-h-[250px] p-4">
              {isTranslating ? (
                <div className="flex items-center justify-center h-full">
                  <FalSpinner className="w-8 h-8 text-[#e7083e]" />
                </div>
              ) : translatedText ? (
                <p className="text-white whitespace-pre-wrap">{translatedText}</p>
              ) : (
                <p className="text-white/30">Translation will appear here...</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Translate Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          className="h-14 px-12 bg-[#e7083e] hover:bg-[#c4072f]"
          onClick={handleTranslate}
          disabled={isTranslating || !sourceText.trim() || !hasFalKey}
        >
          {isTranslating ? <><FalSpinner className="w-5 h-5 mr-2" />Translating...</> : <><Sparkles className="w-5 h-5 mr-2" />Translate</>}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
