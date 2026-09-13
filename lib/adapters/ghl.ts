import { getValidAccessToken } from "@/lib/oauth";
import type { DownstreamAdapter } from "@/lib/adapters/types";

type GhlContactResponse = { contact?: Record<string, unknown> };
const DEFAULT_BASE_URL="https://services.leadconnectorhq.com";const DEFAULT_TIMEOUT_MS=8000;
export class GHLAdapter implements DownstreamAdapter{
 private readonly token:string;private readonly baseUrl:string;private readonly timeoutMs:number;
 constructor(token?:string,baseUrl=process.env.GHL_API_BASE_URL??DEFAULT_BASE_URL,timeoutMs=Number(process.env.GHL_TIMEOUT_MS??DEFAULT_TIMEOUT_MS)){const configured=token??"";if(!configured)throw new Error("No HighLevel connection is available");if(!Number.isFinite(timeoutMs)||timeoutMs<1000||timeoutMs>30000)throw new Error("GHL_TIMEOUT_MS must be between 1000 and 30000 milliseconds");this.token=configured;this.baseUrl=baseUrl.replace(/\/$/,"");this.timeoutMs=timeoutMs;}
 private async getContactRaw(id:string){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.timeoutMs);try{const response=await fetch(`${this.baseUrl}/contacts/${encodeURIComponent(id)}`,{method:"GET",headers:{Accept:"application/json",Authorization:`Bearer ${this.token}`,Version:"v3"},cache:"no-store",signal:controller.signal});if(response.status===404)return null;if(!response.ok){const body=await response.text().catch(()=>"");throw new Error(`HighLevel contact check failed (${response.status})${body?`: ${body.slice(0,240)}`:""}`);}const payload=(await response.json()) as GhlContactResponse;return payload.contact??null;}catch(cause){if(cause instanceof DOMException&&cause.name==="AbortError")throw new Error(`HighLevel contact check timed out after ${this.timeoutMs}ms`);throw cause;}finally{clearTimeout(timeout);}}
 async getRecord(id:string){return this.getContactRaw(id)}
 async getField(id:string,field:string){const record=await this.getContactRaw(id);return record?.[field]??null}
 async getTags(id:string){const record=await this.getContactRaw(id),tags=record?.tags;return Array.isArray(tags)?tags.filter((tag):tag is string=>typeof tag==="string"):null}
 async getStatus(id:string){const record=await this.getContactRaw(id),status=record?.status;return typeof status==="string"?status:null}
}
export async function ghlAdapter(){const token=await getValidAccessToken("ghl");if(token)return new GHLAdapter(token);throw new Error("HighLevel is not connected");}
export async function ghlConfigured(){const {getWorkspaceStore}=await import("@/lib/db");const store=await getWorkspaceStore();return Boolean(await store.connections.latest("ghl"))}
