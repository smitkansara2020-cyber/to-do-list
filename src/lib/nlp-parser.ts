import { toISODate } from "./tasks";

export type ParsedTaskResult = {
  title: string;
  rawInput: string;
  scheduled_date: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  priority: "low" | "medium" | "high" | "urgent";
  category: string | null;
  color: string;
  ambiguityWarning?: string | null;
  confidence: number;
  tokensFound: {
    date?: string;
    time?: string;
    duration?: string;
    priority?: string;
    category?: string;
  };
};

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const CATEGORY_MAP: Record<string, { category: string; color: string }> = {
  study: { category: "Study", color: "mint" },
  revise: { category: "Study", color: "mint" },
  exam: { category: "Study", color: "mint" },
  homework: { category: "Study", color: "mint" },
  assignment: { category: "Study", color: "mint" },
  gym: { category: "Health", color: "peach" },
  workout: { category: "Health", color: "peach" },
  fitness: { category: "Health", color: "peach" },
  run: { category: "Health", color: "peach" },
  work: { category: "Work", color: "sky" },
  meeting: { category: "Work", color: "sky" },
  sync: { category: "Work", color: "sky" },
  project: { category: "Work", color: "sky" },
  call: { category: "Work", color: "sky" },
  groceries: { category: "Personal", color: "yellow" },
  buy: { category: "Personal", color: "yellow" },
  shop: { category: "Personal", color: "yellow" },
  read: { category: "Reading", color: "lilac" },
  book: { category: "Reading", color: "lilac" },
};

/**
 * Natural Language Parser for Quick Capture Tasks
 * Parses strings like:
 * "Revise Java tomorrow at 7 PM for 45 minutes"
 * "Team sync on Friday 10:30am for 1 hour #work"
 * "Buy groceries today 5pm urgent"
 */
export function parseNaturalLanguageTask(
  text: string,
  referenceDate = new Date(),
): ParsedTaskResult {
  let working = text.trim();
  const tokensFound: ParsedTaskResult["tokensFound"] = {};
  let scheduledDate: string | null = null;
  let startTime: string | null = null;
  let durationMinutes: number | null = null;
  let priority: "low" | "medium" | "high" | "urgent" = "medium";
  let category: string | null = null;
  let color = "yellow";
  let ambiguityWarning: string | null = null;

  // 1. Hashtag category (e.g. #study, #work)
  const tagMatch = working.match(/#([a-zA-Z0-9_-]+)/);
  if (tagMatch && tagMatch[1]) {
    category = tagMatch[1].charAt(0).toUpperCase() + tagMatch[1].slice(1);
    tokensFound.category = tagMatch[0];
    working = working.replace(tagMatch[0], "").trim();
  }

  // 2. Priority detection (urgent, high, low, medium)
  if (/\b(urgent|critical|asap|p1)\b/i.test(working)) {
    priority = "urgent";
    tokensFound.priority = "urgent";
    color = "pink";
    working = working.replace(/\b(urgent|critical|asap|p1)\b/gi, "").trim();
  } else if (/\b(high priority|important|p2)\b/i.test(working)) {
    priority = "high";
    tokensFound.priority = "high";
    color = "peach";
    working = working.replace(/\b(high priority|important|p2)\b/gi, "").trim();
  } else if (/\b(low priority|minor|someday)\b/i.test(working)) {
    priority = "low";
    tokensFound.priority = "low";
    working = working.replace(/\b(low priority|minor|someday)\b/gi, "").trim();
  }

  // 3. Duration detection (e.g. "for 45 minutes", "for 1 hour", "90 mins", "1.5 hours")
  const durationMatch = working.match(
    /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i,
  );
  if (durationMatch && durationMatch[1] && durationMatch[2]) {
    const val = parseFloat(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    if (unit.startsWith("h")) {
      durationMinutes = Math.round(val * 60);
    } else {
      durationMinutes = Math.round(val);
    }
    tokensFound.duration = durationMatch[0];
    working = working.replace(durationMatch[0], "").trim();
  }

  // 4. Start Time detection (e.g. "at 7 PM", "7:30pm", "19:00", "at noon")
  const noonMatch = working.match(/\b(?:at\s+)?(noon|midnight)\b/i);
  if (noonMatch && noonMatch[1]) {
    tokensFound.time = noonMatch[0];
    startTime = noonMatch[1].toLowerCase() === "noon" ? "12:00:00" : "00:00:00";
    working = working.replace(noonMatch[0], "").trim();
  } else {
    const timeMatch = working.match(
      /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    );
    // Only accept if has am/pm or has colon or preceded by "at"
    if (
      timeMatch &&
      timeMatch[1] &&
      (timeMatch[3] || timeMatch[2] || /\bat\s+\d/i.test(timeMatch[0]))
    ) {
      let hours = parseInt(timeMatch[1], 10);
      const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();

      if (meridiem === "pm" && hours < 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;

      if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59) {
        startTime = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
        tokensFound.time = timeMatch[0];
        working = working.replace(timeMatch[0], "").trim();
      }
    }
  }

  // 5. Date detection
  const todayRef = new Date(referenceDate);

  if (/\b(?:today|tonight)\b/i.test(working)) {
    scheduledDate = toISODate(todayRef);
    tokensFound.date = "today";
    working = working.replace(/\b(?:today|tonight)\b/gi, "").trim();
  } else if (/\btomorrow\b/i.test(working)) {
    const nextDay = new Date(todayRef);
    nextDay.setDate(nextDay.getDate() + 1);
    scheduledDate = toISODate(nextDay);
    tokensFound.date = "tomorrow";
    working = working.replace(/\btomorrow\b/gi, "").trim();
  } else {
    // Check "in X days"
    const inDaysMatch = working.match(/\bin\s+(\d+)\s+days?\b/i);
    if (inDaysMatch && inDaysMatch[1]) {
      const addDays = parseInt(inDaysMatch[1], 10);
      const target = new Date(todayRef);
      target.setDate(target.getDate() + addDays);
      scheduledDate = toISODate(target);
      tokensFound.date = inDaysMatch[0];
      working = working.replace(inDaysMatch[0], "").trim();
    } else {
      // Check named weekdays (e.g. "on Friday", "next Monday", "this Thursday")
      const dayMatch = working.match(
        /\b(?:on\s+)?(this\s+|next\s+)?(sunday|sun|monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat)\b/i,
      );
      if (dayMatch && dayMatch[2]) {
        const modifier = dayMatch[1]?.toLowerCase().trim();
        const dayWord = dayMatch[2].toLowerCase();
        const targetDayIndex = DAY_NAMES[dayWord];

        if (targetDayIndex !== undefined) {
          const currentDayIndex = todayRef.getDay();
          let diff = (targetDayIndex - currentDayIndex + 7) % 7;
          if (diff === 0 && modifier === "next") diff = 7;
          else if (diff === 0) {
            // Flag ambiguity if today is that day
            ambiguityWarning = `Assuming today (${dayWord}), change if you meant next week.`;
          }

          if (modifier === "next" && diff > 0) diff += 7;

          const target = new Date(todayRef);
          target.setDate(target.getDate() + diff);
          scheduledDate = toISODate(target);
          tokensFound.date = dayMatch[0];
          working = working.replace(dayMatch[0], "").trim();
        }
      }
    }
  }

  // 6. Infer Category & Color from title if not set
  const lowerWorking = working.toLowerCase();
  if (!category) {
    for (const [key, mapping] of Object.entries(CATEGORY_MAP)) {
      if (new RegExp(`\\b${key}\\b`, "i").test(lowerWorking)) {
        category = mapping.category;
        if (color === "yellow") color = mapping.color;
        break;
      }
    }
  }

  // 7. Clean Title: strip prepositions left at edges like "at", "on", "for"
  let cleanTitle = working
    .replace(/^(\s*[,.-]\s*)+|(\s*[,.-]\s*)+$/g, "")
    .replace(/\s+(at|on|for|by|in)\s*$/i, "")
    .replace(/^\s*(at|on|for|by|in)\s+/i, "")
    .trim();

  // If title was completely consumed, fallback
  if (!cleanTitle) {
    cleanTitle = text.trim();
  }

  // Capitalize first letter
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  // Compute confidence score
  let score = 0.5;
  if (scheduledDate) score += 0.2;
  if (startTime) score += 0.15;
  if (durationMinutes) score += 0.15;

  return {
    title: cleanTitle,
    rawInput: text,
    scheduled_date: scheduledDate,
    start_time: startTime,
    duration_minutes: durationMinutes,
    priority,
    category: category ?? "Quick Note",
    color,
    ambiguityWarning,
    confidence: Math.min(score, 1.0),
    tokensFound,
  };
}
