// ==============================================================================
// PROGRESS BAR SEEKING
// ==============================================================================
let isSeeking = false;

const progressContainer = document.querySelector('.progress-container');
if (progressContainer) {
    progressContainer.addEventListener('mouseenter', showProgressTooltip);
    progressContainer.addEventListener('mouseleave', hideProgressTooltip);
}
let seekAnimationId = null;

function startSeek(e) {
    if (!audioElement.duration) return;

    isSeeking = true;
    wasPlaying = !audioElement.paused;

    if (wasPlaying) {
        audioElement.pause();
    }

    window.originalTimeUpdate = audioElement.ontimeupdate;
    audioElement.ontimeupdate = null;

    e.currentTarget.classList.add('dragging');
    document.body.classList.add('dragging-progress');
    document.body.classList.add('no-select');

    updateSeekPosition(e.clientX);
    updateProgressTooltip(e);

    document.addEventListener('mousemove', doSeekGlobal);
    document.addEventListener('mouseup', stopSeekGlobal);
}

function doSeekGlobal(e) {
    if (!isSeeking) return;

    if (seekAnimationId) {
        cancelAnimationFrame(seekAnimationId);
    }

    seekAnimationId = requestAnimationFrame(() => {
        updateSeekPosition(e.clientX);
        updateProgressTooltip(e);
    });
}

function stopSeekGlobal() {
    isSeeking = false;

    if (seekAnimationId) {
        cancelAnimationFrame(seekAnimationId);
        seekAnimationId = null;
    }

    if (progressTooltip) {
        progressTooltip.remove();
        progressTooltip = null;
    }

    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
        progressContainer.classList.remove('dragging');
    }
    document.body.classList.remove('dragging-progress');
    document.body.classList.remove('no-select');

    document.removeEventListener('mousemove', doSeekGlobal);
    document.removeEventListener('mouseup', stopSeekGlobal);

    if (window.originalTimeUpdate) {
        audioElement.ontimeupdate = window.originalTimeUpdate;
        window.originalTimeUpdate = null;
    }

    if (wasPlaying) {
        audioElement.play().catch((e) => {});
    }
    wasPlaying = false;
}

function updateSeekPosition(clientX) {
    if (!audioElement.duration) return;

    const progressContainer = document.querySelector('.progress-container');
    if (!progressContainer) return;

    const rect = progressContainer.getBoundingClientRect();
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    const progress = x / rect.width;

    audioElement.currentTime = progress * audioElement.duration;

    const progressPercent = progress * 100 + '%';
    document.getElementById('progress-bar').style.width = progressPercent;
    document.getElementById('progress-knob').style.left = progressPercent;

    updateTimeDisplay();
}

let progressTooltip = null;

function createProgressTooltip() {
    const el = document.createElement('div');
    el.className = 'custom-tooltip progress-tooltip';
    return el;
}

function updateProgressTooltip(e) {
    const progressContainer = document.querySelector('.progress-container');
    if (!progressContainer) return;

    const rect = progressContainer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    const progress = x / rect.width;
    const time = audioElement.duration ? progress * audioElement.duration : 0;

    if (!progressTooltip) {
        progressTooltip = createProgressTooltip();
        document.body.appendChild(progressTooltip);
    }

    progressTooltip.textContent = formatTime(time);

    let left = rect.left + x;
    let top = rect.top - 2;

    const tooltipRect = progressTooltip.getBoundingClientRect();

    if (left < rect.left) {
        left = rect.left;
    }
    if (left > rect.right) {
        left = rect.right;
    }
    if (top - tooltipRect.height < 6) {
        top = rect.bottom + 6;
        progressTooltip.style.transform = 'translate(-50%, 0)';
    } else {
        progressTooltip.style.transform = 'translate(-50%, -100%)';
    }

    progressTooltip.style.left = left + 'px';
    progressTooltip.style.top = top + 'px';
}

function showProgressTooltip() {
    const progressContainer = document.querySelector('.progress-container');
    if (!progressContainer) return;
    progressContainer.addEventListener('mousemove', updateProgressTooltip);
}

function hideProgressTooltip() {
    if (isSeeking) return;
    if (progressTooltip) {
        progressTooltip.remove();
        progressTooltip = null;
    }
}

