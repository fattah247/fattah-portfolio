"use client";

import { useState } from "react";
import { useSound } from "./sound-provider";

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
  const { play } = useSound();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
      setStatus("copied");
      play("ui.copied");
    } catch {
      const field = document.createElement("textarea");
      field.value = email;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      setStatus(copied ? "copied" : "manual");
      if (copied) play("ui.copied");
      field.remove();
    }
    window.setTimeout(() => setStatus("idle"), 2400);
  }

  return (
    <>
      <button className={className} onClick={handleCopy} type="button">
        {status === "copied" ? copiedLabel : status === "manual" ? email : label}
      </button>
      <span className="sr-only" role="status">{status === "copied" ? copiedLabel : status === "manual" ? `Copy unavailable. Email: ${email}` : ""}</span>
    </>
  );
}
