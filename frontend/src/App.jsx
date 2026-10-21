/* =====================================================================
   BurnCare — App.jsx
   ---------------------------------------------------------------------
   The starting point of the website. It loads the page text, then
   decides which page to show for each web address.

  
   ===================================================================== */

import { useEffect, useState } from "react";
import {
  Route, // Connects one web address (like "/about") to one page
  Routes, // Holds all the Route items and shows the matching one
} from "react-router-dom";
import { DEFAULT_CONTENT } from "./content.js";
import { SiteLayout } from "./components/Layout.jsx";
import HomePage from "./pages/HomePage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import GuestPage from "./pages/GuestPage.jsx";
import PatientEntry from "./pages/PatientEntry.jsx";
import PatientHistory from "./pages/PatientHistory.jsx";
import TrackRecovery from "./pages/TrackRecovery";
import { RegisterChoicePage, RegisterPage } from "./pages/RegisterPages.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";

/* =====================================================================
   2. APP — the starting point of the website
   ===================================================================== */
function App() {
  // "content" holds the page text. It starts as DEFAULT_CONTENT.
  const [content, setContent] = useState(DEFAULT_CONTENT);

  // When the site first opens, ask the Flask server for updated text.
  // If Flask is off, nothing happens and the default text above is shown.
  useEffect(() => {
    let isCurrent = true;

    fetch("/api/site-content")
      .then((response) => {
        if (!response.ok) throw new Error("The content API is unavailable.");
        return response.json();
      })
      .then((data) => {
        // Merge: any field Flask sends replaces the matching default field.
        if (isCurrent) setContent({ ...DEFAULT_CONTENT, ...data });
      })
      .catch(() => {
        // Flask is not running — keep the default text.
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  // Choose which page to show based on the web address.
  return (
    <SiteLayout brandName={content.brandName}>
      <Routes>
        <Route path="/" element={<HomePage content={content} />} />
        <Route path="/about" element={<AboutPage content={content} />} />
        <Route path="/guest" element={<GuestPage />} />
        {/* Register: first choose a role, then fill in that role's form. */}
        <Route path="/register" element={<RegisterChoicePage />} />
        <Route path="/register/patient" element={<RegisterPage role="patient" />} />
        <Route path="/register/staff" element={<RegisterPage role="staff" />} />
        <Route path="/login" element={<ComingSoonPage title="Log in" />} />
        {/* "*" means "any other address" — shows a not-found page. */}
        <Route path="*" element={<ComingSoonPage title="Page not found" />} />
      </Routes>
    </SiteLayout>
  );
}

export default App;
