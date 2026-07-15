// The single source for every claim this app makes about what it is and whose
// work it shows. These strings were previously duplicated between Attribution.jsx
// and pdf.js and had already drifted apart — the component named the January 2025
// verification and the exported PDF still claimed only rev. 5/1/2024. Two copies
// of one fact is one copy too many. Import from here; do not re-type.

// Whose work the criteria are. Update the revision here and every surface follows.
export const ACA_ATTRIBUTION =
  "Skills standards and assessment criteria © American Canoe Association, reproduced from the ACA Coastal Kayaking curriculum (rev. 5/1/2024) and verified against the ACA's CKC January 2025 assessor's guides for L2–L5. Where this app and the current official guides differ, the guides govern.";

// What the app is, and what it is not.
export const INDEPENDENCE_NOTICE =
  'This is an independent, non-commercial tool built by an ACA instructor to conduct assessments to the published standard. It is not published or endorsed by the ACA.';

// The app is a ledger: the assessor decides, the app writes down what they
// decided. This goes on the ASSESSOR's export, because that PDF is handed to the
// paddler — and the paddler, not the assessor, is the one who might read
// "ACA Assessment" as a certificate.
export const LEDGER_NOTICE =
  "Assessor's record. ACA certification is issued by the ACA through its own process; this document is not a certificate and confers no ACA level.";

// The self-assessment export has no assessor behind it at all, so it needs to
// deny more than the ledger notice does.
export const SELF_ASSESSMENT_NOTICE =
  "SELF-ASSESSMENT — not an ACA assessment. This is the paddler's own record of their skills against the published standards. It was not conducted or verified by a certified ACA assessor and confers no ACA certification or level.";
