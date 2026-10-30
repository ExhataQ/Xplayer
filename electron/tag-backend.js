'use strict';

// Which backend reads and writes tags (task PD-01, decision DP7). 'auto' (the default) tries the Node backend and uses the
// Python one when Node cannot do the job: the package is not installed, the file type is not handled, the written file did not
// verify (and was restored), or the Node backend failed. 'node' and 'python' use one only; XPLAYER_TAG_BACKEND picks the mode.
// When neither works, the answer is the one that tells the person what to do: Python's "install Python/mutagen" while the Node
// library is missing, and Node's own error once it ran and failed and Python is not there either.

const NAMES = ['getAudioMetadata', 'saveAudioMetadata', 'saveAudioCover'];

function createTagBackend({ node, python, mode = 'auto' }) {
    const chosen = ['node', 'python'].includes(mode) ? mode : 'auto';
    const out = {};
    for (const name of NAMES) {
        out[name] = async (...args) => {
            if (chosen === 'python') return python[name](...args);
            const fromNode = await node[name](...args);
            if (fromNode.success || chosen === 'node' || fromNode.error === 'Audio file not found') return fromNode;
            const fromPython = await python[name](...args);
            if (fromPython.success) return fromPython;
            const pythonMissing = fromPython.reason === 'no-python' || fromPython.reason === 'no-mutagen';
            return pythonMissing && fromNode.reason !== 'no-library' ? fromNode : fromPython;
        };
    }
    return out;
}

module.exports = { createTagBackend };
