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
  const workspaceName = `${user.email?.split("@")[0] || "My"} Workspace`;

  // The first bootstrap can succeed in creating the workspace but fail before
  // the membership/settings rows are written. A later request must recover
  // that workspace instead of trying the same INSERT again (23505).
  let { data: workspace, error } = await admin
    .from("workspaces")
    .insert({ name: workspaceName, slug, owner_id: user.id })
    .select()
    .single();

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await admin
      .from("workspaces")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing && existing.owner_id === user.id) {
      workspace = existing;
      error = null;
    } else {
      throw error;
    }
  }

  if (error || !workspace) {
    const { data: retry } = await admin
      .from("workspace_members")
      .select("workspace_id, role, workspaces(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (retry?.workspace_id) {
      return { user, workspaceId: retry.workspace_id as string, role: retry.role as string, workspace: (retry as any).workspaces };
    }
    throw error || new Error("WORKSPACE_BOOTSTRAP_FAILED");
  }

  const { error: memberError } = await admin
    .from("workspace_members")
    .upsert({ workspace_id: workspace.id, user_id: user.id, role: "owner" }, { onConflict: "workspace_id,user_id" });
  if (memberError) throw memberError;

  const { error: settingsError } = await admin
    .from("workspace_settings")
    .upsert({ workspace_id: workspace.id }, { onConflict: "workspace_id" });
  if (settingsError) throw settingsError;

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
