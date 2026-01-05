/**
 * Extract audio from video file using Web Audio API
 */
export async function extractAudioFromVideo(videoFile: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;

    video.onloadedmetadata = async () => {
      try {
        const audioContext = new AudioContext();
        const duration = video.duration;

        // Create offline context for rendering
        const offlineContext = new OfflineAudioContext(
          2, // stereo
          Math.ceil(duration * audioContext.sampleRate),
          audioContext.sampleRate
        );

        // Decode the video file as audio
        const arrayBuffer = await videoFile.arrayBuffer();
        const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

        // Create buffer source and connect to destination
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start(0);

        // Render audio
        const renderedBuffer = await offlineContext.startRendering();

        // Convert to WAV
        const wavBlob = audioBufferToWav(renderedBuffer);
        const audioFile = new File([wavBlob], "extracted-audio.wav", {
          type: "audio/wav",
        });

        URL.revokeObjectURL(video.src);
        resolve(audioFile);
      } catch (err) {
        URL.revokeObjectURL(video.src);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video"));
    };
  });
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Write interleaved audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch]![i]!));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Get video duration in seconds
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(video.src);
      resolve(duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video"));
    };
  });
}

/**
 * Audio segment with timing information for dubbing
 */
export interface AudioSegment {
  audioUrl: string;
  startTime: number; // When this segment should start in the final timeline (seconds)
  targetDuration?: number; // Target duration to time-stretch the audio to (seconds)
}

/**
 * Get the duration of an audio file from URL
 */
export async function getAudioDuration(audioUrl: string): Promise<number> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const duration = audioBuffer.duration;
  await audioContext.close();
  return duration;
}

/**
 * Decode audio from URL to AudioBuffer
 */
export async function decodeAudioFromUrl(audioUrl: string): Promise<AudioBuffer> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return audioBuffer;
}

/**
 * Time-stretch audio to match target duration
 * Uses playback rate adjustment (will slightly affect pitch for extreme ratios)
 * For ratios between 0.7-1.4, the pitch change is barely noticeable
 */
export async function timeStretchAudio(
  audioBuffer: AudioBuffer,
  targetDuration: number
): Promise<AudioBuffer> {
  const currentDuration = audioBuffer.duration;
  const speedRatio = currentDuration / targetDuration;

  // Extended range (0.3x to 3.0x) for precise sync
  const clampedRatio = Math.max(0.3, Math.min(3.0, speedRatio));

  // Calculate new length based on speed ratio
  const newLength = Math.ceil(audioBuffer.length / clampedRatio);

  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    newLength,
    audioBuffer.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.playbackRate.value = clampedRatio;
  source.connect(offlineContext.destination);
  source.start(0);

  return await offlineContext.startRendering();
}

/**
 * Convert AudioBuffer to URL (for uploading or playback)
 */
export function audioBufferToUrl(buffer: AudioBuffer): string {
  const wavBlob = audioBufferToWav(buffer);
  return URL.createObjectURL(wavBlob);
}

// Background audio URL for dubbing (original video's background sounds)
const BACKGROUND_AUDIO_URL = "https://v3b.fal.media/files/b/0a891ddc/ip-vXswx9sKxDcGuaUQay_without_isolated_sound_video.mp3";

/**
 * Trim leading silence from audio buffer
 * Detects when audio amplitude exceeds threshold and trims everything before
 */
function trimLeadingSilence(buffer: AudioBuffer, targetSampleRate: number): AudioBuffer {
  const threshold = 0.01; // Amplitude threshold for "sound"
  const channelData = buffer.getChannelData(0); // Use first channel for detection

  // Find first sample above threshold
  let startSample = 0;
  for (let i = 0; i < channelData.length; i++) {
    if (Math.abs(channelData[i]!) > threshold) {
      // Go back a tiny bit to not cut the attack
      startSample = Math.max(0, i - Math.floor(buffer.sampleRate * 0.01)); // 10ms before
      break;
    }
  }

  // If no silence to trim, return original
  if (startSample === 0) {
    return buffer;
  }

  const trimmedLength = buffer.length - startSample;
  const trimmedBuffer = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: trimmedLength,
    sampleRate: buffer.sampleRate,
  });

  // Copy trimmed data for each channel
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const sourceData = buffer.getChannelData(ch);
    const destData = trimmedBuffer.getChannelData(ch);
    for (let i = 0; i < trimmedLength; i++) {
      destData[i] = sourceData[startSample + i]!;
    }
  }

  const trimmedMs = (startSample / buffer.sampleRate) * 1000;
  if (trimmedMs > 5) { // Only log if significant
    console.log(`[AudioMerge] Trimmed ${trimmedMs.toFixed(0)}ms leading silence`);
  }

  return trimmedBuffer;
}

/**
 * Merge multiple audio segments at specific timestamps into a single audio track
 * Each segment is positioned at its startTime and EXACTLY stretched to targetDuration
 * This ensures perfect sync with the original video timing
 */
export async function mergeAudioSegmentsAtTimestamps(
  segments: AudioSegment[],
  totalDuration: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const audioContext = new AudioContext();
  const sampleRate = audioContext.sampleRate;

  // Create offline context for the full duration
  const offlineContext = new OfflineAudioContext(
    2, // stereo
    Math.ceil(totalDuration * sampleRate),
    sampleRate
  );

  // Background audio disabled

  // Load and decode all audio segments
  const loadedSegments: {
    buffer: AudioBuffer;
    startTime: number;
    maxDuration: number;
  }[] = [];

  console.log(`[AudioMerge] Processing ${segments.length} segments for ${totalDuration.toFixed(2)}s video`);

  // First pass: load all segments, trim silence, and calculate durations
  const segmentData: { buffer: AudioBuffer; startTime: number; duration: number }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    try {
      const response = await fetch(segment.audioUrl);
      const arrayBuffer = await response.arrayBuffer();

      // Decode with temp context for better compatibility
      const tempCtx = new AudioContext();
      const rawBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
      await tempCtx.close();

      // Trim leading silence from TTS audio
      const trimmedBuffer = trimLeadingSilence(rawBuffer, sampleRate);

      console.log(`[AudioMerge] Segment ${i}: original=${rawBuffer.duration.toFixed(3)}s, trimmed=${trimmedBuffer.duration.toFixed(3)}s, start=${segment.startTime.toFixed(3)}s`);

      segmentData.push({
        buffer: trimmedBuffer,
        startTime: segment.startTime,
        duration: trimmedBuffer.duration,
      });

      if (onProgress) {
        onProgress((i / segments.length) * 40);
      }
    } catch (err) {
      console.warn(`Failed to load audio segment ${i}:`, err);
    }
  }

  // Calculate max allowed duration for each segment (until next segment starts)
  // NO SPEED CHANGES - if audio is too long, trim from end
  for (let i = 0; i < segmentData.length; i++) {
    const current = segmentData[i]!;
    const next = segmentData[i + 1];

    // Max duration = time until next segment (or video end for last segment)
    const maxDuration = next
      ? next.startTime - current.startTime
      : totalDuration - current.startTime;

    // If audio is longer than allowed, it will be trimmed
    const willTrim = current.duration > maxDuration;
    const actualDuration = Math.min(current.duration, maxDuration);

    if (willTrim) {
      console.log(`[AudioMerge] Segment ${i}: TRIMMING ${(current.duration - maxDuration).toFixed(2)}s from end`);
    }

    console.log(`[AudioMerge] Segment ${i}: start=${current.startTime.toFixed(2)}s, duration=${actualDuration.toFixed(2)}s (max=${maxDuration.toFixed(2)}s)`);

    loadedSegments.push({
      buffer: current.buffer,
      startTime: current.startTime,
      maxDuration: maxDuration,
    });
  }

  // Schedule each segment - NATURAL speed (1.0x), trim if needed
  for (const segment of loadedSegments) {
    const source = offlineContext.createBufferSource();
    source.buffer = segment.buffer;
    source.playbackRate.value = 1.0; // NEVER CHANGE SPEED

    const voiceGain = offlineContext.createGain();
    voiceGain.gain.value = 1.0;

    source.connect(voiceGain);
    voiceGain.connect(offlineContext.destination);

    // Start at exact time, stop before next segment starts
    source.start(segment.startTime);
    if (segment.buffer.duration > segment.maxDuration) {
      source.stop(segment.startTime + segment.maxDuration);
    }
  }

  // Render the combined audio
  if (onProgress) onProgress(60);
  const renderedBuffer = await offlineContext.startRendering();
  if (onProgress) onProgress(90);

  // Convert to WAV
  const wavBlob = audioBufferToWav(renderedBuffer);

  await audioContext.close();
  if (onProgress) onProgress(100);

  return wavBlob;
}

/**
 * Replace video audio with multiple audio segments positioned at specific timestamps
 * This is used for dubbing where each translated segment starts at its original timestamp
 */
export async function replaceVideoWithPositionedAudio(
  videoUrl: string,
  segments: AudioSegment[],
  onProgress?: (progress: number) => void
): Promise<Blob> {
  // First get video duration
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.src = videoUrl;

  const videoDuration = await new Promise<number>((resolve, reject) => {
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => reject(new Error("Failed to load video"));
  });

  // Merge all audio segments at their timestamps
  if (onProgress) onProgress(5);
  const mergedAudioBlob = await mergeAudioSegmentsAtTimestamps(
    segments,
    videoDuration,
    (p) => onProgress?.(5 + p * 0.4) // 5-45%
  );

  // Upload merged audio and replace video audio
  const mergedAudioUrl = URL.createObjectURL(mergedAudioBlob);

  try {
    const result = await replaceVideoAudio(
      videoUrl,
      mergedAudioUrl,
      (p) => onProgress?.(45 + p * 0.55) // 45-100%
    );
    return result;
  } finally {
    URL.revokeObjectURL(mergedAudioUrl);
  }
}

/**
 * Replace audio track in video with new audio
 * Uses MediaRecorder to combine video (muted) with new audio
 */
export async function replaceVideoAudio(
  videoUrl: string,
  audioUrl: string,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const audio = document.createElement("audio");

    video.crossOrigin = "anonymous";
    audio.crossOrigin = "anonymous";
    video.src = videoUrl;
    audio.src = audioUrl;
    video.muted = true;

    let mediaRecorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];

    const cleanup = () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      video.pause();
      audio.pause();
      video.src = "";
      audio.src = "";
    };

    video.onloadedmetadata = async () => {
      try {
        await audio.play();
        audio.pause();
        audio.currentTime = 0;

        // Create canvas to capture video frames
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;

        // Get video stream from canvas
        const videoStream = canvas.captureStream(30);

        // Create audio context for the new audio
        const audioContext = new AudioContext();
        const audioSource = audioContext.createMediaElementSource(audio);
        const destination = audioContext.createMediaStreamDestination();
        audioSource.connect(destination);
        audioSource.connect(audioContext.destination);

        // Combine video and audio streams
        const combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ]);

        // Setup MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";
        mediaRecorder = new MediaRecorder(combinedStream, { mimeType });

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          cleanup();
          audioContext.close();
          resolve(blob);
        };

        mediaRecorder.onerror = (e) => {
          cleanup();
          audioContext.close();
          reject(new Error("Recording failed"));
        };

        // Ensure both video and audio start at time 0
        video.currentTime = 0;
        audio.currentTime = 0;

        // Start recording first
        mediaRecorder.start();

        // Use Promise.all to start video and audio as close together as possible
        await Promise.all([video.play(), audio.play()]);

        // Sync check - if there's drift, correct it
        const syncInterval = setInterval(() => {
          if (video.paused || video.ended) {
            clearInterval(syncInterval);
            return;
          }
          // Keep audio synced to video time
          const drift = Math.abs(video.currentTime - audio.currentTime);
          if (drift > 0.1) {
            audio.currentTime = video.currentTime;
          }
        }, 100);

        // Draw video frames to canvas
        const drawFrame = () => {
          if (video.paused || video.ended) {
            clearInterval(syncInterval);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          if (onProgress) {
            onProgress((video.currentTime / video.duration) * 100);
          }

          requestAnimationFrame(drawFrame);
        };
        drawFrame();

        // Stop when video ends
        video.onended = () => {
          setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
              mediaRecorder.stop();
            }
          }, 100);
        };
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video"));
    };

    audio.onerror = () => {
      cleanup();
      reject(new Error("Failed to load audio"));
    };
  });
}
