import { handleClientError } from "@/components/errors/use-error-handler";

const originalConsoleError = console.error;

console.error = function (...args: unknown[]) {
  // Call centralized error handler
  handleClientError("Console error intercepted:", ...args);

  // Optionally call original console.error to keep default behavior
  originalConsoleError.apply(console, args);
};
