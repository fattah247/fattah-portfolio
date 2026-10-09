import type { Metadata } from "next";
import { EvidenceLedgerApp } from "@/components/evidence-ledger-app";

export const metadata: Metadata = {
  title: "Evidence ledger",
  description: "Public evidence and limits for payment reliability, service observability, and Android device trust cases.",
};

export default function EvidencePage() {
  return <EvidenceLedgerApp />;
}
