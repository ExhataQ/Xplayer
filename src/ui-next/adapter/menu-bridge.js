// menu-bridge: the engine and desktop calls the application menu needs that actions.js does not have yet.
// Dialogs are the engine's own (js/ui/06b-modals.js); window calls go through the desktop bridge. Nothing here reads state.
//
//   showNewPlaylist() / showNewFolder() / showPlayFromUrl()   open the engine's dialogs (false when the engine is not ready)
//   openFileDialog() / openFolderDialog()                      File > Open file / Open folder: choose, then play as a new queue
//   openLightPlayer(view)                                      the Mini Player or the Quick Player ('mini' | 'quick'), following this app
//   toggleShuffle() / toggleRepeat()                           press the player's own buttons, so their state and tooltips follow
//   windowCan(name) -> boolean                                  true when this build has window.<name> (minimizeApp, maximizeApp, closeApp)
//   windowDo(name)                                              run it; false when it is missing

import { engineAction } from './engine-api.js';
import { playerPart } from './player-parts.js';

export const showNewPlaylist = () => engineAction('showCreatePlaylistDialog');
export const showNewFolder = () => engineAction('showCreateFolderDialog');
export const showPlayFromUrl = () => engineAction('showAddLinkDialog');
export const openFileDialog = () => engineAction('chooseAndPlayFiles', 'files');
export const openFolderDialog = () => engineAction('chooseAndPlayFiles', 'folder');
export const openLightPlayer = (view) => engineAction('showCurrentSongInLightPlayer', view);

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
