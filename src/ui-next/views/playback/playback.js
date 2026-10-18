// Playback views (tasks C-01 to C-04): the player's controls, the waveform seek bar, the queue and the cover viewer.
// Mounted once by shell/shell.js. Each part is independent: if one cannot start, the others still do and the player
// keeps working, because the engine owns playback and every part here only adds to it.

import { enhanceTransport } from './transport.js';
import { mountSeekWaveform } from './seek-waveform.js';
import { mountQueuePanel } from './queue-panel.js';
import { mountCoverViewer } from './cover-viewer.js';

export function mountPlayback() {
    const parts = [enhanceTransport, mountSeekWaveform, mountQueuePanel, mountCoverViewer];
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
