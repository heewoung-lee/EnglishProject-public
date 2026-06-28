// @ts-expect-error This style audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This style audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./ChatBubble.tsx', import.meta.url)), 'utf8');

function extractStyleHexColor(styleName: string, propertyName: string) {
  const styleBlock = new RegExp(`${styleName}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`).exec(source)?.[1];
  const color = styleBlock
    ? new RegExp(`${propertyName}:\\s*'(#[0-9a-fA-F]{6})'`).exec(styleBlock)?.[1]
    : null;

  if (!color) {
    throw new Error(`Expected ${styleName}.${propertyName} to define a hex color.`);
  }

  return color;
}

function getReadableNoteStyleColor(specificStyleName: string) {
  return source.includes(`${specificStyleName}:`)
    ? extractStyleHexColor(specificStyleName, 'color')
    : extractStyleHexColor('note', 'color');
}

function hexToRgb(hexColor: string) {
  return {
    red: Number.parseInt(hexColor.slice(1, 3), 16) / 255,
    green: Number.parseInt(hexColor.slice(3, 5), 16) / 255,
    blue: Number.parseInt(hexColor.slice(5, 7), 16) / 255,
  };
}

function linearizeChannel(channel: number) {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hexColor: string) {
  const { red, green, blue } = hexToRgb(hexColor);

  return (
    0.2126 * linearizeChannel(red) +
    0.7152 * linearizeChannel(green) +
    0.0722 * linearizeChannel(blue)
  );
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

describe('ChatBubble styles', () => {
  it('uses the inline feedback policy before rendering analysis notes', () => {
    expect(source).toContain('shouldShowInlineConversationFeedback');
    expect(source).toContain('const shouldShowNote = shouldShowInlineConversationFeedback(message.analysis);');
    expect(source).toContain('shouldShowNote ? (');
  });

  it('keeps the user analysis note readable inside the user bubble', () => {
    const userBubbleColor = extractStyleHexColor('userBubble', 'backgroundColor');
    const userNoteColor = getReadableNoteStyleColor('userNote');

    expect(contrastRatio(userNoteColor, userBubbleColor)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the assistant analysis note readable inside the assistant bubble', () => {
    const assistantBubbleColor = extractStyleHexColor('assistantBubble', 'backgroundColor');
    const assistantNoteColor = getReadableNoteStyleColor('assistantNote');

    expect(contrastRatio(assistantNoteColor, assistantBubbleColor)).toBeGreaterThanOrEqual(4.5);
  });
});
