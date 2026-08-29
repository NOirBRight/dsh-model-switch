# Missing official seams

Official DSH is a read-only dependency. This plugin degrades on a clean tag when a seam is absent.

## `ctx.settingsScope` on non-loopback browsers

- **Needed for:** durable Main / Model Switch namespaces on the trusted lab HTTPS origin.
- **Where used:** `src/client/remote-settings-scope.ts`, `src/client/index.tsx`.
- **When missing / memory-only:** official `ui-settings` keeps process-local memory mode on non-loopback pages. The plugin then uses the public `remote.settings` describe/mutate RPCs (not a DSH core patch) so the settings page remains writable through `dshlab.noirbright.top`.
- **Upstream:** a public `settingsScope` persistence flag for trusted remote Hosts. Until that ships, keep the Remote adapter and this note.
