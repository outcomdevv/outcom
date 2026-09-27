# Outcom V71 — Logo + HighLevel Business System Fix

- Replaced the browser shortcut/app icon with an opaque, browser-safe Outcom mascot icon so the white eye remains visible at small sizes.
- Removed the old `app/icon.png` auto-icon source to avoid competing favicon sources.
- Made HighLevel the explicit Business System / source of truth in the Connect flow.
- Protecting an outcome that requires downstream business-state verification now requires a verified HighLevel connection first.
- HighLevel PIT connection already validates the supplied Location ID + token against the HighLevel Locations API before storing the encrypted token.
- HighLevel OAuth remains available when OAuth credentials are configured.
