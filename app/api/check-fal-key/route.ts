import { NextResponse } from "next/server";

export async function GET() {
  const hasEnvKey = Boolean(process.env.FAL_KEY);
  return NextResponse.json({ hasEnvKey });
}
