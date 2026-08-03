import { ref, watchEffect, onUnmounted } from "vue";
import { readStorage, writeStorage } from "../shared/localStorage";

const STORAGE_KEY = "theme";
type Theme = "light" | "dark" | "system";

const theme = ref<Theme>(readStorage(STORAGE_KEY, "system") as Theme);
const isDark = ref(false);

function getSystemPreference(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme() {
  const shouldBeDark =
    theme.value === "dark" || (theme.value === "system" && getSystemPreference());
  isDark.value = shouldBeDark;
  document.documentElement.classList.toggle("dark", shouldBeDark);
}

// 初始化
applyTheme();

// 主题变化时持久化并应用
watchEffect(() => {
  writeStorage(STORAGE_KEY, theme.value);
  applyTheme();
});

export function useDarkMode() {
  // 监听系统偏好变化，组件卸载时自动清理
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemThemeChange = () => {
    if (theme.value === "system") applyTheme();
  };
  mediaQuery.addEventListener("change", onSystemThemeChange);
  onUnmounted(() => {
    mediaQuery.removeEventListener("change", onSystemThemeChange);
  });

  function setTheme(next: Theme) {
    theme.value = next;
  }

  function toggleTheme() {
    // light → dark → system → light
    if (theme.value === "light") setTheme("dark");
    else if (theme.value === "dark") setTheme("system");
    else setTheme("light");
  }

  return { theme, isDark, setTheme, toggleTheme };
}
