// Tiny browser download helpers — no deps. Used by the /tour export buttons.

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(filename, text, type = 'application/json') {
  downloadBlob(filename, new Blob([text], { type }));
}
