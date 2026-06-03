// iOS-style swipe-to-dismiss for bottom sheets and drawers.
const DISMISS_PX = 72;

function sheetPanel(root) {
  return root?.querySelector('.drawer-sheet, .sheet');
}

export function bindBottomSheetGestures(root, onDismiss) {
  if (!root || root.dataset.swipeBound) return;
  root.dataset.swipeBound = '1';

  const panel = sheetPanel(root);
  if (!panel) return;

  let startY = 0;
  let tracking = false;

  const reset = () => {
    panel.style.transition = '';
    panel.style.transform = '';
    tracking = false;
  };

  const finish = (dismiss) => {
    panel.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
    if (dismiss) {
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => {
        onDismiss?.();
        reset();
      }, 260);
    } else {
      panel.style.transform = 'translateY(0)';
      setTimeout(reset, 280);
    }
  };

  root.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const r = panel.getBoundingClientRect();
      const onGrab = !!e.target?.closest?.('.drawer-grab, .grab');
      if (!onGrab && y > r.top + 48) return;
      startY = y;
      tracking = true;
      panel.style.transition = 'none';
    },
    { passive: true }
  );

  root.addEventListener(
    'touchmove',
    (e) => {
      if (!tracking || e.touches.length !== 1) return;
      const dy = Math.max(0, e.touches[0].clientY - startY);
      if (dy > 4) e.preventDefault();
      panel.style.transform = `translateY(${dy}px)`;
    },
    { passive: false }
  );

  root.addEventListener(
    'touchend',
    (e) => {
      if (!tracking) return;
      tracking = false;
      const dy = Math.max(0, (e.changedTouches[0]?.clientY ?? startY) - startY);
      finish(dy >= DISMISS_PX);
    },
    { passive: true }
  );

  root.addEventListener('touchcancel', () => {
    if (!tracking) return;
    tracking = false;
    finish(false);
  });
}

export function initSheetGestures() {
  const pairs = [
    ['meters-drawer', () => document.getElementById('meters-drawer')?.classList.add('hidden')],
    ['game-actions-sheet', () => document.getElementById('game-actions-sheet')?.classList.add('hidden')],
  ];
  for (const [id, close] of pairs) {
    const el = document.getElementById(id);
    if (el) bindBottomSheetGestures(el, close);
  }
}
