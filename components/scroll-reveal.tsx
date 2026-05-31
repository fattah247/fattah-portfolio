"use client";

import { useEffect, useRef } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
}

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  stagger = false,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) {
      node.classList.add("is-visible");
      if (stagger) {
        node
          .querySelectorAll<HTMLElement>(".reveal-child")
          .forEach((el) => el.classList.add("is-visible"));
      }
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const show = () => {
          node.classList.add("is-visible");
          if (stagger) {
            const children = node.querySelectorAll<HTMLElement>(".reveal-child");
            children.forEach((el, i) => {
              window.setTimeout(() => {
                el.classList.add("is-visible");
              }, i * 65);
            });
          }
        };

        if (delay > 0) {
          window.setTimeout(show, delay);
        } else {
          show();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay, stagger]);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
