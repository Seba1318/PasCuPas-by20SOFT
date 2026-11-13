import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyToMemory, validatePhoto, MAX_PHOTO_BYTES } from './validatePhoto.js';

// Un „fișier” minim: nume, mărime și primii octeți, ca un File din browser.
const fakeFile = (name, size, head) => ({
  name,
  size,
  slice: () => ({ arrayBuffer: async () => new Uint8Array(head).buffer }),
});

test('JPEG and PNG under 8 MB are accepted', async () => {
  assert.equal(await validatePhoto(fakeFile('rampa.jpg', 2_400_000, [0xff, 0xd8, 0xff, 0xe0])), null);
  assert.equal(await validatePhoto(fakeFile('rampa.png', 500_000, [0x89, 0x50, 0x4e, 0x47])), null);
});

test('too large: the message says the size and the limit (G6)', async () => {
  const msg = await validatePhoto(fakeFile('rampa.jpg', 12 * 1024 * 1024, [0xff, 0xd8, 0xff, 0xe0]));
  assert.equal(msg, 'Folosește o poză JPEG sau PNG de maxim 8 MB. „rampa.jpg” are 12 MB.');
});

test('type is checked by content, not by extension', async () => {
  const msg = await validatePhoto(fakeFile('virus.jpg', 1000, [0x4d, 0x5a, 0x90, 0x00]));
  assert.equal(msg, 'Fișierul „virus.jpg” nu e o poză JPEG sau PNG. Pozele HEIC de pe iPhone se pot salva ca JPEG din setările camerei.');
});

test('the limit is 8 MB', () => {
  assert.equal(MAX_PHOTO_BYTES, 8 * 1024 * 1024);
});

test('the photo is copied into memory with its name and type', async () => {
  const original = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])], 'rampa.jpg', { type: 'image/jpeg' });
  const copy = await copyToMemory(original);
  assert.notEqual(copy, original);
  assert.equal(copy.name, 'rampa.jpg');
  assert.equal(copy.type, 'image/jpeg');
  assert.deepEqual([...new Uint8Array(await copy.arrayBuffer())], [0xff, 0xd8, 0xff, 0xe0, 1, 2]);
});
