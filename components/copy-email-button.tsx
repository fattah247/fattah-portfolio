"use client";

import { useState } from "react";

export function CopyEmailButton({
  email,
  label = "Copy email",
  copiedLabel = "Email copied",
  className = "ghost-link",
}: {
  email: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
      setStatus("copied");
    } catch {
      const field = document.createElement("textarea");
      field.value = email;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      setStatus(document.execCommand("copy") ? "copied" : "manual");
      field.remove();
    }
    window.setTimeout(() => setStatus("idle"), 2400);
  }

  return (
    <button className={className} onClick={handleCopy} type="button">
      {status === "copied" ? copiedLabel : status === "manual" ? email : label}
    </button>
  );
}
