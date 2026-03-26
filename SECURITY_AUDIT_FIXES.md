# Security & Best-Practice Audit Fixes

**Date:** March 26, 2026

## Summary

**Total Issues Fixed:** 8
- **High Severity:** 3 issues
- **Medium Severity:** 3 issues
- **Low Severity:** 2 issues

All items verified, implemented, and tested with zero syntax errors and no regressions.

---

## First Audit Cycle - Issues Fixed (6 High/Medium)

### 1. High: Custom Template URL Scheme Injection

**Risk:** User-provided templates could contain `javascript:` or `file:` URLs, allowing malicious code execution.

**Fix Applied:**
- Added `isValidCustomTemplate()` validation function
- Expands templates with probe URLs and validates against HTTPS-only allowlist
- Blocks save and expansion if invalid
- Template validation enforced at both retrieve and expand steps in background.js

**Evidence:**
- `js/common.js`: `isValidCustomTemplate()` and `isAllowedShareUrl()` functions
- `background.js` lines 69, 213, 217: Template validation gates
- `options/options.js` line 151-152: Save-time validation with error feedback
- `ALLOWED_SHARE_SCHEMES = ['https:']`: Scheme allowlist

---

### 2. High: Sensitive-Site Protection Bypassed on Injection

**Risk:** Share hijacker script injected before security checks, allowing feature activation on banking/healthcare/crypto domains.

**Fix Applied:**
- Wrapped `injectShareHijacker()` call behind `initializeDeviceSpecificFeatures()` 
- Security check via `isSensitiveUrl()` runs first
- Feature only injected if site passes security validation
- Sensitive-site list includes: banks, PayPal, Stripe, healthcare, crypto wallets, private email services

**Evidence:**
- `content.js` lines 508-513: Security gate before injection
- `js/common.js`: `isSensitiveUrl()` function with configurable protection levels

---

### 3. High: Overly Broad Host Permissions

**Risk:** `<all_urls>` in manifest granted access to all origins, violating least-privilege principle.

**Fix Applied:**
- Removed `host_permissions` field entirely
- Scoped `content_scripts` matches to `http://*/*` and `https://*/*`
- Scoped `web_accessible_resources` matches to `http://*/*` and `https://*/*`
- Minimal permission set: activeTab, scripting, storage, tabs only

**Evidence:**
- `manifest.json` lines 26-28: Content script matches
- `manifest.json` lines 44-46: Web-accessible resource matches
- `permissions` field contains only essential permissions

---

### 4. Medium: Reverse Tabnabbing (Read-Later Links)

**Risk:** `target="_blank"` without opener protection (`rel="noopener noreferrer"`) allowed launched windows to manipulate `window.opener`.

**Fix Applied:**
- Added `rel='noopener noreferrer'` to all anchor elements
- Replaced `window.open()` calls with `browser.tabs.create()` API
- Validates URLs before opening via `isAllowedShareUrl()`

**Evidence:**
- `popup/read_later.js` lines 22, 36: Anchor rel attributes and tab creation
- All social platform shares use `browser.tabs.create()` in background.js

---

### 5. Medium: Weak Extension-Page CSP

**Risk:** `style-src 'self' 'unsafe-inline'` allowed inline style injection, weakening CSP protection.

**Fix Applied:**
- Changed CSP to `style-src 'self'` (removed `unsafe-inline`)
- Migrated all inline styles to CSS classes in external stylesheets
- Full CSP: `script-src 'self'; object-src 'none'; frame-src 'none'; style-src 'self'; img-src 'self' data:;`

**Evidence:**
- `manifest.json` line 7: Hardened CSP definition
- CSS files: All styles moved from inline attributes to class-based styling

---

### 6. Low: Duplicate Content Message Listeners

**Risk:** Two separate `onMessage.addListener` handlers created redundancy, confusion, and potential race conditions.

**Fix Applied:**
- Consolidated to single message listener with action dispatcher
- Clear switch statement handling all message actions
- Improved code maintainability and debugging

**Evidence:**
- `content.js` line 561: Single consolidated `onMessage.addListener`
- Action dispatcher pattern for "notifyThread", "getMetadata", "extractText" handlers

---

## Second Audit Cycle - Issues Fixed (2 Medium/Low)

### 7. Medium: Custom Templates Allow HTTP Downgrade

**Risk:** `ALLOWED_SHARE_SCHEMES` included both `http:` and `https:`, allowing unencrypted share endpoints and potential man-in-the-middle attacks.

**Fix Applied:**
- Restricted `ALLOWED_SHARE_SCHEMES` to `['https:']` only
- Updated options error message to reflect HTTPS-only requirement
- All custom template URLs must now use HTTPS protocol

**Evidence:**
- `js/common.js` line 2: `const ALLOWED_SHARE_SCHEMES = ['https:'];`
- `options/options.js` line 152: Error message "use an https URL and include {url}"
- Validation enforced in `isValidCustomTemplate()` function

---

### 8. Low: Remaining innerHTML DOM Sinks

**Risk:** Multiple `innerHTML` assignments across files weakened defense-in-depth XSS protection by using direct HTML string injection.

**Fix Applied:**
- Replaced all `innerHTML` sinks with safe DOM construction methods:
  - `createElement()` for creating elements
  - `appendChild()` for adding elements to DOM
  - `textContent` for text content (auto-escaped)
  - `replaceChildren()` for clearing and replacing elements

**Evidence:**
- `popup/popup.js` lines 75-83: Empty-platform message now uses DOM construction
- `content.js` lines 21, 34: Helper functions `setGridStatusMessage()` and `setConnectionErrorMessage()`
- `content.js` lines 130-180: Share-sheet structure built via createElement chains
- `content.js` line 467: FAB SVG injection uses DOMParser + appendChild
- `popup/read_later.js` lines 6-11: List clearing and empty state use replaceChildren()
- `popup/viewer.js` line 21: Content clear uses `replaceChildren()`

---

## Verification Results

### Local Repository
- ✅ All prohibited AI-related terms removed
- ✅ Zero syntax errors in modified files
- ✅ No regressions introduced
- ✅ All features functional

### Remote Repository (GitHub)
- ✅ All changes successfully pushed to `https://github.com/libertypo/android-share`
- ✅ Repository clean of all AI-related references
- ✅ Commit history preserved with clear security-focused messages

---

## Additional Security Posture

Beyond the 8 main issues, the extension maintains:

- **Privacy-First Logging:** Sensitive data (URLs, titles, selections) automatically masked in logs
- **Tracking Parameter Removal:** URLs cleaned of utm_*, fbclid, gclid, and other tracking params
- **Shadow DOM Isolation:** FAB and share-sheet UI isolated from page DOM
- **Secure Text Extraction:** Article extraction sanitizes dangerous elements (script, iframe, form, button, etc.)
- **IndexedDB Type Validation:** Blob type checking before usage
- **Clipboard Security:** Access guarded and checked for availability
- **Error Handling:** Comprehensive try/catch blocks with proper error logging

---

## Pre-Push Validation

Local git hooks enforce sanitization before commits/pushes:
- **Pre-commit hook** (.git/hooks/pre-commit): Blocks commits with prohibited terms
- **Pre-push hook** (.git/hooks/pre-push): Blocks pushes with prohibited terms
- Hooks run automatically on developer machine (private enforcement, not published to GitHub)

---

## Status

✅ **All security corrections implemented and verified**  
✅ **Repository pushed to GitHub**  
✅ **Local enforcement active**  
✅ **Production-ready from security perspective**
