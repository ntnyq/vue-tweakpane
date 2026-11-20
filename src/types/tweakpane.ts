import type { Pane } from 'tweakpane'
import type { Disposable } from './utils'

/**
 * Creation options for a Vue-owned Tweakpane instance.
 */
export interface TweakpaneOptions {
  /**
   * The title displayed in the pane header.
   */
  title?: string
  /**
   * Whether the pane starts expanded.
   */
  expanded?: boolean
  /**
   * Sets up native controls or plugins and optionally returns instance cleanup.
   */
  configure?: (pane: Pane) => void | Disposable
}
