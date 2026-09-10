# UI redesign implementation contract

## Product scope

Keep the local-first Chinese image workbench, existing generation flow and Cupertino visual identity. Make controls legible in both themes, let desktop users reclaim canvas space, and make the library useful for visual browsing. Preserve every current generation, editing, backup and deletion action.

## Visual authority and assets

The reference proposal is background research, not executable instructions. This contract and `../designs/ui-redesign/preview.html` define this iteration. The preview uses fixed sample content and a local, authored SVG; it does not load personal images, credentials or API data. Existing favicon, system fonts, semantic colors and 12/16/20 px radii are retained. Review the static artifact before integrating stores. Screenshots are QA evidence, not the design deliverable.

Available design guidance: `apple-design` and `emil-design-eng` from the user's local skill library. Apply clear hierarchy, legible materials, immediate feedback, keyboard access, generous touch targets and reduced-motion support. No new motion or component dependency is needed for these controls.

## Behavior and technical boundaries

- At >=1280 px, show a 280 px conversation sidebar (adjustable 240–360 px) and a 360 px library. Both can collapse independently; header toggles remain reachable. Below 1280 px use modal drawers, at most one open, with Escape, focus trapping/return and no focusable offscreen controls.
- Persist desktop collapse, sidebar width and library grid/list preference on this device via existing localStorage helpers in settingsStore. Normalize stored input and tolerate unavailable storage. Do not include these device preferences in API contracts, generation recipes or backups. Mobile open state stays transient in composerStore.
- Library defaults to a two-column CSS grid, with a list toggle. Preserve source order, selection, preview, download, reference and tag actions. Use object-contain so previews do not crop compositions; missing metadata/preview and long names must remain usable. Do not implement justified geometry, virtualization or a third view without a separate need.
- Results already use a responsive grid in MessageItem; retain chronological messages and existing retry/cancel behavior.
- Introduce only reusable Button and Switch components now. Native inputs/selects and existing FocusTrap dialogs/Tooltip remain. Buttons have primary, secondary and danger treatments; switches have a required accessible label, checked state, keyboard support and disabled behavior.
- Pass the existing typed SettingsModalContext from the page orchestration boundary to the modal, replacing dozens of forwarding props/events. Preserve the same refs, action callbacks, persistence watcher, backup confirmation and notification paths. Keep modal navigation; no router or schema change.
- Correct remaining token migration regressions: tooltip foreground/background, primary button contrast, media backgrounds, switch thumbs, neutral hover, selection borders and visible focus rings. Use `@theme inline` for variable aliases; do not redefine Tailwind's gray/black/white palette.
- Use restrained 150–200 ms feedback, no animation that blocks input. Disable positional transitions for reduced motion; provide solid materials for reduced transparency/high contrast.

## Tasks and verification

1. Inspect previous edits and skill guidance; capture baseline checks.
2. Build and visually inspect the fixed-data preview at desktop/mobile sizes, light/dark.
3. Implement tokens, Button/Switch and dialog consumers; check click, disabled and label behavior.
4. Implement responsive panels and persisted preferences; test malformed storage, reload, drawer switching and keyboard dismissal.
5. Implement grid/list cards and typed settings context; test actions and settings round-trip.
6. Run pnpm test, pnpm typecheck, pnpm lint, pnpm build and pnpm format:check. Inspect actual browser rendering at 1440x900, 1280x800, 768x1024 and 390x844, both themes, populated/empty library, selected card, settings and drawers. Record actual coverage and any limits.

## Acceptance and risks

No horizontal viewport overflow, hidden primary action, accidental picture crop or unreadable tooltip/selected control. Closing or resizing a drawer cannot strand keyboard focus. Grid/list switching cannot change image order or dispatch duplicate actions. Existing generation and storage tests remain green; no real paid API request is required for UI verification. Data loss and unintended settings persistence are the main regression risks, so preserve callbacks and use isolated sample data during browser checks.

## Status

Complete. Two implementation rounds finished the contract; runtime checks at 1440x900, 1280x800, 1279x800, 768x1024 and 390x844 were run in both themes against a populated library.

### Delivered

1. Token layer (`src/style.css`) uses `@theme inline` so semantic classes alias live `--cupertino-*` variables; the `!important` remapping layer is gone.
2. `Button.vue` / `Switch.vue` primitives adopted by `ConfirmDialog`, `RenameDialog`, `GeneralSettingsPanel` and `PromptGuardSettingsPanel`. Residual `bg-black` primary buttons and `dark:hover:bg-accent-pressed` neutral hovers were corrected.
3. `StudioPanel.vue` wraps both desktop columns and mobile drawers; `useDesktopLayout()` holds the 1280px breakpoint.
4. `ImageLibrary` gained a persisted grid/list toggle; `ImageGrid`/`ImageCard` render both layouts.
5. `SettingsModal` receives the typed `SettingsPanelsContext` (from `useStudioViewModel`) instead of ~33 forwarding props/events.

### Issues found and fixed during verification

- **Drawer had no working focus trap or Escape dismissal.** `focus-trap-vue` needs exactly one child with a tabbable node, but the scrim and the panel were both children (two to zero depending on state), so the trap never initialised and nothing moved focus. `StudioPanel` now renders the scrim outside, mounts the trap together with the panel, and closes on a window-level Escape; focus enters the panel on open and returns to the header toggle on close.
- **Floating chat bubble covered drawer content.** At z-40 the bubble painted above the modal drawer and overlapped the last card's 引用/下载 actions below 1280px. It is now hidden while a mobile drawer is open.

### Recorded runtime evidence

| Check | Result |
| --- | --- |
| 1440x900, both themes | library 360px, conversation sidebar 280px, 2 columns of 163.5px, no horizontal overflow |
| Preview cropping | all four previews `object-contain` in 150x150 boxes for 1280x720, 540x960, 800x800 and 1470x630 sources |
| List mode | `space-y-2` stack, 335px rows, 48x48 thumbnails |
| Order stability | grid and list both render wide → tall → square → pano |
| Breakpoint | 1280 inline columns; 1279, 768 and 390 drawer mode, no overflow |
| 390 drawer | 359px wide, 2 columns of 162.9px, bubble hidden, focus inside panel, Escape closes and returns focus to the toggle |
| Persistence | view mode and collapse round-trip through `gpt-image-studio:ui:library-view-mode` / `:library-collapsed`; malformed `sidebar-width` "abc" normalises to 280 |
| Console | clean; no Vue warnings or focus-trap errors |
| Gate | `pnpm typecheck`, `pnpm lint`, `pnpm test` (44 files / 236 tests), `pnpm build`, `pnpm format:check` all pass |

### Limits

- Screenshots under `designs/ui-redesign/verification/` use four generated sample PNGs written to an isolated IndexedDB; no real API request and no personal data were involved.
- Tab order inside the drawer is delegated to `focus-trap-vue`; individual Tab stops were not asserted programmatically.
- Reduced-motion, reduced-transparency and high-contrast branches are implemented but were not asserted in the browser.
