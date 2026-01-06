"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  ScanSearch,
  Lock,
  Sparkles,
  Globe,
  Scale,
  BadgeCheck,
  Boxes,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

const fadeUp = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

function AnimatedBlob({
  className,
  delay = 0,
}: {
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={cn(
        "pointer-events-none absolute rounded-full blur-3xl opacity-50",
        className
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 0.55,
        scale: [0.95, 1.06, 0.98],
        x: [0, 18, -10, 0],
        y: [0, -14, 12, 0],
      }}
      transition={{
        delay,
        duration: 10 + delay * 2,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
      }}
    />
  );
}

function GridGlow() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
      {/* Top vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.14),transparent_55%)]" />
      {/* Bottom vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.10),transparent_60%)]" />
    </div>
  );
}

export default function HomePage() {
  const stats = useMemo(
    () => [
      { label: "Artifacts extracted", value: "C2PA + EXIF + FFprobe" },
      { label: "Evidence workflow", value: "Cases + Chain-of-Custody" },
      { label: "Output", value: "Report + Integrity Summary" },
      { label: "Goal", value: "A digital notary for media" },
    ],
    []
  );

  const features = useMemo(
    () => [
      {
        icon: <ScanSearch className="h-5 w-5" />,
        title: "Instant provenance scan",
        desc: "Upload an image or video to extract authenticity signals, edits, and tool traces.",
      },
      {
        icon: <BadgeCheck className="h-5 w-5" />,
        title: "High-trust signal model",
        desc: "Separates cryptographic evidence from weak heuristics so users understand certainty.",
      },
      {
        icon: <FileCheck2 className="h-5 w-5" />,
        title: "Decision-ready report",
        desc: "Structured findings, timeline hints, and tamper-evident hashes you can cite.",
      },
      {
        icon: <Lock className="h-5 w-5" />,
        title: "Evidence Workspace (login)",
        desc: "Create cases, attach files, and maintain a chain-of-custody trail.",
      },
      {
        icon: <Scale className="h-5 w-5" />,
        title: "Built for high-stakes use",
        desc: "Legal, journalism, insurance, compliance—anywhere trust is expensive.",
      },
      {
        icon: <Boxes className="h-5 w-5" />,
        title: "Platform path",
        desc: "From reports → workflow → API → sealing inside partner apps.",
      },
    ],
    []
  );

  const useCases = useMemo(
    () => [
      { title: "Legal & Court", desc: "Prepare evidence packets with audit trails and reproducible extraction." },
      { title: "Journalism", desc: "Prove what’s known, what’s uncertain, and what metadata supports it." },
      { title: "Insurance", desc: "Reduce AI-driven fraud and speed up claim decisions." },
      { title: "Compliance", desc: "Maintain consistent verification and retention policies." },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top chrome */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white grid place-items-center shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">TruthStamp</div>
              <div className="text-xs text-slate-500 -mt-0.5">Evidence-grade provenance</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="#product" className="text-sm text-slate-600 hover:text-slate-900">Product</a>
            <a href="#usecases" className="text-sm text-slate-600 hover:text-slate-900">Use cases</a>
            <a href="#workspace" className="text-sm text-slate-600 hover:text-slate-900">Workspace</a>
            <a href="#trust" className="text-sm text-slate-600 hover:text-slate-900">Trust</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden md:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/register">
                Create account <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <GridGlow />

        {/* Animated blobs (white/blue only) */}
        <AnimatedBlob className="left-[-120px] top-[-90px] h-[320px] w-[320px] bg-blue-500/35" delay={0} />
        <AnimatedBlob className="right-[-140px] top-[60px] h-[360px] w-[360px] bg-sky-400/30" delay={0.6} />
        <AnimatedBlob className="left-[30%] bottom-[-180px] h-[420px] w-[420px] bg-blue-600/20" delay={1.1} />

        <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-14 md:pt-20">
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-10 md:grid-cols-2 md:gap-12">
            <motion.div variants={fadeUp}>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
                <Sparkles className="h-4 w-4" />
                Proof-first provenance • built for the AI slop era
              </div>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                Trust media with <span className="text-blue-600">evidence</span>, not guesses.
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
                TruthStamp extracts authenticity signals from images and videos and turns them into
                decision-ready findings. For anyone who needs to prove what happened—and when.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <a href="#try">
                    Try a quick scan <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="border-slate-300">
                  <Link href="/cases">Open Evidence Workspace</Link>
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary" className="bg-white/80 border border-slate-200 text-slate-700">
                  C2PA-aware
                </Badge>
                <Badge variant="secondary" className="bg-white/80 border border-slate-200 text-slate-700">
                  EXIF + FFprobe
                </Badge>
                <Badge variant="secondary" className="bg-white/80 border border-slate-200 text-slate-700">
                  Hash + audit trail
                </Badge>
                <Badge variant="secondary" className="bg-white/80 border border-slate-200 text-slate-700">
                  Report export
                </Badge>
              </div>
            </motion.div>

            {/* Hero right card */}
            <motion.div variants={fadeUp} className="relative">
              <Card className="relative overflow-hidden border-slate-200/70 bg-white/80 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Integrity Summary</div>
                      <div className="text-xs text-slate-500">A preview of what your scan produces</div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                      <Globe className="h-4 w-4 text-blue-600" />
                      Evidence-grade output
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3">
                    {stats.map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="text-sm text-slate-600">{s.label}</div>
                        <div className="text-sm font-medium text-slate-900">{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-blue-600 p-2 text-white">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-blue-900">What you get</div>
                        <p className="mt-1 text-sm text-blue-800/90">
                          A structured analysis + reproducible metadata extraction. When possible,
                          cryptographic provenance is highlighted separately from weaker signals.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                    <span>Public quick scan is free</span>
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5 text-blue-600" /> PDF export requires login
                    </span>
                  </div>
                </CardContent>

                {/* subtle border glow */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-blue-200/40" />
              </Card>

              {/* floating micro cards */}
              <motion.div
                className="absolute -bottom-6 -left-4 hidden w-[220px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:block"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.45 }}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div className="h-8 w-8 rounded-xl bg-blue-600/10 grid place-items-center">
                    <ScanSearch className="h-4 w-4 text-blue-700" />
                  </div>
                  Confidence framing
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Show users what’s proven vs inferred—so they can act.
                </p>
              </motion.div>

              <motion.div
                className="absolute -top-6 -right-4 hidden w-[220px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:block"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.45 }}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div className="h-8 w-8 rounded-xl bg-blue-600/10 grid place-items-center">
                    <FileCheck2 className="h-4 w-4 text-blue-700" />
                  </div>
                  Chain of custody
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Case history + file hashes + actions timeline.
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Product */}
      <section id="product" className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-16">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}>
            <motion.div variants={fadeUp} className="flex items-end justify-between gap-6">
              <div>
                <div className="text-sm font-medium text-blue-600">Product</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  Built like an evidence tool, not a detector.
                </h2>
                <p className="mt-3 max-w-2xl text-slate-600">
                  TruthStamp is designed for high-stakes workflows: it extracts signals, explains them,
                  and produces outputs you can reference.
                </p>
              </div>
            </motion.div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {features.map((f) => (
                <motion.div key={f.title} variants={fadeUp}>
                  <Card className="h-full border-slate-200/70 bg-white shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-600/10 p-2 text-blue-700">{f.icon}</div>
                        <div className="font-medium">{f.title}</div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Try */}
      <section id="try" className="border-t border-slate-200/70 bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-16">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="text-sm font-medium text-blue-600">Try it</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Anyone can run a quick scan.
              </h3>
              <p className="mt-3 text-slate-600">
                Not logged in? Upload a single file and see results. Need PDF + cases? Create an account.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/#analyze">Upload & analyze</Link>
                </Button>
                <Button asChild variant="outline" className="border-slate-300">
                  <Link href="/register">Unlock PDF & cases</Link>
                </Button>
              </div>
            </div>

            <Card className="border-slate-200/70 bg-white shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div className="h-8 w-8 rounded-xl bg-blue-600 text-white grid place-items-center">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  What “good” looks like
                </div>

                <div className="mt-4 grid gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="font-medium text-slate-900">Provenance present</div>
                    <div className="mt-1 text-slate-600">
                      If a trust chain exists, we surface it clearly.
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="font-medium text-slate-900">Edits explained</div>
                    <div className="mt-1 text-slate-600">
                      We show timelines & tool hints—without overclaiming.
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="font-medium text-slate-900">Reproducible</div>
                    <div className="mt-1 text-slate-600">
                      Hashes + extraction notes so another reviewer can verify.
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-xs text-slate-500">
                  Tip: keep files under your configured upload limit on Render free plan.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="usecases" className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-16">
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="text-sm font-medium text-blue-600">Use cases</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Trust is a workflow problem.
              </h3>
              <p className="mt-3 max-w-2xl text-slate-600">
                You’re not “detecting deepfakes.” You’re producing defensible artifacts for real decisions.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {useCases.map((u) => (
              <Card key={u.title} className="border-slate-200/70 bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-medium">{u.title}</div>
                      <p className="mt-2 text-sm text-slate-600">{u.desc}</p>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-blue-600/10 grid place-items-center text-blue-700">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workspace */}
      <section id="workspace" className="border-t border-slate-200/70 bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-16">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="text-sm font-medium text-blue-600">Evidence Workspace</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Cases + chain-of-custody, built-in.
              </h3>
              <p className="mt-3 text-slate-600">
                Login unlocks case dashboards, file history, and report exports—so TruthStamp becomes
                the place you manage evidence.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/cases">
                    Go to cases <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-slate-300">
                  <Link href="/login">Log in</Link>
                </Button>
              </div>
            </div>

            <Card className="border-slate-200/70 bg-white shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div className="h-8 w-8 rounded-xl bg-blue-600 text-white grid place-items-center">
                    <Lock className="h-4 w-4" />
                  </div>
                  Workspace includes
                </div>

                <div className="mt-4 grid gap-3">
                  {[
                    "Create cases for clients / incidents",
                    "Attach media + notes per case",
                    "Automatic file hashing for traceability",
                    "Action timeline (uploads, reports, exports)",
                    "PDF export (gated behind login)",
                  ].map((x) => (
                    <div key={x} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      {x}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-16">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-white p-8 shadow-sm md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium text-blue-600">Trust</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                  Your credibility layer for media.
                </h3>
                <p className="mt-3 max-w-2xl text-slate-600">
                  TruthStamp is built to separate what’s provable from what’s inferred, and present it
                  with clarity. That’s what makes it useful.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/register">Create account</Link>
                </Button>
                <Button asChild variant="outline" className="border-slate-300">
                  <Link href="/login">Log in</Link>
                </Button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                { icon: <ShieldCheck className="h-5 w-5" />, title: "Proof-forward", desc: "Cryptographic provenance surfaced first." },
                { icon: <ScanSearch className="h-5 w-5" />, title: "Explainable", desc: "Clear findings and confidence framing." },
                { icon: <Lock className="h-5 w-5" />, title: "Defensible", desc: "Hashes + workflow trail for audits." },
              ].map((x) => (
                <div key={x.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-blue-600/10 p-2 text-blue-700">{x.icon}</div>
                    <div className="font-medium">{x.title}</div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{x.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white grid place-items-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">TruthStamp</div>
                <div className="text-xs text-slate-500">Provenance for high-stakes media</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <Link className="text-slate-600 hover:text-slate-900" href="/login">Login</Link>
              <Link className="text-slate-600 hover:text-slate-900" href="/register">Sign up</Link>
              <Link className="text-slate-600 hover:text-slate-900" href="/cases">Cases</Link>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            © {new Date().getFullYear()} TruthStamp. Built for evidence workflows.
          </div>
        </div>
      </footer>
    </div>
  );
}
