import {
  type Target,
  isReadonly,
  isShallow,
  reactive,
  reactiveMap,
  readonly,
  readonlyMap,
  shallowReactiveMap,
  shallowReadonlyMap,
  toRaw,
} from './reactive'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import {
  pauseScheduling,
  pauseTracking,
  resetScheduling,
  resetTracking,
} from './effect'
import { ITERATE_KEY, track, trigger } from './reactiveEffect'
import {
  hasChanged,
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
  isSymbol,
  makeMap,
} from '@vue/shared'
import { isRef } from './ref'
import { warn } from './warning'

const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
  /*#__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => (Symbol as any)[key])
    .filter(isSymbol),
)

/**
 * // NICE: 数组的方法
 */
const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations()

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {}
  /**
   * // NICE: 身份敏感的数组方法，用于考虑可能的反应值
   * 处理逻辑：
   * 1. toRaw：将响应式数组转换为原始数组，确保不会因为代理对象影响方法的执行
   * 2. 依赖追踪：使用 track 函数为数据每个索引值添加依赖追踪，以便在数据变化时能够触发更新
   * 3. 方法调用：首先使用原始参数调用原始数组的方法
   * 4. 回退处理：如果方法返回 -1 或 false，表示未找到元素，则使用 toRaw 转换参数再次调用方法
   *    这是因为数组中的元素可能是响应式的，需要转换为原始值才能正确比较
   *    例如：arr.indexOf(reactive(1))，如果 reactive(1) 未找到，则再次调用 arr.indexOf(1)
   * // NICE: End
   */

  // instrument identity-sensitive Array methods to account for possible reactive
  // values
  ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this) as any
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + '')
      }
      // we run the method using the original args first (which may be reactive)
      const res = arr[key](...args)
      if (res === -1 || res === false) {
        // if that didn't work, run it again using raw values.
        return arr[key](...args.map(toRaw))
      } else {
        return res
      }
    }
  })

  /**
   * // NICE: 长度变化的变异方法
   * 处理逻辑：
   * 1. 暂停追踪和调度：
   *  - pauseTracking：暂停依赖追踪，避免在变更操作中出发不必要的依赖追踪
   *  - pauseScheduling：暂停调度，避免在变更操作中触发不必要的更新
   * 2. 方法调用：使用 toRaw 将响应式数组转换为原始数组，然后调用原始数组的方法
   * 3. 恢复追踪和调度：
   *  - resetScheduling：恢复调度
   *  - resetTracking：恢复依赖追踪
   * // NICE: End
   */
  // instrument length-altering mutation methods to avoid length being tracked
  // which leads to infinite loops in some cases (#2137)
  ;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      pauseTracking()
      pauseScheduling()
      const res = (toRaw(this) as any)[key].apply(this, args)
      resetScheduling()
      resetTracking()
      return res
    }
  })
  return instrumentations
}

function hasOwnProperty(this: object, key: unknown) {
  // #10455 hasOwnProperty may be called with non-string values
  if (!isSymbol(key)) key = String(key)
  const obj = toRaw(this)
  track(obj, TrackOpTypes.HAS, key)
  return obj.hasOwnProperty(key as string)
}

/**
 * // NICE: BaseReactiveHandler 类
 * 构造函数接受两个参数，一个是是否只读，一个是是否浅层，默认都是 false
 */
class BaseReactiveHandler implements ProxyHandler<Target> {
  constructor(
    protected readonly _isReadonly = false,
    protected readonly _isShallow = false,
  ) {}

  get(target: Target, key: string | symbol, receiver: object) {
    // console.log(`%c⧭`, 'color: #9E9E9E; font-weight: bold', 'BaseReactiveHandler.get');
    // console.log('target', target);
    // console.log('key', key);
    // console.log('receiver', receiver);
    const isReadonly = this._isReadonly,
      isShallow = this._isShallow

    /**
     * // NICE: 检查 key 是否是 ReactiveFlags 中的属性
     * IS_REACTIVE: 是否是响应式对象
     * IS_READONLY: 是否是只读对象
     * IS_SHALLOW: 是否是浅层对象
     * RAW: 原始对象
     */
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return isShallow
    } else if (key === ReactiveFlags.RAW) {
      /**
       * // NICE: 判断
       */
      // let map;
      // if (isReadonly) {
      //     map = isShallow ? shallowReadonlyMap : readonlyMap;
      // } else {
      //     map = isShallow ? shallowReactiveMap : reactiveMap;
      // }

      // if (receiver === map.get(target) || Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
      //     return target;
      // }
      // return;
      // NICE: 上述为直观代码，下面为源码

      if (
        receiver ===
          (isReadonly
            ? isShallow
              ? shallowReadonlyMap
              : readonlyMap
            : isShallow
              ? shallowReactiveMap
              : reactiveMap
          ).get(target) ||
        // receiver is not the reactive proxy, but has the same prototype
        // this means the reciever is a user proxy of the reactive proxy
        // NICE: 如果 receiver 不是响应式代理，但具有相同的原型
        // 这意味着 receiver 是响应式代理的用户代理
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
      ) {
        // console.log('此时的 target', target);
        return target
      }
      // early return undefined
      return
    }

    // NICE: 数组的特殊处理
    const targetIsArray = isArray(target)

    // NICE: 非只读状态下，数组的特殊处理
    if (!isReadonly) {
      // NICE: 是数组，且 key 是数组的方法
      if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        // NICE: 返回数组的方法
        return Reflect.get(arrayInstrumentations, key, receiver)
      }
      // NICE: key 是 hasOwnProperty, 返回 hasOwnProperty 方法
      if (key === 'hasOwnProperty') {
        return hasOwnProperty
      }
    }

    // NICE: Reflect.get 获取值
    const res = Reflect.get(target, key, receiver)

    // NICE: 如果 key 是 Symbol 或者是非追踪的 key，直接返回
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    // NICE: 如果不是只读状态，追踪 key
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    // NICE: 如果是浅层，直接返回
    if (isShallow) {
      return res
    }

    // NICE: 如果是 ref，直接返回 value
    if (isRef(res)) {
      // ref unwrapping - skip unwrap for Array + integer key.
      return targetIsArray && isIntegerKey(key) ? res : res.value
    }

    // NICE: 如果是对象，返回代理对象
    if (isObject(res)) {
      // Convert returned value into a proxy as well. we do the isObject check
      // here to avoid invalid value warning. Also need to lazy access readonly
      // and reactive here to avoid circular dependency.
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}

class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow = false) {
    super(false, isShallow)
  }

  set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object,
  ): boolean {
    let oldValue = (target as any)[key]
    if (!this._isShallow) {
      // NICE: 如果不是浅层，且不是只读状态
      const isOldValueReadonly = isReadonly(oldValue)
      if (!isShallow(value) && !isReadonly(value)) {
        // NICE: 旧值和新值都转换为原始值
        oldValue = toRaw(oldValue)
        value = toRaw(value)
      }

      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        if (isOldValueReadonly) {
          return false
        } else {
          oldValue.value = value
          return true
        }
      }
    } else {
      // in shallow mode, objects are set as-is regardless of reactive or not
    }

    // NICE: Reflect.set 设置值
    // hadKey: 是否有 key
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)
    const result = Reflect.set(target, key, value, receiver)
    // don't trigger if target is something up in the prototype chain of original
    // NICE: 出发 trigger，更新值
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }

  deleteProperty(target: object, key: string | symbol): boolean {
    const hadKey = hasOwn(target, key)
    const oldValue = (target as any)[key]
    const result = Reflect.deleteProperty(target, key)
    if (result && hadKey) {
      trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
    }
    return result
  }

  has(target: object, key: string | symbol): boolean {
    const result = Reflect.has(target, key)
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, TrackOpTypes.HAS, key)
    }
    return result
  }
  ownKeys(target: object): (string | symbol)[] {
    track(
      target,
      TrackOpTypes.ITERATE,
      isArray(target) ? 'length' : ITERATE_KEY,
    )
    return Reflect.ownKeys(target)
  }
}

class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow = false) {
    super(true, isShallow)
  }

  set(target: object, key: string | symbol) {
    if (__DEV__) {
      warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target,
      )
    }
    return true
  }

  deleteProperty(target: object, key: string | symbol) {
    if (__DEV__) {
      warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target,
      )
    }
    return true
  }
}

export const mutableHandlers: ProxyHandler<object> =
  /*#__PURE__*/ new MutableReactiveHandler()

export const readonlyHandlers: ProxyHandler<object> =
  /*#__PURE__*/ new ReadonlyReactiveHandler()

export const shallowReactiveHandlers = /*#__PURE__*/ new MutableReactiveHandler(
  true,
)

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers =
  /*#__PURE__*/ new ReadonlyReactiveHandler(true)
