"use client";

const marks = [
  {
    label: "200 OK",
    style: { top: "14%", right: "7%", animationDelay: "0s" },
    drift: "a",
  },
  {
    label: "→",
    style: { top: "58%", right: "3%" , animationDelay: "2.4s" },
    drift: "b",
  },
  {
    label: "p95",
    style: { top: "78%", right: "11%", animationDelay: "1.2s" },
    drift: "c",
  },
  {
    label: "retry",
    style: { top: "32%", left: "1%", animationDelay: "3.6s" },
    drift: "b",
  },
  {
    label: "●",
    style: { top: "86%", left: "3%", animationDelay: "0.8s" },
    drift: "a",
  },
  {
    label: "audit",
    style: { top: "48%", left: "0.5%", animationDelay: "5s" },
    drift: "c",
  },
] as const;

export function AmbientMarks() {
  return (
    <>
      {marks.map((m, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="ambient-mark"
          data-drift={m.drift}
          style={{ ...m.style, animationDelay: m.style.animationDelay }}
        >
          {m.label}
        </span>
      ))}
    </>
  );
}
