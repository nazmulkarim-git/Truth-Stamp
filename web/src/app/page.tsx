"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Sparkles,
  FileText,
  ArrowRight,
  Lock,
  UploadCloud,
  BadgeCheck,
  Info,
  Cpu,
} from "lucide-react";

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
};

function badgeFor(state: string) {
  const s = (state || "").toUpperCase();
  if (s.includes("VERIFIED") || s.includes("PROVABLE"))
    return {
      label: "Verifiable",
      cls: "bg-blue-600 text-white border-blue-600",
      dot: "bg-white",
    };
  if (s.includes("UNVERIFIABLE"))
    return {
      label: "Unverifiable",
      cls: "bg-white text-slate-700 border-slate-200",
      dot: "bg-slate-400",
    };
  return {
    label: "Unknown",
    cls: "bg-white text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  };
}

function formatBytes(bytes: number) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb * 10) / 10} KB`;
  const mb = kb / 1024;
  return `${Math.round(mb * 10) / 10} MB`;
}

export default function Home() {
  const router = useRouter();
  const token = getToken();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const pickFile = () => fileInputRef.current?.click();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Dynamic background (white+blue only) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* animated grid */}
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-[0.22]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.22 }}
          transition={{ duration: 0.8 }}
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(37,99,235,0.22) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* light beams */}
        <motion.div
          aria-hidden
          className="absolute -top-24 left-1/2 h-[560px] w-[980px] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(147,197,253,0.18), rgba(255,255,255,0))",
          }}
          animate={{ y: [0, 18, 0], scale: [1, 1.03, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-40 right-[-10%] h-[520px] w-[520px] rounded-full blur-3xl"
          style={{
            background:
              "linear-gradient(45deg, rgba(37,99,235,0.18), rgba(191,219,254,0.14), rgba(255,255,255,0))",
          }}
          animate={{ y: [0, -14, 0], scale: [1, 1.04, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm"
              initial={{ rotate: -6, scale: 0.98 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <ShieldCheck className="h-5 w-5" />
            </motion.div>
            <div>
              <div className="text-sm font-semibold tracking-tight">TruthStamp</div>
              <div className="text-xs text-slate-600">
                Provenance reports — cryptographic proof when available
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {token ? (
              <Button variant="secondary" onClick={() => router.push("/app")}>
                Evidence Workspace
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
                <Button onClick={() => router.push("/register")}>Create account</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* HERO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 shadow-[0_1px_0_rgba(37,99,235,0.08)]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Provenance-first verification (no &quot;fake probability&quot;)
            </motion.div>

            <motion.h1
              className="mt-4 text-[42px] leading-[1.05] font-semibold tracking-tight"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05, ease: "easeOut" }}
            >
              Trust digital evidence{" "}
              <span className="text-blue-700">without guessing</span>.
            </motion.h1>

            <motion.p
              className="mt-4 text-base text-slate-600 max-w-xl"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            >
              Upload a photo or video. TruthStamp extracts provenance (C2PA when present) and
              structured technical metadata, then separates what is provable, inferred, and unknown.
            </motion.p>

            {/* Proof chips */}
            <motion.div
              className="mt-6 flex flex-wrap gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            >
              {[
                { icon: <BadgeCheck className="h-4 w-4" />, t: "Evidence-grade structure" },
                { icon: <Cpu className="h-4 w-4" />, t: "C2PA + metadata inspection" },
                { icon: <Info className="h-4 w-4" />, t: "Clear limitations & unknowns" },
              ].map((x) => (
                <div
                  key={x.t}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm"
                >
                  <span className="text-blue-700">{x.icon}</span>
                  {x.t}
                </div>
              ))}
            </motion.div>

            {/* Feature cards */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  title: "Evidence Workspace",
                  body: "Cases + chain-of-custody events for investigations, legal, or journalism.",
                },
                {
                  title: "Cryptographic when possible",
                  body: "Verifies C2PA trust chains and surfaces signer & assertions when present.",
                },
                {
                  title: "Decision-grade outputs",
                  body: "Human-readable summary plus full JSON; PDF report is login-gated.",
                },
              ].map((c, i) => (
                <motion.div
                  key={c.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.15 + i * 0.05, ease: "easeOut" }}
                >
                  <Card className="p-4 border-slate-200 shadow-sm rounded-2xl">
                    <div className="text-sm font-semibold">{c.title}</div>
                    <div className="mt-1 text-sm text-slate-600">{c.body}</div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Upload module */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Card className="p-6 border-slate-200 shadow-[0_12px_30px_rgba(2,6,23,0.06)] rounded-3xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Upload evidence</div>
                    <div className="text-xs text-slate-600">
                      Guest analysis is free. PDF report requires login.
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    API{" "}
                    <span className="font-mono text-slate-600">
                      {API.replace("https://", "")}
                    </span>
                  </div>
                </div>

                {/* Custom file picker */}
                <div className="mt-5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />

                  <motion.button
                    type="button"
                    onClick={pickFile}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                        <UploadCloud className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">
                          {file ? file.name : "Choose a photo or video"}
                        </div>
                        <div className="text-xs text-slate-600">
                          {file ? `${formatBytes(file.size)} • ready to analyze` : "Drag & drop coming soon"}
                        </div>
                      </div>
                      <div className="text-xs text-blue-700 font-medium">Browse</div>
                    </div>
                  </motion.button>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">Role</div>
                    <Input value={role} onChange={(e) => setRole(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-700 mb-1">Use case</div>
                    <Input value={useCase} onChange={(e) => setUseCase(e.target.value)} />
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mt-4 text-sm text-red-600 border border-red-200 bg-red-50 rounded-xl p-3"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-5 flex gap-2">
                  <Button
                    disabled={!file || busy}
                    onClick={analyze}
                    className="flex-1 rounded-2xl h-11"
                  >
                    {busy ? (
                      "Working…"
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        Analyze <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>

                  <Button
                    disabled={!file || busy}
                    variant="secondary"
                    onClick={generatePdf}
                    className="rounded-2xl h-11"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4" /> PDF
                      {!token ? <Lock className="h-3.5 w-3.5" /> : null}
                    </span>
                  </Button>
                </div>

                {/* tiny trust line */}
                <div className="mt-4 text-[11px] text-slate-500">
                  TruthStamp reports provenance and metadata — it does not estimate &quot;fake probability.&quot;
                </div>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* RESULT */}
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Result</h2>
            {result?.provenance_state ? (
              <span className={`text-xs px-2.5 py-1 rounded-full border ${badge.cls} inline-flex items-center gap-2`}>
                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                {badge.label}
              </span>
            ) : (
              <span className="text-xs text-slate-500">Upload a file to see a result</span>
            )}
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.35 }}
              >
                <Card className="mt-3 p-6 border-slate-200 shadow-sm rounded-3xl">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-xs text-slate-500">SHA-256</div>
                      <div className="mt-2 font-mono text-xs break-all">{result.sha256}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-xs text-slate-500">Media type</div>
                      <div className="mt-2 text-sm font-medium">{result.media_type}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-xs text-slate-500">Size</div>
                      <div className="mt-2 text-sm font-medium">{formatBytes(result.bytes)}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-700">{result.summary}</div>

                  <div className="mt-6">
                    <div className="text-sm font-semibold">Tools</div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(result.tools || []).map((t) => (
                        <motion.div
                          key={t.name}
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.18 }}
                          className="rounded-2xl border border-slate-200 p-4 flex items-center justify-between bg-white"
                        >
                          <div>
                            <div className="text-sm font-medium">{t.name}</div>
                            <div className="text-xs text-slate-500">{t.version || "—"}</div>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${
                              t.available
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}
                          >
                            {t.available ? "available" : "missing"}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-10 flex items-center justify-between text-xs text-slate-500">
          <div className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-700" />
            Evidence-first. Transparent. No guessing.
          </div>
          <button
            className="text-blue-700 hover:text-blue-800 transition-colors"
            onClick={() => router.push(token ? "/app" : "/login")}
          >
            {token ? "Go to Workspace →" : "Sign in for Cases →"}
          </button>
        </div>
      </main>
    </div>
  );
}
