import axe, { type ElementContext, type RunOptions } from 'axe-core';
import { expect } from 'vitest';

const jsdomOptions: RunOptions = {
  rules: {
    // jsdom has no layout engine, so contrast remains a browser-level check.
    'color-contrast': { enabled: false },
  },
};

export async function expectNoAxeViolations(
  context: ElementContext,
  options: RunOptions = {},
) {
  const results = await axe.run(context, {
    ...jsdomOptions,
    ...options,
    rules: {
      ...jsdomOptions.rules,
      ...options.rules,
    },
  });

  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(' ')),
  }));

  expect(violations).toEqual([]);
}
