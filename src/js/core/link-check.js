// The one way a pasted link is checked and described, for Play from URL: the full app's dialog (ui/06b-modals.js) and the Quick Player's
// (ui-next/light/light.js) both use it, and so does the main process's check of a link the Quick asks the full app to play (electron/light-handoff.js
// has its own copy of the rule, kept equal by tools/tests/guards/link-check.test.js).

/** An http(s) link with no spaces, of a sane length. */
export function isHttpLink(text) {
    if (typeof text !== 'string' || !text || text.length > 2048 || /\s/.test(text)) return false;
    try {
        const { protocol } = new URL(text);
        return protocol === 'http:' || protocol === 'https:';
    } catch (e) {
        return false;
    }
}

/** An https link: the only kind the Quick Player can stream itself (the media protocol relays https, nothing else). */
export function isHttpsLink(text) {
    return isHttpLink(text) && new URL(text).protocol === 'https:';
}

export function linkSizeText(bytes) {
    if (!(bytes > 0)) return '';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** "name · size · type", only the parts the server told. Nothing is said when it told nothing. */
export function linkPreviewText(info) {
    if (!info || !info.success) return '';
    return [info.name, linkSizeText(info.size), info.type].filter(Boolean).join(' · ');
}

/** A title for a streamed link: its file name (without the extension), else its host. */
export function linkTitle(link) {
    try {
        const url = new URL(link);
        const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
        return last.replace(/\.[^.]*$/, '') || url.hostname;
    } catch (e) {
        return 'Stream';
    }
}

/**
 * The inside of the Play from URL dialog (the title, the box for the link and the line for its preview), the same for the full app (ui/06b-modals.js,
 * showAddLinkDialog) and the Quick Player (ui-next/light/light.js, openUrlDialog); it is styled by ui-next/views/tools/dialogs.css. The caller
 * gives its own buttons (the full app's carry data-action attributes), as markup.
 */
export function linkDialogHtml(buttonsHtml) {
    return `
        <h3 class="playlist-modal-title">Play from URL</h3>
        <input type="text" id="link-url-input" class="playlist-modal-input" placeholder="Paste URL (e.g. https://example.com/song.mp3)" aria-describedby="link-preview">
        <div id="link-preview" class="link-preview" role="status" aria-live="polite"></div>
        <div class="playlist-modal-buttons" id="link-modal-buttons">${buttonsHtml}
        </div>
    `;
}
