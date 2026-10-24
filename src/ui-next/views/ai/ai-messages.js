// What the person reads when the AI engine answers with an error code (electron/ai/provider.js, planner.js, translate.js, ipc.js).
// One place, so the chat, the settings page and the shuffle command say the same thing.

const TEXT = {
    disabled: 'AI is turned off. Turn it on in Settings.',
    'privacy-not-accepted': 'Please read what is sent and accept it first (Settings, AI).',
    'no-key': 'There is no OpenRouter key yet. Add yours in Settings, AI.',
    'bad-key': 'That does not look like an OpenRouter key. Copy it again from openrouter.ai.',
    'encryption-unavailable': 'This computer cannot store the key safely, so it was not saved.',
    auth: 'OpenRouter refused the key. Check that it is correct and still active.',
    payment: 'The OpenRouter account has no credit for this model. Pick a free model, or add credit.',
    'rate-limit': 'Too many requests, or the free daily limit is used up. Try again later, or pick another model.',
    network: 'Could not reach OpenRouter. Check the internet connection.',
    server: 'OpenRouter or the model had a problem. Try again in a moment, or pick another model.',
    'bad-request': 'This model could not handle the request. Pick another model.',
    'bad-reply': 'The model sent an empty answer. Try again, or pick another model.',
    'invalid-plan': 'The model did not give a usable plan, even after a second try. Try again, rephrase, or pick another model.',
    'invalid-translation': 'The model did not return every line, even after a second try. Try again or pick another model.',
    'bad-request-text': 'Write what you want in a few words (up to 2,000 characters).',
    'bad-songs': 'The song list could not be read.',
    'bad-lyrics': 'There are no lyrics to translate for this song, or they are too long.',
    'bad-language': 'Write the language as a plain name, for example French.',
    'nothing-to-translate': 'These lyrics have no text lines to translate.',
    'no-lyrics': 'This song has no lyrics to translate.',
    busy: 'Another AI request is still running. Wait for it, or cancel it.',
    cancelled: 'Cancelled.',
    unexpected: 'Something went wrong.'
};

export function explain(result) {
    const base = (TEXT[result && result.error] || TEXT.unexpected) + (result && result.resetAt ? ` The limit resets at ${new Date(result.resetAt).toLocaleTimeString()}.` : '');
    const detail = result && result.details && result.details.length ? ` (${result.details[0]})` : '';
    return base + detail;
}

/** True for the errors that Settings can fix. */
export const needsSettings = (result) => ['disabled', 'privacy-not-accepted', 'no-key'].includes(result && result.error);
