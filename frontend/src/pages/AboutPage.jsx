/* =====================================================================
   BurnCare 
   ---------------------------------------------------------------------
   The About Us page 
   Everything this page shows is written in this one file:
     - ABOUT_TEXT: the intro paragraph, the vision and the mission
     - TEAM: the supervisor and the four developers (name, role, bio)
   ===================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion, Reveal } from "../components/animations.jsx";

/* =====================================================================
   ABOUT US PAGE TEXT 
   ===================================================================== */
const ABOUT_TEXT = {
  // The page title.
  title: "About BurnCare",

  // The paragraph under the title.
  intro:
    "BurnCare is an AI-assisted burn referral platform. It combines a few key questions, a body map of the burned area and a photo of the burn to recommend whether a burn needs no treatment, can be treated at a local clinic, or should be transferred to a burn unit. It helps anyone who sees a burn first, from family members to healthcare staff, act quickly and with confidence.",

  // The dark "Our Vision" tile.
  vision:
    "A future where every burn patient reaches the right place of care in time, whether the burn happens at home, in a rural community, or far from a specialist burn unit.",

  // The pink "Our Mission" tile.
  mission:
    "To give the public, healthcare staff and first responders a fast and reliable way to decide where a burn should be treated, by combining established referral criteria, burn size estimation and AI photo analysis, so that serious burns reach specialist care and minor burns are treated closer to home.",
};

/* =====================================================================
   TEAM — shown in the "Meet the team" cards (supervisor first)
   ===================================================================== */
const TEAM = [
  {
    id: "supervisor",
    name: "Dr. Lama Alzaben",
    role: "Supervisor & Product Owner",
    bio: "Department of Information Technology, King Saud University. Guides the BurnCare team and sets the product direction.",
  },
  {
    id: 1,
    name: "Sana Aljaber",
    role: "Project Leader & Developer",
    bio: "Leads the BurnCare project and develops the platform and its features.",
  },
  {
    id: 2,
    name: "Lana Alhussaini",
    role: "Scrum Master & Developer",
    bio: "Leads the team's Scrum process and develops the BurnCare platform.",
  },
  {
    id: 3,
    name: "Shatha Alharthi",
    role: "Developer",
    bio: "Software developer on the BurnCare team, building the platform and its features.",
  },
  {
    id: 4,
    name: "Reema Al-Saud",
    role: "Developer",
    bio: "Software developer on the BurnCare team, building the platform and its features.",
  },
];

/* =====================================================================
   6. ABOUT US PAGE
   ===================================================================== */
function AboutPage() {
  return (
    <div className="about-page">
      {/* ---------- INTRO ---------- */}
      <section className="about-hero">
        <h1>{ABOUT_TEXT.title}</h1>
        <p className="about-lead">{ABOUT_TEXT.intro}</p>
      </section>

      {/* ---------- VISION & MISSION: two large tiles ---------- */}
      <section className="purpose-section" aria-label="BurnCare vision and mission">
        <div className="purpose-grid">
          <Reveal as="article" className="purpose-tile purpose-vision">
            <span className="purpose-number" aria-hidden="true">01</span>
            <span className="tile-kicker">01 / Our vision</span>
            <h2>Our Vision</h2>
            <p>{ABOUT_TEXT.vision}</p>
          </Reveal>
          <Reveal as="article" className="purpose-tile purpose-mission" delay={120}>
            <span className="purpose-number" aria-hidden="true">02</span>
            <span className="tile-kicker">02 / Our mission</span>
            <h2>Our Mission</h2>
            <p>{ABOUT_TEXT.mission}</p>
          </Reveal>
        </div>
      </section>

      {/* ---------- TEAM: swipeable cards (supervisor + developers) ---------- */}
      <DeveloperCarousel developers={TEAM} />
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
