import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface UsePopoverFocusOptions<
  TTrigger extends HTMLElement,
  TPopover extends HTMLElement,
> {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<TTrigger>;
  popoverRef: RefObject<TPopover>;
}

export function usePopoverFocus<
  TTrigger extends HTMLElement,
  TPopover extends HTMLElement,
>({
  isOpen,
  onClose,
  triggerRef,
  popoverRef,
}: UsePopoverFocusOptions<TTrigger, TPopover>) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    const returnFocusTarget =
      trigger
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const animationFrame = window.requestAnimationFrame(() => {
      const popover = popoverRef.current;
      if (!popover) return;
      const preferredFocus = popover.querySelector<HTMLElement>('[data-popover-autofocus]');
      const firstFocusable = popover.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (preferredFocus ?? firstFocusable ?? popover).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const modal = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (modal && !popoverRef.current?.contains(modal)) return;
      event.preventDefault();
      onCloseRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown);
      const focusTarget = trigger ?? returnFocusTarget;
      if (focusTarget?.isConnected) focusTarget.focus();
    };
  }, [isOpen, popoverRef, triggerRef]);
}
