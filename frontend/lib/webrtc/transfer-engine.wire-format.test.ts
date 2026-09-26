import { describe, it, expect } from 'vitest';
import { __wireFormat } from './transfer-engine';

const { HDR, FLAG_LAST, FLAG_MANIFEST, FLAG_ACCEPT, FLAG_ERROR, FLAG_RESUME_RESPONSE, encodeHeader, decodeFrame, concat } = __wireFormat;

describe('wire format — header encode/decode round trip', () => {
  it('round-trips all fields exactly', () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const header = encodeHeader(3, 41, -12345, 100, FLAG_LAST);
    const frame = concat(header, payload);

    const parsed = decodeFrame(frame);

    expect(parsed.transferIndex).toBe(3);
    expect(parsed.chunkIndex).toBe(41);
    expect(parsed.crc32).toBe(-12345);
    expect(parsed.totalChunks).toBe(100);
    expect(parsed.flags).toBe(FLAG_LAST);
    expect(Array.from(parsed.payload)).toEqual(Array.from(payload));
  });

  it('the header is exactly 17 bytes', () => {
    const header = encodeHeader(0, 0, 0, 1, 0);
    expect(header.byteLength).toBe(HDR);
    expect(HDR).toBe(17);
  });

  it('sentinel transferIndex values for manifest/control frames round-trip correctly', () => {
    const manifestHeader = encodeHeader(0xffffffff, 0, 0, 1, FLAG_MANIFEST);
    expect(decodeFrame(concat(manifestHeader, new Uint8Array())).transferIndex).toBe(0xffffffff);

    const ctrlHeader = encodeHeader(0xfffffffe, 0, 0, 1, FLAG_ACCEPT);
    expect(decodeFrame(concat(ctrlHeader, new Uint8Array())).transferIndex).toBe(0xfffffffe);
  });

  it('a large uint32 chunkIndex (near the boundary of realistic file sizes) round-trips without overflow', () => {
    // 128KB chunks, so chunkIndex 500,000 corresponds to a ~64GB file —
    // deliberately larger than any realistic transfer to confirm no silent
    // truncation at smaller boundaries (e.g. int32/signed overflow).
    const header = encodeHeader(0, 500_000, 0, 500_001, 0);
    expect(decodeFrame(concat(header, new Uint8Array())).chunkIndex).toBe(500_000);
  });

  it('flag bits are independent and combinable', () => {
    const combined = FLAG_LAST | FLAG_MANIFEST;
    const header = encodeHeader(0, 0, 0, 1, combined);
    const parsed = decodeFrame(concat(header, new Uint8Array()));

    expect((parsed.flags & FLAG_LAST) !== 0).toBe(true);
    expect((parsed.flags & FLAG_MANIFEST) !== 0).toBe(true);
    expect((parsed.flags & FLAG_ACCEPT) !== 0).toBe(false);
    expect((parsed.flags & FLAG_ERROR) !== 0).toBe(false);
    expect((parsed.flags & FLAG_RESUME_RESPONSE) !== 0).toBe(false);
  });

  it('a negative CRC32 (very common — CRC32 int32 is often negative) round-trips exactly', () => {
    // CRC32.buf() results, when interpreted as int32, are negative roughly
    // half the time — confirm DataView's setInt32/getInt32 handles this
    // (this is exactly the kind of thing that silently breaks with the
    // wrong DataView method, e.g. accidentally using setUint32 for this field).
    const header = encodeHeader(0, 0, -1, 1, 0);
    expect(decodeFrame(concat(header, new Uint8Array())).crc32).toBe(-1);
  });

  it('empty payload decodes to an empty (not undefined) payload array', () => {
    const header = encodeHeader(0, 0, 0, 1, 0);
    const parsed = decodeFrame(concat(header, new Uint8Array()));
    expect(parsed.payload.byteLength).toBe(0);
  });

  it('payload immediately following the header is preserved byte-for-byte, including zero bytes', () => {
    const payload = new Uint8Array([0, 0, 255, 0, 128]);
    const header = encodeHeader(1, 2, 3, 4, 0);
    const parsed = decodeFrame(concat(header, payload));
    expect(Array.from(parsed.payload)).toEqual([0, 0, 255, 0, 128]);
  });
});

describe('concat', () => {
  it('joins multiple Uint8Arrays in order', () => {
    const result = concat(new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5]));
    expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles empty arrays without corrupting the join', () => {
    const result = concat(new Uint8Array([1]), new Uint8Array([]), new Uint8Array([2]));
    expect(Array.from(result)).toEqual([1, 2]);
  });

  it('returns an empty array when given no inputs', () => {
    expect(concat().byteLength).toBe(0);
  });
});
