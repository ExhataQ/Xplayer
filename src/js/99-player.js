// ==============================================================================
// BUILD DATA
// ==============================================================================
// The only classic script on the page. The build writes it as player.js with the two placeholders below
// filled in; core/build-data.js reads it. It uses nothing from any other file.
//
// SONGS_DATA is only the fallback list for a plain browser and the tests: the app's library comes from
// songs.json through the main process.
window.__buildData = {
    songs: {{SONGS_DATA}},
    placeholderImage: '{{PLACEHOLDER_IMAGE}}'
};
