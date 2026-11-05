import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { getLogLevel, setLogLevel } from '@/lib/logger';
import { fakeTutorialFiles } from '@/test-utils/fakeTutorialFiles';

import { findTutorial, TUTORIALS, type Tutorial } from '../catalog';
import { parseManifest, tutorialUrl } from '../logic';
import {
  downloadedBytes,
  downloadTutorial,
  getTutorialsRevision,
  refreshManifest,
  removeDownloads,
  resetTutorialsForTests,
  videoStatus,
  type TutorialDeps,
} from '../store';

// Task 3.7: tutorial videos download once from the cloud, then play offline.

const PROJECT = 'https://sample.supabase.co';
const logLevel = getLogLevel();
beforeAll(() => setLogLevel('error'));
afterAll(() => setLogLevel(logLevel));
afterEach(() => resetTutorialsForTests());

function setup(projectUrl: string | null = PROJECT) {
  const fake = fakeTutorialFiles();
  for (const t of TUTORIALS) {
    if (t.video.kind === 'cloud') {
      fake.web.set(tutorialUrl(PROJECT, t.video.file), `SAMPLE video ${t.id}`);
    }
  }
  const deps: TutorialDeps = {
    files: fake.files,
    projectUrl,
    fetchText: fake.fetchText,
    pause: async () => {},
  };
  return { ...fake, deps };
}

const decks = findTutorial('03-decks') as Tutorial;
const welcome = findTutorial('01-welcome') as Tutorial;

describe('tutorial videos', () => {
  it('keeps the welcome video in the app, so it always plays', () => {
    const { deps } = setup(null);
    expect(welcome.video.kind).toBe('bundled');
    expect(videoStatus(welcome, deps)).toMatchObject({ kind: 'ready' });
  });

  it('downloads a video once, then plays it from the phone', async () => {
    const { deps, stored } = setup();
    expect(videoStatus(decks, deps)).toEqual({
      kind: 'cloud',
      bytes: 3_298_538,
      state: 'idle',
      progress: 0,
      failures: 0,
      error: null,
    });

    expect(await downloadTutorial(decks, deps)).toBe(true);
    expect(stored.get('03-decks.mp4')).toBe('SAMPLE video 03-decks');
    expect(videoStatus(decks, deps)).toEqual({
      kind: 'ready',
      source: 'file:///docs/tutorials/03-decks.mp4',
    });
    // Offline later: still ready, nothing to fetch.
    expect(await downloadTutorial(decks, { ...deps, projectUrl: null })).toBe(true);
  });

  it('shows progress while downloading and ignores a second tap', async () => {
    const { deps, control } = setup();
    control.hold = true;
    const first = downloadTutorial(decks, deps);
    await Promise.resolve();
    expect(videoStatus(decks, deps)).toMatchObject({ state: 'downloading', progress: 0.5 });
    expect(await downloadTutorial(decks, deps)).toBe(false);
    control.release();
    expect(await first).toBe(true);
  });

  it('remembers a failed download so the player can offer “try again”', async () => {
    const { deps, control } = setup();
    control.failNext = new Error('Network request failed');
    const before = getTutorialsRevision();
    expect(await downloadTutorial(decks, deps)).toBe(false);
    expect(getTutorialsRevision()).toBeGreaterThan(before);
    expect(videoStatus(decks, deps)).toMatchObject({
      state: 'failed',
      failures: 1,
      error: 'Network request failed',
    });
    control.failNext = new Error('Network request failed');
    await downloadTutorial(decks, deps);
    // Counts tries in a row, so the player can say "still couldn't".
    expect(videoStatus(decks, deps)).toMatchObject({ state: 'failed', failures: 2 });
    expect(await downloadTutorial(decks, deps)).toBe(true);
  });

  it('counts a video as downloaded when the file arrived, even if an error came after', async () => {
    const { deps, control } = setup();
    control.failAfterSaving = new Error('Something went wrong at the very end');
    expect(await downloadTutorial(decks, deps)).toBe(true);
    expect(videoStatus(decks, deps)).toMatchObject({ kind: 'ready' });
  });

  it('can’t download without a cloud to download from', async () => {
    const { deps } = setup(null);
    expect(videoStatus(decks, deps)).toEqual({ kind: 'unavailable' });
    expect(await downloadTutorial(decks, deps)).toBe(false);
  });

  it('follows the manifest to a re-rendered video and removes the old one', async () => {
    const { deps, stored, web } = setup();
    await downloadTutorial(decks, deps);
    web.set(
      tutorialUrl(PROJECT, 'manifest.json'),
      JSON.stringify({
        version: 1,
        videos: [{ id: '03-decks', file: '03-decks.v2.mp4', bytes: 3_400_000 }],
      }),
    );
    web.set(tutorialUrl(PROJECT, '03-decks.v2.mp4'), 'SAMPLE video 03-decks, take 2');

    await refreshManifest(TUTORIALS, deps);
    expect(stored.has('03-decks.mp4')).toBe(false);
    expect(videoStatus(decks, deps)).toMatchObject({ kind: 'cloud', bytes: 3_400_000 });
    await downloadTutorial(decks, deps);
    expect(stored.get('03-decks.v2.mp4')).toBe('SAMPLE video 03-decks, take 2');

    // The manifest is kept, so after a restart with no internet it still knows the new file.
    resetTutorialsForTests();
    expect(videoStatus(decks, { ...deps, projectUrl: null })).toMatchObject({ kind: 'ready' });
  });

  it('keeps what it has when the manifest can’t be fetched or is broken', async () => {
    const { deps, stored, web } = setup();
    await refreshManifest(TUTORIALS, deps); // 404
    web.set(tutorialUrl(PROJECT, 'manifest.json'), '{"version": 9}');
    await refreshManifest(TUTORIALS, deps);
    expect(stored.has('manifest.json')).toBe(false);
    expect(videoStatus(decks, deps)).toMatchObject({ kind: 'cloud', bytes: 3_298_538 });
  });

  it('adds up the downloaded videos and removes them all', async () => {
    const { deps, stored } = setup();
    await downloadTutorial(decks, deps);
    await downloadTutorial(findTutorial('02-notes') as Tutorial, deps);
    expect(downloadedBytes(TUTORIALS, deps)).toBe(
      'SAMPLE video 03-decks'.length + 'SAMPLE video 02-notes'.length,
    );
    stored.set('manifest.json', '{}');
    removeDownloads(deps);
    expect([...stored.keys()]).toEqual(['manifest.json']);
    expect(downloadedBytes(TUTORIALS, deps)).toBe(0);
  });
});

describe('the videos to upload (tools/tutorials/cloud)', () => {
  const folder = join(__dirname, '../../../../tools/tutorials/cloud');
  const manifest = parseManifest(readFileSync(join(folder, 'manifest.json'), 'utf8'));

  it('has a valid manifest that matches the files', () => {
    expect(manifest).not.toBeNull();
    const mp4s = readdirSync(folder).filter((f) => f.endsWith('.mp4'));
    expect(manifest?.videos.map((v) => v.file).sort()).toEqual(mp4s.sort());
    for (const v of manifest?.videos ?? []) {
      expect(statSync(join(folder, v.file)).size).toBe(v.bytes);
    }
  });

  it('has every cloud video the app lists, the same size as the app expects', () => {
    for (const t of TUTORIALS) {
      if (t.video.kind !== 'cloud') continue;
      expect(manifest?.videos.find((v) => v.id === t.id)).toEqual({
        id: t.id,
        file: t.video.file,
        bytes: t.video.bytes,
      });
    }
  });

  it('builds only the welcome video into the app', () => {
    const bundled = readdirSync(join(__dirname, '../../../../assets/tutorials')).filter((f) =>
      f.endsWith('.mp4'),
    );
    expect(bundled).toEqual(['01-welcome.mp4']);
    expect(TUTORIALS.filter((t) => t.video.kind === 'bundled').map((t) => t.id)).toEqual([
      '01-welcome',
    ]);
  });
});
