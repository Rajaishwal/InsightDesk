// SplashScreen.jsx — Brand intro shown once per full page load (i.e. a manual refresh), over the app while it boots.
// White background (the page only faintly visible through it); the colour lives in the navy cards.
// The logo + orbit animation always plays to the end; the splash then fades out as soon as sign-in has loaded
// (capped, so a slow or offline server never keeps it on screen).
import { useEffect, useState } from "react";
import BrandOrbit from "./BrandOrbit";

const INTRO_MS = 2400; // logo draw + orbit icons popping in + wordmark
const MAX_MS   = 4000; // never hold the app longer than this
const FADE_MS  = 450;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function SplashScreen({ ready }) {
  const [introDone, setIntroDone] = useState(false);
  const [timedOut, setTimedOut]   = useState(false);
  const [gone, setGone]           = useState(false);

  useEffect(() => {
    const intro = setTimeout(() => setIntroDone(true), prefersReducedMotion() ? 500 : INTRO_MS);
    const cap   = setTimeout(() => setTimedOut(true), MAX_MS);
    return () => { clearTimeout(intro); clearTimeout(cap); };
  }, []);

  const leaving = introDone && (ready || timedOut);

  // No page scrollbar showing through while the splash covers the screen
  useEffect(() => {
    if (leaving) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { html.style.overflow = prev; };
  }, [leaving]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  if (gone) return null;

  return (
    <div
      role="status"
      aria-label="Loading InsightDesk"
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-white/90 backdrop-blur-xl transition-opacity ease-out"
      style={{ opacity: leaving ? 0 : 1, transitionDuration: `${FADE_MS}ms`, pointerEvents: leaving ? "none" : "auto" }}
    >
      <div
        className="flex flex-col items-center transition-transform ease-out"
        style={{ transform: leaving ? "scale(1.06)" : "scale(1)", transitionDuration: `${FADE_MS}ms` }}
      >
        {/* White background — only the cards carry the navy colour */}
        <BrandOrbit onLight className="max-sm:scale-[0.85]" />

        <div className="splash-up mt-4 text-center" style={{ animationDelay: "1.2s" }}>
          <div className="text-[2.1rem] font-extrabold leading-none tracking-tight">
            <span className="text-blue-600">Insight</span><span className="text-amber-400">Desk</span>
          </div>
          <p className="mt-3 text-[0.66rem] font-semibold uppercase tracking-[0.3em] text-gray-400">Track Your Performance</p>
        </div>
      </div>
    </div>
  );
}
