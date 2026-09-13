import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function POST(request:Request){const form=await request.formData();const email=String(form.get("email")||"");const password=String(form.get("password")||"");const supabase=await createSupabaseServerClient();const {error}=await supabase.auth.signInWithPassword({email,password});if(error)return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error.message)}`,request.url),303);return NextResponse.redirect(new URL("/",request.url),303)}
