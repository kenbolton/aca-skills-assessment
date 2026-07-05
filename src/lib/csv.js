/**
 * Escape a CSV field according to RFC-4180.
 * Fields containing comma, double-quote, or newline are wrapped in double quotes.
 * Inner double quotes are escaped as two double quotes.
 */
function escapeCsvField(field) {
  if (field == null) return '';
  const str = String(field);
  // Check if field contains comma, double-quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    // Escape inner quotes and wrap in quotes
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert a session to CSV format.
 * Header: Level,Paddler,Category,Skill,Optional,Rating,Feedback
 * One row per result in session.results.
 */
export function sessionToCsv(session) {
  const header = 'Level,Paddler,Category,Skill,Optional,Rating,Feedback';
  const rows = [header];

  for (const result of session.results) {
    // Find paddler name
    const paddler = session.paddlers.find(p => p.id === result.paddlerId);
    const paddlerName = paddler ? paddler.name : '';

    // Find skill
    const skill = session.skills.find(s => s.id === result.skillId);
    const skillName = skill ? skill.name : '';
    const category = skill ? skill.category : '';
    const optional = skill && skill.optional ? 'yes' : '';

    // Find rating label
    let ratingLabel = '';
    if (result.rating != null) {
      const scaleOption = session.scale.find(o => o.value === result.rating);
      if (scaleOption) {
        ratingLabel = scaleOption.label;
      }
    }

    // Build row
    const fields = [
      session.levelName,
      paddlerName,
      category,
      skillName,
      optional,
      ratingLabel,
      result.feedback,
    ];

    // Escape fields and join
    const row = fields.map(escapeCsvField).join(',');
    rows.push(row);
  }

  return rows.join('\n');
}
