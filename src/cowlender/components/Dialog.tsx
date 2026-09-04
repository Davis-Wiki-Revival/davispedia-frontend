import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export function Dialog({ title, children, onClose, wide = false }: DialogProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="cowlender-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="cowlender-dialog-title"
        aria-modal="true"
        className={`cowlender-dialog${wide ? ' cowlender-dialog--wide' : ''}`}
        role="dialog"
      >
        <header className="cowlender-dialog__header">
          <h2 id="cowlender-dialog-title">{title}</h2>
          <button
            aria-label="Close"
            className="cowlender-icon-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="cowlender-dialog__body">{children}</div>
      </section>
    </div>
  );
}
