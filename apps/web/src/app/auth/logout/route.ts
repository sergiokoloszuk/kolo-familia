import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Pós-logout vai pro login (não pra landing velha do app, que está inativa).
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
