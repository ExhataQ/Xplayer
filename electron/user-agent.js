'use strict';

// Sent with every MusicBrainz, ListenBrainz and LRCLIB request. These services ask for the app's name and version and a way to reach
// its authors (a web address is accepted), and may block clients that do not give one. The version is the one in package.json.
// Tests copy electron/ to a folder without package.json; a missing file must not stop the app from starting.
const version = (() => {
    try {
        return require('../package.json').version;
    } catch {
        return 'unknown';
    }
})();

const PROJECT_URL = 'https://github.com/ExhataQ/Xplayer';
const USER_AGENT = `Xplayer/${version} ( ${PROJECT_URL} )`;

module.exports = { USER_AGENT, PROJECT_URL };
