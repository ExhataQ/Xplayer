'use strict';

// Sent with every MusicBrainz and ListenBrainz request. Both services ask for a real way to reach the app's author in the
// User-Agent and may block clients that do not give one. REPLACE the placeholder address below with a real one.
const USER_AGENT = 'ExhataQ-MusicPlayer/1.0 ( contact: replace-with-your-email@example.com )';

module.exports = { USER_AGENT };
