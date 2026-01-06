"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Upload,
  FileText,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Clock,
  Briefcase,
  Newspaper,
  Scale,
  BadgeCheck,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type AnalysisResult = {
  filename: string;
  media_type: "image" | "video" | "unknown";
  sha256: string;
  bytes: number;
  provenance_state: "VERIFIED_ORIGINAL" | "ALTERED_OR_BROKEN_PROVENANCE" | "UNVERIFIABLE_NO_PROVENANCE";
  summary: string;
  tools: Array<{ name: string; available: boolean; version?: string; notes?: string }>;
  derived_timeline?: any;
  metadata_consistency?: any;
  metadata_completeness?: { score_0_to_3?: number; checks?: Record<string, boolean>; notes?: string[] };
  decision_context?: any;
  what_would_make_verifiable?: string[];
  what_this_report_is?: string[];
  what_this_report_is_not?: string[];
};

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function formatBytes(b: number) {
  if (!Number.isFinite(b)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function ScoreBadge({ score }: { score?: number }) {
  const s = typeof score === "number" ? score : undefined;
  const label = s === undefined ? "—" : `${s}/3`;
  return <Badge variant="secondary" className="font-medium">{label}</Badge>;
}

export default function Page() {
  const [API] = useState(DEFAULT_API);
  const [role, setRole] = useState<string>("investigator");
  const [useCase, setUseCase] = useState<string>("insurance");

  // Evidence Workspace (Cases)
  type CaseItem = { id: string; title: string; description?: string | null; created_at: string };
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [caseId, setCaseId] = useState<string>("");
  const [showCaseCreate, setShowCaseCreate] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseDesc, setNewCaseDesc] = useState("");

  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Pilot signup
  const [email, setEmail] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "ok" | "err">("idle");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/cases`);
        if (!r.ok) return;
        const data = (await r.json()) as CaseItem[];
        setCases(data);
        if (!caseId && data.length) setCaseId(data[0].id);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const badge = useMemo(() => {
    if (!result) return { label: "Awaiting evidence", variant: "secondary" as const, Icon: BadgeCheck };
    const s = result.provenance_state;
    if (s === "VERIFIED_ORIGINAL") return { label: "Verified (C2PA intact)", variant: "default" as const, Icon: ShieldCheck };
    if (s === "ALTERED_OR_BROKEN_PROVENANCE") return { label: "Altered / Broken provenance", variant: "destructive" as const, Icon: AlertTriangle };
    return { label: "Unverifiable (no C2PA)", variant: "secondary" as const, Icon: HelpCircle };
  }, [result]);

  async function post(endpoint: "/analyze" | "/report") {
    if (!file) return null;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("role", role);
    fd.append("use_case", useCase);
    if (caseId) fd.append("case_id", caseId);
    const r = await fetch(`${API}${endpoint}`, { method: "POST", body: fd, headers: { "x-truthstamp-actor": "web" } });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r;
  }

  async function onAnalyze() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await post("/analyze");
      const data = (await r!.json()) as AnalysisResult;
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function onReport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post("/report");
      const blob = await r!.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "TruthStamp_Report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function onJoinPilot() {
    setLeadStatus("idle");
    try {
      const r = await fetch(`${API}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, use_case: useCase, notes: leadNotes }),
      });
      if (!r.ok) throw new Error(await r.text());
      setLeadStatus("ok");
      setEmail("");
      setLeadNotes("");
    } catch {
      setLeadStatus("err");
    }
  }

  
  async function createCase() {
    const title = newCaseTitle.trim();
    if (!title) return;
    try {
      const r = await fetch(`${API}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: newCaseDesc.trim() || null }),
      });
      if (!r.ok) throw new Error(await r.text());
      const c = (await r.json()) as CaseItem;
      setCases((prev) => [c, ...prev]);
      setCaseId(c.id);
      setShowCaseCreate(false);
      setNewCaseTitle("");
      setNewCaseDesc("");
    } catch (e: any) {
      setError(e?.message || "Failed to create case");
    }
  }

return (
    <main className="min-h-screen bg-white">
      {/* Subtle blue glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-120px] h-[420px] w-[520px] rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-slate-700 shadow-soft">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              Provenance reports for photos & videos • cryptographic proof when available • no guessing
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">TruthStamp</h1>
            <p className="max-w-2xl text-slate-600">
              <b>Make decisions that matter</b> by seeing what digital media can be <b>proven</b> about its origin and edits — and what remains <b>unknown</b>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <div className="text-xs text-slate-500">Case</div>
              <select
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
              >
                <option value="">No case</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => setShowCaseCreate(true)}>
                New Case
              </Button>
            </div>

            <Badge variant={badge.variant} className="gap-2">
              <badge.Icon className="h-4 w-4" />
              {badge.label}
            </Badge>
          </div>
        </div>

        {/* Primary card */}
        <Card className="border-blue-100 shadow-glow">
          <CardHeader>
            <CardTitle>Upload evidence</CardTitle>
            <CardDescription>
              Analyze provenance + metadata and generate a forensic PDF you can share in financial, legal, or editorial workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role + use-case selector */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs font-medium text-slate-600">I am uploading as</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { v: "insurance_adjuster", label: "Insurance", Icon: Briefcase },
                    { v: "journalist", label: "Journalist", Icon: Newspaper },
                    { v: "legal", label: "Legal", Icon: Scale },
                    { v: "investigator", label: "Investigator", Icon: BadgeCheck },
                  ].map((x) => (
                    <button
                      key={x.v}
                      onClick={() => setRole(x.v)}
                      className={
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition " +
                        (role === x.v ? "border-blue-300 bg-blue-50 text-slate-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                      }
                      type="button"
                    >
                      <x.Icon className={"h-4 w-4 " + (role === x.v ? "text-blue-600" : "text-slate-500")} />
                      {x.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs font-medium text-slate-600">Primary use case</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { v: "insurance", label: "Claims review" },
                    { v: "journalism", label: "Source verification" },
                    { v: "court", label: "Court evidence" },
                    { v: "compliance", label: "Compliance audit" },
                  ].map((x) => (
                    <button
                      key={x.v}
                      onClick={() => setUseCase(x.v)}
                      className={
                        "rounded-lg border px-3 py-2 text-sm transition " +
                        (useCase === x.v ? "border-blue-300 bg-blue-50 text-slate-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                      }
                      type="button"
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Upload */}
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Button onClick={onAnalyze} disabled={!file || busy} className="gap-2">
                <Upload className="h-4 w-4" />
                {busy ? "Working…" : "Analyze"}
              </Button>
              <Button onClick={onReport} disabled={!file || busy} variant="outline" className="gap-2 border-blue-200">
                <FileText className="h-4 w-4" />
                Generate PDF
              </Button>
            </div>

            <div className="text-xs text-slate-500">
              API: <code className="rounded bg-slate-50 px-2 py-1 border">{API}</code>
              {file ? (
                <span className="ml-2">
                  • File: <b className="text-slate-700">{file.name}</b> ({formatBytes(file.size)})
                </span>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-slate-900">
                <b className="text-red-700">Error:</b> {error}
              </div>
            ) : null}

            {/* What this is / is not */}
            <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">What TruthStamp is (and is not)</div>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-600">This is</div>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    <li>Cryptographic provenance checks when present (C2PA)</li>
                    <li>Structured technical observations (metadata, encoding, workflow hints)</li>
                    <li>Clear separation of provable facts, derived observations, and unknowns</li>
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">This is not</div>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    <li>A probability score of being fake</li>
                    <li>A judgment of authenticity or intent</li>
                    <li>A deepfake-model detector</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {result ? (
          <div className="mt-6 space-y-6">
            <Card className="border-slate-200">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle>Result</CardTitle>
                  <CardDescription>{result.summary}</CardDescription>
                </div>
                <Badge variant={badge.variant} className="gap-2">
                  <badge.Icon className="h-4 w-4" />
                  {badge.label}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Key facts */}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs text-slate-500">SHA-256</div>
                    <div className="mt-1 break-all text-sm font-medium text-slate-900">{result.sha256}</div>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs text-slate-500">Media type</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{result.media_type}</div>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs text-slate-500">Size</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{formatBytes(result.bytes)}</div>
                  </div>
                </div>

                {/* Evidence status matrix */}
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">Evidence status matrix</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Metadata completeness</span>
                      <ScoreBadge score={result.metadata_completeness?.score_0_to_3} />
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Cryptographic provenance</div>
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                        {result.provenance_state === "VERIFIED_ORIGINAL" ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : <HelpCircle className="h-4 w-4 text-slate-400" />}
                        {result.provenance_state === "VERIFIED_ORIGINAL" ? "Verified (C2PA intact)" : "Not present / not verifiable"}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Tamper from provenance</div>
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                        {result.provenance_state === "ALTERED_OR_BROKEN_PROVENANCE" ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <HelpCircle className="h-4 w-4 text-slate-400" />}
                        {result.provenance_state === "ALTERED_OR_BROKEN_PROVENANCE" ? "Broken / altered chain detected" : "Inconclusive"}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">AI disclosure</div>
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                        Declared only when explicitly embedded (absence ≠ human capture)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline + verifiability guidance */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Clock className="h-4 w-4 text-blue-600" /> Derived timeline
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      Derived from available metadata. Not cryptographically sealed.
                    </div>
                    <pre className="mt-3 max-h-[240px] overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
{JSON.stringify(result.derived_timeline || {}, null, 2)}
                    </pre>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">What would make this verifiable?</div>
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                      {(result.what_would_make_verifiable || []).map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                    <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">
                      Metadata absence is not evidence of manipulation, but it limits verifiability.
                    </div>
                  </div>
                </div>

                {/* Tools */}
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-900">Tools audit</div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {result.tools.map((t) => (
                      <div key={t.name} className="rounded-xl border bg-white p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-slate-900">{t.name}</div>
                          <Badge variant={t.available ? "secondary" : "outline"}>{t.available ? "available" : "missing"}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{t.version ? t.version : t.notes || ""}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <details className="rounded-xl border bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">Full JSON</summary>
                  <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800">
{JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* How it works + Use cases */}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
              <CardDescription>A decision-first workflow built for evidence review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold">1</span>
                <div><b>Upload</b> a photo or video used in a claim, report, or case.</div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold">2</span>
                <div><b>Review</b> provable provenance (C2PA) plus derived technical observations.</div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold">3</span>
                <div><b>Generate</b> a forensic PDF that preserves facts, uncertainty, and tool versions.</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Use cases</CardTitle>
              <CardDescription>Start narrow. Expand to every high-stakes workflow.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Briefcase className="mt-0.5 h-4 w-4 text-blue-600" />
                <div><b>Insurance claims:</b> review evidence quickly and avoid false confidence from detectors.</div>
              </div>
              <div className="flex items-start gap-2">
                <Newspaper className="mt-0.5 h-4 w-4 text-blue-600" />
                <div><b>Journalism:</b> verify source media and publish with defensible provenance.</div>
              </div>
              <div className="flex items-start gap-2">
                <Scale className="mt-0.5 h-4 w-4 text-blue-600" />
                <div><b>Legal & courts:</b> support chain-of-custody documentation and expert review.</div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" />
                <div><b>Compliance:</b> audit media integrity in regulated workflows.</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Testimonials (starter) */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Early feedback</CardTitle>
              <CardDescription>Replace these placeholders with real quotes as you talk to users.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {[
                { q: "“The report structure makes it clear what we can rely on, and what we can’t.”", who: "Insurance claims reviewer (pilot)" },
                { q: "“I like that it refuses to guess. That’s better for journalism.”", who: "Editor / journalist (beta)" },
                { q: "“The integrity block + hash makes this defensible for documentation.”", who: "Legal professional (review)" },
              ].map((t, i) => (
                <div key={i} className="rounded-2xl border bg-white p-4">
                  <div className="text-sm text-slate-800">{t.q}</div>
                  <div className="mt-2 text-xs text-slate-500">{t.who}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Pilot signup */}
        <div className="mt-8">
          <Card className="border-blue-100">
            <CardHeader>
              <CardTitle>Join the pilot program</CardTitle>
              <CardDescription>Get early access, share workflows, and shape TruthStamp’s roadmap.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" />
                <Input value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} placeholder="What workflow are you trying to verify?" />
              </div>
              <Button onClick={onJoinPilot} disabled={!email} className="gap-2">
                <Mail className="h-4 w-4" />
                Request access
              </Button>
              {leadStatus === "ok" ? (
                <div className="text-sm text-blue-700">Thanks — request received.</div>
              ) : leadStatus === "err" ? (
                <div className="text-sm text-red-700">Could not submit. Please try again.</div>
              ) : null}
              <div className="text-xs text-slate-500">
                Note: On Render free tier, lead storage is best-effort (ephemeral). For production, connect to a database.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>FAQ</CardTitle>
              <CardDescription>Clear answers, no overclaims.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div>
                <div className="font-semibold text-slate-900">Does TruthStamp work for all photos and videos?</div>
                <div className="mt-1">
                  It can analyze any file for available metadata and workflow hints. However, <b>cryptographic verification</b> is only possible when the media includes signed provenance (e.g., C2PA) or explicit embedded disclosure.
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">If there’s no C2PA, does that mean it’s fake?</div>
                <div className="mt-1">
                  No. Lack of C2PA means the file is <b>unverifiable</b> via cryptographic provenance. It does not confirm authenticity or manipulation.
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Can you detect “Gemini / Midjourney / etc.”?</div>
                <div className="mt-1">
                  TruthStamp only confirms AI origin when the file explicitly declares it (e.g., signed provenance or embedded metadata). It does not guess.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 text-xs text-slate-500">
          TruthStamp reports provenance and metadata. It does not estimate “fake probability.”
        </div>
      </div>
    </main>
  );
}
