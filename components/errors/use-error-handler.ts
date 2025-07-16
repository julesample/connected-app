export function createUnhandledError(message: string, error?: unknown): void {
  const unhandledError = new Error(message);
  if (error) {
    // Attach original error details if available
    (unhandledError as any).originalError = error;
  }
  // Here you can add additional logging or reporting logic if needed
  throw unhandledError;
}

export function handleClientError(message: string, error?: unknown): void {
  // Centralized client error handling
  // Log error to console or send to external monitoring service
  console.error(message, error);

  // Create and throw unhandled error for further handling if needed
  createUnhandledError(message, error);
}
