/** PUTs a file straight to the presigned storage URL, reporting progress (fetch cannot). */
export function putWithProgress(
  url: string,
  file: Blob,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (HTTP ${String(xhr.status)})`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

/** Reads an audio file's duration in seconds from its metadata. */
export function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(audio.duration);
      else reject(new Error('Unknown duration'));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unreadable audio file'));
    };
    audio.src = url;
  });
}
