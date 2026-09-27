export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (error === null || typeof error === 'undefined') {
    return { message: String(error) }
  }

  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack
    }

    const extra = error as Error & {
      code?: unknown
      status?: unknown
      details?: unknown
      hint?: unknown
      cause?: unknown
    }

    if (extra.code) details.code = extra.code
    if (extra.status) details.status = extra.status
    if (extra.details) details.details = extra.details
    if (extra.hint) details.hint = extra.hint
    if (extra.cause) details.cause = getErrorDetails(extra.cause)

    return details
  }

  if (typeof error === 'object') {
    const details: Record<string, unknown> = {}
    for (const key of Object.getOwnPropertyNames(error)) {
      details[key] = (error as Record<string, unknown>)[key]
    }
    return Object.keys(details).length > 0 ? details : { message: JSON.stringify(error) }
  }

  return { message: String(error) }
}

export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  const details = getErrorDetails(error)
  const message = details.message

  if (typeof message === 'string' && message.trim()) {
    return message
  }

  const name = details.name
  const code = details.code
  const status = details.status
  const parts = [name, code, status].filter(Boolean).map(String)

  return parts.length > 0 ? parts.join(' / ') : fallback
}
