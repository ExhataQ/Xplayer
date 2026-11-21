// Keeps the shell's AI status (shell/ai-slots.js) in step with the main process. Call after every change.
import { setAiStatus } from '../../shell/ai-slots.js';
import { getStatus, whenBridgeReady } from '../../adapter/ai-bridge.js';

export async function refreshStatus() {
    await whenBridgeReady();
    try {
        const status = await getStatus();
        setAiStatus(status);
        return status;
    } catch (error) {
        // No desktop bridge (a plain browser) or the call failed: the AI stays off and nothing else breaks.
        setAiStatus({ enabled: false });
        return null;
    }
}
