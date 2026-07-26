import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Rgb = [number, number, number];

const css = readFileSync(resolve(process.cwd(), 'src/styles/schedule-tokens.css'), 'utf8');

function token(block: string, name: string): Rgb {
  const match = block.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`));
  if (!match) throw new Error(`Missing RGB token: ${name}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance([red, green, blue]: Rgb): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function contrast(foreground: Rgb, background: Rgb): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('schedule semantic color tokens', () => {
  it('keeps small light-mode text and status colors at WCAG AA contrast', () => {
    const lightBlock = css.slice(css.indexOf(':root'), css.indexOf('.dark'));
    const white: Rgb = [255, 255, 255];
    const mutedSurface = token(lightBlock, 'color-surface-muted');

    expect(contrast(token(lightBlock, 'color-text-muted'), white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(lightBlock, 'color-text-muted'), mutedSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(lightBlock, 'color-success'), white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(lightBlock, 'color-warning'), white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(lightBlock, 'color-danger'), white)).toBeGreaterThanOrEqual(4.5);
  });

  it('preserves AA contrast for dark-mode semantic text colors', () => {
    const darkBlock = css.slice(css.indexOf('.dark'));
    const surface = token(darkBlock, 'color-surface');

    expect(contrast(token(darkBlock, 'color-text-muted'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(darkBlock, 'color-success'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(darkBlock, 'color-warning'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(darkBlock, 'color-danger'), surface)).toBeGreaterThanOrEqual(4.5);
  });
});
