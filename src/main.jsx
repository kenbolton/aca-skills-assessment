import { render } from 'preact';
import { App } from './app.jsx';
import { countPageView } from './lib/metrics.js';
import { registerInstallMetric } from './lib/install-metric.js';
import './styles.css';

countPageView();
registerInstallMetric(typeof window !== 'undefined' ? window : undefined);

render(<App />, document.getElementById('app'));
