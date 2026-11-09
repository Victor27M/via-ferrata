import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconX } from '../ui.tsx';

interface Props {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Dim + block the map behind (filters, settings). The site card stays non-modal. */
  modal?: boolean;
  /** Full-height (stats). */
  full?: boolean;
}

/** Bottom sheet on phones, floating side panel on wide screens. Swipe the header down to close. */
export function BottomSheet({ title, onClose, children, modal, full }: Props) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const end = () => {
    if (dy > 80) onClose();
    start.current = null;
    setDy(0);
  };

  return (
    <>
      {modal && <div className="backdrop" onClick={onClose} />}
      <section className={`sheet${full ? ' full' : ''}`} style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined} role="dialog">
        <header
          className="sheet-head"
          onPointerDown={(e) => (start.current = e.clientY)}
          onPointerMove={(e) => start.current != null && setDy(Math.max(0, e.clientY - start.current))}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div className="grabber" />
          <div className="sheet-title">{title}</div>
          <button className="icon-btn" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Close">
            <IconX />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </>
  );
}
