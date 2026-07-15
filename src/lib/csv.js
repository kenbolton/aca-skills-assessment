import { skillById, optionFor } from './session.js';
import { skillLabel } from './skills.js';
import { landingFor } from './landing.js';

function esc(field) {
  const s = String(field ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The ACA CMS Paddler Evaluation form records only "Meets" or "Below" for each
// skill (Exceeds collapses to Meets; detail goes in the comments). "Did Not
// Observe" and unrated skills have nothing to enter, so they map to blank.
const CMS_GRADE = { meets: 'Meets', exceeds: 'Meets', pass: 'Meets', below: 'Below', no: 'Below', l1: 'Below' };
export function cmsGrade(rating) { return CMS_GRADE[rating] || ''; }

export function sessionToCsv(session) {
  const paddlerById = new Map(session.paddlers.map(p => [p.id, p]));
  const landingById = new Map(session.paddlers.map(p => [p.id, landingFor(session, p.id).landing]));
  const self = !!session.selfAssessment;
  const rows = [['Type', 'Paddler', 'Target', 'Landing', 'Category', 'Skill', 'Optional', 'Rating', 'CMS Grade', 'Feedback']];
  for (const r of session.results) {
    const p = paddlerById.get(r.paddlerId) || { name: r.paddlerId, target: '' };
    const sk = skillById(session, r.skillId) || { category: '', standard: r.skillId, optional: false };
    const opt = sk.category !== undefined ? optionFor(session, sk, r.rating) : null;
    // The CMS form is only about required (assessed) skills; optional developing
    // skills never carry a CMS grade.
    //
    // A SELF-assessment never carries one either. The CMS Paddler Evaluation form
    // is a certified assessor's official record; emitting CMS-shaped grades from a
    // paddler's self-review invites them to be transcribed into the ACA's system
    // as if an assessor had made them. Leaving the column blank is the safeguard.
    const cms = (self || sk.optional) ? '' : cmsGrade(r.rating);
    rows.push([self ? 'Self-assessment' : 'Assessment', p.name, p.target, landingById.get(r.paddlerId) || '', sk.category, skillLabel(sk), sk.optional ? 'yes' : '', opt ? opt.label : '', cms, r.feedback]);
  }
  return rows.map(cols => cols.map(esc).join(',')).join('\n');
}
