import {
  hasOwn,
  isFunction,
  isKeyOf,
  isNull,
  isNumber,
  isObject,
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
function getControlValueKeys(value: ObjectValue) {
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
export function createBindingValueAdapter<T extends TweakValue>(
  initialValue: T,
) {
  const target = { value: initialValue }
  let controlValueKeys: readonly string[] = []

  if (isObjectValue(initialValue)) {
    const prototype = getRecordPrototype(toRaw(initialValue))
    controlValueKeys = getControlValueKeys(initialValue)
    target.value = snapshotRecord(initialValue, prototype)
  }

  function copyRecord(
    value: ObjectValue,
    prototype: object | null,
    descriptors: PropertyDescriptorMap,
  ): T {
    for (const key of controlValueKeys) {
      if (isKeyOf(value, key)) {
        descriptors[key] = {
          configurable: true,
          enumerable: true,
          value: Reflect.get(value, key),
          writable: true,
        }
      }
    }
    return Object.create(
      isNull(prototype) ? null : Object.prototype,
      descriptors,
    ) as T
  }

  function snapshotRecord(value: ObjectValue, prototype: object | null): T {
    const descriptors: PropertyDescriptorMap =
      Object.getOwnPropertyDescriptors(value)
    // Native change events include metadata. Track data properties without
    // calling metadata getters as a side effect of synchronization.
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key]
      if (
        descriptor?.enumerable &&
        hasOwn(descriptor, 'value') &&
        !(typeof key === 'string' && controlValueKeys.includes(key))
      ) {
        descriptor.value = Reflect.get(value, key)
      }
    }
    return copyRecord(value, prototype, descriptors)
  }

  function createModelSnapshot(value: T): T {
    return isObjectValue(value)
      ? snapshotRecord(value, getRecordPrototype(toRaw(value)))
      : value
  }

  function createUpdatedModelValue(value: T, model: T): T {
    if (!isObjectValue(value) || !isObjectValue(model)) {
      return value
    }
    const base = toRaw(model)
    return copyRecord(
      value,
      getRecordPrototype(base),
      Object.getOwnPropertyDescriptors(base),
    )
  }

  function areControlValuesEqual(first: T, second: T): boolean {
    if (!isObjectValue(first) || !isObjectValue(second)) {
      return Object.is(first, second)
    }

    return controlValueKeys.every(key =>
      Object.is(Reflect.get(first, key), Reflect.get(second, key)),
    )
  }

  return {
    target,
    createModelSnapshot,
    createUpdatedModelValue,
    areControlValuesEqual,
  }
}
