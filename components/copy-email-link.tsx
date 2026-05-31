"use client";

import { useEffect, useState } from "react";

export function CopyEmailLink({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        aria-label={`Copy ${email}`}
        className="copy-email-link"
        onClick={handleCopy}
        style={{ fontSize: "clamp(1.85rem, 5.2vw, 3rem)" }}
        type="button"
      >
        {email}
      </button>
      <p className="copy-email-hint">Click to copy</p>
      {copied ? <div className="copy-toast">Email copied</div> : null}
    </>
  );
}
