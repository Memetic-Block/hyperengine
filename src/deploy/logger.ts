export type LogLevel = 'normal' | 'verbose' | 'debug'

export interface Logger {
  log: (msg: string) => void
  verbose: (msg: string) => void
  debug: (msg: string) => void
  time: (label: string) => () => void
  level: LogLevel
}

export function createLogger(opts: { verbose?: boolean; debug?: boolean } = {}): Logger {
  const isDebug = opts.debug ?? false
  const isVerbose = isDebug || (opts.verbose ?? false)
  const level: LogLevel = isDebug ? 'debug' : isVerbose ? 'verbose' : 'normal'

  return {
    level,
    log(msg: string) {
      console.log(msg)
    },
    verbose(msg: string) {
      if (isVerbose) console.error(`[verbose] ${msg}`)
    },
    debug(msg: string) {
      if (isDebug) console.error(`[debug] ${msg}`)
    },
    time(label: string) {
      if (!isVerbose) return () => {}
      const start = performance.now()
      return () => {
        const ms = (performance.now() - start).toFixed(0)
        console.error(`[verbose] ${label} completed in ${ms}ms`)
      }
    },
  }
}

const noop = () => {}

export const defaultLogger: Logger = {
  level: 'normal',
  log: (msg: string) => console.log(msg),
  verbose: noop,
  debug: noop,
  time: () => noop,
}
