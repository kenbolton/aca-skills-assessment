// Build the anonymous, aggregate GoatCounter path for an assessment-started
// event. The L1/L2 combined mode contains a slash, which would create a nested
// path segment, so it is replaced with a dash.
export function startEventPath(level, selfAssessment) {
  return '/start/' + String(level).replace('/', '-') + (selfAssessment ? '/self' : '/group');
}
