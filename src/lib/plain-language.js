// Plain-language learner glosses: an overlay on the skill list, kept in its own
// file so the ACA standard text stays reproduced verbatim. A gloss restates a
// skill in everyday words for a learner; it is NOT the official standard.

import glosses from '../data/plain-language.json';

export function plainFor(skillId) {
  const g = glosses[skillId];
  return typeof g === 'string' && g.trim() ? g : null;
}
