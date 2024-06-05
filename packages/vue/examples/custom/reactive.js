function reactive(obj) {
  return new Proxy(obj, {
    get(target, key) {
      // 依赖收集
      track(target, key)
      return Reflect.get(target, key)
    },

    set(target, key, value) {
      const res = Reflect.set(target, key, value)
      // 触发更新
      trigger(target, key)

      return res
    },
  })
}

let activeEffect = null
class ReactiveEffect {
  constructor(fn) {
    this.fn = fn
    this.deps = []
  }

  run() {
    activeEffect = this
    this.fn()
    activeEffect = null
  }
}

function effect(fn) {
  const _effect = new ReactiveEffect(fn)
  _effect.run()
}

const targetMap = new WeakMap()
function track(target, key) {
  if (!activeEffect) return

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)
  if (!dep) return

  dep.forEach(effect => effect.run())
}
