import {
  addLogSink,
  consoleSink,
  createLogger,
  getLogLevel,
  setLogLevel,
  type LogEntry,
} from '../logger';

describe('logger', () => {
  const initialLevel = getLogLevel();
  let entries: LogEntry[];
  let removeSink: () => void;

  beforeEach(() => {
    entries = [];
    removeSink = addLogSink((entry) => entries.push(entry));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    removeSink();
    setLogLevel(initialLevel);
    jest.restoreAllMocks();
  });

  it('logs everything in development and tags entries with scope, level and time', () => {
    expect(initialLevel).toBe('debug');
    const log = createLogger('db');
    log.debug('opened', { tables: 2 });
    log.error('failed', new Error('disk full'));

    expect(entries.map((e) => [e.level, e.scope, e.message])).toEqual([
      ['debug', 'db', 'opened'],
      ['error', 'db', 'failed'],
    ]);
    expect(entries[0].data).toEqual({ tables: 2 });
    expect(entries[1].error).toBeInstanceOf(Error);
    expect(entries[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('drops entries below the minimum level (release builds keep warn and error)', () => {
    setLogLevel('warn');
    const log = createLogger('sync');
    log.debug('a');
    log.info('b');
    log.warn('c');
    log.error('d');
    expect(entries.map((e) => e.message)).toEqual(['c', 'd']);
  });

  it('writes to the console with the scope as a prefix', () => {
    createLogger('media').warn('big file', { bytes: 9 });
    expect(console.warn).toHaveBeenCalledWith('[media] big file', { bytes: 9 });
    consoleSink({ level: 'debug', scope: 'x', message: 'hi', at: '' });
    expect(console.log).toHaveBeenCalledWith('[x] hi');
  });

  it('keeps going when a sink throws, and stops after a sink is removed', () => {
    const remove = addLogSink(() => {
      throw new Error('broken sink');
    });
    expect(() => createLogger('app').info('still fine')).not.toThrow();
    expect(entries).toHaveLength(1);
    remove();
    removeSink();
    createLogger('app').info('after removal');
    expect(entries).toHaveLength(1);
  });
});
