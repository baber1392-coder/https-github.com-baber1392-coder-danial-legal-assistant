import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "danial-legal-assistant" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
