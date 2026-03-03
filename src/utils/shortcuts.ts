interface ShortcutKey {
  ctrl?: boolean;
}

function toCtrlCharacter(letter: string): string {
  const normalized = letter.trim().toLowerCase();
  if (!/^[a-z]$/.test(normalized)) {
    throw new Error(`Unsupported control shortcut: ${letter}`);
  }

  return String.fromCharCode(normalized.charCodeAt(0) - 96);
}

export function isCtrlShortcut(
  input: string,
  key: ShortcutKey,
  letter: string,
): boolean {
  const normalized = letter.trim().toLowerCase();

  return (key.ctrl === true && input.toLowerCase() === normalized) ||
    input === toCtrlCharacter(normalized);
}

export function isThemeToggleShortcut(input: string, key: ShortcutKey): boolean {
  return isCtrlShortcut(input, key, 't');
}
