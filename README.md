# Translator Studio

<p align="left">
  <a href="https://fal.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/fal-logo-light.svg">
      <source media="(prefers-color-scheme: light)" srcset="./assets/fal-logo-dark.svg">
      <img alt="fal.ai" src="./assets/fal-logo-dark.svg" width="120">
    </picture>
  </a>
</p>

<p align="left">
  <strong>fal-powered translation suite</strong><br>
  Powered by <a href="https://fal.ai">fal.ai</a>
</p>

---

## Overview

All-in-one AI translation toolkit: transcription, text translation, speech-to-speech, video dubbing with lip sync, voice cloning, image OCR, and auto subtitles.

## Features

| Feature | Description |
|---------|-------------|
| **Transcribe** | Convert audio to text with Whisper |
| **Translate** | Translate text between 50+ languages |
| **Image OCR** | Extract and translate text from images |
| **Speech-to-Speech** | Translate spoken audio with voice cloning |
| **Voice Dub** | Dub video audio without lip sync |
| **Video Dubbing** | Full video dubbing with lip sync |
| **Auto Subtitle** | Generate and burn subtitles into video |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Audio/Video    │────▶│   Transcribe     │────▶│   Translate     │
│  Input          │     │   (Whisper)      │     │   (LLM)         │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────────────┐
                        ▼                                 ▼                                 ▼
               ┌───────────────┐                 ┌───────────────┐                 ┌───────────────┐
               │ Voice Clone   │                 │ TTS           │                 │ Lip Sync      │
               │ (MiniMax)     │                 │ (MiniMax)     │                 │ (Sync)        │
               └───────────────┘                 └───────────────┘                 └───────────────┘
```

## Models

| Model | Purpose |
|-------|---------|
| `fal-ai/whisper` | Speech-to-text transcription |
| `fal-ai/wizper` | Fast transcription |
| `fal-ai/minimax/speech-2.6-hd` | Text-to-speech synthesis |
| `fal-ai/minimax/voice-clone` | Voice cloning |
| `fal-ai/sync-lipsync/v2` | Lip sync video generation |
| `fal-ai/nano-banana-pro/edit` | Image text editing |
| `fal-ai/workflow-utilities/auto-subtitle` | Auto subtitle generation |

## Setup

```bash
npm install
npm run dev
```

Enter your [fal.ai API key](https://fal.ai/dashboard/keys) when prompted.

## License

MIT
