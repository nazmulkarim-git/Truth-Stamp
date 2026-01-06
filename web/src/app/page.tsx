"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const t = getToken();
    router.replace(t ? "/app" : "/login");
  }, [router]);
  return null;
}
