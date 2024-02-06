// using literal strings instead of numbers so that it's easier to inspect
// debugger events

export enum TrackOpTypes {
  GET = 'get',
  HAS = 'has',
  ITERATE = 'iterate',
}

export enum TriggerOpTypes {
  SET = 'set',
  ADD = 'add',
  DELETE = 'delete',
  CLEAR = 'clear',
}

export enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw',
}

/**
 * Dirty levels 脏检查级别
 * 0: not dirty 未脏
 * 1: possibly dirty 可能脏
 * 2: dirty 脏
 *
 * 脏检查的目的：
 * 1. 在脏检查时，如果当前值为 0，那么就不需要再进行脏检查了，直接返回 false
 * 2. 如果当前值为 1，那么就需要进行脏检查，如果脏检查后值为 0，那么就需要将当前值设置为 0
 * 3. 如果当前值为 2，那么就需要进行脏检查，如果脏检查后值为 0，那么就需要将当前值设置为 1
 */
export enum DirtyLevels {
  NotDirty = 0,
  QueryingDirty = 1,
  MaybeDirty_ComputedSideEffect = 2,
  MaybeDirty = 3,
  Dirty = 4,
}
