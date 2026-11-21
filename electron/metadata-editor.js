const path = require('path');
const { createNodeBackend } = require('./tag-node-backend');

// Tags are read and written by the Node backend (tag-node-backend.js, with node-taglib-sharp through tag-lib-adapter.js). Every call answers
// { success, ... } and, when it fails, an `error` the person can read and a `reason` the callers can test: 'no-library' (the package did not
// load), 'unsupported' (this kind of file is not handled), 'verify-failed' (the saved file did not match the edit; the original was restored)
// or 'failed' (anything else; the original was restored).
function fileUrlToPath(fileUrl){if(!fileUrl)return ''; try{const u=new URL(fileUrl);let p=decodeURIComponent(u.pathname);if(process.platform==='win32'&&/^\/[A-Za-z]:/.test(p))p=p.slice(1);return p.replace(/\//g,path.sep);}catch(e){return String(fileUrl).replace(/^file:\/\//,'').replace(/\//g,path.sep);}}
const { getAudioMetadata, saveAudioMetadata, saveAudioCover } = createNodeBackend({ toPath: fileUrlToPath });
// The first read of a session loads the tag library (a large package): done a few seconds after start, in the background, so the first time the
// Metadata editor opens it does not wait for that. A package that does not load is not an error here: the first call reports it.
function warmUpTagBackend() {
    return Promise.resolve()
        .then(() => require('./tag-lib-adapter').loadLibrary())
        .catch(() => {});
}

module.exports = { getAudioMetadata, saveAudioMetadata, saveAudioCover, fileUrlToPath, warmUpTagBackend };
