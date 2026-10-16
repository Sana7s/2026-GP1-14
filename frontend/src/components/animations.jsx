/* =====================================================================
   BurnCare — components/animations.jsx
   ---------------------------------------------------------------------
   Small helpers that make things fade in and move while scrolling.
   Used by the Home, About, Guest and Register pages.
   ===================================================================== */

import { useEffect, useRef, useState } from "react";

/* =====================================================================
   3. ANIMATION HELPERS
   ===================================================================== */

// Returns true if the visitor asked their device for less motion
// (an accessibility setting). We then switch animations off.
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// <Reveal> wraps any block so it gently fades and slides up the first time
// it scrolls into view. "delay" (in milliseconds) lets items appear one
// after another instead of all at once.
function Reveal({ as: Tag = "div", className = "", delay = 0, style, children, ...rest }) {
  const ref = useRef(null); // a pointer to the real HTML element
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // No animation wanted (or very old browser)? Show it straight away.
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }

    // IntersectionObserver is a browser tool that tells us when an element
    // enters the screen. When it does, we mark it visible and stop watching.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      {...rest}
      ref={ref}
      // The CSS class "is-visible" triggers the fade-in (see styles.css).
      className={`reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--reveal-delay": `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

// Measures how far the visitor has scrolled through an element and stores
// it as a number from 0 to 1 in the CSS variable "--p". The CSS then uses
// that number to animate things (for example, words lighting up).
function useScrollProgress(ref, compute, reducedValue = 1) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (prefersReducedMotion()) {
      node.style.setProperty("--p", String(reducedValue));
      return undefined;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect(); // element's position on screen
      const value = compute(rect, window.innerHeight);
      // Keep the number between 0 and 1.
      node.style.setProperty("--p", Math.min(1, Math.max(0, value)).toFixed(4));
    };
    // requestAnimationFrame makes sure we update at most once per screen
    // refresh, which keeps scrolling smooth.
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, compute, reducedValue]);
}

// Formulas for useScrollProgress:
// heroProgress: 0 at the top of the page, 1 once the hero is scrolled past.
const heroProgress = (rect) => -rect.top / Math.max(rect.height, 1);
// statementProgress: 0 when the block enters the screen, 1 when it is
// roughly in the middle of the screen.
const statementProgress = (rect, vh) =>
  (vh * 0.88 - rect.top) / (vh * 0.42 + rect.height / 2);

export { prefersReducedMotion, Reveal, useScrollProgress, heroProgress, statementProgress };
