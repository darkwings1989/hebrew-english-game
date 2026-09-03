"use strict";

(function initializeAdminCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ENGLISH_GAME_ADMIN_CORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ISSUE_START = "<!-- ENGLISH_WORD_REQUEST_V1";
  const ISSUE_END = "END_ENGLISH_WORD_REQUEST -->";
  const HEBREW_MARKS = /[\u0591-\u05c7]/gu;
  const HEBREW_LETTERS = /[\u05d0-\u05ea]/u;
  const ENGLISH_WORD = /^[a-z]+(?:[ '-][a-z]+)*$/;
  const SAFE_SLUG = /^[a-z][a-z0-9-]*$/;
  const SAFE_ICON = /^[a-z0-9-]+$/;
  const SAFE_COLOR = /^#[0-9a-f]{6}$/i;

  const categories = Object.freeze([
    { id: "colors", label: "צבעים" },
    { id: "numbers", label: "מספרים" },
    { id: "animals", label: "חיות" },
    { id: "family", label: "משפחה" },
    { id: "classroom", label: "חפצים מהכיתה" },
    { id: "food", label: "אוכל" },
    { id: "greetings", label: "ברכות וביטויים" },
    { id: "objects", label: "חפצים" },
    { id: "home", label: "בית" },
    { id: "nature", label: "טבע" },
    { id: "body", label: "גוף" },
    { id: "transport", label: "תחבורה" },
    { id: "other", label: "אחר" },
  ]);

  function normalizeEnglish(value) {
    return String(value || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, " ");
  }

  function isValidEnglishWord(value) {
    const normalized = normalizeEnglish(value);
    return normalized.length >= 1 && normalized.length <= 40 && ENGLISH_WORD.test(normalized);
  }

  function normalizeHebrew(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(HEBREW_MARKS, "")
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/[־–—-]/g, " ")
      .replace(/[^\u05d0-\u05ea\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripWikiMarkup(value) {
    return String(value || "")
      .replace(/<!--[^]*?-->/g, "")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\{\{l\|he\|([^}|]+)[^}]*\}\}/gi, "$1")
      .replace(/\{\{[^{}]*\}\}/g, "")
      .replace(/'{2,}/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim();
  }

  function cleanTranslation(value) {
    const cleaned = stripWikiMarkup(value)
      .split(/[;,]/)[0]
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return HEBREW_LETTERS.test(cleaned) && cleaned.length <= 80 ? cleaned : "";
  }

  function englishSection(wikitext) {
    const source = String(wikitext || "");
    const match = source.match(/^==\s*English\s*==\s*$/im);
    if (!match || match.index === undefined) return "";
    const rest = source.slice(match.index + match[0].length);
    const nextLanguage = rest.search(/^==[^=].*?==\s*$/m);
    return nextLanguage >= 0 ? rest.slice(0, nextLanguage) : rest;
  }

  function extractHebrewTranslations(wikitext) {
    const section = englishSection(wikitext);
    if (!section) return [];

    const translations = [];
    const templatePattern = /\{\{(?:t\+?|tt\+?|t-check)\|he\|([^|}]+)(?:\|[^}]*)?\}\}/gi;
    let match;
    while ((match = templatePattern.exec(section)) !== null) {
      const translation = cleanTranslation(match[1]);
      if (translation) translations.push(translation);
    }

    const hebrewLinePattern = /^\*\s*Hebrew\s*:\s*(.+)$/gim;
    while ((match = hebrewLinePattern.exec(section)) !== null) {
      const line = match[1];
      for (const linked of line.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
        const translation = cleanTranslation(linked[1]);
        if (translation) translations.push(translation);
      }
    }

    const seen = new Set();
    return translations.filter((translation) => {
      const key = normalizeHebrew(translation);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function meaningIsListed(value, candidates) {
    const wanted = normalizeHebrew(value);
    return Boolean(wanted && candidates.some((candidate) => normalizeHebrew(candidate) === wanted));
  }

  function validateWordPayload(payload, options = {}) {
    const errors = [];
    const allowedIcons = new Set(options.allowedIcons || []);
    const allowedCategories = new Set((options.allowedCategories || categories.map((item) => item.id)));
    const existingWords = new Set((options.existingWords || []).map(normalizeEnglish));

    if (!payload || typeof payload !== "object") return ["בקשת המילה אינה תקינה."];
    if (!isValidEnglishWord(payload.word)) errors.push("המילה באנגלית אינה תקינה.");
    if (!payload.hebrew || !HEBREW_LETTERS.test(String(payload.hebrew))) errors.push("חסר פירוש תקין בעברית.");
    if (!payload.hebrewVocalized || !HEBREW_LETTERS.test(String(payload.hebrewVocalized))) errors.push("חסר פירוש מנוקד בעברית.");
    if (payload.hebrew && payload.hebrewVocalized && normalizeHebrew(payload.hebrew) !== normalizeHebrew(payload.hebrewVocalized)) {
      errors.push("הפירוש הרגיל והפירוש המנוקד אינם אותה מילה.");
    }
    if (!SAFE_ICON.test(String(payload.icon || ""))) errors.push("האייקון אינו תקין.");
    if (allowedIcons.size && !allowedIcons.has(payload.icon)) errors.push("האייקון אינו קיים בספריית האתר.");
    if (!SAFE_COLOR.test(String(payload.color || ""))) errors.push("הצבע אינו תקין.");
    if (!SAFE_SLUG.test(String(payload.category || "")) || !allowedCategories.has(payload.category)) errors.push("הקטגוריה אינה תקינה.");
    if (existingWords.has(normalizeEnglish(payload.word))) errors.push("המילה כבר קיימת במשחק.");
    return errors;
  }

  function sanitizePayload(payload) {
    return {
      version: 1,
      word: normalizeEnglish(payload.word),
      hebrew: String(payload.hebrew || "").trim(),
      hebrewVocalized: String(payload.hebrewVocalized || "").trim(),
      icon: String(payload.icon || "").trim(),
      color: String(payload.color || "").trim().toLowerCase(),
      category: String(payload.category || "").trim(),
    };
  }

  function buildIssueBody(payload) {
    const safe = sanitizePayload(payload);
    const category = categories.find((item) => item.id === safe.category)?.label || safe.category;
    return [
      ISSUE_START,
      JSON.stringify(safe, null, 2),
      ISSUE_END,
      "",
      "## בקשה להוספת מילה למשחק",
      "",
      `- מילה באנגלית: ${safe.word}`,
      `- פירוש בעברית: ${safe.hebrewVocalized}`,
      `- קטגוריה: ${category}`,
      `- אייקון: ${safe.icon}`,
      "",
      "הבקשה נוצרה מדף הניהול של המשחק. אין לערוך את אזור הנתונים המוסתר.",
    ].join("\n");
  }

  function parseIssueBody(body) {
    const source = String(body || "");
    const start = source.indexOf(ISSUE_START);
    const end = source.indexOf(ISSUE_END, start + ISSUE_START.length);
    if (start < 0 || end < 0) throw new Error("לא נמצאו נתוני בקשה תקינים.");
    const json = source.slice(start + ISSUE_START.length, end).trim();
    const payload = JSON.parse(json);
    if (!payload || payload.version !== 1) throw new Error("גרסת הבקשה אינה נתמכת.");
    return sanitizePayload(payload);
  }

  return Object.freeze({
    ISSUE_START,
    ISSUE_END,
    categories,
    normalizeEnglish,
    isValidEnglishWord,
    normalizeHebrew,
    cleanTranslation,
    englishSection,
    extractHebrewTranslations,
    meaningIsListed,
    validateWordPayload,
    sanitizePayload,
    buildIssueBody,
    parseIssueBody,
  });
});
