import { jsPDF } from 'jspdf';
import { paddlerSummary } from './summary.js';
import { getActionPlan } from './session.js';

const LANDING_LABEL = {
  L2: 'Level 2',
  L1: 'Level 1',
  did_not_meet_L1: 'Did not meet Level 1',
  pending: (pendingCount) => `Pending (${pendingCount} not yet assessed)`
};

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function downloadPaddlerPdf(session, paddlerId) {
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
  doc.text(`ACA Assessment — ${summary.name}`, marginX, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const dateLine = new Date(session.createdAt).toLocaleString();
  const metaLine = session.location ? `${dateLine} · ${session.location}` : dateLine;
  doc.text(metaLine, marginX, y);
  y += 20;

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

  doc.save(`aca-${summary.target}-${safeName(summary.name)}.pdf`);
}
