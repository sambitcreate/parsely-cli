function getWidth(value: string): number {
  return Array.from(value).length;
}

function chunkWord(word: string, width: number): string[] {
  if (width <= 0) {
    return [word];
  }

  const chunks: string[] = [];
  let remaining = word;

  while (getWidth(remaining) > width) {
    const segment = Array.from(remaining).slice(0, width).join('');
    chunks.push(segment);
    remaining = Array.from(remaining).slice(width).join('');
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

export function wrapText(
  text: string,
  width: number,
  initialIndent = '',
  continuationIndent = initialIndent,
): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [initialIndent.trimEnd()];
  }

  const words = normalized.split(' ');
  const lines: string[] = [];
  let prefix = initialIndent;
  let current = '';

  const flush = () => {
    lines.push(`${prefix}${current}`.trimEnd());
    prefix = continuationIndent;
    current = '';
  };

  for (const word of words) {
    const available = Math.max(1, width - getWidth(prefix));

    if (getWidth(word) > available) {
      if (current) {
        flush();
      }

      const chunks = chunkWord(word, available);
      chunks.forEach((chunk, index) => {
        lines.push(`${prefix}${chunk}`.trimEnd());
        if (index < chunks.length - 1) {
          prefix = continuationIndent;
        }
      });
      prefix = continuationIndent;
      current = '';
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (getWidth(prefix) + getWidth(candidate) <= width) {
      current = candidate;
      continue;
    }

    flush();
    current = word;
  }

  if (current || lines.length === 0) {
    lines.push(`${prefix}${current}`.trimEnd());
  }

  return lines;
}
