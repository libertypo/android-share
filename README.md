Another Share Extension
=======================

A privacy-focused Firefox extension to share articles and selected text.

Features
--------
* Movable FAB: A Floating Action Button for quick sharing.
* System Share: Access the native Android share menu.
* Native App Support: Opens links directly in apps like X, Bluesky, Mastodon, and WhatsApp.
* Privacy Sanitization: Automatically removes tracking parameters from shared links.
* Read Later: Save articles to a local list.

Supported Platforms
-------------------
X, WhatsApp, Telegram, Bluesky, Mastodon, LinkedIn, Facebook, Reddit, and System Share.

Privacy Policy
--------------
Zero Data Collection.
* No tracking or analytics.
* No external servers; everything runs locally.
* URL tracking parameters are stripped before sharing.
* Metadata is stored in memory only while the popup is open.

Permissions
-----------
* activeTab: To read the current page title and URL.
* scripting: To extract text.
* storage: To save settings locally.
* tabs & all_urls: Required for the floating button on any site.

Installation (Development)
--------------------------
1. Go to about:debugging in Firefox.
2. Select "This Firefox".
3. Click "Load Temporary Add-on" and select manifest.json.
