"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Sparkles, FileText, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";

type AnalysisResult = {
  filename: string;
  media_type: string;
  bytes: number;
  sha256: string;
  provenance_state: string;
  summary: string;
  tools?: Array<{ name: string; available: boolean; version?: string | null }>;
  ai_disclosure?: any;
  transformations?: any;
  derived_timeline?: any;
  metadata_completeness?: any;
};

function badgeFor(state: string) {
  if (state?.includes("VERIFIED")) return { label: "Verifiable", cls: "bg-blue-600 text-white" };
  if (state?.includes("UNVERIFIABLE")) return { label: "Unverifiable", cls: "bg-slate-100 text-slate-700" };
  return { label: "Unknown", cls: "bg-slate-100 text-slate-700" };
}

export default function Home() {
  const router = useRouter();
  const token = getToken();

  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("All Evidence");
  const [useCase, setUseCase] = useState("General verification");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const badge = useMemo(() => badgeFor(result?.provenance_state || ""), [result]);

  async function analyze() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("role", role);
      fd.append("use_case", useCase);

      const r = await fetch(`${API}/analyze`, { method: "POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as AnalysisResult;
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  async function generatePdf() {
    if (!file) return;
    if (!token) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("role", role);
      fd.append("use_case", useCase);

      const r = await fetch(`${API}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "truthstamp-report.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "PDF generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Subtle animated background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-200/60 via-sky-100/50 to-white blur-3xl" />
        <div className="absolute -bottom-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-blue-100/60 via-white to-white blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:22px_22px] opacity-[0.35]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">TruthStamp</div>
              <div className="text-xs text-slate-600">Provenance reports — cryptographic proof when available</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {token ? (
              <Button variant="secondary" onClick={() => router.push("/app")}>Evidence Workspace</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => router.push("/login")}>Sign in</Button>
                <Button onClick={() => router.push("/register")}>Create account</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Provenance-first verification (no &quot;fake probability&quot;)
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
              Trust digital evidence <span className="text-blue-700">without guessing</span>.
            </h1>
            <p className="mt-3 text-base text-slate-600 max-w-xl">
              Upload a photo or video. TruthStamp extracts provenance (C2PA when present) and structured technical metadata,
              then explains what is provable, what is inferred, and what is unknown.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-4 border-slate-200 shadow-sm">
                <div className="text-sm font-semibold">Court/Claims-ready</div>
                <div className="mt-1 text-sm text-slate-600">Clear chain-of-custody events in the workspace.</div>
              </Card>
              <Card className="p-4 border-slate-200 shadow-sm">
                <div className="text-sm font-semibold">Cryptographic when possible</div>
                <div className="mt-1 text-sm text-slate-600">Verifies C2PA trust chain when available.</div>
              </Card>
              <Card className="p-4 border-slate-200 shadow-sm">
                <div className="text-sm font-semibold">Transparent outputs</div>
                <div className="mt-1 text-sm text-slate-600">Full JSON + PDF report (login required).</div>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-5">
            <Card className="p-6 border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Upload evidence</div>
                  <div className="text-xs text-slate-600">Free single-file analysis. PDF requires login.</div>
                </div>
                <div className="text-xs text-slate-500">API: <span className="font-mono">{API}</span></div>
              </div>

              <div className="mt-4 space-y-3">
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">Role</div>
                    <Input value={role} onChange={(e) => setRole(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">Use case</div>
                    <Input value={useCase} onChange={(e) => setUseCase(e.target.value)} />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md p-2">{error}</div>
                )}

                <div className="flex gap-2">
                  <Button disabled={!file || busy} onClick={analyze} className="flex-1">
                    {busy ? "Working…" : (
                      <span className="inline-flex items-center gap-2">Analyze <ArrowRight className="h-4 w-4" /></span>
                    )}
                  </Button>
                  <Button disabled={!file || busy} variant="secondary" onClick={generatePdf}>
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4" /> PDF{token ? "" : <Lock className="h-3 w-3" />}
                    </span>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Result */}
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Result</h2>
            {result?.provenance_state ? (
              <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
            ) : (
              <span className="text-xs text-slate-500">Upload a file to see a result</span>
            )}
          </div>

          {result && (
            <Card className="mt-3 p-6 border-slate-200 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">SHA-256</div>
                  <div className="mt-1 font-mono text-xs break-all">{result.sha256}</div>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">Media type</div>
                  <div className="mt-1 text-sm font-medium">{result.media_type}</div>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">Size</div>
                  <div className="mt-1 text-sm font-medium">{Math.round((result.bytes / 1024) * 10) / 10} KB</div>
                </div>
              </div>

              <div className="mt-4 text-sm text-slate-700">{result.summary}</div>

              <div className="mt-5">
                <div className="text-sm font-semibold">Tools</div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(result.tools || []).map((t) => (
                    <div key={t.name} className="rounded-md border border-slate-200 p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-slate-500">{t.version || "—"}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${t.available ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-700"}`}>
                        {t.available ? "available" : "missing"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        <footer className="mt-12 text-xs text-slate-500">
          TruthStamp reports provenance and metadata. It does not estimate &quot;fake probability.&quot;
        </footer>
      </main>
    </div>
  );
}
