'use strict';

// Popularity for the "most popular" rule of electron/release-rank.js (task PD-04). Source: the ListenBrainz popularity API
// (MetaBrainz, open, no key): POST /1/popularity/release-group with { release_group_mbids: [...] } answers, in the same order,
// [{ release_group_mbid, total_listen_count, total_user_count }] with nulls for groups it knows nothing about
// (https://listenbrainz.readthedocs.io/en/latest/users/api/popularity.html). It is keyed by the MusicBrainz release-group id,
// which is what rankReleases takes. It never throws: no answer means no popularity, and the caller falls back to "original".
//
// Score: the number of different listeners, on a log scale relative to the most listened-to candidate (1 for that one).

const https = require('https');
const { USER_AGENT } = require('./user-agent');

const URL_RELEASE_GROUP = 'https://api.listenbrainz.org/1/popularity/release-group';
const MAX_IDS = 50;

function toScores(rows) {
    const counts = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
        const id = row && row.release_group_mbid;
        if (id) counts.set(id, Math.max(0, Number(row.total_user_count) || 0));
    }
    const most = Math.max(0, ...counts.values());
    if (most === 0) return null;
    const scores = {};
    for (const [id, count] of counts) scores[id] = Number((Math.log1p(count) / Math.log1p(most)).toFixed(3));
    return scores;
}

function httpsPostJson(url, body, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const request = https.request(url, { method: 'POST', headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), Accept: 'application/json' }, timeout: timeoutMs }, (response) => {
            const chunks = [];
            response.on('data', (c) => chunks.push(c));
            response.on('end', () => {
                if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`ListenBrainz answered HTTP ${response.statusCode}`));
                try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); }
            });
        });
        request.on('timeout', () => request.destroy(new Error('ListenBrainz timed out')));
        request.on('error', reject);
        request.end(data);
    });
}

/** { [releaseGroupId]: 0..1 } for the given release groups, or null when there is nothing to go on. */
async function fetchPopularity(releaseGroupIds, { post = httpsPostJson } = {}) {
    const ids = [...new Set((releaseGroupIds || []).filter((id) => typeof id === 'string' && id))].slice(0, MAX_IDS);
    if (ids.length === 0) return null;
    try { return toScores(await post(URL_RELEASE_GROUP, { release_group_mbids: ids })); } catch (error) { return null; }
}

module.exports = { fetchPopularity, toScores, URL_RELEASE_GROUP };
