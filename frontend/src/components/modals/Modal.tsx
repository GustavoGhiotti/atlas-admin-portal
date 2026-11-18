import { ReactNode, useEffect } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export default function Modal({ open, title, description, onClose, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <p className="eyebrow">Comandos</p>
            <h2 id="modal-title">{title}</h2>
            {description ? <p className="panel__description">{description}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar modal">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
