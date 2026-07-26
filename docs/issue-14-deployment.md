# Issue 14 deployment hardening

## Runtime origin inventory

The frontend currently requires these origins:

- `'self'` for the application HTML, Vite JavaScript chunks, generated CSS, local images, and the theme bootstrap.
- `https://fonts.googleapis.com` for the IBM Plex Sans Arabic stylesheet.
- `https://fonts.gstatic.com` for the IBM Plex Sans Arabic font files.
- `https:` and `wss:` connections for the build-time configurable `VITE_API_URL` and `VITE_SOCKET_URL` integrations. Their deployment values are not committed to this repository, so a static Vercel header cannot safely name narrower hosts.
- `http://localhost:3000` and `ws://localhost:3000` for the existing API and socket development fallbacks. These do not make an insecure production connection usable from an HTTPS page; production integration values must use HTTPS/WSS.
- `https://hospital.sa` is an external calendar-subscription link that is displayed and copied, not fetched by the frontend.
- `https://www.ctgate.cc` is an external navigation target, not a fetched frontend resource.

There are no runtime third-party image origins. Application images are same-origin, while `data:` images remain allowed for report/logo data already supported by the export code. The repository contains no active web-worker creation or service-worker registration. `worker-src 'self'` is retained as a restrictive default for any future same-origin worker; adding one still requires an explicit implementation, registration, deployment, and browser-test review.

## Headers and CSP rationale

Vercel applies these headers to every path:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`, denying unused sensors, camera, microphone, location, payments, and USB while retaining same-origin fullscreen and clipboard writes used by the application.

The CSP blocks plugins, inline scripts, inline script attributes, cross-origin framing, and non-same-origin application code. `unsafe-eval` is not allowed. The original inline theme bootstrap is now `/theme-bootstrap.js`, a blocking same-origin script that runs before the React root to preserve the pre-render theme behavior.

`unsafe-inline` is limited to `style-src-elem` and `style-src-attr`. This is required because the existing React UI uses runtime style attributes extensively and the PDF/print export paths create same-origin `about:blank` frames containing generated inline styles. A static `vercel.json` policy cannot attach a per-response nonce to those generated styles, and their dynamic values prevent a stable hash. Script execution does not receive this exception.

The existing SPA rewrite and immutable `/assets/*` caching rule are unchanged. `/theme-bootstrap.js` intentionally does not receive immutable caching because its stable filename may change between deployments.

## Staged browser CSP smoke test

The production build and local route checks cannot reproduce Vercel's response headers. After deploying to a staging Vercel URL, complete this browser pass before promoting the deployment:

1. In DevTools, confirm the document response includes all four security headers and that `frame-ancestors 'none'` is present in the CSP.
2. Load `/`, `/login`, `/forgot-password`, a guarded admin route, a guarded employee route, and an unknown route directly in a new tab. Confirm Vercel serves the SPA rather than a platform 404.
3. Switch light/dark/system theme, reload, and confirm the saved theme is applied before React renders. Confirm there are no script CSP violations.
4. Exercise lazy route navigation and confirm all Vite chunks, local images, the Google font stylesheet, and font files load without CSP errors.
5. With staging HTTPS/WSS API and socket values configured, verify requests and the WebSocket handshake. If those values intentionally use fixed hosts, replace the `https:` and `wss:` scheme sources with those exact origins in a follow-up deployment hardening change.
6. Verify calendar URL copying, native fullscreen, all Excel/DOCX downloads, each PDF/print flow, and report images. In particular, confirm the generated print frames are not blocked.
7. Open CT Gate from both the sidebar and employee dashboard and confirm it resolves to `https://www.ctgate.cc` in a new isolated tab.
8. Review the browser console and the CSP report stream, if staging supplies one, for violations before production promotion.
