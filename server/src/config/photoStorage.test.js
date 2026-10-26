/**
 * Unit tests for photo storage (local mode; Cloudinary needs an account). Run with:  npm test
 */
const fs = require('fs');
const path = require('path');
const { UPLOAD_ROOT } = require('./uploads');
const PhotoStorage = require('./photoStorage');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'); // PNG header bytes

describe('photoStorage (local mode)', () => {
  test('without CLOUDINARY_URL the photos stay on the server disk', () => {
    expect(PhotoStorage.STORAGE_MODE).toBe('local');
  });

  test('save -> read -> delete', async () => {
    const stored = await PhotoStorage.savePhoto('reports', PNG, '.png');
    expect(stored).toMatch(/^reports\/[0-9a-f]{32}\.png$/);
    expect(fs.existsSync(path.join(UPLOAD_ROOT, stored))).toBe(true);

    const photo = await PhotoStorage.readPhoto(stored);
    expect(photo.contentType).toBe('image/png');
    expect(photo.buffer.equals(PNG)).toBe(true);

    await PhotoStorage.deletePhoto(stored);
    expect(fs.existsSync(path.join(UPLOAD_ROOT, stored))).toBe(false);
    expect(await PhotoStorage.readPhoto(stored)).toBeNull();
  });

  test('paths outside the uploads folder are refused', async () => {
    expect(PhotoStorage.localFile('../.env')).toBeNull();
    expect(PhotoStorage.localFile('reports/../../src/app.js')).toBeNull();
    expect(await PhotoStorage.readPhoto('../package.json')).toBeNull();
  });

  test('a Cloudinary path is read back into its id and format', () => {
    expect(PhotoStorage.parseCloudPath('cloudinary:landayan/reports/ab12.jpg')).toEqual({ publicId: 'landayan/reports/ab12', format: 'jpg' });
    expect(PhotoStorage.parseCloudPath('cloudinary:noformat')).toBeNull();
  });

  test('a Cloudinary photo without Cloudinary settings is "not found", not a crash', async () => {
    expect(await PhotoStorage.readPhoto('cloudinary:landayan/reports/ab12.jpg')).toBeNull();
  });
});
