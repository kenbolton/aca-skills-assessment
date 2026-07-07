// src/components/CompetencyRadars.jsx
// All of a paddler's competency radars as small multiples, one per category.
import { competencyRadars } from '../lib/competency.js';
import { CompetencyRadar } from './CompetencyRadar.jsx';

export function CompetencyRadars({ session, paddlerId }) {
  const groups = competencyRadars(session, paddlerId);
  if (!groups.length) return null;
  return (
    <div className="competency-radars">
      {groups.map(g => (
        <CompetencyRadar key={g.category} category={g.category} levels={g.levels} />
      ))}
    </div>
  );
}
