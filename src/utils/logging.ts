export function logDevError(context: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.warn(`[SFA] ${context}`, error);
  }
}
