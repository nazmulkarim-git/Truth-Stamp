"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API, apiFetch } from "@/lib/api";
import { authHeaders, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type CaseItem = { id: string; title: string; description?: string | null; created_at: string };
type EvidenceItem = {
  id: string;
  filename?: string | null;
  sha256?: string | null;
  media_type?: string | null;
  bytes?: number | null;
  provenance_state?: string | null;
  summary?: string | null;
  created_at: string;
};
type EventItem = {
  id: string;
  event_type: string;
  actor?: string | null;
  created_at: string;
  details?: any;
  evidence_id?: string | null;
};

export default function CasePage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;
  const router = useRouter();

  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // upload/analyze/report
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("All Evidence");
  const [useCase, setUseCase] = useState("General verification");

  async function loadAll() {
    setErr(null);
    try {
      const [rc, re, rv] = await Promise.all([
        apiFetch(`/cases/${caseId}`),
        apiFetch(`/cases/${caseId}/evidence`),
        apiFetch(`/cases/${caseId}/events`),
      ]);
      if (!rc.ok) throw new Error(await rc.text());
      if (!re.ok) throw new Error(await re.text());
      if (!rv.ok) throw new Error(await rv.text());
      setCaseItem(await rc.json());
      setEvidence(await re.json());
      setEvents(await rv.json());
    } catch (e: any) {
      setErr(e?.message || "Failed to load case");
    }
  }

  useEffect(() => {
    if (!getToken()) router.replace("/login");
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function postMultipart(endpoint: "/analyze" | "/report") {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("role", role);
      fd.append("use_case", useCase);
      fd.append("case_id", caseId);

      const r = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: {
          ...authHeaders(),
        } as any,
        body: fd,
      });

      if (!r.ok) throw new Error(await r.text());

      if (endpoint === "/report") {
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "truthstamp-report.pdf";
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        await r.json();
      }

      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const statusChip = useMemo(() => {
    const last = evidence[0];
    const s = last?.provenance_state || "—";
    return s;
  }, [evidence]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-blue-700">TruthStamp</div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{caseItem?.title || "Case"}</h1>
              <span className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600">
                Latest: {statusChip}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{caseItem?.description || "No description"}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/app")}>
              Back
            </Button>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Evidence uploader */}
          <div className="md:col-span-5">
            <Card className="p-5 border-slate-200 shadow-sm">
              <div className="text-sm font-semibold">Add evidence</div>
              <p className="mt-1 text-sm text-slate-600">
                Upload original files whenever possible. TruthStamp logs chain-of-custody automatically.
              </p>

              <div className="mt-4 space-y-3">
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm"
                />
                <div>
                  <div className="text-sm font-medium mb-1">Role</div>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} />
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Use case</div>
                  <Input value={useCase} onChange={(e) => setUseCase(e.target.value)} />
                </div>

                {err && (
                  <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md p-2">
                    {err}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button disabled={!file || busy} onClick={() => postMultipart("/analyze")}>
                    {busy ? "Working…" : "Analyze"}
                  </Button>
                  <Button disabled={!file || busy} variant="secondary" onClick={() => postMultipart("/report")}>
                    Generate PDF
                  </Button>
                </div>

                <div className="text-xs text-slate-500">
                  Chain-of-custody events recorded: upload → analyze → report.
                </div>
              </div>
            </Card>

            <Card className="mt-6 p-5 border-slate-200 shadow-sm">
              <div className="text-sm font-semibold">Why this matters</div>
              <p className="mt-1 text-sm text-slate-600">
                Provenance can be missing. TruthStamp still produces a decision-grade output by separating
                <b> verifiable facts</b>, <b>technical observations</b>, and <b>unknowns</b>.
              </p>
            </Card>
          </div>

          {/* Evidence list */}
          <div className="md:col-span-7">
            <Card className="p-5 border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Evidence</div>
                <div className="text-xs text-slate-500">{evidence.length} items</div>
              </div>

              <div className="mt-4 space-y-2">
                {evidence.map((e) => (
                  <div key={e.id} className="rounded-md border border-slate-200 p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{e.filename || "upload"}</div>
                        <div className="text-xs text-slate-500 truncate">{e.sha256}</div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-700 whitespace-nowrap">
                        {e.provenance_state || "—"}
                      </div>
                    </div>
                    {e.summary && <div className="mt-2 text-sm text-slate-600">{e.summary}</div>}
                    <div className="mt-2 text-xs text-slate-500">{e.created_at}</div>
                  </div>
                ))}
                {evidence.length === 0 && (
                  <div className="text-sm text-slate-600 py-8 text-center">No evidence added yet.</div>
                )}
              </div>
            </Card>

            <Card className="mt-6 p-5 border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Chain of custody</div>
                <div className="text-xs text-slate-500">{events.length} events</div>
              </div>

              <div className="mt-4 space-y-2">
                {events.map((ev) => (
                  <div key={ev.id} className="flex gap-3 rounded-md border border-slate-200 p-3">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-600" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{ev.event_type}</div>
                      <div className="text-xs text-slate-500">
                        {ev.created_at}
                        {ev.actor ? ` • ${ev.actor}` : ""}
                        {ev.evidence_id ? ` • ${ev.evidence_id}` : ""}
                      </div>
                      {ev.details && Object.keys(ev.details).length > 0 && (
                        <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-md p-2 overflow-auto">
                          {JSON.stringify(ev.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="text-sm text-slate-600 py-8 text-center">No custody events yet.</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
