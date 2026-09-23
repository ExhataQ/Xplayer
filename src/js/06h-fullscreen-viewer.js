// ==============================================================================
// FULLSCREEN IMAGE VIEWER
// ==============================================================================
function openImageViewer() {
    const viewer = document.getElementById('image-viewer');
    const viewerImage = document.getElementById('viewer-image');
    const albumArt = document.getElementById('album-art-image');

    if (albumArt && albumArt.src && albumArt.src !== PLACEHOLDER_IMAGE) {
        viewerImage.src = albumArt.src;
        viewer.classList.remove('closing');
        viewer.classList.add('active');

        viewerImage.addEventListener('mousemove', function (e) {
            viewerMouseX = e.clientX;
            viewerMouseY = e.clientY;
        });

        viewerImage.addEventListener('click', initZoomLens);

        document.addEventListener('keydown', imageViewerKeyHandler);
    }
}

let zoomLens = null;
let lensActive = false;
let viewerMouseX = 0;
let viewerMouseY = 0;

function initZoomLens(e) {
    if (lensActive) {
        deactivateZoomLens();
        return;
    }

    const viewerImage = document.getElementById('viewer-image');
    const viewer = document.getElementById('image-viewer');
    if (!viewerImage || !viewer) return;

    lensActive = true;
    viewerImage.style.cursor = 'none';

    if (!zoomLens) {
        zoomLens = document.createElement('div');
        zoomLens.className = 'image-viewer-zoom-lens';
        document.body.appendChild(zoomLens);
    }

    let zoomLensInner = zoomLens.querySelector('.image-viewer-zoom-lens-inner');
    if (!zoomLensInner) {
        zoomLensInner = document.createElement('div');
        zoomLensInner.className = 'image-viewer-zoom-lens-inner';
        zoomLens.appendChild(zoomLensInner);
    }

    const zoomLevel = 1.75;
    const imgRectInit = viewerImage.getBoundingClientRect();
    const bgDisplayW = imgRectInit.width * zoomLevel;
    const bgDisplayH = imgRectInit.height * zoomLevel;

    zoomLensInner.style.backgroundImage = `url(${viewerImage.src})`;
    zoomLensInner.style.backgroundSize = `${bgDisplayW}px ${bgDisplayH}px`;
    zoomLensInner.style.backgroundRepeat = 'no-repeat';
    zoomLensInner.style.backgroundColor = 'transparent';

    function moveLens(e) {
        const imgRect = viewerImage.getBoundingClientRect();

        const rawX = e.clientX - imgRect.left;
        const rawY = e.clientY - imgRect.top;

        if (rawX < 0 || rawY < 0 || rawX > imgRect.width || rawY > imgRect.height) {
            zoomLens.style.display = 'none';
            return;
        }

        const lensW = zoomLens.offsetWidth || 180;
        const lensH = zoomLens.offsetHeight || 180;

        const fx = rawX / imgRect.width;
        const fy = rawY / imgRect.height;

        const bgX = fx * bgDisplayW - lensW / 2;
        const bgY = fy * bgDisplayH - lensH / 2;

        zoomLens.style.left = e.clientX - lensW / 2 + 'px';
        zoomLens.style.top = e.clientY - lensH / 2 + 'px';
        zoomLens.style.display = 'block';
        zoomLensInner.style.backgroundPosition = `${-bgX}px ${-bgY}px`;
    }

    function hideLens() {
        if (zoomLens) zoomLens.style.display = 'none';
    }

    viewer.addEventListener('mousemove', moveLens);
    viewer.addEventListener('mouseleave', hideLens);

    moveLens({
        clientX: viewerMouseX,
        clientY: viewerMouseY
    });

    zoomLens._cleanup = function () {
        viewer.removeEventListener('mousemove', moveLens);
        viewer.removeEventListener('mouseleave', hideLens);
        if (zoomLens) zoomLens.style.display = 'none';
    };
}

function deactivateZoomLens() {
    lensActive = false;
    const viewerImage = document.getElementById('viewer-image');
    if (viewerImage) viewerImage.style.cursor = '';
    if (zoomLens && zoomLens._cleanup) {
        zoomLens._cleanup();
    }
}

function closeImageViewer() {
    deactivateZoomLens();
    const viewer = document.getElementById('image-viewer');
    viewer.classList.add('closing');

    setTimeout(() => {
        viewer.classList.remove('active', 'closing');
    }, 300);

    document.removeEventListener('keydown', imageViewerKeyHandler);
}

function imageViewerKeyHandler(e) {
    if (e.key === 'Escape') {
        closeImageViewer();
    }
}
