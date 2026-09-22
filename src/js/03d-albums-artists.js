// ==============================================================================
// ALBUMS & ARTISTS
// Split out of 03-storage.js. Derives album/artist groupings from SONGS_DATA.
// ==============================================================================

function getAlbums() {
    const albums = {};
    for (const song of SONGS_DATA) {
        if (!song.album || song.album.trim() === '') continue;
        const albumName = song.album.trim();
        if (!albums[albumName]) {
            albums[albumName] = {
                name: albumName,
                songs: [],
                coverCounts: {},
                largeByCover: {}
            };
        }
        if (!deletedSongIds.has(song.id)) {
            albums[albumName].songs.push(song.id);
        }
        const coverKey = song.cover || '__none__';
        albums[albumName].coverCounts[coverKey] = (albums[albumName].coverCounts[coverKey] || 0) + 1;
        if (song.cover && song.largeCover && !albums[albumName].largeByCover[song.cover]) {
            albums[albumName].largeByCover[song.cover] = song.largeCover;
        }
    }

    const albumList = Object.values(albums).map((album) => {
        let bestCover = '';
        let maxCount = 0;
        for (const [cover, count] of Object.entries(album.coverCounts)) {
            if (cover !== '__none__' && count > maxCount) {
                maxCount = count;
                bestCover = cover;
            }
        }
        return {
            id: generateConsistentId('a', album.name),
            name: album.name,
            songs: album.songs,
            cover: bestCover,
            largeCover: album.largeByCover[bestCover] || bestCover,
            songCount: album.songs.length
        };
    });

    return albumList;
}

function getAlbumSongs(albumId) {
    const albums = getAlbums();
    const album = albums.find((a) => a.id === albumId);
    if (!album) return [];
    const songs = filterDeletedSongs(album.songs.map((id) => getSongById(id)));
    songs.sort((a, b) => {
        const trackA = parseInt(a.track) || 0;
        const trackB = parseInt(b.track) || 0;
        if (trackA > 0 && trackB > 0) return trackA - trackB;
        if (trackA > 0 && trackB === 0) return -1;
        if (trackA === 0 && trackB > 0) return 1;
        return (a.title || '').localeCompare(b.title || '');
    });
    return songs;
}

function getArtistNamesForSong(song) {
    if (!song || !song.artist) return [];
    const raw = song.artist;
    let pieces = [];
    if (Array.isArray(raw)) {
        for (const entry of raw) {
            pieces.push(...String(entry).split(/[;/]/));
        }
    } else {
        pieces = String(raw).split(/[;/]/);
    }
    pieces = pieces.map((s) => s.trim()).filter((s) => s !== '');
    const seen = new Set();
    const result = [];
    for (const name of pieces) {
        if (name === 'Unknown Artist') continue;
        if (seen.has(name)) continue;
        seen.add(name);
        result.push(name);
    }
    return result;
}

function getArtists() {
    const artists = {};
    for (const song of SONGS_DATA) {
        const names = getArtistNamesForSong(song);
        for (const artistName of names) {
            if (!artists[artistName]) {
                artists[artistName] = {
                    name: artistName,
                    songs: []
                };
            }
            if (!deletedSongIds.has(song.id)) {
                artists[artistName].songs.push(song.id);
            }
        }
    }

    const artistList = Object.values(artists).map((artist) => {
        const sortedSongs = artist.songs
            .map((id) => getSongById(id))
            .filter((s) => s)
            .sort((a, b) => {
                const yearA = parseInt(a.year) || 0;
                const yearB = parseInt(b.year) || 0;
                if (yearA !== yearB) return yearB - yearA;
                return (a.title || '').localeCompare(b.title || '');
            });

        const latestCover = sortedSongs.length > 0 ? sortedSongs[0].cover || '' : '';
        const latestLargeCover = sortedSongs.length > 0 ? sortedSongs[0].largeCover || latestCover : latestCover;

        return {
            id: generateConsistentId('r', artist.name),
            name: artist.name,
            songs: artist.songs,
            cover: latestCover,
            largeCover: latestLargeCover,
            songCount: artist.songs.length
        };
    });

    return artistList;
}

function getArtistSongs(artistId) {
    const artists = getArtists();
    const artist = artists.find((a) => a.id === artistId);
    if (!artist) return [];
    const songs = filterDeletedSongs(artist.songs.map((id) => getSongById(id)));
    songs.sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        if (yearA !== yearB) return yearB - yearA;
        return (a.title || '').localeCompare(b.title || '');
    });
    return songs;
}
