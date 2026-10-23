/* FOLLOWERS zip reader. Reads only the entries asked for, using byte ranges,
   so a multi-GB Instagram export is never loaded into memory.
   Uses the browser/Node built-in DecompressionStream, no library, no network. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FollowersZip = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SIG_EOCD = 0x06054b50;
  var SIG_EOCD64 = 0x06064b50;
  var SIG_LOC64 = 0x07064b50;
  var SIG_CEN = 0x02014b50;
  var SIG_LOC = 0x04034b50;
  var MAX_COMMENT = 65535;
  var EOCD_MIN = 22;
  var MAX_ENTRY_BYTES = 256 * 1024 * 1024;
  var U32_MAX = 0xffffffff;
  var U16_MAX = 0xffff;

  function ZipError(message) {
    var e = new Error(message);
    e.name = 'ZipError';
    return e;
  }

  function u16(v, o) { return v.getUint16(o, true); }
  function u32(v, o) { return v.getUint32(o, true); }
  function u64(v, o) { return v.getUint32(o, true) + v.getUint32(o + 4, true) * 4294967296; }
  function view(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }

  // reader = { size, read(start, length) -> Promise<Uint8Array> }
  function readerFromBytes(bytes) {
    return {
      size: bytes.length,
      read: function (start, length) { return Promise.resolve(bytes.subarray(start, start + length)); }
    };
  }

  function readerFromBlob(blob) {
    return {
      size: blob.size,
      read: function (start, length) {
        return blob.slice(start, start + length).arrayBuffer().then(function (b) { return new Uint8Array(b); });
      }
    };
  }

  function findEocd(tail) {
    var v = view(tail);
    for (var i = tail.length - EOCD_MIN; i >= 0; i--) {
      if (u32(v, i) === SIG_EOCD) return i;
    }
    return -1;
  }

  async function readEndRecords(reader) {
    if (reader.size < EOCD_MIN) throw ZipError('Not a zip file (too small).');
    var tailLen = Math.min(reader.size, MAX_COMMENT + EOCD_MIN + 20);
    var tailStart = reader.size - tailLen;
    var tail = await reader.read(tailStart, tailLen);
    var at = findEocd(tail);
    if (at === -1) throw ZipError('Not a zip file (no end record). The download may be incomplete.');
    var v = view(tail);
    var info = { entries: u16(v, at + 10), cdSize: u32(v, at + 12), cdOffset: u32(v, at + 16) };
    var needs64 = info.entries === U16_MAX || info.cdSize === U32_MAX || info.cdOffset === U32_MAX;
    if (!needs64) return info;

    if (at < 20 || u32(v, at - 20) !== SIG_LOC64) throw ZipError('Unsupported zip64 layout.');
    var recOffset = u64(v, at - 20 + 8);
    var rec = await reader.read(recOffset, 56);
    var rv = view(rec);
    if (rec.length < 56 || u32(rv, 0) !== SIG_EOCD64) throw ZipError('Unsupported zip64 layout.');
    return { entries: u64(rv, 32), cdSize: u64(rv, 40), cdOffset: u64(rv, 48) };
  }

  function applyZip64Extra(extra, entry) {
    var v = view(extra);
    var p = 0;
    while (p + 4 <= extra.length) {
      var id = u16(v, p);
      var size = u16(v, p + 2);
      if (id === 1) {
        var q = p + 4;
        if (entry.usize === U32_MAX) { entry.usize = u64(v, q); q += 8; }
        if (entry.csize === U32_MAX) { entry.csize = u64(v, q); q += 8; }
        if (entry.offset === U32_MAX) { entry.offset = u64(v, q); }
        return;
      }
      p += 4 + size;
    }
  }

  function parseCentralDirectory(bytes, expected) {
    var v = view(bytes);
    var dec = new TextDecoder('utf-8');
    var out = [];
    var p = 0;
    while (p + 46 <= bytes.length && out.length < expected && u32(v, p) === SIG_CEN) {
      var nameLen = u16(v, p + 28);
      var extraLen = u16(v, p + 30);
      var commentLen = u16(v, p + 32);
      var entry = {
        flags: u16(v, p + 8),
        method: u16(v, p + 10),
        csize: u32(v, p + 20),
        usize: u32(v, p + 24),
        offset: u32(v, p + 42),
        name: dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
      };
      applyZip64Extra(bytes.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen), entry);
      out.push(entry);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  async function listEntries(reader) {
    var end = await readEndRecords(reader);
    var cd = await reader.read(end.cdOffset, end.cdSize);
    return parseCentralDirectory(cd, end.entries);
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw ZipError('This browser cannot unzip files. Unzip it first and pick the .json files inside.');
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function extract(reader, entry) {
    if (entry.flags & 1) throw ZipError('This zip is password protected.');
    if (entry.usize > MAX_ENTRY_BYTES) throw ZipError('A file inside the zip is too large.');
    var head = await reader.read(entry.offset, 30);
    var hv = view(head);
    if (head.length < 30 || u32(hv, 0) !== SIG_LOC) throw ZipError('The zip looks damaged.');
    var start = entry.offset + 30 + u16(hv, 26) + u16(hv, 28);
    var raw = await reader.read(start, entry.csize);
    if (entry.method === 0) return raw;
    if (entry.method === 8) return inflateRaw(raw);
    throw ZipError('Unsupported zip compression (method ' + entry.method + ').');
  }

  // Read the text of every entry whose path passes `accept(path)`.
  async function readTexts(reader, accept) {
    var entries = await listEntries(reader);
    var wanted = entries.filter(function (e) { return !/\/$/.test(e.name) && accept(e.name); });
    var dec = new TextDecoder('utf-8');
    var out = [];
    for (var i = 0; i < wanted.length; i++) {
      out.push({ name: wanted[i].name, text: dec.decode(await extract(reader, wanted[i])) });
    }
    return { files: out, totalEntries: entries.length };
  }

  function looksLikeZip(headBytes) {
    return headBytes.length >= 4 && headBytes[0] === 0x50 && headBytes[1] === 0x4b &&
      (headBytes[2] === 0x03 || headBytes[2] === 0x05);
  }

  return {
    ZipError: ZipError,
    readerFromBytes: readerFromBytes,
    readerFromBlob: readerFromBlob,
    listEntries: listEntries,
    readTexts: readTexts,
    looksLikeZip: looksLikeZip
  };
});
