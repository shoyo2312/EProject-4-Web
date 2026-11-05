/**
 * Saves a media file under `fileName`. The file lives on object storage, another origin, where
 * `<a download>` is ignored and the browser would just play it — so it is fetched into a blob
 * first. Rejects when the storage refuses the read: a `window.open` fallback here would run
 * after the await, outside the click's user activation, and popup blockers drop it silently.
 */
export async function downloadFile(url: string, fileName: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();

  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(href);
}
