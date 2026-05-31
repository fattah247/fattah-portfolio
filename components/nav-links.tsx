"use client";

import { useEffect, useState } from "react";

type NavLink = {
  label: string;
  href: string;
};

export function NavLinks({ links }: { links: NavLink[] }) {
  const [activeHref, setActiveHref] = useState<string>(links[0]?.href ?? "");

  useEffect(() => {
    const sections = links
      .map((link) => {
        const id = link.href.replace("#", "");
        return document.getElementById(id);
      })
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible?.target.id) {
          return;
        }

        setActiveHref(`#${visible.target.id}`);
      },
      {
        rootMargin: "-18% 0px -56% 0px",
        threshold: [0.2, 0.4, 0.6],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [links]);

  return (
    <ul className="flex items-center gap-6 text-sm text-[color:var(--muted)]">
      {links.map((item) => {
        const isActive = item.href === activeHref;

        return (
          <li key={item.href}>
            <a
              aria-current={isActive ? "page" : undefined}
              className={`nav-link ${isActive ? "nav-link-active" : ""}`}
              href={item.href}
            >
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
