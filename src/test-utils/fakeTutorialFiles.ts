import type { TutorialFiles } from '@/features/tutorials/files';

/** The tutorials folder in memory, with a pretend network (task 3.7 tests). */
export function fakeTutorialFiles() {
  const stored = new Map<string, string>();
  /** What the bucket serves: URL → contents. A missing URL fails like a 404. */
  const web = new Map<string, string>();
  const control = {
    /** Makes the next download throw this. */
    failNext: null as Error | null,
    /** Holds downloads until `release()` is called. */
    hold: false,
    pending: [] as (() => void)[],
    release() {
      control.pending.splice(0).forEach((resolve) => resolve());
    },
  };
  const files: TutorialFiles = {
    uri: (name) => (stored.has(name) ? `file:///docs/tutorials/${name}` : null),
    list: () => [...stored.keys()],
    size: (name) => stored.get(name)?.length ?? 0,
    remove: (name) => void stored.delete(name),
    readText: (name) => stored.get(name) ?? null,
    writeText: (name, text) => void stored.set(name, text),
    async download(url, name, onProgress) {
      if (control.failNext) {
        const error = control.failNext;
        control.failNext = null;
        throw error;
      }
      const contents = web.get(url);
      if (contents === undefined) throw new Error('HTTP 404');
      onProgress(0.5);
      if (control.hold) await new Promise<void>((resolve) => control.pending.push(resolve));
      onProgress(1);
      stored.set(name, contents);
    },
  };
  const fetchText = async (url: string) => {
    const text = web.get(url);
    if (text === undefined) throw new Error('HTTP 404');
    return text;
  };
  return { files, stored, web, control, fetchText };
}
