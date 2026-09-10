<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PromptMode, PromptWordbankSectionKey, PromptWordbanks } from "../../types/studio";
import { useSettingsModalContext } from "./settingsModalContext";

const ctx = useSettingsModalContext();
const {
  promptMode: modelValue,
  promptWordbanks: wordbanks,
  ragEnabled,
  ragTopK,
  updatePromptMode: updateModelValue,
  updateRagEnabled,
  updateRagTopK: ctxUpdateRagTopK,
  saveWordbank,
  restoreDefaultWordbank,
} = ctx;

const options: Array<{
  value: PromptMode;
  label: string;
  description: string;
}> = [
  {
    value: "default",
    label: "默认",
    description: "不追加任何模式指令，保持当前逻辑。",
  },
  {
    value: "safe",
    label: "安全",
    description: "只使用安全词库，强化干净、稳定的画面表达。",
  },
  {
    value: "creative",
    label: "创意",
    description: "使用安全 + 创意词库，强化氛围和画面张力。",
  },
  {
    value: "adult",
    label: "开放",
    description: "使用安全 + 创意 + 开放词库，适合更自由的模型或接口。",
  },
];

const wordbankSections: Array<{
  key: PromptWordbankSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: "pose.safe",
    label: "安全词库",
    description: "安全模式会从这里抽取词。",
  },
  {
    key: "pose.creative",
    label: "创意词库",
    description: "创意模式会叠加这里的词。",
  },
  {
    key: "pose.nsfw",
    label: "开放词库",
    description: "开放模式会继续叠加这里的词。",
  },
  {
    key: "adultInspiration",
    label: "开放灵感",
    description: "开放模式额外抽取的氛围灵感词。",
  },
];

const activeSection = ref<PromptWordbankSectionKey>("pose.safe");
const draftText = ref("");
const searchText = ref("");

const activeSectionMeta = computed(
  () =>
    wordbankSections.find((section) => section.key === activeSection.value) ?? wordbankSections[0],
);
const activeTerms = computed(() => getWordbankTerms(wordbanks.value, activeSection.value));
const parsedDraftTerms = computed(() => parseTerms(draftText.value));
const hasChanges = computed(
  () => termsSignature(parsedDraftTerms.value) !== termsSignature(activeTerms.value),
);
const filteredTerms = computed(() => {
  const query = searchText.value.trim().toLowerCase();
  if (!query) return activeTerms.value;
  return activeTerms.value.filter((term) => term.toLowerCase().includes(query));
});

watch(
  [wordbanks, activeSection],
  () => {
    draftText.value = activeTerms.value.join("\n");
    searchText.value = "";
  },
  { immediate: true },
);

function saveDraft() {
  saveWordbank(activeSection.value, parsedDraftTerms.value);
}

function restoreDefault() {
  restoreDefaultWordbank(activeSection.value);
}

function handleRagTopKChange(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return;
  ctxUpdateRagTopK(Math.min(12, Math.max(1, Math.trunc(numeric))));
}

function parseTerms(text: string) {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0 && !term.startsWith("#"))
    .filter((term) => {
      if (seen.has(term)) return false;
      seen.add(term);
      return true;
    });
}

function termsSignature(terms: readonly string[]) {
  return terms.join("\n");
}

function getWordbankTerms(wordbanks: PromptWordbanks, section: PromptWordbankSectionKey) {
  if (section === "pose.safe") return wordbanks.pose.safe;
  if (section === "pose.creative") return wordbanks.pose.creative;
  if (section === "pose.nsfw") return wordbanks.pose.nsfw;
  return wordbanks.adultInspiration;
}
</script>

<template>
  <section aria-labelledby="promptModeSettingsTitle" class="space-y-6">
    <div>
      <h3 id="promptModeSettingsTitle" class="text-base font-semibold text-content">提示词模式</h3>
      <p class="mt-1 text-sm leading-relaxed text-content-muted">
        当前设置只影响发送给图片接口的请求文本，不会改写聊天记录里的原始提示词。
      </p>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      <button
        v-for="option in options"
        :key="option.value"
        class="cursor-pointer rounded-card border px-3 py-3 text-left transition-colors"
        :class="
          modelValue === option.value
            ? 'border-border-subtle bg-accent text-white'
            : 'border-border-subtle bg-surface text-content hover:border-border-subtle'
        "
        type="button"
        @click="updateModelValue(option.value)"
      >
        <span class="block text-sm font-semibold">
          {{ option.label }}
        </span>
        <span
          class="mt-1 block text-xs leading-relaxed"
          :class="modelValue === option.value ? 'text-content' : 'text-content-muted'"
        >
          {{ option.description }}
        </span>
      </button>
    </div>

    <div class="rounded-card border border-border-subtle bg-surface px-3 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 class="text-sm font-semibold text-content">RAG 参考</h4>
          <p class="mt-1 text-xs leading-relaxed text-content-muted">
            从项目词库、收藏 Prompt、历史 Prompt 中检索相近内容，并只作为最终请求 Prompt 的参考。
          </p>
        </div>
        <button
          class="cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors"
          :class="
            ragEnabled
              ? 'bg-accent text-white'
              : 'bg-surface-muted text-content-muted hover:bg-surface-hover'
          "
          type="button"
          @click="updateRagEnabled(!ragEnabled)"
        >
          {{ ragEnabled ? "已开启" : "已关闭" }}
        </button>
      </div>

      <label class="mt-3 flex max-w-xs items-center gap-3 text-xs text-content-muted">
        <span class="shrink-0">参考条数</span>
        <input
          class="h-8 w-20 rounded-md border border-border-subtle px-2 text-sm text-content outline-none transition-colors focus:border-border-subtle disabled:bg-surface-muted disabled:text-content-tertiary"
          :disabled="!ragEnabled"
          max="12"
          min="1"
          type="number"
          :value="ragTopK"
          @change="handleRagTopKChange(($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <div class="border-t border-border-subtle pt-5">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 class="text-sm font-semibold text-content">灵感词库</h4>
          <p class="mt-1 text-xs leading-relaxed text-content-muted">
            每行一个词，空行和 # 开头的注释会被忽略。
          </p>
        </div>
        <span class="text-xs text-content-tertiary">
          当前 {{ activeTerms.length }} 条，编辑后 {{ parsedDraftTerms.length }} 条
        </span>
      </div>

      <div class="grid min-h-0 gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav class="space-y-1" aria-label="灵感词库分类">
          <button
            v-for="section in wordbankSections"
            :key="section.key"
            class="w-full cursor-pointer rounded-card border px-3 py-2.5 text-left transition-colors"
            :class="
              activeSection === section.key
                ? 'border-border-subtle bg-surface-muted text-content'
                : 'border-border-subtle bg-surface text-content hover:border-border-subtle'
            "
            type="button"
            @click="activeSection = section.key"
          >
            <span class="block text-sm font-medium">{{ section.label }}</span>
            <span class="mt-1 block text-xs leading-relaxed text-content-muted">
              {{ section.description }}
            </span>
          </button>
        </nav>

        <div class="min-w-0 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-sm font-medium text-content">
                {{ activeSectionMeta.label }}
              </div>
              <p class="mt-0.5 text-xs text-content-muted">
                {{ activeSectionMeta.description }}
              </p>
            </div>
            <button
              class="cursor-pointer rounded-md px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
              type="button"
              @click="restoreDefault"
            >
              恢复默认
            </button>
          </div>

          <textarea
            v-model="draftText"
            class="h-52 w-full resize-y rounded-card border border-border-subtle bg-surface px-3 py-2 font-mono text-sm leading-relaxed text-content outline-none transition-colors focus:border-border-subtle"
            spellcheck="false"
          />

          <div class="flex flex-wrap items-center justify-between gap-3">
            <input
              v-model="searchText"
              class="h-9 min-w-0 flex-1 rounded-card border border-border-subtle px-3 text-sm outline-none transition-colors focus:border-border-subtle"
              placeholder="搜索当前词库"
              type="search"
            />
            <button
              class="cursor-pointer rounded-card bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              :disabled="!hasChanges"
              @click="saveDraft"
            >
              保存词库
            </button>
          </div>

          <div class="rounded-card border border-border-subtle">
            <div class="border-b border-border-subtle px-3 py-2 text-xs text-content-muted">
              匹配 {{ filteredTerms.length }} 条
            </div>
            <div class="max-h-40 overflow-y-auto p-2">
              <div
                v-if="!filteredTerms.length"
                class="px-2 py-5 text-center text-sm text-content-tertiary"
              >
                没有匹配的灵感词
              </div>
              <div v-else class="flex flex-wrap gap-1.5">
                <span
                  v-for="term in filteredTerms"
                  :key="term"
                  class="rounded-md bg-surface-muted px-2 py-1 font-mono text-xs text-content"
                >
                  {{ term }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
