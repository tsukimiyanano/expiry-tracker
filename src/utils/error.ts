export const ErrorUtils = {
  getMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  },
}
