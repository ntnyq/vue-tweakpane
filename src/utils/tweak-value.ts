import {
  hasOwn,
  isFunction,
  isKeyOf,
  isNull,
  isNumber,
  isObject,
  isUndefined,
} from '@ntnyq/utils'
import { toRaw } from 'vue'
import { COLOR_KEYS, POINT_KEYS } from '../constants'
import type { ObjectValue, TweakValue } from '../types'

/**
 * Checks whether a binding value is a non-callable object.
 *
 * @param value The value bound to the control.
 * @returns True for non-null objects that aren't callable.
 */
function isObjectValue(value: TweakValue): value is ObjectValue {
  return isObject(value) && !isFunction(value)
}

/**
 * Selects the fields belonging to a color or point control.
 *
 * @param value The object bound to the control.
 * @returns The recognized fields for the value's control.
 */
function getValueKeys(value: ObjectValue) {
  return isNumber(Reflect.get(value, 'r')) &&
    isNumber(Reflect.get(value, 'g')) &&
    isNumber(Reflect.get(value, 'b'))
    ? COLOR_KEYS
    : POINT_KEYS
}

/**
 * Gets the prototype of a value that can be copied as a plain record.
 *
 * @param value The raw model object.
 * @returns The record's prototype.
 */
function getRecordPrototype(value: ObjectValue): object | null {
  const prototype = Reflect.getPrototypeOf(value)
  if (isNull(prototype) || prototype === Object.prototype) {
    return prototype
  }

  // Object records from other realms have their own Object.prototype.
  const constructor: unknown = Reflect.get(prototype, 'constructor')
  if (
    hasOwn(prototype, 'constructor') &&
    isFunction(constructor) &&
    Function.prototype.toString.call(constructor) ===
      Function.prototype.toString.call(Object)
  ) {
    return prototype
  }

  throw new TypeError(
    'useTweakBinding requires plain point and color objects. Use a writable computed to adapt a class instance.',
  )
}

/**
 * Copies and compares values using the fields selected when the control is
 * created.
 *
 * @param initialValue The model value used to select the control.
 * @returns A native binding target and operations for synchronizing its value.
 */
export function createBindingValue<T extends TweakValue>(initialValue: T) {
  const target = { value: initialValue }
  let keys: readonly string[] = []

  if (isObjectValue(initialValue)) {
    const prototype = getRecordPrototype(toRaw(initialValue))
    keys = getValueKeys(initialValue)
    target.value = copyRecord(initialValue, initialValue, prototype)
  }

  function copyRecord<TRecord extends ObjectValue>(
    value: ObjectValue,
    base: TRecord,
    prototype: object | null,
  ): TRecord {
    const copy = { ...base }
    if (isNull(prototype)) {
      Reflect.setPrototypeOf(copy, null)
    }
    for (const key of keys) {
      if (isKeyOf(value, key)) {
        Reflect.set(copy, key, Reflect.get(value, key))
      }
    }
    return copy
  }

  function copyValue(value: T, model?: T): T {
    // Native snapshots track shallow Vue state. Model writes keep raw metadata.
    const base = isUndefined(model) ? value : toRaw(model)
    if (!isObjectValue(value) || !isObjectValue(base)) {
      return value
    }

    return copyRecord(value, base, getRecordPrototype(toRaw(base)))
  }

  function hasSameValue(first: T, second: T): boolean {
    if (!isObjectValue(first) || !isObjectValue(second)) {
      return Object.is(first, second)
    }

    return keys.every(key =>
      Object.is(Reflect.get(first, key), Reflect.get(second, key)),
    )
  }

  return {
    target,
    copyValue,
    hasSameValue,
  }
}
