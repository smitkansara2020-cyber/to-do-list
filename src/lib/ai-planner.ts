export interface ProposedTask {
  title: string;
  category: string;
  duration_minutes: number;
  priority: "low" | "medium" | "high";
  subtasks: string[];
}

/**
 * Standardize common developer & student typos in user prompts
 */
const COMMON_TYPOS: Record<string, string> = {
  deepleanrning: "Deep Learning",
  deeplearning: "Deep Learning",
  machinelearning: "Machine Learning",
  machinglearning: "Machine Learning",
  leetcde: "LeetCode",
  leetcode: "LeetCode",
  litcode: "LeetCode",
  "leet code": "LeetCode",
  "neat code": "LeetCode",
  neatcode: "LeetCode",
  "tool code": "LeetCode",
  toolcode: "LeetCode",
  javascrip: "JavaScript",
  javascript: "JavaScript",
  typescrip: "TypeScript",
  typescript: "TypeScript",
  pyton: "Python",
  reactjs: "React",
  nextjs: "Next.js",
  fronted: "Frontend",
  backend: "Backend",
  dsa: "DSA (Data Structures & Algorithms)",
};

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  "forty-five": 45,
  fifty: 50,
  sixty: 60,
  ninety: 90,
};

/**
 * Extract duration in minutes from a text snippet.
 * Handles compound durations ("1 hour, 30 minutes", "one hour 30 mins ish"),
 * per-unit durations ("30 minutes each"), verbal numbers ("two hours", "half an hour", "two and a half hours"),
 * and standard numeric units ("120 minutes", "1.5hr", "45m").
 */
export function extractDurationMinutes(text: string): { minutes: number | null; matchedText: string | null } {
  // 1. Compound duration: e.g. "one hour, 30 minutes", "1 hour and 30 mins", "1h 30m", "one hour 30 minutes ish"
  const compound = text.match(
    /\b(?:for|in|about)?\s*(\d+(?:\.\d+)?|one|two|three|four|five)\s*(?:hours?|hrs?|h)\s*(?:and|,)?\s*(\d+|fifteen|twenty|thirty|forty-five|forty|fifty)\s*(?:minutes?|mins?|min|m)\b(?:\s*ish)?/i,
  );
  if (compound && compound[1] && compound[2]) {
    const hours = WORD_NUMBERS[compound[1].toLowerCase()] ?? parseFloat(compound[1]);
    const mins = WORD_NUMBERS[compound[2].toLowerCase()] ?? parseFloat(compound[2]);
    return {
      minutes: Math.round(hours * 60 + mins),
      matchedText: compound[0],
    };
  }

  // 2. Idiomatic verbal hours: "two and a half hours", "an hour and a half", "half an hour", "an hour"
  const halfHourCombo = text.match(
    /\b(?:for|in|about)?\s*(\d+|one|two|three|four)?\s*(?:and\s+a\s+half\s+hours?|hour\s+and\s+a\s+half)\b(?:\s*ish)?/i,
  );
  if (halfHourCombo) {
    const prefixStr = halfHourCombo[1];
    const prefix = prefixStr ? (WORD_NUMBERS[prefixStr.toLowerCase()] ?? parseFloat(prefixStr)) : 1;
    return { minutes: Math.round((prefix + 0.5) * 60), matchedText: halfHourCombo[0] };
  }
  if (/\bhalf\s+an?\s+hour\b/i.test(text)) {
    const m = text.match(/\b(?:for|in|about)?\s*half\s+an?\s+hour\b(?:\s*ish)?/i);
    return { minutes: 30, matchedText: m ? m[0] : "half an hour" };
  }
  if (/\ban\s+hour\b/i.test(text)) {
    const m = text.match(/\b(?:for|in|about)?\s*an\s+hour\b(?:\s*ish)?/i);
    return { minutes: 60, matchedText: m ? m[0] : "an hour" };
  }

  // 3. Per-item durations: "30 minutes each", "half an hour each"
  const eachMatch = text.match(
    /\b(?:for|about)?\s*(\d+|half\s+an?\s+hour)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m)?\s*each\b/i,
  );
  if (eachMatch) {
    let unitMins = 30;
    const itemDurStr = eachMatch[1] || "";
    if (itemDurStr.toLowerCase().includes("half")) {
      unitMins = 30;
    } else {
      const val = parseFloat(itemDurStr || "30");
      const unit = (eachMatch[2] || "m").toLowerCase();
      unitMins = unit.startsWith("h") ? Math.round(val * 60) : Math.round(val);
    }
    const countMatch = text.match(
      /\b(\d+|two|three|four|five)\s*(?:leetcode|neatcode|neat\s*code|tool\s*code|problems?|questions?|tasks?|sessions?)/i,
    );
    const countStr = countMatch ? countMatch[1] : undefined;
    const count = countStr ? (WORD_NUMBERS[countStr.toLowerCase()] ?? parseInt(countStr, 10)) : 2;
    return {
      minutes: unitMins * count,
      matchedText: eachMatch[0],
    };
  }

  // 4. Standard digits or verbal number units: "120 minutes", "2 hours", "two hours", "1.5hr", "45 mins"
  const match = text.match(
    /\b(?:for|in|about)?\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m)\b(?:\s*ish)?/i,
  );
  if (!match || !match[1] || !match[2]) {
    return { minutes: null, matchedText: null };
  }

  const val = WORD_NUMBERS[match[1].toLowerCase()] ?? parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith("h")) {
    return { minutes: Math.round(val * 60), matchedText: match[0] };
  }
  return { minutes: Math.round(val), matchedText: match[0] };
}

/**
 * Clean up user input into a presentable title
 */
export function cleanTaskTitle(raw: string, matchedDurationText: string | null): string {
  let cleaned = raw;
  if (matchedDurationText) {
    cleaned = cleaned.replace(matchedDurationText, " ");
  }

  // Remove meta directives if present in a clause
  cleaned = cleaned
    .replace(
      /\b(?:so\s+)?(?:please\s+)?(?:create|make|add|generate|pin|put)\s+(?:(?:a|an|one|two|three|four|\d+)\s+)?(?:sticky\s*notes?|tasks?|sessions?|notes?|cards?)\b.*/gi,
      " ",
    )
    .replace(
      /\b(?:and\s*)?(?:i\s*)?(?:add|put|pin)\s*(?:it|them)\s*(?:in|to)\s*(?:today'?s?\s*list|my\s*list|the\s*board|my\s*whiteboard|today)\b.*/gi,
      " ",
    )
    .replace(/\bso\s+create\s+(?:two|three|\d+)?\s*sticky\s*notes?\s*(?:it)?\b/gi, " ");

  // Remove common filler phrases, qualifiers, and voice artifacts
  cleaned = cleaned
    .replace(
      /\b(hey|please|can you|could you|i want to|i need to|i'd like to|i would like to|plan my (?:today'?s?|rodays?|day'?s?|day)?|plan (?:today'?s?|rodays?|day'?s?|day)?|schedule|also|and also|and then|and|plus|for|in|about|ish|each|of)\b/gi,
      " ",
    )
    .replace(/\b(?:for\s+)?two\s+of\s+us\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Replace common typos
  for (const [typo, replacement] of Object.entries(COMMON_TYPOS)) {
    const reg = new RegExp(`\\b${typo}\\b`, "gi");
    if (reg.test(cleaned)) {
      cleaned = cleaned.replace(reg, replacement);
    }
  }

  // Convert number words preceding problem/question
  cleaned = cleaned.replace(/\b(two|three|four|five)\s+(?=leetcode|problems?|questions?)/gi, (_, w) => {
    return `${WORD_NUMBERS[w.toLowerCase()] ?? w} `;
  });

  // Standardize coding tasks to Problems
  if (/leetcode/i.test(cleaned)) {
    cleaned = cleaned.replace(/\bquestions?\b/gi, "Problems");
    cleaned = cleaned.replace(/\bproblems?\b/gi, "Problems");
  }

  // Strip generic "Topic" suffix (e.g. "Deep Learning Topic" -> "Deep Learning")
  cleaned = cleaned.replace(/\bTopic\b/gi, "").trim();

  // Clean leading / trailing connecting words
  cleaned = cleaned.replace(/^(?:of|and|for|in|to)\s+/i, "").replace(/\s+(?:of|and|for|in|to)$/i, "");

  // Title case conversion
  cleaned = cleaned
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      // If it's already mixed-case like LeetCode or JavaScript, preserve it
      if (/[A-Z]/.test(word.slice(1))) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

  return cleaned || "Focused Deep Work";
}

/**
 * Infer category and priority based on task subject
 */
export function inferCategoryAndPriority(title: string): { category: string; priority: "low" | "medium" | "high" } {
  const lower = title.toLowerCase();

  if (/\b(deep learning|ai|machine learning|neural|study|learn|reading|course|lecture|exam|physics|math)\b/i.test(lower)) {
    return { category: "Study", priority: "high" };
  }
  if (/\b(leetcode|code|coding|algorithm|dsa|problem|bug|frontend|backend|react|python|build|dev)\b/i.test(lower)) {
    return { category: "Coding", priority: "high" };
  }
  if (/\b(gym|workout|fitness|run|health|stretch|walk|exercise|hydrate)\b/i.test(lower)) {
    return { category: "Health", priority: "medium" };
  }
  if (/\b(meeting|sync|call|review|email|client|admin|interview)\b/i.test(lower)) {
    return { category: "Work", priority: "medium" };
  }
  if (/\b(clean|groceries|buy|errand|personal|habit|finance)\b/i.test(lower)) {
    return { category: "Personal", priority: "low" };
  }

  return { category: "Today's Work", priority: "high" };
}

/**
 * Generate smart, relevant subtasks tailored to duration and topic
 */
export function generateSubtasks(title: string, durationMinutes: number): string[] {
  const lower = title.toLowerCase();
  const isLongSession = durationMinutes >= 90;

  // LeetCode / Coding problems
  if (/\bleetcode\b/i.test(lower) || /\bproblems?\b/i.test(lower)) {
    const countMatch = lower.match(/(\d+)\s*(?:leetcode|problems?)/);
    const count = countMatch && countMatch[1] ? parseInt(countMatch[1], 10) : 2;

    if (count === 2) {
      return [
        "Problem 1: Pattern identification & optimal solution",
        "Problem 2: Implementation & edge cases",
        "Analyze time & space complexity for both",
      ];
    }
    if (count >= 3) {
      return [
        `Solve Problem 1 & 2 (Core pattern analysis)`,
        `Solve Problem ${count} (Edge cases & performance)`,
        "Review constraints and document complexity",
      ];
    }
    return [
      "Analyze problem constraints & edge cases",
      "Implement optimal solution",
      "Verify time/space complexity",
    ];
  }

  // Deep Learning / Machine Learning / Study
  if (/\b(deep learning|ai|machine learning|study|learn)\b/i.test(lower)) {
    if (isLongSession) {
      const part1 = Math.round(durationMinutes * 0.4);
      const part2 = Math.round(durationMinutes * 0.4);
      const part3 = durationMinutes - part1 - part2;
      return [
        `Core architecture & theory review (${part1}m)`,
        `Notebook experimentation & code implementation (${part2}m)`,
        `Evaluate results & summarize takeaways (${part3}m)`,
      ];
    }
    return [
      "Review theory & core mathematical concepts",
      "Hands-on code implementation & tests",
      "Summarize key insights & equations",
    ];
  }

  // Workout / Health
  if (/\b(gym|workout|fitness|run|health|exercise)\b/i.test(lower)) {
    return [
      "Warm-up & dynamic stretching (10m)",
      "Main working sets & intensity progression",
      "Cool-down, hydration & mobility stretch",
    ];
  }

  // General Deep Work / Implementation
  if (isLongSession) {
    const block = Math.round(durationMinutes / 2);
    return [
      `Phase 1: Architecture, planning & setup (${block}m)`,
      `Phase 2: Execution & core implementation (${block}m)`,
      "Final review, validation & wrap-up",
    ];
  }

  return [
    "Initial discovery & scope outline",
    "Focused execution block",
    "Verification & commit changes",
  ];
}

/**
 * Intelligent Plan Request Parser
 * Takes natural language voice or text requests and produces exact duration-accurate, categorized action items.
 */
export function parsePlanRequest(query: string): { summaryText: string; tasks: ProposedTask[] } {
  let cleanedQuery = query.trim();

  // 1. Strip UI meta directives (e.g., "So create two Sticky notes for it and I add it in today's list")
  cleanedQuery = cleanedQuery
    .replace(
      /(?:[.,;]|\s+)\s*(?:so\s+)?(?:please\s+)?(?:create|make|add|generate|pin|put)\s+(?:(?:a|an|one|two|three|four|\d+)\s+)?(?:sticky\s*notes?|tasks?|sessions?|notes?|cards?)\s*(?:for\s+(?:it|this|them))?\s*(?:and\s*(?:i\s*)?(?:add|put|pin)\s*(?:it|them)?\s*(?:in|to)\s*(?:today'?s?\s*list|my\s*list|the\s*board|my\s*whiteboard|today))?.*$/i,
      "",
    )
    .replace(
      /(?:[.,;]|\s+)\s*(?:and\s*)?(?:i\s*)?(?:add|put|pin)\s*(?:it|them)\s*(?:in|to)\s*(?:today'?s?\s*list|my\s*list|the\s*board|my\s*whiteboard|today).*$/i,
      "",
    )
    .trim();

  // 2. Pre-normalize speech recognition artifacts
  // "for two of us" / "two of us" -> voice transcription artifact for "for 2 hours"
  cleanedQuery = cleanedQuery.replace(/\b(?:for|in|about)?\s*two\s+of\s+us\b/gi, "for 2 hours");
  // "to hours" / "too hours" -> "2 hours"
  cleanedQuery = cleanedQuery.replace(/\b(?:to|too)\s+hours\b/gi, "2 hours");
  // "tool code" / "neat code" -> "leetcode"
  cleanedQuery = cleanedQuery.replace(/\b(?:tool\s*code|neat\s*code|neatcode)\b/gi, "leetcode");

  // 3. Insert boundary when voice typing omitted punctuation between a duration and the next action
  // e.g., "...120 minutes solve tool code problems..." -> "...120 minutes and solve tool code problems..."
  cleanedQuery = cleanedQuery.replace(
    /((?:hours?|hrs?|h|minutes?|mins?|min|m)\b(?:\s*ish)?(?:\s+each)?)\s+(?=(?:i\s+(?:want|need|would\s+like)\s+to\s+)?(?:solve|practice|code|learn|study|work|workout|gym|exercise|review|read|write|prepare|build|debug|finish|clean|create|test|testing|deploy|meeting|sync|interview|research)\b)/gi,
    "$1 and ",
  );

  // 4. Split query into task clauses
  const rawClauses = cleanedQuery
    .split(
      /(?:\s+(?:and\s+also|and\s+then|also|plus|as\s+well\s+as|after\s+that)\s+|(?<!\d)[;.]|\s+and\s+(?=[a-z0-9\s]+(?:for|in|\d+\s*(?:h|m|hour|min)|solve|practice|code|learn|study|work|workout|gym|exercise|review|read|write|prepare|build))|,\s*(?=[a-z0-9\s]+(?:solve|practice|code|learn|study|work|workout|gym|exercise|review|read|write|prepare|build)))/i,
    )
    .map((c) => c.trim())
    .filter(Boolean);

  const parsedTasks: ProposedTask[] = [];

  for (const clause of rawClauses) {
    const { minutes, matchedText } = extractDurationMinutes(clause);
    const hasIntent =
      /\b(learn|study|solve|practice|code|workout|read|write|prepare|finish|clean|build|meeting|review|leetcode|deep learning)\b/i.test(
        clause,
      );

    if (minutes !== null || hasIntent) {
      const finalDuration = minutes ?? 45;
      const cleanTitle = cleanTaskTitle(clause, matchedText);
      if (cleanTitle.length > 2) {
        const { category, priority } = inferCategoryAndPriority(cleanTitle);
        const subtasks = generateSubtasks(cleanTitle, finalDuration);

        parsedTasks.push({
          title: cleanTitle,
          category,
          duration_minutes: finalDuration,
          priority,
          subtasks,
        });
      }
    }
  }

  // Fallback if no specific clauses could be extracted
  if (parsedTasks.length === 0) {
    const { minutes, matchedText } = extractDurationMinutes(cleanedQuery);
    const overallDuration = minutes ?? 60;
    const cleanTitle = cleanTaskTitle(cleanedQuery, matchedText);
    const { category, priority } = inferCategoryAndPriority(cleanTitle);

    parsedTasks.push({
      title: cleanTitle.length > 3 ? cleanTitle : "Focused Deep Work Session",
      category,
      duration_minutes: overallDuration,
      priority,
      subtasks: generateSubtasks(cleanTitle, overallDuration),
    });
  }

  const totalMin = parsedTasks.reduce((sum, t) => sum + t.duration_minutes, 0);
  const totalHoursFormatted =
    totalMin >= 60 ? `${(totalMin / 60).toFixed(1).replace(/\.0$/, "")}h` : `${totalMin}m`;

  const taskListFormatted = parsedTasks
    .map((t) => `• **${t.title}** (${t.duration_minutes}m)`)
    .join("\n");

  const summaryText = `I've planned out ${parsedTasks.length} focused session${parsedTasks.length === 1 ? "" : "s"} totaling **${totalHoursFormatted}** (${totalMin}m), automatically converting your requested hours into exact minute blocks:\n\n${taskListFormatted}\n\nReview them below and click **Pin to Board**:`;

  return {
    summaryText,
    tasks: parsedTasks,
  };
}
