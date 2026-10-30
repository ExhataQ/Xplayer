// Playback views (tasks C-01 to C-04): the player's controls, the waveform seek bar, the queue, the cover viewer and the right panel's content.
// Mounted once by shell/shell.js. Each part is independent: if one cannot start, the others still do and the player
// keeps working, because the engine owns playback and every part here only adds to it.

import { enhanceTransport } from './transport.js';
import { mountSeekWaveform } from './seek-waveform.js';
import { mountQueuePanel } from './queue-panel.js';
import { mountCoverViewer } from './cover-viewer.js';

// The right panel's content is loaded on its own (a dynamic import), not with the other parts: a static import of a file that is
// missing or has a syntax error stops the whole module graph, and then the app shows no content at all. This way only the panel's
// content is lost and the error is in the console.
function mountRightPanelContent() {
    let stop = null;
    let stopped = false;
    import('./right-panel-content.js')
        .then((module) => {
            if (!stopped) stop = module.mountRightPanelContent();
        })
        .catch((error) => console.error('Playback view mountRightPanelContent could not start:', error));
    return () => {
        stopped = true;
        if (typeof stop === 'function') stop();
    };
}

export function mountPlayback() {
    const parts = [enhanceTransport, mountSeekWaveform, mountQueuePanel, mountCoverViewer, mountRightPanelContent];
    const stops = [];
    for (const start of parts) {
        try {
            stops.push(start());
        } catch (error) {
            console.error(`Playback view ${start.name} could not start:`, error);
        }
    }
    return () => stops.forEach((stop) => typeof stop === 'function' && stop());
}
