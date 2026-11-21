'use strict';

// Every window of the app loads its page from disk (file://), and frame-src is 'none' in the CSP, so a message that arrives from any other
// kind of page is not ours: refuse it before a handler runs. This is one more layer behind the CSP; it does not replace escaping the page's HTML.

function senderUrl(event) {
    try {
        const frame = event && event.senderFrame;
        if (frame && typeof frame.url === 'string') return frame.url;
        return event && event.sender && typeof event.sender.getURL === 'function' ? event.sender.getURL() : '';
    } catch (_) {
        return '';
    }
}

// An event with no page url at all (a destroyed frame, or the fake event of a test) is let through: Electron always gives a live page's url, so
// only a page that says it is not ours is refused.
function isTrustedSender(event) {
    const url = senderUrl(event);
    return url === '' || /^file:\/\//i.test(url);
}

/** Makes ipcMain.handle and ipcMain.on answer only the app's own pages. Call once, before any handler is registered. */
function guardIpc(ipcMain, log = () => {}) {
    const handle = ipcMain.handle.bind(ipcMain);
    const on = ipcMain.on.bind(ipcMain);
    const refuse = (channel, event) => log(`[ipc] refused ${channel} from ${senderUrl(event) || 'an unknown page'}`);

    ipcMain.handle = (channel, listener) =>
        handle(channel, (event, ...args) => {
            if (isTrustedSender(event)) return listener(event, ...args);
            refuse(channel, event);
            throw new Error('Not allowed from this page');
        });
    ipcMain.on = (channel, listener) =>
        on(channel, (event, ...args) => {
            if (isTrustedSender(event)) return listener(event, ...args);
            refuse(channel, event);
            event.returnValue = null; // a sendSync caller must not wait forever
        });
    return ipcMain;
}

module.exports = { guardIpc, isTrustedSender };
