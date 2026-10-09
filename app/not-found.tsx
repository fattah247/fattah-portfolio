import Link from "next/link";
import type { Metadata } from "next";
import { ChevronIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Not found" };

/** An unknown address still lands inside the environment, with a way back to the work. */
export default function NotFound() {
  return (
    <main className="not-found-screen">
      <section className="not-found-panel" aria-labelledby="not-found-title">
        <p className="not-found-bar">Not found</p>
        <div className="not-found-body">
          <h1 id="not-found-title">Nothing is filed at this address</h1>
          <p>The link may be old or mistyped. The three engineering cases and the side projects are in Projects.</p>
          <div className="not-found-actions">
            <Link className="home-action" href="/#selected-work">Open Projects <ChevronIcon direction="right" /></Link>
            <Link className="home-action" href="/">Home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
