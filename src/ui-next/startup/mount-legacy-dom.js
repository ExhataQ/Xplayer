// Builds the engine's elements before js/main.js runs (module scripts run in document order after parsing).
// This was an inline <script type="module"> in index.html; the page's Content-Security-Policy allows scripts from files only.
import { mountLegacyDom } from '../adapter/legacy-dom-adapter.js';

mountLegacyDom();
