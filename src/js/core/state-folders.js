// ==============================================================================
// STATE FOLDERS
// ==============================================================================
// Open folder, folder navigation and the selected library folders.
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

export function setCurrentOpenFolderId(value) {
    currentOpenFolderId = value;
}

export function setCurrentOpenFolderName(value) {
    currentOpenFolderName = value;
}

export function setFolderNavigationStack(value) {
    folderNavigationStack = value;
}

export function setSelectedLibraryFolders(value) {
    selectedLibraryFolders = value;
}

// Other files and inline handlers call these by name, so they are registered on window.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        setCurrentOpenFolderId,
        setCurrentOpenFolderName,
        setFolderNavigationStack,
        setSelectedLibraryFolders
    });
}
