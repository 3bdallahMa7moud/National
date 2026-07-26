import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import HospitalLogo from './HospitalLogo';

afterEach(cleanup);

const fragmentReferencePattern = /^url\(#([a-zA-Z][a-zA-Z0-9_-]*)\)$/;

function getFragmentReferences(svg: SVGSVGElement): string[] {
  return Array.from(svg.querySelectorAll('*')).flatMap((element) =>
    Array.from(element.attributes)
      .map((attribute) => attribute.value.match(fragmentReferencePattern)?.[1])
      .filter((id): id is string => Boolean(id)),
  );
}

describe('HospitalLogo', () => {
  it('keeps definition IDs and fragment references isolated across logo variants', () => {
    const { container } = render(
      <>
        <HospitalLogo variant="default" />
        <HospitalLogo variant="white" />
        <HospitalLogo variant="colored" />
      </>,
    );

    const logos = Array.from(container.querySelectorAll('svg'));
    const allDefinitionIds = logos.flatMap((logo) =>
      Array.from(logo.querySelectorAll('defs [id]'), (definition) => definition.id),
    );

    expect(logos).toHaveLength(3);
    expect(allDefinitionIds).toHaveLength(12);
    expect(new Set(allDefinitionIds).size).toBe(allDefinitionIds.length);

    logos.forEach((logo) => {
      const localDefinitionIds = new Set(
        Array.from(logo.querySelectorAll('defs [id]'), (definition) => definition.id),
      );
      const references = getFragmentReferences(logo);

      expect(localDefinitionIds.size).toBe(4);
      expect(references).toHaveLength(5);
      references.forEach((referencedId) => {
        expect(localDefinitionIds).toContain(referencedId);
        expect(document.getElementById(referencedId)).toBe(
          logo.querySelector(`[id="${referencedId}"]`),
        );
      });
    });
  });

  it('keeps generated fragment IDs stable across rerenders', () => {
    const { container, rerender } = render(<HospitalLogo variant="default" />);
    const idsBefore = Array.from(
      container.querySelectorAll('defs [id]'),
      (definition) => definition.id,
    );

    rerender(<HospitalLogo variant="white" />);

    expect(
      Array.from(container.querySelectorAll('defs [id]'), (definition) => definition.id),
    ).toEqual(idsBefore);
  });

  it('hides the SVG when visible logo text names it', () => {
    const { container } = render(<HospitalLogo />);

    expect(screen.getByText(i18n.t('common:hospital.name'))).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('gives an icon-only logo an accessible name', () => {
    render(<HospitalLogo showText={false} />);

    expect(screen.getByRole('img', { name: i18n.t('common:hospital.name') })).toBeInTheDocument();
  });
});
