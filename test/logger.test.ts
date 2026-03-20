import { describe, it, expect, vi, afterEach } from 'vitest'
import { createLogger, defaultLogger } from '../src/deploy/logger.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createLogger', () => {
  it('defaults to normal level', () => {
    const logger = createLogger()
    expect(logger.level).toBe('normal')
  })

  it('sets verbose level when verbose is true', () => {
    const logger = createLogger({ verbose: true })
    expect(logger.level).toBe('verbose')
  })

  it('sets debug level when debug is true', () => {
    const logger = createLogger({ debug: true })
    expect(logger.level).toBe('debug')
  })

  it('debug implies verbose', () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ debug: true })

    logger.verbose('verbose message')
    expect(stderrSpy).toHaveBeenCalledWith('[verbose] verbose message')
  })

  it('log() always outputs to stdout', () => {
    const stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger()

    logger.log('hello')
    expect(stdoutSpy).toHaveBeenCalledWith('hello')
  })

  it('verbose() outputs to stderr with prefix when verbose', () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ verbose: true })

    logger.verbose('step info')
    expect(stderrSpy).toHaveBeenCalledWith('[verbose] step info')
  })

  it('verbose() is silent at normal level', () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger()

    logger.verbose('should not appear')
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('debug() outputs to stderr with prefix when debug', () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ debug: true })

    logger.debug('payload data')
    expect(stderrSpy).toHaveBeenCalledWith('[debug] payload data')
  })

  it('debug() is silent at verbose level', () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ verbose: true })

    logger.debug('should not appear')
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('time() logs elapsed time at verbose level', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ verbose: true })

    const done = logger.time('Test step')
    // small delay to get non-zero timing
    await new Promise(r => setTimeout(r, 10))
    done()

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[verbose\] Test step completed in \d+ms/),
    )
  })

  it('time() is a no-op at normal level', () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger()

    const done = logger.time('Noop step')
    done()

    expect(stderrSpy).not.toHaveBeenCalled()
  })
})

describe('defaultLogger', () => {
  it('has normal level', () => {
    expect(defaultLogger.level).toBe('normal')
  })

  it('log() outputs to stdout', () => {
    const stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    defaultLogger.log('test')
    expect(stdoutSpy).toHaveBeenCalledWith('test')
  })

  it('verbose() and debug() are no-ops', () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    defaultLogger.verbose('nope')
    defaultLogger.debug('nope')
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('time() returns no-op', () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const done = defaultLogger.time('noop')
    done()
    expect(stderrSpy).not.toHaveBeenCalled()
  })
})
