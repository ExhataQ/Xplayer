// The song title and the artist name in the player bar jump to the playing song's place in the Library (the engine's own handlers,
// js/ui/player-bar.js). The engine does that by changing its page, and the shell follows when it does (shell.js, followEngine). Home, Metadata, the
// song page and the AI chat hide the engine's pages, so the shell had nothing to follow: the engine jumped behind them and the screen did not
// change; and when the engine was already on the right page it changed nothing at all and said nothing.
//
// So when one of those views is on screen, the click is held back, the Library is shown first, and then the same click is made again on the same
// element, so the engine does exactly what it always did, now in front of the person. Everywhere else the click is left alone.

const TARGETS = '#player-title, #player-artist';

/**
 * installPlayerJump({ covered, showLibrary }) -> uninstall()
 *   covered()          true when the main view hides the engine's pages (it is not a view that shows one)
 *   showLibrary(after) shows the Library view (the panel as it is) and calls `after` once it is on screen, also after an answer the view asked for
 */
export function installPlayerJump({ covered, showLibrary }) {
    let again = false; // true while the held-back click is being made again
    const onClick = (event) => {
        if (again || event.button !== 0 || !(event.target instanceof Element)) return;
        const part = event.target.closest(TARGETS);
        // Nothing is playing: the engine ignores the click, so there is nowhere to go.
        if (!part || !part.closest('.player-song-info.has-song') || !covered()) return;
        event.stopPropagation();
        event.preventDefault();
        const origin = event.target; // the artist's name inside the artist line carries its own action: the same element gets the click again
        showLibrary(() => {
            if (!origin.isConnected) return;
            again = true;
            try {
                origin.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            } finally {
                again = false;
            }
        });
    };
    window.addEventListener('click', onClick, true); // before the engine's listeners on the title, the artist and the document
    return () => window.removeEventListener('click', onClick, true);
}
