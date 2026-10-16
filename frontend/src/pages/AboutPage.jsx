/* =====================================================================
   BurnCare — pages/AboutPage.jsx
   ---------------------------------------------------------------------
   The About Us page (address: /about).
   ===================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CONTENT } from "../content.js";
import { prefersReducedMotion, Reveal } from "../components/animations.jsx";

/* =====================================================================
   6. ABOUT US PAGE
   ===================================================================== */
function AboutPage({ content }) {
  // Use up to four developers; fall back to the defaults if Flask sends
  // something that is not a list.
  const developers = Array.isArray(content.developers)
    ? content.developers.slice(0, 4)
    : DEFAULT_CONTENT.developers;

  // The full team: the supervisor first, then the developers.
  const supervisor = content.supervisor?.name ? content.supervisor : DEFAULT_CONTENT.supervisor;
  const team = [supervisor, ...developers];

  return (
    <div className="about-page">
      {/* ---------- INTRO ---------- */}
      <section className="about-hero">
        <h1>About {content.brandName}</h1>
        <p className="about-lead">{content.aboutIntro}</p>
      </section>

      {/* ---------- VISION & MISSION: two large tiles ---------- */}
      <section className="purpose-section" aria-label="BurnCare vision and mission">
        <div className="purpose-grid">
          <Reveal as="article" className="purpose-tile purpose-vision">
            <span className="purpose-number" aria-hidden="true">01</span>
            <span className="tile-kicker">01 / Our vision</span>
            <h2>Our Vision</h2>
            <p>{content.vision}</p>
          </Reveal>
          <Reveal as="article" className="purpose-tile purpose-mission" delay={120}>
            <span className="purpose-number" aria-hidden="true">02</span>
            <span className="tile-kicker">02 / Our mission</span>
            <h2>Our Mission</h2>
            <p>{content.mission}</p>
          </Reveal>
        </div>
      </section>

      {/* ---------- TEAM: swipeable cards (supervisor + developers) ---------- */}
      <DeveloperCarousel developers={team} />
    </div>
  );
}

// Takes a name like "Sana Aljaber" and returns its initials: "SA".
// Titles such as "Dr." are skipped, so "Dr. Lama Alzaben" becomes "LA".
function initialsFor(name, index) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter((part) => part && !/^(dr|prof)\.?$/i.test(part));
  if (!parts.length) return String(index + 1).padStart(2, "0");
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// A row of team cards you can swipe sideways (or move with the arrow buttons).
function DeveloperCarousel({ developers }) {
  const trackRef = useRef(null); // the scrolling row
  const [canPrev, setCanPrev] = useState(false); // can we go left?
  const [canNext, setCanNext] = useState(true); // can we go right?

  // Turn the arrow buttons on/off depending on the scroll position.
  const updateControls = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateControls();
    window.addEventListener("resize", updateControls);
    return () => window.removeEventListener("resize", updateControls);
  }, [updateControls, developers.length]);

  // Scroll the row by exactly one card to the left (-1) or right (+1).
  const scrollByCard = (direction) => {
    const track = trackRef.current;
    const card = track?.querySelector(".developer-card");
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
    track.scrollBy({
      left: direction * (card.offsetWidth + gap),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <section className="developers-section">
      <Reveal className="developers-heading">
        <div>
          <h2>Meet the team</h2>
        </div>
        <span className="team-count">{developers.length} team members</span>
      </Reveal>

      <div
        className="developer-track"
        ref={trackRef}
        onScroll={updateControls}
        tabIndex={0}
        aria-label="Team member profiles"
      >
        {developers.map((developer, index) => (
          <Reveal as="article" className="developer-card" key={developer.id ?? index} delay={index * 90}>
            <div className="developer-top">
              <span className={`developer-avatar developer-avatar-${index + 1}`} aria-hidden="true">
                {initialsFor(developer.name, index)}
              </span>
              <span className="developer-number">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div>
              <p className="developer-role">{developer.role}</p>
              <h3>{developer.name}</h3>
              <p className="developer-bio">{developer.bio}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Left / right arrow buttons. */}
      <div className="carousel-controls">
        <button type="button" className="carousel-button" onClick={() => scrollByCard(-1)} disabled={!canPrev} aria-label="Previous team member">
          <svg viewBox="0 0 12 12" width="13" height="13" aria-hidden="true">
            <path d="M8 2L4 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="carousel-button" onClick={() => scrollByCard(1)} disabled={!canNext} aria-label="Next team member">
          <svg viewBox="0 0 12 12" width="13" height="13" aria-hidden="true">
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export default AboutPage;
