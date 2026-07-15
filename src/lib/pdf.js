import { paddlerSummary } from './summary.js';
import { getActionPlan, conditionsSummary } from './session.js';

// Exported so the wording can be tested and reused: it IS the safeguard, not
// decoration. A self-assessment is a paddler's own record — it is not an ACA
// assessment and must not read like one.
export const SELF_ASSESSMENT_NOTICE =
  'SELF-ASSESSMENT — not an ACA assessment. This is the paddler\'s own record of their skills against the published standards. It was not conducted or verified by a certified ACA assessor and confers no ACA certification or level.';

const LANDING_LABEL = {
  L2: 'Level 2',
  L1: 'Level 1',
  did_not_meet_L1: 'Did not meet Level 1',
  pending: (pendingCount) => `Pending (${pendingCount} not yet assessed)`
};

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function downloadPaddlerPdf(session, paddlerId) {
  // jsPDF (and its html2canvas/purify deps) is heavy and only needed on export,
  // so it is loaded on demand — keeping it out of the initial app bundle.
  const { jsPDF } = await import('jspdf');
  const summary = paddlerSummary(session, paddlerId);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 56;
  const pageBottom = 720;
  let y = 56;

  function ensureRoom(lines = 1, lineHeight = 14) {
    if (y + lines * lineHeight > pageBottom) {
      doc.addPage();
      y = 56;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  // A self-assessment must never export a document headed "ACA Assessment". The
  // PDF is the artifact that leaves the app and gets shown to people; unlabelled,
  // it is indistinguishable from a certified assessor's result.
  doc.text(`${session.selfAssessment ? 'ACA Self-Assessment' : 'ACA Assessment'} — ${summary.name}`, marginX, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const dateLine = new Date(session.createdAt).toLocaleString();
  const conditions = conditionsSummary(session);
  const metaLine = [dateLine, session.location, conditions].filter(Boolean).join(' · ');
  const metaWrapped = doc.splitTextToSize(metaLine, 480);
  doc.text(metaWrapped, marginX, y);
  y += metaWrapped.length * 14 + 6;

  if (session.selfAssessment) {
    doc.setFont('helvetica', 'bold');
    const notice = doc.splitTextToSize(SELF_ASSESSMENT_NOTICE, 480);
    ensureRoom(notice.length);
    doc.text(notice, marginX, y);
    y += notice.length * 14 + 6;
    doc.setFont('helvetica', 'normal');
  }

  doc.setFont('helvetica', 'bold');
  let landingLabel;
  if (summary.landing === 'pending') landingLabel = LANDING_LABEL.pending(summary.pendingCount);
  else if (summary.landing === 'meets_level') landingLabel = `Meets ${summary.target} standard`;
  else if (summary.landing === 'below_level') landingLabel = `${summary.belowCount} below ${summary.target} standard`;
  else landingLabel = LANDING_LABEL[summary.landing] || summary.landing;
  doc.text(`Target: ${summary.target}    Landing: ${landingLabel}`, marginX, y);
  y += 20;

  const targetScale = session.scales[summary.target] || [];
  const countsLine = targetScale
    .map(opt => `${opt.label}: ${summary.counts[opt.value] ?? 0}`)
    .join('   ') + `   Unrated: ${summary.unrated}`;
  doc.setFont('helvetica', 'bold');
  doc.text(countsLine, marginX, y);
  y += 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  ensureRoom(1);
  doc.text('Skills to review:', marginX, y);
  y += 18;

  doc.setFontSize(11);
  if (summary.flagged.length === 0) {
    doc.setFont('helvetica', 'normal');
    ensureRoom(1);
    doc.text('None flagged.', marginX, y);
    y += 16;
  } else {
    for (const item of summary.flagged) {
      doc.setFont('helvetica', 'bold');
      ensureRoom(1);
      doc.text(`• ${item.name} (${item.category}) — ${item.ratingLabel}`, marginX, y);
      y += 15;

      if (item.feedback) {
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(item.feedback, 480);
        ensureRoom(wrapped.length);
        doc.text(wrapped, marginX + 12, y);
        y += wrapped.length * 14 + 6;
      }
    }
  }

  if (summary.optionalItems.length) {
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    ensureRoom(1);
    doc.text('Optional (developing) skills assessed:', marginX, y);
    y += 18;

    doc.setFontSize(11);
    for (const item of summary.optionalItems) {
      doc.setFont('helvetica', 'bold');
      ensureRoom(1);
      doc.text(`• ${item.name}: ${item.ratingLabel}`, marginX, y);
      y += 15;

      if (item.feedback) {
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(item.feedback, 480);
        ensureRoom(wrapped.length);
        doc.text(wrapped, marginX + 12, y);
        y += wrapped.length * 14 + 6;
      }
    }
  }

  const actionPlan = getActionPlan(session, paddlerId).trim();
  if (actionPlan) {
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    ensureRoom(1);
    doc.text('Action plan & return recommendation:', marginX, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const wrapped = doc.splitTextToSize(actionPlan, 480);
    ensureRoom(wrapped.length);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 14 + 6;
  }

  // Copyright attribution on the exported record.
  ensureRoom(3);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120);
  const notice = doc.splitTextToSize(
    'Skills standards and assessment criteria © American Canoe Association, reproduced from the ACA Coastal Kayaking curriculum (rev. 5/1/2024). Independent, non-commercial instructor tool; not published or endorsed by the ACA.',
    480,
  );
  doc.text(notice, marginX, Math.min(y + 14, pageBottom + 24));
  doc.setTextColor(0);

  doc.save(`aca-${summary.target}-${safeName(summary.name)}.pdf`);
}
