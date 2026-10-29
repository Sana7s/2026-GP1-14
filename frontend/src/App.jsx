/* =====================================================================
   BurnCare — App.jsx
   ---------------------------------------------------------------------
   The starting point of the website. It loads the page text, then
   decides which page to show for each web address.
     /patient/...   patient pages (with the patient top bar)
     everything else → public pages inside the normal site layout
   ===================================================================== */

import { useEffect, useState } from "react";
import {
  Navigate, // Sends the visitor on to another address
  Route, // Connects one web address (like "/about") to one page
  Routes, // Holds all the Route items and shows the matching one
} from "react-router-dom";
import { DEFAULT_CONTENT } from "./content.js";
import { SiteLayout } from "./components/Layout.jsx";
import HomePage from "./pages/HomePage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import GuestPage from "./pages/GuestPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import { RegisterChoicePage, RegisterPage } from "./pages/RegisterPages.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import PatientTopBar from "./components/PatientTopBar.jsx";
import PatientHomePage from "./pages/PatientHomePage.jsx";
import PatientProfilePage from "./pages/PatientProfilePage.jsx";
import PatientEntry from "./pages/PatientEntry.jsx"; 
import PatientHistory from "./pages/PatientHistory.jsx"; 
import TrackRecovery from "./pages/TrackRecovery.jsx"; 
import TbsaPage from "./pages/TbsaPage.jsx";
import FirstAidPage from "./pages/FirstAidPage.jsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.jsx";
import ReportPage from "./pages/ReportPage.jsx";
import StaffTopBar from "./components/StaffTopBar.jsx";
import StaffHomePage from "./pages/staff/StaffHomePage.jsx";
import StaffAssessmentPage from "./pages/staff/StaffAssessmentPage.jsx";
import StaffReportsPage from "./pages/staff/StaffReportsPage.jsx";
import StaffReportPage from "./pages/staff/StaffReportPage.jsx";
import StaffConsultationsPage from "./pages/staff/StaffConsultationsPage.jsx";
import StaffProfilePage from "./pages/staff/StaffProfilePage.jsx";
import AdminTopBar from "./components/AdminTopBar.jsx";

/* =====================================================================
   APP — the starting point of the website
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
    <Routes>
      {/* ===== Patient pages: show the top bar, then the page itself ===== */}
      <Route path="/patient" element={<PatientTopBar />}>
        <Route index element={<PatientHomePage />} />
        <Route path="assessment" element={<PatientEntry />} />
        <Route path="reports" element={<PatientHistory />} />
        <Route path="reports/:reportId" element={<ReportPage />} />
        <Route path="recovery" element={<TrackRecovery />} />
        <Route path="chat" element={<ComingSoonPage title="Wound-care chat" />} />
        <Route path="first-aid" element={<FirstAidPage />} />
        <Route path="profile" element={<PatientProfilePage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />
       <Route path="*" element={<ComingSoonPage title="Page not found" />} />

</Route>

      {/* ===== Admin page ===== */}
      <Route path="/admin" element={<AdminTopBar />}>
        <Route index element={<AdminPage />} />
      </Route>


  {/* ===== Healthcare staff pages (/staff/...) ===== */}
      <Route path="/staff" element={<StaffTopBar />}>
        <Route index element={<StaffHomePage />} />
        <Route path="assessment" element={<StaffAssessmentPage />} />
        <Route path="reports" element={<StaffReportsPage />} />
        <Route path="reports/:reportId" element={<StaffReportPage />} />
        <Route path="consultations" element={<StaffConsultationsPage />} />
        <Route path="profile" element={<StaffProfilePage />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Route>

      {/* ===== Public pages: the normal site layout ===== */}
      <Route
        path="*"
        element={
          <SiteLayout brandName={content.brandName}>
            <Routes>
              <Route path="/" element={<HomePage content={content} />} />
              <Route path="/about" element={<AboutPage content={content} />} />
              <Route path="/guest" element={<GuestPage />} />
              <Route path="/tbsa" element={<TbsaPage />} />
              {/* Register: first choose a role, then fill in that role's form. */}
              <Route path="/register" element={<RegisterChoicePage />} />
              <Route path="/register/patient" element={<RegisterPage role="patient" />} />
              <Route path="/register/staff" element={<RegisterPage role="staff" />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              {/* Old addresses of the patient pages → their new place under /patient */}
              <Route path="/patient-entry" element={<Navigate to="/patient/assessment" replace />} />
              <Route path="/patient-history" element={<Navigate to="/patient/reports" replace />} />
              <Route path="/track-recovery" element={<Navigate to="/patient/recovery" replace />} />
              
              {/* "*" means "any other address" — shows a not-found page. */}
              <Route path="*" element={<ComingSoonPage title="Page not found" />} />
            </Routes>
          </SiteLayout>
        }
      />
    </Routes>
  );
}

export default App;