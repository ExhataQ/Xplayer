// Mouse back and forward (task PA-13). The engine's own history (ui/07 pushViewToHistory, used by ui/06k) knows only its lists,
// playlists, albums, artists and settings, so Home, Lyrics, Metadata and the AI chat were skipped or went to the wrong place.
// The shell keeps its own: one entry per place the person was, { view: rail view id, engine: the engine's view name or null }.
//
//   createNavHistory({ read, restore })   read() -> { view, engine } now; restore(entry) shows that place again.
//   record(provisional)  call after the shell shows a view (provisional: an engine switch may follow at once, it replaces the entry)
//   change()             call when the engine's view changed
//   refresh()            call when the engine became ready (the first entry had no engine view yet)
//   back(), forward()    -> true when it moved
//
// The shell views that read their own state (Metadata with unsaved text) may refuse to be left: restore() then returns false
// and the position stays where it was. restore() may also return a Promise of that (the Sync editor asks "Discard Sync?" in a
// dialog that answers later); back() and forward() then return the Promise, and a second press while it waits does nothing.

const LIMIT = 100;

export function createNavHistory({ read, restore }) {
    let entries = [];
    let at = -1;
    let navigating = false;
    let busy = false; // a restore() is running or waiting for an answer
    let provisional = false;

    const same = (a, b) => a && b && a.view === b.view && a.engine === b.engine && a.song === b.song; // song: the song page's id (PB-17)

    function push(entry) {
        if (same(entries[at], entry)) return;
        entries = entries.slice(0, at + 1);
        entries.push(entry);
        if (entries.length > LIMIT) entries.shift();
        at = entries.length - 1;
    }

    function record(isProvisional = false) {
        if (navigating) return;
        push(read());
        provisional = isProvisional;
        if (isProvisional) queueMicrotask(() => { provisional = false; });
    }

    function change() {
        if (navigating) return;
        const now = read();
        if (provisional && entries[at] && entries[at].view === now.view) {
            if (at > 0 && same(entries[at - 1], now)) at -= 1; // the engine went back to the place before: that is the same step
            else entries[at] = now;
            provisional = false;
            return;
        }
        push(now);
    }

    // The engine was not ready when the first place was recorded: write what it is now into the same entry.
    function refresh() {
        if (entries[at]) entries[at] = read();
    }

    function go(step) {
        if (busy) return false; // a view is still asking whether it may be left
        const target = entries[at + step];
        if (!target) return false;
        navigating = true;
        busy = true;
        const finish = (result) => {
            navigating = false;
            busy = false;
            const moved = result !== false; // a restore() that returns nothing moved, as before
            if (moved) at += step;
            return moved;
        };
        let result;
        try {
            result = restore(target);
        } catch (error) {
            console.error('[nav-history] restore failed', error);
            return finish(false);
        }
        if (result && typeof result.then === 'function') {
            return result.then(
                (answer) => finish(answer),
                (error) => {
                    console.error('[nav-history] restore failed', error);
                    return finish(false);
                }
            );
        }
        return finish(result);
    }

    return {
        record,
        change,
        refresh,
        back: () => go(-1),
        forward: () => go(1),
        canBack: () => at > 0,
        canForward: () => at < entries.length - 1
    };
}

// The two mouse buttons the engine also listens to. The engine's handler never sees them: this runs first, in the capture phase.
export function installMouseNavigation(history) {
    const handle = (event) => {
        if (event.button !== 3 && event.button !== 4) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type !== 'mousedown') return;
        if (event.button === 3) history.back();
        else history.forward();
    };
    for (const type of ['mousedown', 'mouseup', 'auxclick']) window.addEventListener(type, handle, true);
}
