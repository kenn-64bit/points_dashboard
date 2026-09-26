import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
