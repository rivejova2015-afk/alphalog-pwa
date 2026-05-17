"use client";

import { useState } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

export type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message?: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  children?: React.ReactNode;
}

const VARIANT_ICON = {
  danger:  <ShieldAlert size={20} className="text-red-400" />,
  warning: <AlertTriangle size={20} className="text-amber-400" />,
  info:    <Info size={20} className="text-cyan-400" />,
};

const VARIANT_BTN: Record<ConfirmVariant, "destructive" | "default"> = {
  danger:  "destructive",
  warning: "destructive",
  info:    "default",
};

// Replaces native `window.confirm`. Maintains its own loading state while
// `onConfirm` resolves so consumers can `await` async handlers without UI flicker.
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  variant = "danger",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  children,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onCancel()}
      title={title}
      variant="confirm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={VARIANT_BTN[variant]}
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{VARIANT_ICON[variant]}</div>
        <div className="flex-1 text-sm text-slate-300">
          {message && <p>{message}</p>}
          {children}
        </div>
      </div>
    </Modal>
  );
}
