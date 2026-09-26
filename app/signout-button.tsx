"use client";

import { useState } from "react";
import LoadingScreen from "@/app/loading-screen";

export default function SignOutButton() {
  const [loading, setLoading] = useState(false);
  return <form action="/api/auth/signout" method="post" onSubmit={() => setLoading(true)}><button className="sidebar-signout" disabled={loading}>{loading ? <LoadingScreen inline message="Signing out" /> : "Sign out"}</button></form>;
}
