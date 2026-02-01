import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

        {/* Browser Tab Title */}
        <title>Fox Creek Member Portal</title>

        {/* PWA Meta Tags */}
        <meta name="application-name" content="Fox Creek Golf Club" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Fox Creek Golf Club" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0c0c0c" />
        <meta name="description" content="Fox Creek Golf Club Member Portal - Book tee times, track scores, and stay connected with your golf community" />

        {/* Open Graph / Social Sharing */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Fox Creek Member Portal" />
        <meta property="og:description" content="Fox Creek Golf Club - Book tee times, track scores, and stay connected" />
        <meta property="og:image" content="/fc-logo.png" />

        {/* Favicon - FC Logo */}
        <link rel="icon" type="image/png" href="/fc-logo.png" />
        <link rel="apple-touch-icon" href="/fc-logo.png" />

        {/* Web App Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #0c0c0c;
  margin: 0;
  padding: 0;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #0c0c0c;
  }
}
/* Prevent text selection on buttons */
button, [role="button"] {
  -webkit-user-select: none;
  user-select: none;
}
/* Smooth scrolling */
* {
  -webkit-overflow-scrolling: touch;
}
/* Hide scrollbars but keep functionality */
::-webkit-scrollbar {
  display: none;
}
* {
  -ms-overflow-style: none;
  scrollbar-width: none;
}`;
