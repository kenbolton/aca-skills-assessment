// A plain-language privacy statement. The app's core promise is that paddler
// data never leaves the device; the only telemetry is anonymous, cookieless
// page/event counts on the public site.
export const PRIVACY_TEXT = [
  'Your assessments stay on your device. Nothing you enter about a paddler is uploaded anywhere.',
  'This site keeps anonymous, cookieless counts of page visits, installs, and assessments started — no personal data, no cookies, and it honors your browser’s Do-Not-Track setting.',
];

export function PrivacyStatement() {
  return (
    <section className="privacy-statement" aria-label="Privacy">
      <h2>Privacy</h2>
      {PRIVACY_TEXT.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}
