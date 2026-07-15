import { paddlerSummary } from './summary.js';
import { getActionPlan, conditionsSummary } from './session.js';
import {
  ACA_ATTRIBUTION, INDEPENDENCE_NOTICE, LEDGER_NOTICE, SELF_ASSESSMENT_NOTICE,
} from './notices.js';

// Re-exported for the existing test import path; notices.js is the source.
export { SELF_ASSESSMENT_NOTICE };

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

  // Footer on the exported record: whose work the criteria are, what this tool is,
  // and — for an assessor's export — that the document is a ledger, not a
  // certificate. The paddler receives this PDF; the assessor knows what it is, but
  // the paddler is the one who might read "ACA Assessment" as a credential.
  // Wording comes from lib/notices.js so it cannot drift from the in-app footer.
  ensureRoom(4);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120);
  const footer = doc.splitTextToSize(
    [session.selfAssessment ? null : LEDGER_NOTICE, ACA_ATTRIBUTION, INDEPENDENCE_NOTICE]
      .filter(Boolean).join(' '),
    480,
  );
  doc.text(footer, marginX, Math.min(y + 14, pageBottom + 24));
  doc.setTextColor(0);

  doc.save(`aca-${summary.target}-${safeName(summary.name)}.pdf`);
}
