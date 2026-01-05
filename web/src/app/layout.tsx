import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TruthStamp",
  description: "Provenance reports for photos & videos (cryptographic proof when available — no guessing).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
