import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('public and internal indexing policy', () => {
  it('makes the public entry shell discoverable and descriptive', async () => {
    const html = await readFile(resolve(process.cwd(), 'index.html'), 'utf8');
    const parsedHtml = new DOMParser().parseFromString(html, 'text/html');

    expect(
      parsedHtml.querySelector('meta[name="robots"]')?.getAttribute('content'),
    ).toBe('index, follow');
    expect(
      parsedHtml.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toContain('CT scan workforce scheduling');
    expect(parsedHtml.title).toBe('CT Scan Scheduling');
  });

  it('keeps authenticated application areas out of crawler access', async () => {
    const robots = await readFile(resolve(process.cwd(), 'public/robots.txt'), 'utf8');

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /admin/');
    expect(robots).toContain('Disallow: /employee/');
    expect(robots).toContain('Disallow: /schedule/');
    expect(robots).not.toContain('Disallow: /login');
  });
});
