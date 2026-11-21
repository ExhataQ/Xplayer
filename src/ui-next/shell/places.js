// Places: where a view is inside itself. The shell's Back and Forward (shell/nav-history.js) walk views, and a view with screens of its own
// (Library health: the overview, then one card's list) needs them to walk those too. A view does two things:
//
//   setPlace(host, 'no-cover')    call whenever it shows another screen of its own (null: its first screen). The shell records the step.
//   onGoPlace((place) => ...)     call once when mounted; runs when Back or Forward lands on another place of this same view. Answer the
//                                 function that stops it from leave(). Showing that place must not call anything but setPlace().
//
// A place is a short string the view understands ('' or null is the first screen). The shell stores it in the history entry next to the view
// id, and gives it back as options.place when Back or Forward has to open the view first. See shell/VIEWS.md, "Places".

export const PLACE_CHANGED = 'xplayer:place-changed';
export const PLACE_GO = 'xplayer:go-place';

export function setPlace(host, place) {
    if (place) host.dataset.place = place;
    else delete host.dataset.place;
    window.dispatchEvent(new CustomEvent(PLACE_CHANGED, { detail: place || null }));
}

export function goPlace(place) {
    window.dispatchEvent(new CustomEvent(PLACE_GO, { detail: place || null }));
}

export function onGoPlace(callback) {
    const handler = (event) => callback(event.detail || null);
    window.addEventListener(PLACE_GO, handler);
    return () => window.removeEventListener(PLACE_GO, handler);
}
