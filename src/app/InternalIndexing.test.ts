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
    expect(
      parsedHtml.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    ).toBe('CT Scan Scheduling');
    expect(
      parsedHtml.querySelector('link[rel="manifest"]')?.getAttribute('href'),
    ).toBe('/site.webmanifest');
    expect(parsedHtml.querySelector('#root')?.textContent).toContain('Loading secure CT scheduling workspace');
    expect(parsedHtml.title).toBe('CT Scan Scheduling');
  });

  it('keeps authenticated application areas out of crawler access', async () => {
    const robots = await readFile(resolve(process.cwd(), 'public/robots.txt'), 'utf8');

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /admin/');
    expect(robots).toContain('Disallow: /employee/');
    expect(robots).toContain('Disallow: /schedule/');
    expect(robots).toContain('Disallow: /forgot-password');
    expect(robots).not.toContain('Disallow: /login');
  });

  it('publishes a valid installable application manifest', async () => {
    const manifest = JSON.parse(
      await readFile(resolve(process.cwd(), 'public/site.webmanifest'), 'utf8'),
    ) as { name?: string; start_url?: string; icons?: unknown[] };

    expect(manifest.name).toBe('CT Scan Scheduling');
    expect(manifest.start_url).toBe('/login');
    expect(manifest.icons).not.toHaveLength(0);
  });
});
