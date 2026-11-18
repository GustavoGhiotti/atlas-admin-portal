import { useEffect, useRef } from "react";

import { useToast } from "@/contexts/ToastContext";

type FeedbackLike = {
  type: "success" | "danger" | "warning";
  message: string;
};

type FeedbackToastBridgeProps = {
  successMessage?: string | null;
  errorMessage?: string | null;
  warningMessage?: string | null;
  feedback?: FeedbackLike | null;
  successTitle?: string;
  errorTitle?: string;
  warningTitle?: string;
};

export default function FeedbackToastBridge({
  successMessage,
  errorMessage,
  warningMessage,
  feedback,
  successTitle = "Operação concluída",
  errorTitle = "Falha na operação",
  warningTitle = "Atenção",
}: FeedbackToastBridgeProps) {
  const toast = useToast();
  const previousSuccess = useRef<string | null>(null);
  const previousError = useRef<string | null>(null);
  const previousWarning = useRef<string | null>(null);
  const previousFeedback = useRef<string | null>(null);

  useEffect(() => {
    if (successMessage && successMessage !== previousSuccess.current) {
      toast.success(successTitle, successMessage);
      previousSuccess.current = successMessage;
    }
    if (!successMessage) {
      previousSuccess.current = null;
    }
  }, [successMessage, successTitle, toast]);

  useEffect(() => {
    if (errorMessage && errorMessage !== previousError.current) {
      toast.error(errorTitle, errorMessage);
      previousError.current = errorMessage;
    }
    if (!errorMessage) {
      previousError.current = null;
    }
  }, [errorMessage, errorTitle, toast]);

  useEffect(() => {
    if (warningMessage && warningMessage !== previousWarning.current) {
      toast.warning(warningTitle, warningMessage);
      previousWarning.current = warningMessage;
    }
    if (!warningMessage) {
      previousWarning.current = null;
    }
  }, [warningMessage, warningTitle, toast]);

  useEffect(() => {
    const feedbackKey = feedback ? `${feedback.type}:${feedback.message}` : null;
    if (feedbackKey && feedbackKey !== previousFeedback.current) {
      if (feedback?.type === "success") toast.success(successTitle, feedback.message);
      if (feedback?.type === "danger") toast.error(errorTitle, feedback.message);
      if (feedback?.type === "warning") toast.warning(warningTitle, feedback.message);
      previousFeedback.current = feedbackKey;
    }
    if (!feedbackKey) {
      previousFeedback.current = null;
    }
  }, [errorTitle, feedback, successTitle, toast, warningTitle]);

  return null;
}
