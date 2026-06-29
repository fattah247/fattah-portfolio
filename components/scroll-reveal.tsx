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
    let observer: IntersectionObserver | null = null;
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
          }, index * 60);
        });
    };

    if (!("IntersectionObserver" in window)) {
      show();
      return undefined;
    }

    observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        if (delay > 0) {
          timer = window.setTimeout(show, delay);
        } else {
          show();
        }

        observer?.unobserve(node);
      },
      {
        rootMargin: "0px 0px -14% 0px",
        threshold: 0.16,
      },
    );

    observer.observe(node);

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }

      observer?.disconnect();
    };
  }, [delay, stagger]);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
