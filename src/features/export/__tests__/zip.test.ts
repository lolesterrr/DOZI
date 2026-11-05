import { memorySink, readZip } from '@/test-utils/readZip';

import { crc32, dosDateTime, ZipWriter } from '../zip';

const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

describe('zip writer', () => {
  it('uses the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('stores dates in the MS-DOS format', () => {
    const { time, date } = dosDateTime(new Date(2026, 10, 5, 12, 30, 10));
    expect(date).toBe(((2026 - 1980) << 9) | (11 << 5) | 5);
    expect(time).toBe((12 << 11) | (30 << 5) | 5);
  });

  it('writes files that read back exactly, including UTF-8 names and empty files', () => {
    const sink = memorySink();
    const zip = new ZipWriter(sink.write);
    const picture = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    zip.addFile('dozi-data.json', '{"colour":"✓"}');
    zip.addFile('media/ä1.jpg', picture);
    zip.addFile('empty.txt', '');
    zip.finish();

    const files = readZip(sink.bytes());
    expect([...files.keys()]).toEqual(['dozi-data.json', 'media/ä1.jpg', 'empty.txt']);
    expect(text(files.get('dozi-data.json'))).toBe('{"colour":"✓"}');
    expect([...(files.get('media/ä1.jpg') ?? [])]).toEqual([...picture]);
    expect(files.get('empty.txt')).toHaveLength(0);
  });
});
