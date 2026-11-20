import type { Pane } from 'tweakpane'

/**
 * An RGB or RGBA color value for a Tweakpane input control.
 */
export interface TweakColor {
  /**
   * The red channel, from 0 to 255 by default or 0 to 1 when `color.type` is
   * set to `'float'`.
   */
  r: number
  /**
   * The green channel, from 0 to 255 by default or 0 to 1 when `color.type` is
   * set to `'float'`.
   */
  g: number
  /**
   * The blue channel, from 0 to 255 by default or 0 to 1 when `color.type` is
   * set to `'float'`.
   */
  b: number
  /**
   * The alpha channel, from 0 (fully transparent) to 1 (fully opaque) in both
   * modes.
   */
  a?: number
}

/**
 * A point value for a 2D, 3D, or 4D Tweakpane input control.
 */
export interface TweakPoint {
  /**
   * The coordinate along the x-axis.
   */
  x: number
  /**
   * The coordinate along the y-axis.
   */
  y: number
  /**
   * The third coordinate in a 3D or 4D point.
   */
  z?: number
  /**
   * The fourth coordinate in a 4D point.
   */
  w?: number
}

/**
 * Values supported by the built-in Tweakpane input controls.
 */
export type TweakValue = boolean | number | string | TweakColor | TweakPoint

/**
 * The native binding API specialized to the Vue model's value type.
 */
export type TweakBindingApi<T> = ReturnType<
  typeof Pane.prototype.addBinding<{ value: T }, 'value'>
>

/**
 * Object values supported by Tweakpane's color and point controls.
 */
export type ObjectValue = Extract<TweakValue, object>
