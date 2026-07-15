import { ACA_ATTRIBUTION, INDEPENDENCE_NOTICE } from '../lib/notices.js';

// Copyright attribution + a good-faith takedown path. The skills standards and
// assessor-guide criteria shown in this app are the ACA's copyrighted work; this
// is an independent, non-commercial instructor tool, not published by the ACA.
// The wording lives in lib/notices.js so this and the PDF export cannot diverge.
export function Attribution() {
  return (
    <footer className="attribution">
      <p>{ACA_ATTRIBUTION}</p>
      <p>
        {INDEPENDENCE_NOTICE} To request changes or removal, open an issue at{' '}
        <a href="https://github.com/kenbolton/aca-skills-assessment/issues" rel="noreferrer">
          github.com/kenbolton/aca-skills-assessment
        </a>.
      </p>
    </footer>
  );
}
