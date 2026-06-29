"use client";

export function PrintBriefButton() {
  return <button className="brief-action brief-print-action" onClick={() => window.print()} type="button">Print / save PDF</button>;
}
