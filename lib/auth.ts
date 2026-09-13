import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function ensureWorkspace() {
  const user = await getUser();
  if (!user) return null;
  const admin = createSupabaseServiceClient();
  const { data: membership } = await admin.from("workspace_members").select("workspace_id, role, workspaces(*)").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (membership?.workspace_id) return { user, workspaceId: membership.workspace_id as string, role: membership.role as string, workspace: (membership as any).workspaces };

  const base = (user.email?.split("@")[0] || "workspace").replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "") || "workspace";
  const slug = `${base}-${user.id.slice(0, 8)}`;
  const { data: workspace, error } = await admin.from("workspaces").insert({ name: `${user.email?.split("@")[0] || "My"} Workspace`, slug, owner_id: user.id }).select().single();
  if (error) {
    const { data: retry } = await admin.from("workspace_members").select("workspace_id, role, workspaces(*)").eq("user_id", user.id).limit(1).maybeSingle();
    if (retry?.workspace_id) return { user, workspaceId: retry.workspace_id as string, role: retry.role as string, workspace: (retry as any).workspaces };
    throw error;
  }
  await admin.from("workspace_members").insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });
  await admin.from("workspace_settings").insert({ workspace_id: workspace.id });
  return { user, workspaceId: workspace.id as string, role: "owner", workspace };
}

export async function requireWorkspace() {
  const context = await ensureWorkspace();
  if (!context) throw new Error("AUTH_REQUIRED");
  return context;
}

export async function currentWorkspaceId() {
  const context = await requireWorkspace();
  return context.workspaceId;
}
