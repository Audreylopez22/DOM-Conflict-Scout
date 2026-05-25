# DOM Conflict Scout

A lightweight, zero-dependency library to detect DOM injections from browser extensions. This tool helps you understand what third-party extensions are modifying your website's DOM, which can be useful for security auditing, performance monitoring, or telemetry.

## Installation

Install the package from npm:

```bash
npm install @audreylopez/dom-conflict-scout
```

## How to Use

The library uses a `MutationObserver` to monitor the DOM in real-time for changes made by extensions.

Here is a basic example of how to import and start the auditor:

```javascript
import { DomConflictScout } from '@audreylopez/dom-conflict-scout';

// Create a callback function to handle detections
const handleDetection = (detection) => {
  console.log('Extension detected!', detection);
  
  // Example: Send data to your analytics service
  // myAnalytics.track('ExtensionInterference', {
  //   source: detection.source,
  //   keyword: detection.matchedKeyword,
  // });
};

// Instantiate the auditor with your callback
const auditor = new BrowserAuditor({
  onDetection: handleDetection,
});

// Start monitoring the DOM
auditor.start();

// To stop monitoring later
// auditor.stop();
```

## How it Works

The library scans the `id`, `class`, attributes, and outer HTML of elements added to the DOM, matching them against a dictionary of known "fingerprints" left by common browser extensions (ad blockers, translators, grammar checkers, etc.).

It is designed to be lightweight and have minimal impact on performance.
