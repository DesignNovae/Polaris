// A drag can end outside the animated sheet. Only a fresh backdrop click closes it.
let paperGesture = null;
let paperBackdropClick = false;
window.addEventListener('pointerdown', e => {
  paperBackdropClick = false;
  if (e.button !== 0 || e.isPrimary === false) return;
  const outside = !inQuad(e.clientX, e.clientY);
  paperGesture = { id: e.pointerId, x: e.clientX, y: e.clientY, outside, moved: false };
  if (!outside) canvas.setPointerCapture(e.pointerId);
});
window.addEventListener('pointermove', e => {
  if (!paperGesture || e.pointerId !== paperGesture.id) return;
  if (Math.hypot(e.clientX - paperGesture.x, e.clientY - paperGesture.y) > 6)
    paperGesture.moved = true;
});
window.addEventListener('pointerup', e => {
  if (!paperGesture || e.pointerId !== paperGesture.id) return;
  paperBackdropClick = paperGesture.outside && !paperGesture.moved &&
    Math.hypot(e.clientX - paperGesture.x, e.clientY - paperGesture.y) <= 6 &&
    !inQuad(e.clientX, e.clientY);
  paperGesture = null;
});
function cancelPaperGesture() {
  paperGesture = null;
  paperBackdropClick = false;
  dragging = false;
  release = .6;
}
window.addEventListener('pointercancel', cancelPaperGesture);
window.addEventListener('blur', cancelPaperGesture);
canvas.addEventListener('lostpointercapture', () => {
  if (paperGesture) cancelPaperGesture();
});
window.addEventListener('click', () => {
  const close = paperBackdropClick;
  paperBackdropClick = false;
  if (close) parent.postMessage({ type: 'polaris-paper-close' }, '*');
});
