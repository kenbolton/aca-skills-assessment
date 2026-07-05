import { jsPDF } from 'jspdf';
import { paddlerSummary } from './summary.js';

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
  doc.text(`ACA ${summary.levelName} — ${summary.name}`, marginX, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const dateLine = new Date(session.createdAt).toLocaleString();
  const metaLine = session.location ? `${dateLine} · ${session.location}` : dateLine;
  doc.text(metaLine, marginX, y);
  y += 20;

  const countsLine = summary.scale
    .map(opt => `${opt.label}: ${summary.counts[opt.value] ?? 0}`)
    .join('   ') + `   Unrated: ${summary.unrated}`;
  doc.setFont('helvetica', 'bold');
  doc.text(countsLine, marginX, y);
  y += 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  ensureRoom(1);
  doc.text('Did not meet the standard:', marginX, y);
  y += 18;

  doc.setFontSize(11);
  if (summary.belowItems.length === 0) {
    doc.setFont('helvetica', 'normal');
    ensureRoom(1);
    doc.text('None — all assessed skills met or exceeded.', marginX, y);
    y += 16;
  } else {
    for (const item of summary.belowItems) {
      doc.setFont('helvetica', 'bold');
      ensureRoom(1);
      doc.text(`• ${item.name} (${item.category})`, marginX, y);
      y += 15;

      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(item.feedback || '(no feedback)', 480);
      ensureRoom(wrapped.length);
      doc.text(wrapped, marginX + 12, y);
      y += wrapped.length * 14 + 6;
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
      const option = summary.scale.find(o => o.value === item.rating);
      const label = option ? option.label : String(item.rating);
      doc.setFont('helvetica', 'bold');
      ensureRoom(1);
      doc.text(`• ${item.name}: ${label}`, marginX, y);
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

  doc.save(`aca-${session.levelId}-${safeName(summary.name)}.pdf`);
}
