// ratings-bridge (task B3): the Rating system settings, from the engine (library/03h-ratings.js).
//
//   getRatingSettings()          -> { enabled, shuffleWeight, writeTags }   off by default
//   setRatingSetting(key, bool)  saves one switch; the engine tells everyone with ratingSettings:changed
//   ratingSystemOn()             is the whole system on
//   ratingsForSongs(ids)         stars for many songs at once, same order (the song list)
//   rateSong(id, stars)          saves (0 clears); the engine tells everyone with ratings:changed
import { engineCall } from './engine-api.js';

export const getRatingSettings = () => engineCall('getRatingSettings') || { enabled: false, shuffleWeight: true, writeTags: true };
export const setRatingSetting = (key, value) => engineCall('setRatingSetting', key, value);
export const ratingSystemOn = () => Boolean(getRatingSettings().enabled);
export const ratingsForSongs = (ids) => engineCall('ratingsForSongIds', ids) || ids.map(() => 0);
export const rateSong = (id, stars) => engineCall('setRating', id, stars);
