import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  GITHUB_REPOSITORY_URL,
  NPM_PACKAGE_URL,
  ReleaseActions,
} from '../packages/dashboard/src/components/landing/variants/LandingMorphism.jsx';

describe('landing release actions', () => {
  it('fails closed to local development and non-link coming-soon statuses', () => {
    const html = renderToStaticMarkup(<ReleaseActions />);

    expect(html).toContain('data-release-status="unpublished"');
    expect(html).toContain('npm run dev');
    expect(html).toContain('npm · Coming soon');
    expect(html).toContain('GitHub · Coming soon');
    expect(html).not.toContain('<a');
    expect(html).not.toContain('npx soupz-cli');
    expect(html).not.toContain(NPM_PACKAGE_URL);
    expect(html).not.toContain(GITHUB_REPOSITORY_URL);
  });

  it('renders canonical npm and GitHub actions when publication is explicitly enabled', () => {
    const html = renderToStaticMarkup(<ReleaseActions publicRelease />);

    expect(html).toContain('data-release-status="published"');
    expect(html).toContain('npx soupz-cli');
    expect(html).toContain(`href="${NPM_PACKAGE_URL}"`);
    expect(html).toContain(`href="${GITHUB_REPOSITORY_URL}"`);
    expect(html).not.toContain('Coming soon');
  });
});
