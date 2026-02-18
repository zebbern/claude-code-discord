export function sanitizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

export function splitText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const codePoint of text) {
    if ((current + codePoint).length > maxLength) {
      if (current) {
        chunks.push(current);
      }
      current = codePoint;
    } else {
      current += codePoint;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}