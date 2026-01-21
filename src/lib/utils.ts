/**
 * Utility functions for the application
 */

type ClassValue = string | undefined | null | false | Record<string, unknown> | ClassValue[];

/**
 * Classname merge utility for Tailwind CSS
 * Supports strings, objects, and arrays like clsx
 */
export function cn(...classes: ClassValue[]): string {
  const result: string[] = [];

  for (const item of classes) {
    if (!item) continue;

    if (typeof item === 'string') {
      result.push(item);
    } else if (typeof item === 'object') {
      if (Array.isArray(item)) {
        // Handle arrays recursively
        result.push(cn(...item));
      } else {
        // Handle objects - include key if value is truthy
        for (const [key, value] of Object.entries(item)) {
          if (value) {
            result.push(key);
          }
        }
      }
    }
  }

  return result.join(' ');
}
