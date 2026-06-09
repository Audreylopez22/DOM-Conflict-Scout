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

## How it Works

The library scans the `id`, `class`, attributes, and outer HTML of elements added to the DOM, matching them against a dictionary of known "fingerprints" left by common browser extensions (ad blockers, translators, grammar checkers, etc.).

It is designed to be lightweight and have minimal impact on performance.
