# RC1 interaction bug

Observed on the first macOS 1.1.0 release candidate:

- Overview could display stale `Integration.connected` values from a previous workspace while current connector status still required authorization.
- Critical actions depended on per-render element bindings and browser-native confirmation dialogs, which made failures difficult to observe in the packaged WebView.
- Errors were shown only as transient toasts, so a failed native command could appear to be an unresponsive button.

RC2 must:

1. treat native connector status as the authoritative connection state;
2. add a stable delegated action handler for critical controls;
3. treat an explicitly labelled action button as the approval instead of relying on a second browser-native confirmation dialog;
4. show the last action result persistently in the application header;
5. preserve reversible setup and rollback behavior.
