import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "swiftwallet",
    version: "0.1.0"
  });
}

