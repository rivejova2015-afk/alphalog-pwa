export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ShowToastOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Show a toast notification to the user
 * Using console as fallback since sonner is not installed
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  options?: ShowToastOptions
) {
  if (typeof window === 'undefined') return;

  // Try to dynamically import sonner if available
  void import('sonner')
    .then((mod) => {
      if (mod && 'toast' in mod && typeof mod.toast === 'object') {
        const toast = mod.toast as {
          success: (msg: string, opts?: unknown) => unknown;
          error: (msg: string, opts?: unknown) => unknown;
          warning: (msg: string, opts?: unknown) => unknown;
          info: (msg: string, opts?: unknown) => unknown;
        };
        const toastOptions = {
          duration: options?.duration,
          action: options?.action,
        };

        switch (type) {
          case 'success':
            return toast.success(message, toastOptions);
          case 'error':
            return toast.error(message, toastOptions);
          case 'warning':
            return toast.warning(message, toastOptions);
          case 'info':
          default:
            return toast.info(message, toastOptions);
        }
      }
    })
    .catch(() => {
      // sonner not available, fall back to console
    });

  // Fallback: log to console
  const prefix = `[${type.toUpperCase()}]`;
  switch (type) {
    case 'error':
      console.error(prefix, message);
      break;
    case 'warning':
      console.warn(prefix, message);
      break;
    default:
      console.log(prefix, message);
  }
}

/**
 * Show an error toast with optional action
 */
export function showErrorToast(
  message: string,
  options?: ShowToastOptions
) {
  return showToast(message, 'error', options);
}

/**
 * Show a success toast
 */
export function showSuccessToast(
  message: string,
  options?: ShowToastOptions
) {
  return showToast(message, 'success', options);
}

/**
 * Parse error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Show error toast with parsed error message
 */
export function showParsedErrorToast(error: unknown, fallback?: string) {
  const message = error instanceof Error && error.message 
    ? error.message 
    : fallback || getErrorMessage(error);
  return showErrorToast(message);
}

