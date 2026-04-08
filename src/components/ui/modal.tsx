"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  variant?: "confirm" | "form" | "info";
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  variant = "info",
  children,
  footer,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed inset-0 z-50 m-auto max-h-[85vh] w-full overflow-y-auto rounded-xl border border-slate-700/70 bg-slate-900 p-0 text-slate-200 shadow-[0_24px_48px_rgba(0,0,0,0.5)] backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm",
        {
          "max-w-md": variant === "confirm" || variant === "info",
          "max-w-lg": variant === "form",
        },
        className
      )}
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <div className="flex items-start justify-between border-b border-slate-700/50 px-6 py-4">
        <div>
          {title && (
            <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
          )}
          {description && (
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-6 py-4">{children}</div>

      {footer && (
        <div className="flex items-center justify-end gap-3 border-t border-slate-700/50 px-6 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
