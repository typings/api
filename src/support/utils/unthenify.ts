import Promise = require('native-or-bluebird')

type Callback <T> = (error: Error, result: T) => any

export default function unthenify <U> (fn: () => Promise<U>): (cb: Callback<U>) => any
export default function unthenify <T1, U> (fn: (a: T1) => Promise<U>): (a: T1, cb: Callback<U>) => any
export default function unthenify <T1, T2, U> (fn: (a: T1, b: T2) => Promise<U>): (a: T1, b: T2, cb: Callback<U>) => any
export default function unthenify <T1, T2, T3, U> (fn: (a: T1, b: T2, c: T3) => Promise<U>): (a: T1, b: T2, c: T3, cb: Callback<U>) => any
export default function unthenify <U> (fn: (...args: any[]) => Promise<any>): (...args: any[]) => any {
  return function () {
    const args = Array.prototype.slice.call(arguments)
    const cb = args.pop()

    fn.apply(this, args)
      .then(
        (res: U) => cb(null, res),
        (err: Error) => cb(err || new TypeError('Promise was rejected with falsy value'))
      )
  }
}
