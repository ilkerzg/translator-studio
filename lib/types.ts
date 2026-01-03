/**
 * TRANSLATOR STUDIO - SHARED TYPES
 * ==================================
 */

// =============================================================================
// TABS
// =============================================================================

export type TabId =
  | "transcribe"
  | "text"
  | "speech"
  | "dubbing"
  | "voicedub"
  | "subtitle"
  | "image";

export interface Tab {
  id: TabId;
  label: string;
  description: string;
  icon: string;
}

// =============================================================================
// PROCESSING
// =============================================================================

export type ProcessingStatus = "idle" | "uploading" | "processing" | "complete";

// =============================================================================
// AUDIO TRANSCRIBER
// =============================================================================

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  detectedLanguage?: string;
}

// =============================================================================
// SPEECH TO SPEECH
// =============================================================================

export interface SpeechToSpeechResult {
  originalText: string;
  translatedText: string;
  audioUrl: string;
}

// =============================================================================
// VIDEO DUBBING
// =============================================================================

export interface DubbingResult {
  transcript: string;
  translatedText: string;
  audioUrl: string;
}

// =============================================================================
// SUBTITLE
// =============================================================================

export interface SubtitleStyle {
  language: string;
  font_name: string;
  font_size: number;
  font_weight: string;
  font_color: string;
  highlight_color: string;
  stroke_width: number;
  stroke_color: string;
  position: string;
  y_offset: number;
  words_per_subtitle: number;
  enable_animation: boolean;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  language: "en",
  font_name: "Montserrat",
  font_size: 80,
  font_weight: "bold",
  font_color: "white",
  highlight_color: "yellow",
  stroke_width: 3,
  stroke_color: "black",
  position: "bottom",
  y_offset: 75,
  words_per_subtitle: 1,
  enable_animation: true,
};
