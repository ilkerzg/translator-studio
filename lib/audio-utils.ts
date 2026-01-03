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

        // Start recording
        mediaRecorder.start();
        video.play();
        audio.play();

        // Draw video frames to canvas
        const drawFrame = () => {
          if (video.paused || video.ended) return;
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
