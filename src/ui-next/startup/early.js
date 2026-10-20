// Starts the startup view (task A-09) without waiting for the rest of the app.
//
// The shell and the engine are about a hundred module files. A module runs only when everything it imports has loaded, so the startup
// view used to appear in the same moment as the app itself: the window opened on a plain graphite page, waited, and the startup view
// showed for a split second before the app. This file imports only the startup view (a handful of small files), and index.html lists it
// first, so it runs as soon as those few files have loaded while the rest is still loading. shell.js still calls startBoot(), which
// returns the boot this file started.
import { startBoot } from './boot.js';

startBoot();
