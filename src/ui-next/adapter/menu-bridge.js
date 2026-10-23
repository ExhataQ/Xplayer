// menu-bridge (task PA-07): the engine and desktop calls the application menu needs that actions.js does not have yet.
// Dialogs are the engine's own (js/ui/06b-modals.js); window calls go through the desktop bridge. Nothing here reads state.
//
//   showNewPlaylist() / showNewFolder() / showPlayFromUrl()   open the engine's dialogs (false when the engine is not ready)
//   toggleShuffle() / toggleRepeat()                           press the player's own buttons, so their state and tooltips follow
//   windowCan(name) -> boolean                                  true when this build has window.<name> (minimizeApp, maximizeApp, closeApp)
//   windowDo(name)                                              run it; false when it is missing

import { engineAction } from './engine-api.js';
import { playerPart } from './player-parts.js';

export const showNewPlaylist = () => engineAction('showCreatePlaylistDialog');
export const showNewFolder = () => engineAction('showCreateFolderDialog');
export const showPlayFromUrl = () => engineAction('showAddLinkDialog');

export function toggleShuffle() {
    playerPart('shuffle')?.click();
}

export function toggleRepeat() {
    playerPart('repeat')?.click();
}

export const windowCan = (name) => Boolean(window.desktopApi?.supports?.(`window.${name}`));

export function windowDo(name) {
    if (!windowCan(name)) return false;
    window.desktopApi.window[name]();
    return true;
}
