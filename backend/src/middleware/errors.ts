import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error)
  let failure: ApiError
  if (error instanceof ApiError) failure = error
  else if (error instanceof ZodError || error?.type === 'entity.parse.failed') {
    failure = new ApiError(400, 'INVALID_REQUEST', 'Invalid request.')
  } else if (error?.type === 'entity.too.large') {
    failure = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.')
  } else if (['charset.unsupported', 'encoding.unsupported'].includes(error?.type)) {
    failure = new ApiError(415, 'UNSUPPORTED_ENCODING', 'Unsupported request encoding.')
  } else {
    console.error('Unhandled API request failure.')
    failure = new ApiError(500, 'INTERNAL_ERROR', 'Request failed.')
  }
  res.status(failure.status).json({ status: 'error', error: { code: failure.code, message: failure.message } })
}
