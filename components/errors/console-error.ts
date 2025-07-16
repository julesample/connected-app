/**
 * Utility to format or handle console errors.
 * This can be extended to customize error logging or formatting.
 */

export function logConsoleError(message: string, error?: unknown): void {
  // Customize error logging here if needed
  console.error(message, error);
}
