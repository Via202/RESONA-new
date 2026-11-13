import { encodeExport, renderExport } from './audio-export.js';

export function bindExportControls({ wav, mp3, status, download, snapshot,
  render = renderExport, encode = encodeExport }) {
  let active = false, url;
  function clearDownload() {
    if (url) URL.revokeObjectURL(url);
    url = undefined;
    download.hidden = true;
    download.removeAttribute('href');
  }
  async function run(format) {
    if (active) return;
    active = wav.disabled = mp3.disabled = true;
    clearDownload();
    const update = message => { status.textContent = message; };
    update('Preparing audio…');
    try {
      const request = snapshot();
      const rendered = await render(request, update);
      const message = format === 'mp3' ? 'Encoding MP3 at 320 kbps…' : 'Encoding WAV…';
      update(message);
      await new Promise(resolve => setTimeout(resolve, 0));
      let lastPercent = -1;
      const blob = await encode(rendered, format, fraction => {
        const percent = Math.floor(fraction * 100);
        if (percent !== lastPercent && percent < 100) update(`${message} ${percent}%`);
        lastPercent = percent;
      });
      url = URL.createObjectURL(blob);
      download.href = url;
      download.download = request.name.replace(/[^a-zA-Z0-9_-]/g, '-') + '.' + format;
      download.hidden = false;
      update('Export ready. Use the download link if needed.');
      download.click();
    } catch (error) {
      update('Export failed. ' + (error.message || 'Please try again.'));
    } finally {
      active = wav.disabled = mp3.disabled = false;
    }
  }
  wav.addEventListener('click', () => run('wav'));
  mp3.addEventListener('click', () => run('mp3'));
  return clearDownload;
}
