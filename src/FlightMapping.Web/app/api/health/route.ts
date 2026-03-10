import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:5223";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
