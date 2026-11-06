import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import BottomSheetModal from '@/components/BottomSheetModal';
import { isCapacitorIOS } from '@/lib/utils';

type Content = Extract<ComponentProps<typeof BottomSheetModal>['children'], (...args: never[]) => unknown>;

/** Match Settings: mobile sheet, desktop DaisyUI dialog. The parent owns mounting. */
export default function VoiceCallModal({ onClose, children }: { onClose: () => void; children: Content }) {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768 || isCapacitorIOS());
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches || isCapacitorIOS());
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobile]);

  useEffect(() => {
    if (mobile || !closing) return;
    // Backup for reduced motion or a backgrounded page with no animationend.
    const timer = window.setTimeout(() => onCloseRef.current(), 220);
    return () => window.clearTimeout(timer);
  }, [mobile, closing]);

  const requestDesktopClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
  };

  if (mobile) return createPortal(
    <BottomSheetModal
      isOpen={true}
      onClose={() => onCloseRef.current()}
      hideHeader
      dismissible={false}
      safeArea={false}
      className={`relative bg-base-100 pt-0 pb-0 ${isCapacitorIOS() ? 'ios-mode' : ''}`}
      contentClassName="h-full"
    >
      {controls => children({ ...controls, requestClose: reason => {
        if (closingRef.current) return;
        closingRef.current = true;
        controls.requestClose(reason);
      } })}
    </BottomSheetModal>, document.body,
  );

  return createPortal(<dialog
    open
    className={`modal modal-open voice-call-dialog ${closing ? 'voice-call-dialog-closing' : ''}`}
    aria-label="语音通话"
    onCancel={event => { event.preventDefault(); requestDesktopClose(); }}
    onClick={event => event.stopPropagation()}
  >
    <div className="modal-backdrop bg-black/45" onClick={requestDesktopClose} aria-hidden="true" />
    <div className="modal-box relative h-[640px] max-h-[88dvh] w-full max-w-[500px] overflow-hidden rounded-[24px] bg-base-100 p-0 shadow-2xl">
      {children({ bind: () => ({}), isDragging: false, requestClose: requestDesktopClose })}
    </div>
  </dialog>, document.body);
}
