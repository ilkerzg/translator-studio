/**
 * TRANSLATOR STUDIO - SHARED CONSTANTS
 * =====================================
 * Languages, voices, models, and configuration for all translation features.
 */

// =============================================================================
// LANGUAGES
// =============================================================================

export interface Language {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", flag: "🇺🇸", nativeName: "English" },
  { code: "es", name: "Spanish", flag: "🇪🇸", nativeName: "Español" },
  { code: "it", name: "Italian", flag: "🇮🇹", nativeName: "Italiano" },
  { code: "fr", name: "French", flag: "🇫🇷", nativeName: "Français" },
  { code: "tr", name: "Turkish", flag: "🇹🇷", nativeName: "Türkçe" },
  { code: "de", name: "German", flag: "🇩🇪", nativeName: "Deutsch" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹", nativeName: "Português" },
  { code: "nl", name: "Dutch", flag: "🇳🇱", nativeName: "Nederlands" },
  { code: "ru", name: "Russian", flag: "🇷🇺", nativeName: "Русский" },
  { code: "ja", name: "Japanese", flag: "🇯🇵", nativeName: "日本語" },
  { code: "ko", name: "Korean", flag: "🇰🇷", nativeName: "한국어" },
  { code: "zh", name: "Chinese", flag: "🇨🇳", nativeName: "中文" },
  { code: "ar", name: "Arabic", flag: "🇸🇦", nativeName: "العربية" },
  { code: "hi", name: "Hindi", flag: "🇮🇳", nativeName: "हिन्दी" },
  { code: "pl", name: "Polish", flag: "🇵🇱", nativeName: "Polski" },
  { code: "sv", name: "Swedish", flag: "🇸🇪", nativeName: "Svenska" },
  { code: "no", name: "Norwegian", flag: "🇳🇴", nativeName: "Norsk" },
  { code: "da", name: "Danish", flag: "🇩🇰", nativeName: "Dansk" },
  { code: "fi", name: "Finnish", flag: "🇫🇮", nativeName: "Suomi" },
  { code: "el", name: "Greek", flag: "🇬🇷", nativeName: "Ελληνικά" },
  { code: "he", name: "Hebrew", flag: "🇮🇱", nativeName: "עברית" },
  { code: "th", name: "Thai", flag: "🇹🇭", nativeName: "ไทย" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳", nativeName: "Tiếng Việt" },
  { code: "id", name: "Indonesian", flag: "🇮🇩", nativeName: "Bahasa Indonesia" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦", nativeName: "Українська" },
  { code: "cs", name: "Czech", flag: "🇨🇿", nativeName: "Čeština" },
  { code: "ro", name: "Romanian", flag: "🇷🇴", nativeName: "Română" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺", nativeName: "Magyar" },
];

// =============================================================================
// VOICES
// =============================================================================

export interface Voice {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  description: string;
}

export const VOICES: Voice[] = [
  { id: "same_voice", name: "Clone Voice", gender: "neutral", description: "Clone from audio" },
  { id: "Calm_Woman", name: "Calm Woman", gender: "female", description: "Soft, soothing" },
  { id: "Wise_Woman", name: "Wise Woman", gender: "female", description: "Mature, authoritative" },
  { id: "Friendly_Person", name: "Friendly Person", gender: "neutral", description: "Warm, approachable" },
  { id: "Inspirational_girl", name: "Inspirational Girl", gender: "female", description: "Young, energetic" },
  { id: "Deep_Voice_Man", name: "Deep Voice Man", gender: "male", description: "Deep, resonant" },
  { id: "Calm_Man", name: "Calm Man", gender: "male", description: "Relaxed, steady" },
  { id: "Newsman", name: "Newsman", gender: "male", description: "Professional, clear" },
  { id: "Cute_Boy", name: "Cute Boy", gender: "male", description: "Young, cheerful" },
  { id: "Lovely_Girl", name: "Lovely Girl", gender: "female", description: "Sweet, pleasant" },
];

// =============================================================================
// SUBTITLE FONTS & COLORS
// =============================================================================

export const FONTS = [
  "Montserrat", "Poppins", "Roboto", "Open Sans", "Lato",
  "Oswald", "Raleway", "Ubuntu", "Playfair Display", "Inter",
] as const;

export const FONT_WEIGHTS = [
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
  { value: "black", label: "Black" },
] as const;

export const FONT_COLORS = [
  { value: "white", label: "White", hex: "#FFFFFF" },
  { value: "yellow", label: "Yellow", hex: "#FFFF00" },
  { value: "cyan", label: "Cyan", hex: "#00FFFF" },
  { value: "lime", label: "Lime", hex: "#00FF00" },
  { value: "orange", label: "Orange", hex: "#FFA500" },
  { value: "pink", label: "Pink", hex: "#FF69B4" },
] as const;

export const HIGHLIGHT_COLORS = [
  { value: "none", label: "None", hex: "transparent" },
  { value: "yellow", label: "Yellow", hex: "#FFFF00" },
  { value: "cyan", label: "Cyan", hex: "#00FFFF" },
  { value: "purple", label: "Purple", hex: "#9B59B6" },
  { value: "orange", label: "Orange", hex: "#FFA500" },
  { value: "pink", label: "Pink", hex: "#FF69B4" },
] as const;

export const POSITIONS = [
  { value: "bottom", label: "Bottom" },
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
] as const;

// =============================================================================
// TRANSLATION STYLES
// =============================================================================

export const TRANSLATION_STYLES = {
  standard: { name: "Standard", description: "Natural, everyday language" },
  formal: { name: "Formal", description: "Professional, business tone" },
  casual: { name: "Casual", description: "Informal, friendly" },
  technical: { name: "Technical", description: "Precise terminology" },
} as const;

export type TranslationStyle = keyof typeof TRANSLATION_STYLES;

// =============================================================================
// SUBTITLE PRESETS
// =============================================================================

export const SUBTITLE_PRESETS = [
  {
    name: "TikTok",
    style: {
      font_name: "Montserrat",
      font_size: 100,
      font_weight: "bold",
      font_color: "white",
      highlight_color: "yellow",
      words_per_subtitle: 1,
      enable_animation: true,
    },
  },
  {
    name: "YouTube",
    style: {
      font_name: "Roboto",
      font_size: 70,
      font_weight: "normal",
      font_color: "white",
      highlight_color: "none",
      words_per_subtitle: 3,
      enable_animation: false,
    },
  },
  {
    name: "Reels",
    style: {
      font_name: "Poppins",
      font_size: 90,
      font_weight: "bold",
      font_color: "white",
      highlight_color: "purple",
      words_per_subtitle: 2,
      enable_animation: true,
    },
  },
  {
    name: "Karaoke",
    style: {
      font_name: "Oswald",
      font_size: 85,
      font_weight: "bold",
      font_color: "white",
      highlight_color: "cyan",
      words_per_subtitle: 1,
      enable_animation: true,
    },
  },
] as const;

// =============================================================================
// FAL MODELS
// =============================================================================

export const MODELS = {
  // LLM
  llm: "openrouter/router",
  llmModel: "google/gemini-2.5-flash",

  // Speech-to-Text
  whisper: "fal-ai/whisper",
  wizper: "fal-ai/wizper",
  elevenlabsSTT: "fal-ai/elevenlabs/speech-to-text",

  // Text-to-Speech
  tts: "fal-ai/minimax/speech-2.6-hd",
  voiceClone: "fal-ai/minimax/voice-clone",

  // Video
  autoSubtitle: "fal-ai/workflow-utilities/auto-subtitle",
  lipsync: "fal-ai/sync-lipsync/v2",

  // Image
  imageEdit: "fal-ai/nano-banana-pro/edit",
} as const;

// =============================================================================
// HELPERS
// =============================================================================

export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES.find((lang) => lang.code === code);
}

export function getVoiceById(id: string): Voice | undefined {
  return VOICES.find((voice) => voice.id === id);
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
