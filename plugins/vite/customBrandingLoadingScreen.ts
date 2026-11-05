// Deep import on purpose: the package root barrel uses extensionless relative
// imports that Node's type-stripping loader (which evaluates externalized
// config-time imports) cannot resolve. branding.ts is a dependency-free leaf
// exposed via the './branding' subpath — keep it import-free.
import { BRANDING_LOGO_URL, BRANDING_NAME } from '@lobechat/business-const/branding';
import type { Plugin } from 'vite';

const LOADING_BRAND_BLOCK = /<div id="loading-brand"[^>]*>[\S\s]*?<\/div>/;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Replace the hardcoded LobeHub wordmark in the static loading screen with the
 * custom brand name, so white-label deployments (BRANDING_NAME !== 'LobeHub')
 * never flash the LobeHub logo before the SPA boots. No-op for the default
 * branding.
 */
export const customBrandingLoadingScreen = (): Plugin => ({
  name: 'custom-branding-loading-screen',
  transformIndexHtml: {
    handler(html) {
      if (BRANDING_NAME === 'LobeHub') return html;

      const brandMarkup = BRANDING_LOGO_URL
        ? `<img src="${escapeHtml(BRANDING_LOGO_URL)}" width="48" height="48" alt="${escapeHtml(
            BRANDING_NAME,
          )}" style="border-radius: 12px;" />`
        : escapeHtml(BRANDING_NAME);

      return html.replace(
        LOADING_BRAND_BLOCK,
        `<div id="loading-brand" aria-label="Loading" role="status" style="display: flex; align-items: center; gap: 12px; font-size: 26px; font-weight: 700; letter-spacing: 0.02em;">${brandMarkup}<span>${escapeHtml(
          BRANDING_NAME,
        )}</span></div>`,
      );
    },
    order: 'pre',
  },
});
