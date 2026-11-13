let encoder;
const parts = [];
self.onmessage = ({ data }) => {
  try {
    if (data.command === 'start') {
      importScripts('../vendor/lamejs-1.2.1/lame.min.js');
      encoder = new lamejs.Mp3Encoder(data.count, data.rate, 320);
    } else if (data.command === 'encode') {
      const [left, right] = data.block;
      for (let offset = 0; offset < left.length; offset += 1152) {
        const samples = left.subarray(offset, offset + 1152);
        const bytes = right ? encoder.encodeBuffer(samples, right.subarray(offset, offset + 1152)) :
          encoder.encodeBuffer(samples);
        if (bytes.length) parts.push(bytes);
      }
    } else if (data.command === 'finish') {
      parts.push(encoder.flush());
      self.postMessage({ blob: new Blob(parts, { type: 'audio/mpeg' }) });
      return;
    }
    self.postMessage({ ready: true });
  } catch (error) {
    self.postMessage({ error: error.message || 'MP3 encoding failed.' });
  }
};
