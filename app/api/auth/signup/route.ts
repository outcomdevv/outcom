import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function redirectWithError(request: Request, message: string) {
  return NextResponse.redirect(
    new URL(`/auth/signup?error=${encodeURIComponent(message)}`, request.url),
    303,
  );
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");

    if (!email) return redirectWithError(request, "Email is required.");
    if (password.length < 8) {
      return redirectWithError(request, "Password must be at least 8 characters.");
    }

    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const secretKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!secretKey) {
      throw new Error(
        "Server auth is not configured. Add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to Vercel.",
      );
    }

    const admin = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    /*
     * V60: use the server-only Admin Auth API for the current
     * design-partner/private-access signup flow. This avoids the broken
     * production email-confirmation path that was rejecting a real Gmail
     * address with email_address_invalid.
     *
     * The secret key never reaches the browser.
     */
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      // Repair a partial account from an earlier failed signup.
      if (
        error.code === "email_exists" ||
        /already registered|already exists|email.*exists/i.test(error.message)
      ) {
        const { data: usersData, error: listError } =
          await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

        if (listError) return redirectWithError(request, listError.message);

        const existing = usersData.users.find(
          (user) => user.email?.toLowerCase() === email,
        );

        if (!existing) return redirectWithError(request, error.message);

        const { error: repairError } =
          await admin.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
          });

        if (repairError) return redirectWithError(request, repairError.message);
      } else {
        return redirectWithError(request, error.message);
      }
    }

    return NextResponse.redirect(
      new URL(
        `/auth/login?notice=${encodeURIComponent(
          data?.user
            ? "Workspace created. Sign in to continue."
            : "Workspace access repaired. Sign in to continue.",
        )}`,
        request.url,
      ),
      303,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create your workspace.";

    return redirectWithError(request, message);
  }
}
