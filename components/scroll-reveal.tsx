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
    if (!node) {
      return;
    }

    let timer = 0;
    const show = () => {
      node.classList.add("is-visible");
      if (!stagger) {
        return;
      }

      node
        .querySelectorAll<HTMLElement>(".reveal-child")
        .forEach((el, index) => {
          window.setTimeout(() => {
            el.classList.add("is-visible");
          }, index * 45);
        });
    };

    if (delay > 0) {
      timer = window.setTimeout(show, delay);
    } else {
      show();
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [delay, stagger]);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
