export async function downloadImage(url: string, title: string) {
  const name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'styleout-look';
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.jpg`;
  link.target = '_blank';
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
