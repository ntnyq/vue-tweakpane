import { handleError } from 'vue'
import type { ComponentInternalInstance, ErrorCodes } from 'vue'
import type { Disposable } from '../types'

/**
 * Reports a failure after the current Vue update or native disposal finishes.
 *
 * @param error The failure to report.
 * @param component The component whose error handlers receive the failure.
 * @param type The Vue error category passed to those handlers.
 */
export function reportVueError(
  error: unknown,
  component: ComponentInternalInstance | null,
  type: ErrorCodes,
) {
  // Vue error handlers can throw. Let the current update or disposal finish first.
  queueMicrotask(() => {
    handleError(error, component, type, false)
  })
}

/**
 * Throws the original error or groups failures from the same operation.
 *
 * @param errors The failures in the order they occurred.
 * @param message The message for an aggregate error.
 */
export function throwCollectedErrors(
  errors: readonly unknown[],
  message: string,
) {
  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, message)
  }
}

/**
 * Cleans up after a failure and preserves any subsequent cleanup error.
 *
 * @param error The failure that triggered cleanup.
 * @param cleanup The callback that releases partially initialized resources.
 * @param message The message if the operation and its cleanup both fail.
 */
export function rethrowAfterCleanup(
  error: unknown,
  cleanup: Disposable,
  message: string,
): never {
  try {
    cleanup()
  } catch (cleanupError) {
    throw new AggregateError([error, cleanupError], message, {
      cause: cleanupError,
    })
  }
  throw error
}
