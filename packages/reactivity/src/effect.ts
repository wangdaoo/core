import { NOOP, extend } from '@vue/shared'
import type { ComputedRefImpl } from './computed'
import {
  DirtyLevels,
  type TrackOpTypes,
  type TriggerOpTypes,
} from './constants'
import type { Dep } from './dep'
import { type EffectScope, recordEffectScope } from './effectScope'

export type EffectScheduler = (...args: any[]) => any

export type DebuggerEvent = {
  effect: ReactiveEffect
} & DebuggerEventExtraInfo

export type DebuggerEventExtraInfo = {
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any> {
  active = true // 是否激活
  deps: Dep[] = [] // 依赖集合

  /**
   * Can be attached after creation
   * @internal
   */
  computed?: ComputedRefImpl<T> // 计算属性
  /**
   * @internal
   */
  allowRecurse?: boolean // 是否允许递归

  onStop?: () => void // 停止回调
  // dev only
  onTrack?: (event: DebuggerEvent) => void // 跟踪回调，仅在开发环境下
  // dev only
  onTrigger?: (event: DebuggerEvent) => void // 触发回调，仅在开发环境下

  /**
   * @internal
   */
  _dirtyLevel = DirtyLevels.Dirty // 脏级别
  /**
   * @internal
   */
  _trackId = 0 // 跟踪 ID
  /**
   * @internal
   */
  _runnings = 0 // 运行次数
  /**
   * @internal
   */
  _shouldSchedule = false // 是否应该调度
  /**
   * @internal
   */
  _depsLength = 0 // 依赖长度

  constructor(
    public fn: () => T, // 副作用函数
    public trigger: () => void, // 触发函数
    public scheduler?: EffectScheduler, // 调度器
    scope?: EffectScope, // 作用域
  ) {
    recordEffectScope(this, scope) // 记录作用域
  }

  // 是否脏
  public get dirty() {
    // 脏级别为 MaybeDirty_ComputedSideEffect 或 MaybeDirty 时，会触发计算属性，以便获取最新值
    if (
      this._dirtyLevel === DirtyLevels.MaybeDirty_ComputedSideEffect ||
      this._dirtyLevel === DirtyLevels.MaybeDirty
    ) {
      this._dirtyLevel = DirtyLevels.QueryingDirty
      // 暂停跟踪
      pauseTracking()
      for (let i = 0; i < this._depsLength; i++) {
        const dep = this.deps[i]
        if (dep.computed) {
          // 触发计算属性
          triggerComputed(dep.computed)
          if (this._dirtyLevel >= DirtyLevels.Dirty) {
            break
          }
        }
      }
      // 重置脏级别
      if (this._dirtyLevel === DirtyLevels.QueryingDirty) {
        this._dirtyLevel = DirtyLevels.NotDirty
      }
      // 重置跟踪
      resetTracking()
    }
    return this._dirtyLevel >= DirtyLevels.Dirty
  }

  // 设置脏
  public set dirty(v) {
    this._dirtyLevel = v ? DirtyLevels.Dirty : DirtyLevels.NotDirty
  }

  run() {
    this._dirtyLevel = DirtyLevels.NotDirty
    if (!this.active) {
      return this.fn()
    }
    let lastShouldTrack = shouldTrack
    let lastEffect = activeEffect
    try {
      shouldTrack = true
      activeEffect = this
      this._runnings++
      preCleanupEffect(this)
      return this.fn()
    } finally {
      postCleanupEffect(this)
      this._runnings--
      activeEffect = lastEffect
      shouldTrack = lastShouldTrack
    }
  }

  stop() {
    if (this.active) {
      preCleanupEffect(this)
      postCleanupEffect(this)
      this.onStop && this.onStop()
      this.active = false
    }
  }
}

function triggerComputed(computed: ComputedRefImpl<any>) {
  return computed.value
}

function preCleanupEffect(effect: ReactiveEffect) {
  effect._trackId++
  effect._depsLength = 0
}

function postCleanupEffect(effect: ReactiveEffect) {
  if (effect.deps.length > effect._depsLength) {
    for (let i = effect._depsLength; i < effect.deps.length; i++) {
      cleanupDepEffect(effect.deps[i], effect)
    }
    effect.deps.length = effect._depsLength
  }
}

function cleanupDepEffect(dep: Dep, effect: ReactiveEffect) {
  const trackId = dep.get(effect)
  if (trackId !== undefined && effect._trackId !== trackId) {
    dep.delete(effect)
    if (dep.size === 0) {
      dep.cleanup()
    }
  }
}

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}

export interface ReactiveEffectOptions extends DebuggerOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
  scope?: EffectScope
  allowRecurse?: boolean
  onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

/**
 * Registers the given function to track reactive updates.
 *
 * The given function will be run once immediately. Every time any reactive
 * property that's accessed within it gets updated, the function will run again.
 *
 * @param fn - The function that will track reactive updates.
 * @param options - Allows to control the effect's behaviour.
 * @returns A runner that can be used to control the effect after creation.
 */
export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions,
): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const _effect = new ReactiveEffect(fn, NOOP, () => {
    if (_effect.dirty) {
      _effect.run()
    }
  })
  if (options) {
    extend(_effect, options)
    if (options.scope) recordEffectScope(_effect, options.scope)
  }
  if (!options || !options.lazy) {
    _effect.run()
  }
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
}

/**
 * Stops the effect associated with the given runner.
 *
 * @param runner - Association with the effect to stop tracking.
 */
export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop()
}

// NICE: 当前执行的 effect 是否需要收集
export let shouldTrack = true
// 暂停调度栈
export let pauseScheduleStack = 0

// 调用链栈，用来处理嵌套的 effect 调用情况
// 记录这个链上的 effect 是否需要收集依赖
const trackStack: boolean[] = []

/**
 * Temporarily pauses tracking.
 */
// 暂停依赖收集
export function pauseTracking() {
  // 将当前的 shouldTrack 值保存到栈中
  trackStack.push(shouldTrack)
  shouldTrack = false
}

/**
 * Re-enables effect tracking (if it was paused).
 */
// 启用依赖收集，暂时没有具体的应用场景
export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

/**
 * Resets the previous global effect tracking state.
 */
// 重置依赖收集
export function resetTracking() {
  // 弹出栈顶的 shouldTrack 值，标识当前的 shouldTrack 值已经失效，需要恢复到上一个状态
  const last = trackStack.pop()

  // 如果 last 为 undefined，说明没有调用过 pauseTracking，此时 shouldTrack 应该为 true
  shouldTrack = last === undefined ? true : last
}

export function pauseScheduling() {
  pauseScheduleStack++
}

export function resetScheduling() {
  pauseScheduleStack--
  while (!pauseScheduleStack && queueEffectSchedulers.length) {
    queueEffectSchedulers.shift()!()
  }
}

export function trackEffect(
  effect: ReactiveEffect,
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo,
) {
  if (dep.get(effect) !== effect._trackId) {
    dep.set(effect, effect._trackId)
    const oldDep = effect.deps[effect._depsLength]
    if (oldDep !== dep) {
      if (oldDep) {
        cleanupDepEffect(oldDep, effect)
      }
      effect.deps[effect._depsLength++] = dep
    } else {
      effect._depsLength++
    }
    if (__DEV__) {
      // eslint-disable-next-line no-restricted-syntax
      effect.onTrack?.(extend({ effect }, debuggerEventExtraInfo!))
    }
  }
}

const queueEffectSchedulers: EffectScheduler[] = []

export function triggerEffects(
  dep: Dep, // 依赖集合
  dirtyLevel: DirtyLevels, // 脏级别
  debuggerEventExtraInfo?: DebuggerEventExtraInfo, // 调试信息
) {
  // 暂停调度，以避免重复触发或无序触发
  pauseScheduling()
  for (const effect of dep.keys()) {
    // dep.get(effect) is very expensive, we need to calculate it lazily and reuse the result
    let tracking: boolean | undefined
    if (
      effect._dirtyLevel < dirtyLevel &&
      (tracking ??= dep.get(effect) === effect._trackId)
    ) {
      effect._shouldSchedule ||= effect._dirtyLevel === DirtyLevels.NotDirty
      effect._dirtyLevel = dirtyLevel
    }
    if (
      effect._shouldSchedule &&
      (tracking ??= dep.get(effect) === effect._trackId)
    ) {
      if (__DEV__) {
        // eslint-disable-next-line no-restricted-syntax
        effect.onTrigger?.(extend({ effect }, debuggerEventExtraInfo))
      }
      effect.trigger()
      if (
        (!effect._runnings || effect.allowRecurse) &&
        effect._dirtyLevel !== DirtyLevels.MaybeDirty_ComputedSideEffect
      ) {
        effect._shouldSchedule = false
        if (effect.scheduler) {
          queueEffectSchedulers.push(effect.scheduler)
        }
      }
    }
  }
  resetScheduling()
}
