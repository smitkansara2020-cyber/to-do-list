export interface CategoryInfo {
  id: string;
  name: string;
  emoji: string;
  color: "yellow" | "pink" | "mint" | "sky" | "lilac" | "peach";
}

export const WORK_CATEGORIES: CategoryInfo[] = [
  { id: "work", name: "Work & Career", emoji: "💼", color: "yellow" },
  { id: "health", name: "Health & Fitness", emoji: "🏃‍♂️", color: "mint" },
  { id: "learning", name: "Learning & Growth", emoji: "📚", color: "sky" },
  { id: "finance", name: "Finance & Money", emoji: "💰", color: "peach" },
  { id: "personal", name: "Personal & Life", emoji: "🏡", color: "lilac" },
];

const KEYWORD_MAP: Array<{
  category: string;
  emoji: string;
  color: "yellow" | "pink" | "mint" | "sky" | "lilac" | "peach";
  keywords: string[];
}> = [
  {
    category: "Health & Fitness",
    emoji: "🏃‍♂️",
    color: "mint",
    keywords: [
      "gym",
      "workout",
      "run",
      "fitness",
      "exercise",
      "walk",
      "diet",
      "water",
      "yoga",
      "stretch",
      "sleep",
      "health",
      "cardio",
      "swim",
      "cycling",
      "lift",
      "weights",
      "meal",
      "meditate",
      "jog",
    ],
  },
  {
    category: "Work & Career",
    emoji: "💼",
    color: "yellow",
    keywords: [
      "work",
      "code",
      "dev",
      "bug",
      "feature",
      "client",
      "project",
      "presentation",
      "meeting",
      "deploy",
      "review",
      "email",
      "interview",
      "design",
      "wireframe",
      "docs",
      "release",
      "sync",
      "standup",
      "report",
      "slides",
      "contract",
      "proposal",
      "sales",
      "leads",
      "task",
      "roadmap",
      "marketing",
      "pr",
      "ship",
    ],
  },
  {
    category: "Learning & Growth",
    emoji: "📚",
    color: "sky",
    keywords: [
      "read",
      "book",
      "course",
      "study",
      "learn",
      "exam",
      "language",
      "class",
      "practice",
      "tutorial",
      "chapter",
      "lecture",
      "homework",
      "skill",
      "research",
    ],
  },
  {
    category: "Finance & Money",
    emoji: "💰",
    color: "peach",
    keywords: [
      "budget",
      "finance",
      "money",
      "save",
      "invest",
      "tax",
      "invoice",
      "pay",
      "bill",
      "expense",
      "crypto",
      "salary",
      "audit",
      "account",
      "fund",
      "debt",
    ],
  },
  {
    category: "Personal & Life",
    emoji: "🏡",
    color: "lilac",
    keywords: [
      "home",
      "family",
      "clean",
      "chore",
      "grocery",
      "groceries",
      "cook",
      "dinner",
      "lunch",
      "breakfast",
      "call",
      "friend",
      "hobby",
      "garden",
      "pet",
      "dog",
      "cat",
      "shop",
      "errand",
      "laundry",
      "car",
      "doctor",
      "dentist",
    ],
  },
];

/**
 * Detects the category, emoji, and suggested note color from a title or description.
 */
export function detectCategory(text: string): {
  category: string;
  emoji: string;
  color: "yellow" | "pink" | "mint" | "sky" | "lilac" | "peach";
} {
  const lower = text.toLowerCase();

  for (const group of KEYWORD_MAP) {
    for (const kw of group.keywords) {
      // Word boundary match
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(lower)) {
        return {
          category: group.category,
          emoji: group.emoji,
          color: group.color,
        };
      }
    }
  }

  // Fallback default
  return {
    category: "Work & Career",
    emoji: "💼",
    color: "yellow",
  };
}

/**
 * Prepends a matching emoji to the title if not already present.
 */
export function formatTitleWithEmoji(rawTitle: string, emoji?: string): string {
  const title = rawTitle.trim();
  // Check if title already starts with an emoji (common Unicode emoji ranges)
  const hasEmoji = /^\p{Extended_Pictographic}/u.test(title);
  if (hasEmoji) return title;

  const chosenEmoji = emoji || detectCategory(title).emoji;
  return `${chosenEmoji} ${title}`;
}
