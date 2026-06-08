# RAG Wordbank Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact RAG match bar above the composer so users can see and exclude wordbank references before generation.

**Architecture:** Keep the RAG algorithm unchanged. Add lightweight presentation metadata and a pure helper in `src/services/rag.ts`, move Prompt preview open state into `composerStore`, then render a focused `ComposerRagMatchBar.vue` between attachments and the input box. The existing Prompt preview modal remains the detail view.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Vite, Tailwind CSS utility classes.

---

## File Structure

- Modify `src/services/rag.ts`: add `sourceImageId` metadata to wordbank documents and add a pure helper for match-bar state.
- Modify `src/services/rag.test.ts`: cover the new metadata and helper behavior.
- Create `src/stores/composerStore.test.ts`: cover Prompt preview open/close state in the composer store.
- Modify `src/stores/composerStore.ts`: store Prompt preview modal open state and expose open/close actions.
- Modify `src/components/chat/ComposerParameterBar.vue`: use composer-store preview state instead of local `ref`.
- Create `src/components/chat/ComposerRagMatchBar.vue`: render the compact match bar and call existing RAG exclusion actions.
- Modify `src/components/chat/ChatComposer.vue`: place the new match bar below attachments and above `PromptInputBox`.

## Pre-Flight: Clean Current Worktree Boundary

**Files:**
- Existing dirty files from the previous simplification task: `src/services/rag.ts`, `src/stores/generationStore.ts`
- Existing untracked visual companion files: `.superpowers/`

- [ ] **Step 1: Inspect the current status**

Run:

```bash
git status -sb
```

Expected before implementation in this thread:

```text
## main...origin/main [ahead 1]
 M src/services/rag.ts
 M src/stores/generationStore.ts
?? .superpowers/
```

- [ ] **Step 2: Commit the previous simplification separately if it is still dirty**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
git add src/services/rag.ts src/stores/generationStore.ts
git commit -m "refactor: simplify rag and prompt expansion flow"
```

Expected:

```text
vue-tsc --noEmit
Test Files 27 passed
vite build completes successfully
Git creates commit "refactor: simplify rag and prompt expansion flow"
```

Do not stage `.superpowers/`. Those are visual companion artifacts.

- [ ] **Step 3: Confirm only visual companion artifacts remain untracked**

Run:

```bash
git status -sb
```

Expected:

```text
## main...origin/main [ahead 2]
?? .superpowers/
```

If `src/services/rag.ts` or `src/stores/generationStore.ts` are already clean, skip Step 2 and continue.

---

### Task 1: Add RAG Match-Bar State Helper

**Files:**
- Modify: `src/services/rag.ts`
- Test: `src/services/rag.test.ts`

- [ ] **Step 1: Write failing tests for source image metadata and bar state**

Append these tests inside the existing `describe("RAG", () => { ... })` block in `src/services/rag.test.ts`:

```ts
  it("tracks the successful image id for wordbank RAG documents", () => {
    const documents = collectRagDocuments({
      wordbanks,
      imageAssets: images,
    });

    expect(documents[0].sourceImageId).toBe("img-1");
  });

  it("builds compact match-bar state from active and excluded RAG matches", () => {
    const state = buildRagMatchBarState({
      items: [
        {
          id: "image-wordbank:img-1:0",
          source: "wordbank",
          title: "成功图片匹配词库: city",
          text: "cinematic rain street",
          sourceImageId: "img-1",
          rawScore: 0.4,
          score: 0.5,
          sourceWeight: 1.25,
        },
        {
          id: "image-wordbank:img-2:0",
          source: "wordbank",
          title: "成功图片匹配词库: portrait",
          text: "sitting on chair",
          sourceImageId: "img-2",
          rawScore: 0.3,
          score: 0.38,
          sourceWeight: 1.25,
        },
        {
          id: "image-wordbank:img-2:1",
          source: "wordbank",
          title: "成功图片匹配词库: portrait",
          text: "soft window light",
          sourceImageId: "img-2",
          rawScore: 0.2,
          score: 0.25,
          sourceWeight: 1.25,
        },
        {
          id: "image-wordbank:img-3:0",
          source: "wordbank",
          title: "成功图片匹配词库: room",
          text: "dramatic rim light",
          sourceImageId: "img-3",
          rawScore: 0.18,
          score: 0.23,
          sourceWeight: 1.25,
        },
      ],
      excludedItems: [
        {
          id: "image-wordbank:img-4:0",
          source: "wordbank",
          title: "成功图片匹配词库: old",
          text: "old excluded term",
          sourceImageId: "img-4",
          rawScore: 0.1,
          score: 0.13,
          sourceWeight: 1.25,
        },
      ],
      maxVisibleItems: 3,
    });

    expect(state.visibleItems.map((item) => item.text)).toEqual([
      "cinematic rain street",
      "sitting on chair",
      "soft window light",
    ]);
    expect(state.activeCount).toBe(4);
    expect(state.hiddenItemCount).toBe(1);
    expect(state.excludedCount).toBe(1);
    expect(state.sourceImageCount).toBe(3);
    expect(state.shouldShow).toBe(true);
  });

  it("keeps the match bar visible when only excluded matches remain", () => {
    const state = buildRagMatchBarState({
      items: [],
      excludedItems: [
        {
          id: "image-wordbank:img-1:0",
          source: "wordbank",
          title: "成功图片匹配词库: city",
          text: "cinematic rain street",
          sourceImageId: "img-1",
          rawScore: 0,
          score: 0,
          sourceWeight: 1.25,
        },
      ],
    });

    expect(state.visibleItems).toEqual([]);
    expect(state.activeCount).toBe(0);
    expect(state.excludedCount).toBe(1);
    expect(state.shouldShow).toBe(true);
  });
```

Add `buildRagMatchBarState` to the import list:

```ts
import {
  buildRagContextBlock,
  buildRagMatchBarState,
  collectRagDocuments,
  retrieveRagContext,
} from "./rag";
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm test -- src/services/rag.test.ts
```

Expected: fail because `sourceImageId` and `buildRagMatchBarState` are not implemented.

- [ ] **Step 3: Add metadata and helper implementation**

In `src/services/rag.ts`, extend `RagDocument`:

```ts
export type RagDocument = {
  id: string;
  source: RagDocumentSource;
  title: string;
  text: string;
  searchText?: string;
  sourceImageId?: string;
};
```

When adding image-wordbank documents in `collectRagDocuments`, include the source image id:

```ts
addDocument(documents, seen, {
  id: `image-wordbank:${image.id}:${index}`,
  source: "wordbank",
  title: `成功图片匹配词库: ${image.name}`,
  text: term,
  searchText,
  sourceImageId: image.id,
});
```

Add this helper near the other exported RAG functions:

```ts
export type RagMatchBarState = {
  visibleItems: RagMatch[];
  activeCount: number;
  hiddenItemCount: number;
  excludedCount: number;
  sourceImageCount: number;
  shouldShow: boolean;
};

export function buildRagMatchBarState(input: {
  items: RagMatch[];
  excludedItems?: RagMatch[];
  maxVisibleItems?: number;
}): RagMatchBarState {
  const visibleLimit = normalizeVisibleItemCount(input.maxVisibleItems);
  const visibleItems = input.items.slice(0, visibleLimit);
  const sourceImageIds = new Set(
    input.items
      .map((item) => item.sourceImageId)
      .filter((id): id is string => Boolean(id)),
  );
  const excludedCount = input.excludedItems?.length ?? 0;

  return {
    visibleItems,
    activeCount: input.items.length,
    hiddenItemCount: Math.max(0, input.items.length - visibleItems.length),
    excludedCount,
    sourceImageCount: sourceImageIds.size,
    shouldShow: input.items.length > 0 || excludedCount > 0,
  };
}
```

Add this helper near `normalizeTopK`:

```ts
function normalizeVisibleItemCount(count: unknown) {
  const numeric = typeof count === "number" ? count : Number(count);
  if (!Number.isFinite(numeric)) return 3;
  return Math.min(12, Math.max(1, Math.trunc(numeric)));
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
pnpm test -- src/services/rag.test.ts
```

Expected: `src/services/rag.test.ts` passes.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/services/rag.ts src/services/rag.test.ts
git commit -m "feat: prepare rag match bar state"
```

Expected: commit contains only `rag.ts` and `rag.test.ts`.

---

### Task 2: Move Prompt Preview Open State Into Composer Store

**Files:**
- Modify: `src/stores/composerStore.ts`
- Create: `src/stores/composerStore.test.ts`
- Modify: `src/components/chat/ComposerParameterBar.vue`

- [ ] **Step 1: Write the composer store test**

Create `src/stores/composerStore.test.ts`:

```ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useComposerStore } from "./composerStore";

describe("composer store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("opens and closes the prompt preview modal", () => {
    const composer = useComposerStore();

    expect(composer.isPromptPreviewOpen).toBe(false);

    composer.openPromptPreview();
    expect(composer.isPromptPreviewOpen).toBe(true);

    composer.closePromptPreview();
    expect(composer.isPromptPreviewOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm test -- src/stores/composerStore.test.ts
```

Expected: fail because `isPromptPreviewOpen`, `openPromptPreview`, and `closePromptPreview` do not exist.

- [ ] **Step 3: Add store state and actions**

In `src/stores/composerStore.ts`, add the state:

```ts
const isPromptPreviewOpen = ref(false);
```

Add actions:

```ts
function openPromptPreview() {
  isPromptPreviewOpen.value = true;
}

function closePromptPreview() {
  isPromptPreviewOpen.value = false;
}
```

Return them from the store:

```ts
return {
  activeEditor,
  activeEditMaskImageId,
  activeEditSourceImageId,
  composerText,
  editModeEnabled,
  isConversationSidebarOpen,
  isLibraryOpen,
  isPromptPreviewOpen,
  ragExcludedMatchIds,
  selectingEditImageId,
  applyEditSelection,
  clearEditSelection,
  closeAllEditors,
  clearRagExclusions,
  closePromptPreview,
  excludeRagMatch,
  openConversations,
  openPromptPreview,
  restoreRagMatch,
  setConversationSidebarOpen,
  setEditModeEnabled,
  setLibraryOpen,
  toggleEditor,
};
```

- [ ] **Step 4: Update `ComposerParameterBar.vue` to use store state**

Change the Vue import:

```ts
import { computed } from "vue";
```

Remove:

```ts
const isPromptPreviewOpen = ref(false);
```

Change the Prompt preview button:

```vue
@click="composer.openPromptPreview()"
```

Change modal bindings:

```vue
v-if="composer.isPromptPreviewOpen"
@click="composer.closePromptPreview()"
```

Change close buttons:

```vue
@click="composer.closePromptPreview()"
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm test -- src/stores/composerStore.test.ts
pnpm typecheck
```

Expected: focused test passes and typecheck passes.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add src/stores/composerStore.ts src/stores/composerStore.test.ts src/components/chat/ComposerParameterBar.vue
git commit -m "feat: share prompt preview state"
```

Expected: commit contains only the store, store test, and parameter bar.

---

### Task 3: Create the Compact RAG Match Bar Component

**Files:**
- Create: `src/components/chat/ComposerRagMatchBar.vue`

- [ ] **Step 1: Create the component**

Create `src/components/chat/ComposerRagMatchBar.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import {
  buildRagMatchBarState,
  collectRagDocuments,
  retrieveRagContext,
  type RagMatch,
} from "../../services/rag";
import { useComposerStore } from "../../stores/composerStore";
import { useImagesStore } from "../../stores/imagesStore";
import { useSettingsStore } from "../../stores/settingsStore";

const composer = useComposerStore();
const images = useImagesStore();
const settings = useSettingsStore();

const sourcePrompt = computed(() =>
  composer.composerText.trim() ||
    (images.activeAttachments.length ? "基于引用图片继续编辑。" : ""),
);

const ragDocuments = computed(() =>
  collectRagDocuments({
    wordbanks: settings.promptWordbanks,
    imageAssets: images.imageAssets,
  }),
);

const activeRagResult = computed(() => {
  if (!settings.ragEnabled || !sourcePrompt.value) return undefined;

  return retrieveRagContext({
    query: sourcePrompt.value,
    documents: ragDocuments.value,
    excludedIds: composer.ragExcludedMatchIds,
    topK: settings.ragTopK,
  });
});

const excludedRagMatches = computed(() => {
  if (!settings.ragEnabled || !sourcePrompt.value) return [];
  const excludedIds = new Set(composer.ragExcludedMatchIds);
  if (!excludedIds.size) return [];

  return retrieveRagContext({
    query: sourcePrompt.value,
    documents: ragDocuments.value,
    topK: 12,
    minScore: 0,
  }).items.filter((item) => excludedIds.has(item.id));
});

const matchBarState = computed(() =>
  buildRagMatchBarState({
    items: activeRagResult.value?.items ?? [],
    excludedItems: excludedRagMatches.value,
    maxVisibleItems: 3,
  }),
);

const summaryText = computed(() => {
  const state = matchBarState.value;
  const sourcePart = state.sourceImageCount
    ? ` · 来自 ${state.sourceImageCount} 张成功图`
    : "";
  return `RAG 参考 ${state.activeCount} 项${sourcePart}`;
});

function excludeMatch(item: RagMatch) {
  composer.excludeRagMatch(item.id);
}
</script>

<template>
  <div
    v-if="matchBarState.shouldShow"
    class="mb-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
  >
    <div class="flex flex-wrap items-center gap-2">
      <div class="shrink-0 text-[11px] font-medium text-gray-500">
        {{ summaryText }}
      </div>

      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <button
          v-for="item in matchBarState.visibleItems"
          :key="item.id"
          class="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900"
          type="button"
          :title="`排除 ${item.text}`"
          @click="excludeMatch(item)"
        >
          <span class="truncate">{{ item.text }}</span>
          <span class="text-gray-400" aria-hidden="true">×</span>
        </button>

        <span
          v-if="matchBarState.hiddenItemCount"
          class="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400"
        >
          +{{ matchBarState.hiddenItemCount }}
        </span>

        <button
          v-if="matchBarState.excludedCount"
          class="cursor-pointer rounded-full px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          type="button"
          @click="composer.clearRagExclusions()"
        >
          已排除 {{ matchBarState.excludedCount }} 项 · 恢复
        </button>
      </div>

      <button
        class="shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        type="button"
        @click="composer.openPromptPreview()"
      >
        详情
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: typecheck passes.

- [ ] **Step 3: Commit Task 3**

Run:

```bash
git add src/components/chat/ComposerRagMatchBar.vue
git commit -m "feat: add rag match bar component"
```

Expected: commit contains only the new component.

---

### Task 4: Mount the RAG Match Bar in the Composer

**Files:**
- Modify: `src/components/chat/ChatComposer.vue`

- [ ] **Step 1: Import the new component**

In `src/components/chat/ChatComposer.vue`, add:

```ts
import ComposerRagMatchBar from "./ComposerRagMatchBar.vue";
```

- [ ] **Step 2: Render the component below attachments**

Place this after `ComposerAttachmentList` and before `PromptInputBox`:

```vue
      <ComposerRagMatchBar />
```

The target structure becomes:

```vue
      <ComposerAttachmentList
        :active-attachments="images.activeAttachments"
        :active-edit-mask-image-id="composer.activeEditMaskImageId"
        :active-edit-source-image-id="composer.activeEditSourceImageId"
        @preview-image="emit('previewImage', $event)"
        @remove-attachment="emit('removeAttachment', $event)"
      />

      <ComposerRagMatchBar />

      <PromptInputBox
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: typecheck passes.

- [ ] **Step 4: Commit Task 4**

Run:

```bash
git add src/components/chat/ChatComposer.vue
git commit -m "feat: show rag matches above composer"
```

Expected: commit contains only `ChatComposer.vue`.

---

### Task 5: Verify Behavior and Polish

**Files:**
- Review: `src/components/chat/ComposerRagMatchBar.vue`
- Review: `src/components/chat/ComposerParameterBar.vue`
- Review: `src/services/rag.ts`
- Review: `src/services/rag.test.ts`
- Review: `src/stores/composerStore.ts`
- Review: `src/stores/composerStore.test.ts`

- [ ] **Step 1: Run full automated verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Expected:

```text
vue-tsc --noEmit
Test Files 28 passed
✓ built
```

`git diff --check` should have no whitespace errors. Windows line-ending warnings are acceptable.

- [ ] **Step 2: Scan Chinese and Unicode integrity**

Run:

```bash
rg -n -P "\x{FFFD}|\x{951F}\x{65A4}\x{62F7}|\x{00C3}|\x{00C2}|\x{6D93}|\x{5997}|\x{5699}|\x{922B}|\x{9354}|\x{59D8}|\x{705E}|\x{93C0}|\x{9286}|\x{20AC}" src docs README.md README更新版.md CLAUDE.md
rg -n -P "[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{206F}\x{FE00}-\x{FE0F}\x{3000}\x{FEFF}]" src docs README.md README更新版.md CLAUDE.md
```

Expected: no matches. If matches appear, inspect the exact file and line before editing.

- [ ] **Step 3: Manual browser verification**

Run the dev server:

```bash
pnpm dev
```

Open the local URL shown by Vite. In the browser:

1. Enable RAG in settings.
2. Use a prompt that matches a previous successful generated image.
3. Confirm the compact RAG bar appears above the input box.
4. Click a chip and confirm it disappears.
5. Click `详情` and confirm the existing Prompt preview opens.
6. Click `恢复` and confirm excluded matches can return.

- [ ] **Step 4: Final commit if any polish changes were needed**

If Task 5 changed files, commit only those files:

```bash
git add src/components/chat/ComposerRagMatchBar.vue src/components/chat/ComposerParameterBar.vue src/components/chat/ChatComposer.vue src/services/rag.ts src/services/rag.test.ts src/stores/composerStore.ts src/stores/composerStore.test.ts
git commit -m "fix: polish rag match bar"
```

If Task 5 changed no files, do not create an empty commit.

---

## Completion Criteria

- The match bar appears only when RAG is enabled and there is an active or excluded match.
- Visible chips represent active RAG items that will enter the final Prompt.
- Clicking a chip excludes that match through `composer.excludeRagMatch`.
- Excluded matches can be restored through `composer.clearRagExclusions`.
- `详情` opens the existing Prompt preview modal.
- RAG retrieval behavior and final Prompt construction remain unchanged.
- Full typecheck, tests, build, whitespace check, and Unicode scans pass.
