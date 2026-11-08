import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
export async function POST(request: NextRequest) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(url&&key){
    const supabase=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(items)=>items.forEach(({name,value,options})=>request.cookies.set(name,value,options))}});
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login",request.url),303);
}