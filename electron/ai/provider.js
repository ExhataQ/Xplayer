// The AI provider interface and its OpenRouter implementation (plan PE-02).
//
// A provider is any object with:
//   chat({ model, messages, schema?, schemaName?, maxTokens?, temperature?, reasoning?, signal? })   reasoning: 'low' | 'medium' | 'high' | null
//        -> { content, model, usage }       (model = the one that actually answered)
//   listModels()  -> [{ id, name, contextLength, free, structured }]
//   keyInfo()     -> raw key/quota info or null
// Failures throw AiError with a `code` the UI can turn into a notification.
//
// Calls are made from the main process only. Free models answer 429 often and a failed request
// still counts against the daily free quota, so retries are few and bounded.

const BASE_URL = 'https://openrouter.ai/api/v1';

class AiError extends Error {
    constructor(code, message, extra = {}) {
        super(message);
        this.name = 'AiError';
        this.code = code;
        Object.assign(this, extra);
    }
}

const sleepReal = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function errorForStatus(status, body) {
    const detail = body && body.error && body.error.message ? `: ${body.error.message}` : '';
    if (status === 401 || status === 403) return new AiError('auth', `The key was refused (HTTP ${status})${detail}`, { status });
    if (status === 402) return new AiError('payment', `The account has no credit for this request${detail}`, { status });
    if (status === 429) return new AiError('rate-limit', `Too many requests, or the free daily limit is used${detail}`, { status });
    if (status === 400 || status === 404 || status === 422) return new AiError('bad-request', `The request was refused (HTTP ${status})${detail}`, { status });
    return new AiError('server', `The AI service failed (HTTP ${status})${detail}`, { status });
}

function createOpenRouterProvider({
    getKey,
    fetchImpl = (...args) => fetch(...args),
    sleep = sleepReal,
    maxRetries = 2,
    baseUrl = BASE_URL,
    referer = 'https://github.com/ExhataQ/Xplayer',
    appTitle = 'Xplayer'
}) {
    async function request(method, endpoint, body, signal) {
        const key = getKey();
        if (!key) throw new AiError('no-key', 'No OpenRouter key is set');
        let lastError = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (signal && signal.aborted) throw new AiError('cancelled', 'Cancelled');
            let response;
            try {
                response = await fetchImpl(`${baseUrl}${endpoint}`, {
                    method,
                    signal,
                    headers: {
                        Authorization: `Bearer ${key}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': referer,
                        'X-Title': appTitle
                    },
                    body: body ? JSON.stringify(body) : undefined
                });
            } catch (error) {
                if (signal && signal.aborted) throw new AiError('cancelled', 'Cancelled');
                lastError = new AiError('network', `Could not reach OpenRouter: ${error && error.message}`);
                if (attempt < maxRetries) {
                    await sleep(500 * 2 ** attempt);
                    continue;
                }
                throw lastError;
            }
            let json = null;
            try {
                json = await response.json();
            } catch (e) {
                // An empty or non-JSON body is handled through the status below.
            }
            if (response.ok) return json;
            lastError = errorForStatus(response.status, json);
            if (response.status === 429) {
                // OpenRouter sends X-RateLimit-Reset (milliseconds since 1970) with its own 429s: say when it is over.
                const reset = Number(response.headers && response.headers.get && response.headers.get('x-ratelimit-reset'));
                if (Number.isFinite(reset) && reset > Date.now()) lastError.resetAt = reset;
            }
            const retryable = response.status === 429 || response.status >= 500;
            // One retry for 429 (it counts against the free quota), up to maxRetries for server errors.
            const limit = response.status === 429 ? Math.min(1, maxRetries) : maxRetries;
            if (!retryable || attempt >= limit) throw lastError;
            const header = Number(response.headers && response.headers.get && response.headers.get('retry-after'));
            await sleep(Number.isFinite(header) && header > 0 ? Math.min(header * 1000, 10000) : 1000 * 2 ** attempt);
        }
        throw lastError;
    }

    async function chat({ model, messages, schema, schemaName = 'xplayer_reply', maxTokens = 2000, temperature = 0.2, reasoning = null, signal }) {
        const body = { model, messages, max_tokens: maxTokens, temperature };
        const effort = reasoning === 'low' || reasoning === 'high' || reasoning === 'medium' ? reasoning : null;
        if (effort) body.reasoning = { effort };
        if (schema) {
            // strict is off: the action arguments are free-form objects, and the app checks the reply itself.
            body.response_format = { type: 'json_schema', json_schema: { name: schemaName, strict: false, schema } };
            body.provider = { require_parameters: true };
        }
        let json;
        try {
            json = await request('POST', '/chat/completions', body, signal);
        } catch (error) {
            if (error.code !== 'bad-request') throw error;
            // The request was refused. A model that has no reasoning setting is the first suspect (require_parameters rules out every
            // endpoint that lacks one): drop it. Then, some endpoints cannot do json_schema: ask only for "some JSON".
            if (body.reasoning) {
                delete body.reasoning;
                try {
                    json = await request('POST', '/chat/completions', body, signal);
                } catch (second) {
                    if (second.code !== 'bad-request' || !schema) throw second;
                }
            }
            if (!json) {
                if (!schema) throw error;
                body.response_format = { type: 'json_object' };
                json = await request('POST', '/chat/completions', body, signal, true);
            }
        }
        const choice = json && json.choices && json.choices[0];
        const content = choice && choice.message && choice.message.content;
        if (typeof content !== 'string' || !content.trim()) throw new AiError('bad-reply', 'The model returned an empty reply');
        return { content, model: json.model || model, usage: json.usage || null };
    }

    async function listModels() {
        const json = await request('GET', '/models');
        const rows = (json && json.data) || [];
        return rows.map((m) => {
            const params = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
            const pricing = m.pricing || {};
            return {
                id: m.id,
                name: m.name || m.id,
                contextLength: m.context_length || 0,
                free: String(m.id).endsWith(':free') || (Number(pricing.prompt) === 0 && Number(pricing.completion) === 0),
                structured: params.includes('structured_outputs') || params.includes('response_format')
            };
        });
    }

    async function keyInfo() {
        const json = await request('GET', '/key');
        return (json && json.data) || null;
    }

    return { chat, listModels, keyInfo };
}

module.exports = { createOpenRouterProvider, AiError, BASE_URL };
