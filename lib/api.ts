import { NextResponse } from "next/server";
export const error=(code:string,message:string,status=400)=>NextResponse.json({success:false,error:{code,message}},{status});
export const ok=(data:Record<string,unknown>,status=200)=>NextResponse.json({success:true,...data},{status});
