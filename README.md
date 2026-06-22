# DOM Conflict Scout

A lightweight, zero-dependency library to detect DOM injections from browser extensions. This tool helps you understand what third-party extensions are modifying your website's DOM, which can be useful for security auditing, performance monitoring, or telemetry.

## Installation

Install the package from npm:

```bash
npm install @audreylopez/dom-conflict-scout
```

## How to Use

There are two primary ways to use this library, depending on your project's setup.

### Method 1: Modern Bundler (Recommended)

This is the standard approach for projects using tools like Vite, Webpack, or Parcel (e.g., React, Vue, Svelte).

**1. Installation:**
```bash
npm install @audreylopez/dom-conflict-scout
```

**2. Usage:**
```javascript
import { DomConflictScout } from '@audreylopez/dom-conflict-scout';

const scout = new DomConflictScout({
  onDetection: (detection) => {
    console.log('Extension detected!', detection);
    // Send data to your analytics service, etc.
  },
  debug: true // Optional: enables detailed console logs
});

scout.start();
```

### Method 2: Classic `<script>` Tag (CDN)

For simple HTML pages or quick tests, you can load the library directly from a CDN.

**1. Include the script:**
Add this script tag to the end of your `<body>`. It will create a `window.DOMConflictScout` global variable.

```html
<script src="https://cdn.jsdelivr.net/npm/@audreylopez/dom-conflict-scout@LATEST_VERSION/dist/detector.global.js"></script>
```
*Note: Replace `LATEST_VERSION` with the current version number, e.g., `1.0.3`.*

**2. Usage:**
```javascript
const scout = new window.DOMConflictScout({
  onDetection: (detection) => {
    console.log('Extension detected!', detection.source);
  }
});

scout.start();
```

## Playground

You can try a live demo of the library and see how it works in a real-world scenario on this playground:

[**Interactive Playground**](https://audreylopez22.github.io/playground-dom-conflict-scout/)

---

## Advanced Usage

### How to Run a Timed Scan

If you only want to monitor the DOM for a specific duration (e.g., the first 30 seconds after the page loads).

```javascript
const scout = new DomConflictScout({ onDetection: handleDetection });
scout.start();

// Stop monitoring after 30 seconds
setTimeout(() => {
  scout.stop();
  console.log('Timed scan finished.');
}, 30000);
```

### How to Run Periodic Scans

If you prefer to take a "snapshot" of the DOM at intervals instead of constant monitoring.

**Note:** This pattern involves creating and destroying the observer repeatedly. For most use cases, the real-time monitoring (`start()` and `stop()`) is more efficient.

```javascript
function runSingleScan() {
  console.log('🔍 Running periodic scan...');
  const scout = new DomConflictScout({
    onDetection: handleDetection,
  });
  
  // start() runs an initial scan immediately.
  scout.start();
  
  // We stop it shortly after to prevent continuous observation.
  setTimeout(() => scout.stop(), 200);
}

// Run a scan every 15 seconds
const intervalId = setInterval(runSingleScan, 15000);

// To stop the periodic scans later:
// clearInterval(intervalId);
```

## Custom Signatures

The library ships with a built-in dictionary of fingerprints for 25+ categories of common extensions (ad blockers, translators, grammar checkers, password managers, etc.). You don't need to contact the author to extend it: you can add your own signatures or modify the existing ones directly from your code.

> **The built-in signatures always keep working.** Anything you provide is layered on top — your own keywords are added, never silently dropped.

### Option A: Extend the built-in signatures (`customSignatures`)

Use `customSignatures` to merge your own fingerprints with the built-in ones. New categories are added, and for categories that already exist your keywords are appended to the defaults (duplicates are ignored, case-insensitive).

```javascript
import { DomConflictScout } from '@audreylopez/dom-conflict-scout';

const scout = new DomConflictScout({
  customSignatures: {
    // Adds a keyword to an EXISTING built-in category:
    ADBLOCKER: ['my-corporate-adblock'],
    // Creates a BRAND-NEW category:
    INTERNAL_TOOLS: ['acme-widget', 'acme-helper'],
  },
  onDetection: (d) => console.log(`${d.source} detected:`, d.matchedKeyword),
});

scout.start(); // Same start() as always — it now detects built-in + your signatures.
```

There is **no extra "run" step**: the merge happens once when the instance is created, so the regular `start()` already scans the combined table.

### Option B: Replace all signatures (`signatures`)

If you want full control and prefer to start from scratch (ignoring the built-in dictionary entirely), pass `signatures` instead. This option takes precedence over `customSignatures`.

```javascript
const scout = new DomConflictScout({
  signatures: {
    ONLY_THIS: ['foo', 'bar'],
  },
});
scout.start(); // Detects ONLY the signatures you provided.
```

### Option C: Modify signatures at runtime

You can also change the signatures of a live instance, without recreating it:

```javascript
const scout = new DomConflictScout();
scout.start();

// Add keywords (creates the category if it doesn't exist):
scout.addSignature('TRANSLATOR', ['my-translator']);

// Remove specific keywords from a category:
scout.removeSignature('ADBLOCKER', ['sponsor']);

// Remove an entire category:
scout.removeSignature('WEB3_WALLETS');

// Inspect the currently active signatures:
console.log(scout.getSignatures());
```

### TypeScript

The signature type is exported so you get autocompletion and type-checking:

```typescript
import { DomConflictScout, type ExtensionSignatures } from '@audreylopez/dom-conflict-scout';

const mySignatures: ExtensionSignatures = {
  INTERNAL_TOOLS: ['acme-widget'],
};

const scout = new DomConflictScout({ customSignatures: mySignatures });
```

## How it Works

The library scans the `id`, `class`, attributes, and outer HTML of elements added to the DOM, matching them against a dictionary of known "fingerprints" left by common browser extensions (ad blockers, translators, grammar checkers, etc.).

It is designed to be lightweight and have minimal impact on performance.
