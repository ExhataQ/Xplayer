// ==============================================================================
// STATE FOLDERS
// ==============================================================================
// Open folder, folder navigation and the selected library folders.
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

function setCurrentOpenFolderId(value) {
    currentOpenFolderId = value;
}

function setCurrentOpenFolderName(value) {
    currentOpenFolderName = value;
}

function setFolderNavigationStack(value) {
    folderNavigationStack = value;
}

function setSelectedLibraryFolders(value) {
    selectedLibraryFolders = value;
}
