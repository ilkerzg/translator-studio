"use client";

import React, { useState } from "react";
import { DemoLayout } from "@/components/ui/demo-layout";
import { Button } from "@/components/ui/button";
import { FalKeyInput } from "@/components/ui/fal-key-input";
import { useFalKey } from "@/lib/fal-key-provider";
import { cn } from "@/lib/utils";
import {
  FileAudio,
  Languages,
  Mic,
  Video,
  Subtitles,
  Key,
  Image,
  Volume2,
  Server,
  User,
} from "lucide-react";
import type { TabId } from "@/lib/types";
import { AudioTranscriber } from "@/components/AudioTranscriber";
import { TextTranslator } from "@/components/TextTranslator";
import { SpeechToSpeech } from "@/components/SpeechToSpeech";
import { VideoDubbing } from "@/components/VideoDubbing";
import { VideoVoiceDub } from "@/components/VideoVoiceDub";
import { AutoSubtitle } from "@/components/AutoSubtitle";
import { ImageTranslator } from "@/components/ImageTranslator";

interface TabInfo {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
  models: { name: string; purpose: string }[];
}

const TABS: TabInfo[] = [
  {
    id: "transcribe",
    label: "Transcribe",
    icon: FileAudio,
    description: "Convert audio to text with high accuracy",
    models: [
      { name: "fal-ai/whisper", purpose: "Speech-to-text transcription" },
    ],
  },
  {
    id: "text",
    label: "Translate",
    icon: Languages,
    description: "Translate text between 25+ languages",
    models: [
      { name: "google/gemini-2.5-flash", purpose: "LLM translation" },
    ],
  },
  {
    id: "image",
    label: "Image",
    icon: Image,
    description: "Extract and translate text in images",
    models: [
      { name: "fal-ai/nano-banana-pro/edit", purpose: "Image text editing" },
    ],
  },
  {
    id: "speech",
    label: "Speech-to-Speech",
    icon: Mic,
    description: "Translate spoken audio with voice cloning",
    models: [
      { name: "fal-ai/whisper", purpose: "Transcription" },
      { name: "fal-ai/minimax/voice-clone", purpose: "Voice cloning" },
      { name: "fal-ai/minimax/speech-2.6-hd", purpose: "Speech synthesis" },
    ],
  },
  {
    id: "voicedub",
    label: "Voice Dub",
    icon: Volume2,
    description: "Dub video audio without lip sync",
    models: [
      { name: "fal-ai/whisper", purpose: "Transcription" },
      { name: "fal-ai/minimax/speech-2.6-hd", purpose: "Speech synthesis" },
    ],
  },
  {
    id: "dubbing",
    label: "Video Dubbing",
    icon: Video,
    description: "Full video dubbing with AI lip sync",
    models: [
      { name: "fal-ai/whisper", purpose: "Transcription" },
      { name: "fal-ai/minimax/speech-2.6-hd", purpose: "Speech synthesis" },
      { name: "fal-ai/sync-lipsync/v2", purpose: "Lip sync generation" },
    ],
  },
  {
    id: "subtitle",
    label: "Auto Subtitle",
    icon: Subtitles,
    description: "Generate and burn subtitles into video",
    models: [
      { name: "fal-ai/workflow-utilities/auto-subtitle", purpose: "Auto subtitle" },
    ],
  },
];

export default function TranslatorStudio() {
  const { falKey, setFalKey, clearFalKey, hasFalKey, hasEnvKey } = useFalKey();
  const [activeTab, setActiveTab] = useState<TabId>("transcribe");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const isUsingOwnKey = Boolean(falKey);
  const activeTabInfo = TABS.find((t) => t.id === activeTab);

  const headerRight = (
    <div className="flex items-center gap-2">
      {showKeyInput ? (
        <FalKeyInput
          value={falKey}
          hasKey={Boolean(falKey)}
          onSave={(key) => {
            setFalKey(key);
            setShowKeyInput(false);
          }}
          onClear={() => {
            clearFalKey();
            setShowKeyInput(false);
          }}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowKeyInput(true)}
          className={cn(
            "gap-2 text-xs",
            isUsingOwnKey
              ? "text-blue-400 hover:text-blue-300"
              : hasEnvKey
              ? "text-green-400 hover:text-green-300"
              : "text-white/60 hover:text-white"
          )}
        >
          {isUsingOwnKey ? (
            <>
              <User className="w-3.5 h-3.5" />
              Your Key Active
            </>
          ) : hasEnvKey ? (
            <>
              <Server className="w-3.5 h-3.5" />
              fal Key Active
            </>
          ) : (
            <>
              <Key className="w-3.5 h-3.5" />
              Set API Key
            </>
          )}
        </Button>
      )}
    </div>
  );

  return (
    <DemoLayout title="Translator Studio" maxWidth="2xl" headerRight={headerRight}>
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 p-1 bg-white/[0.02] border border-white/[0.08] rounded-lg">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 min-w-[140px] h-14 flex flex-col items-center justify-center gap-1 rounded-md transition-all",
                  isActive
                    ? "bg-[#e7083e] text-white hover:bg-[#c4072f]"
                    : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{tab.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Tab Info Card */}
        {activeTabInfo && (
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-white/70 mb-3">{activeTabInfo.description}</p>
                <div className="flex flex-wrap gap-2">
                  {activeTabInfo.models.map((model, idx) => (
                    <a
                      key={idx}
                      href={`https://fal.ai/models/${model.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-md text-xs text-white/60 hover:text-white/80 transition-colors"
                    >
                      <span className="font-mono text-[10px] text-white/40">{model.purpose}</span>
                      <span className="text-white/30">·</span>
                      <span className="font-medium text-white/70">{model.name.split('/').pop()}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === "transcribe" && <AudioTranscriber hasFalKey={hasFalKey} />}
          {activeTab === "text" && <TextTranslator hasFalKey={hasFalKey} />}
          {activeTab === "image" && <ImageTranslator hasFalKey={hasFalKey} />}
          {activeTab === "speech" && <SpeechToSpeech hasFalKey={hasFalKey} />}
          {activeTab === "voicedub" && <VideoVoiceDub hasFalKey={hasFalKey} />}
          {activeTab === "dubbing" && <VideoDubbing hasFalKey={hasFalKey} />}
          {activeTab === "subtitle" && <AutoSubtitle hasFalKey={hasFalKey} />}
        </div>
      </div>
    </DemoLayout>
  );
}
