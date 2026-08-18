// Build a pre-filled GitHub "new issue" link so a paddler can suggest a Top Tip
// from inside the app. No backend: suggestions land as GitHub issues the
// maintainer triages and keys to the right technique. Online-only, by nature.

const NEW_ISSUE = 'https://github.com/kenbolton/aca-skills-assessment/issues/new';

// The easiest place to suggest a tip — no GitHub account needed. The #top-tips
// channel is where suggestions are gathered.
export const DISCORD_URL = 'https://discord.gg/65QRCEbwX4';

export function suggestTipUrl(skill) {
  const title = skill && skill.name
    ? `Top Tip suggestion: ${skill.name}${skill.level ? ` (${skill.level})` : ''}`
    : 'Top Tip suggestion';
  const context = skill && skill.name
    ? `For: ${skill.name}${skill.level ? ` (${skill.level})` : ''}${skill.skillId ? ` — \`${skill.skillId}\`` : ''}\n\n`
    : '';
  const body =
    `${context}` +
    'Your cue (one short line):\n\n' +
    'When does it land (a beginner? or only in harder conditions)?\n\n' +
    'Anything else — a common mistake it fixes, or where you learned it:\n';
  const q = new URLSearchParams({ labels: 'top-tip', title, body });
  return `${NEW_ISSUE}?${q.toString()}`;
}
