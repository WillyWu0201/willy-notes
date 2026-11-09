// Shared by the digest scripts: the four tabs, the fallback tab for items without an
// analysis, and the http(s)-only rule for anything published.

export const CATEGORIES = [
  { id: "dev", label: "AI 開發方式" },
  { id: "industry", label: "AI 產業動態" },
  { id: "apple", label: "iOS / Apple" },
  { id: "finance", label: "金融與虛擬資產" },
];

const GROUP_TO_CATEGORY = { AI: "industry", "iOS / Apple": "apple", 金融: "finance", 虛擬資產: "finance" };

export function fallbackCategory(item) {
  if (item.curated) return "dev";
  return GROUP_TO_CATEGORY[item.groups?.[0]] || "industry";
}

export const categoryOf = (item) => item.category ?? fallbackCategory(item);

// URLs come from scraped sites, so only http(s) links are published (no javascript: etc.).
export function isWebUrl(u) {
  try {
    return ["http:", "https:"].includes(new URL(u).protocol);
  } catch {
    return false;
  }
}
