import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// A small uncompressed ZIP keeps the downloadable extension reproducible and dependency-free.
const root = fileURLToPath(new URL('../../browser-extensions/fgis/', import.meta.url));
const output = fileURLToPath(new URL('../public/fgis-extension.zip', import.meta.url));
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
const local = []; const directory = []; let offset = 0;
const entries = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isFile()).sort((a, b) => a.name.localeCompare(b.name, 'en'));
for (const entry of entries) {
  const name = Buffer.from(entry.name, 'utf8'); const content = await readFile(path.join(root, entry.name)); const crc = crc32(content);
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(33, 12);
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(content.length, 18); header.writeUInt32LE(content.length, 22); header.writeUInt16LE(name.length, 26);
  local.push(header, name, content);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(33, 14);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(content.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
  directory.push(central, name); offset += header.length + name.length + content.length;
}
const central = Buffer.concat(directory); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, Buffer.concat([...local, central, end]));
console.log(`Packaged ZNAQ → ФГИС (${entries.length} files)`);
