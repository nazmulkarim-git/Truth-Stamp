"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { setToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setToken(data.token);
      router.replace(next);
    } catch (err: any) {
      setError(err?.message || "Register failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-xs font-medium text-blue-700">TruthStamp</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-slate-600">
            Start organizing evidence into cases with chain-of-custody.
          </p>
        </div>

        <Card className="p-6 shadow-sm border-slate-200">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.com" />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Password</div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>

            {error && (
              <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md p-2">
                {error}
              </div>
            )}

            <Button disabled={busy} type="submit" className="w-full">
              {busy ? "Creating…" : "Create account"}
            </Button>

            <div className="text-sm text-slate-600 text-center">
              Already have an account?{" "}
              <a className="text-blue-700 hover:underline" href="/login">
                Sign in
              </a>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
