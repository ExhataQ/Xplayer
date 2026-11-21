// The limits line in the chat. The numbers are OpenRouter's own (GET /key through "Check my limits"): for free models how many of
// today's free requests are used and when the day resets (00:00 UTC), for paid models the credit used. Nothing is counted here.
// It refreshes when the chat opens, after each request and when the day resets, never more than once every few seconds.

import { el } from '../../components/index.js';
import { keyInfo } from '../../adapter/ai-bridge.js';

export function formatWait(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    return m ? `${m}m ${String(total % 60).padStart(2, '0')}s` : `${total}s`;
}

const isFree = (model) => model === 'openrouter/free' || String(model).endsWith(':free');
const nextMidnightUtc = (t) => Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate() + 1);
const money = (n) => `$${Number(n).toFixed(Number(n) < 1 ? 4 : 2)}`;

/** getModel() returns the model now chosen. Returns { el, refresh() }; the clock stops by itself when the line leaves the page. */
export function createLimitsMeter(getModel) {
    const line = el('p', { class: 'ai-limits', role: 'status', hidden: true });
    let info = null;
    let last = 0;
    let timer = null;
    let resetAt = 0;

    function draw() {
        if (!info) return;
        const free = info.free_model_daily_requests;
        if (isFree(getModel()) && free && Number.isFinite(free.limit)) {
            resetAt = nextMidnightUtc(Date.now());
            const left = Math.max(0, free.remaining ?? free.limit - free.used);
            line.textContent = `Free requests today: ${free.used} of ${free.limit} used, ${left} left · resets in ${formatWait(resetAt - Date.now())}`;
            line.dataset.level = left === 0 ? 'out' : left <= free.limit * 0.2 ? 'low' : 'ok';
        } else {
            resetAt = 0;
            const remaining = info.limit_remaining;
            line.textContent = `Credit used: ${money(info.usage || 0)}${remaining === null || remaining === undefined ? '' : ` · ${money(remaining)} left`}`;
            line.dataset.level = 'ok';
        }
        line.hidden = false;
    }

    async function refresh(force = false) {
        if (!force && Date.now() - last < 5000) return draw();
        last = Date.now();
        try {
            const result = await keyInfo();
            info = result && result.ok ? result.info : null;
        } catch (error) {
            info = null;
        }
        if (!info) line.hidden = true;
        draw();
        if (!timer && line.isConnected) {
            timer = setInterval(() => {
                if (!line.isConnected) {
                    clearInterval(timer);
                    timer = null;
                    return;
                }
                if (resetAt && Date.now() >= resetAt) refresh(true);
                else draw();
            }, 1000);
        }
    }

    return { el: line, refresh };
}
