"use client";

import { useEffect, useRef } from "react";

export function ParallaxBlock({
  children,
  className = "",
  speed = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const offset = (viewportCenter - elementCenter) * speed;
      node.style.transform = `translate3d(0, ${Math.max(-18, Math.min(18, offset))}px, 0)`;
    };

    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      node.style.transform = "";
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [speed]);

  return (
    <div className={className} data-parallax ref={ref}>
      {children}
    </div>
  );
}
