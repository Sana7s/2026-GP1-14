/* =====================================================================
   BurnCare — components/Chevron.jsx
   ---------------------------------------------------------------------
   
   ===================================================================== */

// The small ">" arrow used after text links.
function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
      <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export { Chevron };
