// The ready-made messages along the top of the chat box. One tap sends one. "translate" is not text for the model: it runs the lyrics
// translation of the song that is playing (the same as the Translate button in the lyrics bar). The rest are ordinary requests; the
// assistant sees the library, the queue and the playlists with each of them, so none needs to say which songs it means.

export const QUICK_PROMPTS = [
    { id: 'translate', label: 'Translate the song playing', icon: 'languages', run: 'translate' },
    { id: 'about', label: 'Tell me about this song', text: 'Tell me about the song that is playing now: who made it, its mood and what it is about.' },
    { id: 'calm', label: 'Shuffle my queue for a calm evening', text: 'Shuffle my queue for a calm evening' },
    { id: 'moods', label: 'Make playlists by mood', text: 'Make playlists by mood from my library' },
    { id: 'tags', label: 'Fill in missing genres and years', text: 'Fill in missing genres and years' },
    { id: 'folders', label: 'Put my playlists into folders', text: 'Put my playlists into folders by theme' }
];
