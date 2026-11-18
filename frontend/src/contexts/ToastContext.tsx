import { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import ToastViewport, { type ToastItem } from "@/components/ui/ToastViewport";

type ToastInput = {
  title: string;
  message: string;
  type?: ToastItem["type"];
  durationMs?: number;
};

type ToastContextType = {
  pushToast: (input: ToastInput) => number;
  success: (title: string, message: string, durationMs?: number) => number;
  error: (title: string, message: string, durationMs?: number) => number;
  warning: (title: string, message: string, durationMs?: number) => number;
  removeToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ title, message, type = "success", durationMs = 4200 }: ToastInput) => {
      const id = toastIdRef.current++;
      setToasts((current) => [...current, { id, type, title, message }]);
      window.setTimeout(() => {
        removeToast(id);
      }, durationMs);
      return id;
    },
    [removeToast],
  );

  const value = useMemo<ToastContextType>(
    () => ({
      pushToast,
      success: (title, message, durationMs) => pushToast({ title, message, type: "success", durationMs }),
      error: (title, message, durationMs) => pushToast({ title, message, type: "danger", durationMs }),
      warning: (title, message, durationMs) => pushToast({ title, message, type: "warning", durationMs }),
      removeToast,
    }),
    [pushToast, removeToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de ToastProvider.");
  }
  return context;
}
