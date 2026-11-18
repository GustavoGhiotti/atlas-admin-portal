export type ToastItem = {
  id: number;
  type: "success" | "danger" | "warning";
  title: string;
  message: string;
};

type ToastViewportProps = {
  toasts: ToastItem[];
  onClose: (id: number) => void;
};

export default function ToastViewport({ toasts, onClose }: ToastViewportProps) {
  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`} role="status">
          <div className="toast__content">
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <button className="toast__close" type="button" onClick={() => onClose(toast.id)} aria-label="Fechar notificacao">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
