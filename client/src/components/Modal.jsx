/**
 * Pop-up dialog built on the browser's <dialog> element, which already
 * handles keyboard focus and closes with the Esc key.
 *   open:    true to show it
 *   title:   heading text (already translated)
 *   onClose: called when the dialog should close (Esc key or a Cancel button)
 */
import { useEffect, useId, useRef } from 'react';
import './Modal.css';

export default function Modal({ open, title, onClose, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  // Open or close the real <dialog> when the "open" prop changes.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc key: let React decide (so state stays in sync).
        event.preventDefault();
        onClose();
      }}
    >
      {open && (
        <>
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}
