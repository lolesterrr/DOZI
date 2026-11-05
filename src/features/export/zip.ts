// A minimal zip writer for "Export my data" (task 3.6). Files are stored, not compressed: the
// pictures are already JPEGs, so compressing them saves nothing, and this needs no new package.
// Bytes go to `write` as they are made, so a big export never sits in memory all at once.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The CRC-32 checksum zip files use. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Zip stores times in the old MS-DOS format (local time, 2-second steps, from 1980). */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const utf8 = (text: string) => new TextEncoder().encode(text);

type Entry = { name: Uint8Array; crc: number; size: number; offset: number };

export class ZipWriter {
  private offset = 0;
  private readonly entries: Entry[] = [];
  private readonly stamp: { time: number; date: number };

  constructor(
    private readonly write: (bytes: Uint8Array) => void,
    modified: Date = new Date(),
  ) {
    this.stamp = dosDateTime(modified);
  }

  private emit(bytes: Uint8Array) {
    this.write(bytes);
    this.offset += bytes.length;
  }

  /** Adds one file. `path` uses forward slashes, e.g. `media/<id>.jpg`. */
  addFile(path: string, data: Uint8Array | string) {
    const bytes = typeof data === 'string' ? utf8(data) : data;
    const name = utf8(path);
    const entry: Entry = { name, crc: crc32(bytes), size: bytes.length, offset: this.offset };
    if (this.entries.length >= 0xffff || this.offset + bytes.length >= 0xffffffff) {
      throw new Error('The export is too big for one zip file');
    }
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true); // local file header
    header.setUint16(4, 20, true); // version needed
    header.setUint16(6, 0x0800, true); // names are UTF-8
    header.setUint16(8, 0, true); // stored
    header.setUint16(10, this.stamp.time, true);
    header.setUint16(12, this.stamp.date, true);
    header.setUint32(14, entry.crc, true);
    header.setUint32(18, entry.size, true);
    header.setUint32(22, entry.size, true);
    header.setUint16(26, name.length, true);
    header.setUint16(28, 0, true);
    this.emit(new Uint8Array(header.buffer));
    this.emit(name);
    this.emit(bytes);
    this.entries.push(entry);
  }

  /** Writes the table of contents. Call once, after the last file. */
  finish() {
    const start = this.offset;
    for (const entry of this.entries) {
      const header = new DataView(new ArrayBuffer(46));
      header.setUint32(0, 0x02014b50, true); // central directory header
      header.setUint16(4, 20, true); // made by
      header.setUint16(6, 20, true); // version needed
      header.setUint16(8, 0x0800, true);
      header.setUint16(10, 0, true);
      header.setUint16(12, this.stamp.time, true);
      header.setUint16(14, this.stamp.date, true);
      header.setUint32(16, entry.crc, true);
      header.setUint32(20, entry.size, true);
      header.setUint32(24, entry.size, true);
      header.setUint16(28, entry.name.length, true);
      // extra length, comment length, disk, internal and external attributes stay 0
      header.setUint32(42, entry.offset, true);
      this.emit(new Uint8Array(header.buffer));
      this.emit(entry.name);
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); // end of central directory
    end.setUint16(8, this.entries.length, true);
    end.setUint16(10, this.entries.length, true);
    end.setUint32(12, this.offset - start, true);
    end.setUint32(16, start, true);
    this.emit(new Uint8Array(end.buffer));
  }
}
