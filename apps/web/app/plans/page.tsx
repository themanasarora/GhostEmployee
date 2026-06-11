"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Plans are now selected per-project after creation.
// Redirect anyone who lands here directly to the dashboard.
export default function PlansPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, [router]);
  return (
    <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
    </div>
  );
}
