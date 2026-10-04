import { useEffect } from 'react';

// Reference counter so nested modals/drawers don't prematurely unlock scroll
let lockCount = 0;
let originalOverflow = '';
let originalTouchAction = '';
let originalPaddingRight = '';

export function useLockBodyScroll(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked) return;

    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      originalTouchAction = document.body.style.touchAction;
      originalPaddingRight = document.body.style.paddingRight;

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
        document.body.style.paddingRight = originalPaddingRight;
        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
      }
    };
  }, [isLocked]);
}
