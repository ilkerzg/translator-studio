import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FalKeyProvider } from "@/lib/fal-key-provider";
import { FalClientProvider } from "@/components/FalClientProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://translator.fal.ai";

export const metadata: Metadata = {
  title: "Translator Studio | fal.ai",
  description: "AI-powered translation suite: audio transcription, text translation, speech-to-speech, video dubbing with lip sync, voice cloning, image OCR translation, and auto subtitles. Powered by fal.ai.",
  keywords: ["translation", "transcription", "dubbing", "subtitles", "voice cloning", "lip sync", "AI", "fal.ai", "speech-to-speech", "video translation"],
  authors: [{ name: "fal.ai", url: "https://fal.ai" }],
  creator: "fal.ai",
  publisher: "fal.ai",
  robots: "index, follow",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "fal.ai Translator Studio",
    title: "Translator Studio | AI-Powered Translation Suite",
    description: "Complete AI translation toolkit: transcription, text translation, speech-to-speech, video dubbing with lip sync, voice cloning, and auto subtitles.",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "fal.ai Translator Studio - AI-Powered Translation Suite",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Translator Studio | fal.ai",
    description: "AI-powered translation suite: transcription, dubbing, subtitles, voice cloning & more.",
    images: [`${baseUrl}/og-image.png`],
    creator: "@faboratory",
  },
  metadataBase: new URL(baseUrl),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white antialiased`}>
        <FalKeyProvider>
          <FalClientProvider>{children}</FalClientProvider>
        </FalKeyProvider>
      </body>
    </html>
  );
}
