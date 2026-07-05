import { skillById, optionFor } from './session.js';

export function paddlerSummary(session, paddlerId) {
  // Find the paddler
  const paddler = session.paddlers.find(p => p.id === paddlerId);
  if (!paddler) {
    throw new Error(`Paddler with id ${paddlerId} not found`);
  }

  // Get all results for this paddler
  const paddlerResults = session.results.filter(r => r.paddlerId === paddlerId);

  // Initialize counts object with all scale values set to 0
  const counts = {};
  for (const option of session.scale) {
    counts[option.value] = 0;
  }

  // Process results
  let coreTotal = 0;
  let unrated = 0;
  const belowItems = [];
  let optionalAssessed = 0;
  const optionalItems = [];

  for (const result of paddlerResults) {
    const skill = skillById(session, result.skillId);
    if (!skill) continue;

    const isOptional = skill.optional;

    if (!isOptional) {
      // Core skill
      coreTotal++;

      if (result.rating === null) {
        unrated++;
      } else {
        // Count the rating (guard against a rating value not present in the scale)
        if (result.rating != null && result.rating in counts) counts[result.rating]++;

        // Check if this rating requires feedback
        const option = optionFor(session, result.rating);
        if (option && option.requiresFeedback) {
          belowItems.push({
            skillId: result.skillId,
            name: skill.name,
            category: skill.category,
            rating: result.rating,
            feedback: result.feedback,
          });
        }
      }
    } else {
      // Optional skill
      if (result.rating !== null) {
        optionalAssessed++;
        optionalItems.push({
          skillId: result.skillId,
          name: skill.name,
          category: skill.category,
          rating: result.rating,
          feedback: result.feedback,
        });
      }
    }
  }

  return {
    name: paddler.name,
    levelId: session.levelId,
    levelName: session.levelName,
    scale: session.scale,
    coreTotal,
    counts,
    unrated,
    belowItems,
    optionalAssessed,
    optionalItems,
  };
}
