"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../admin-core.js");

const ROOT = path.resolve(process.env.GAME_ROOT || path.join(__dirname, ".."));
const OUTPUT_DIR = path.resolve(process.env.RUNNER_TEMP || ROOT);
const ERROR_FILE = path.join(OUTPUT_DIR, "word-request-error.txt");
const SUCCESS_FILE = path.join(OUTPUT_DIR, "word-request-success.txt");

function readWindowValue(file, property) {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context.window[property];
}

function getExistingData() {
  const base = readWindowValue(path.join(ROOT, "data.js"), "ENGLISH_GAME_DATA");
  const custom = readWindowValue(path.join(ROOT, "custom-words.js"), "ENGLISH_GAME_CUSTOM_WORDS");
  return {
    baseWords: Array.isArray(base?.words) ? base.words : [],
    customWords: Array.isArray(custom) ? JSON.parse(JSON.stringify(custom)) : [],
  };
}

async function fetchWiktionaryWikitext(word) {
  if (process.env.WIKTIONARY_WIKITEXT_FILE) {
    return fs.readFileSync(process.env.WIKTIONARY_WIKITEXT_FILE, "utf8");
  }
  const params = new URLSearchParams({
    action: "parse",
    page: word,
    prop: "wikitext",
    format: "json",
    formatversion: "2",
    redirects: "1",
    origin: "*",
  });
  const response = await fetch(`https://en.wiktionary.org/w/api.php?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "EnglishFirstQuestGitHubAction/1.0" },
  });
  if (!response.ok) throw new Error(`בדיקת המילון נכשלה עם קוד ${response.status}.`);
  const result = await response.json();
  if (result.error || !result.parse?.wikitext) throw new Error("המילה לא נמצאה במילון האנגלי.");
  return result.parse.wikitext;
}

function assertOwner(event) {
  const actor = event.issue?.user?.login || event.sender?.login || "";
  const owner = event.repository?.owner?.login || "";
  if (!actor || !owner || actor.toLowerCase() !== owner.toLowerCase()) {
    throw new Error("רק בעל המאגר יכול להוסיף מילים באמצעות התהליך האוטומטי.");
  }
}

function serializeCustomWords(words) {
  const sorted = [...words].sort((left, right) => left.word.localeCompare(right.word, "en"));
  return [
    "\"use strict\";",
    "",
    "// This file is updated automatically by the add-word GitHub workflow.",
    `window.ENGLISH_GAME_CUSTOM_WORDS = Object.freeze(${JSON.stringify(sorted, null, 2)});`,
    "",
  ].join("\n");
}

async function processEvent(event) {
  assertOwner(event);
  if (!String(event.issue?.title || "").startsWith("[הוספת מילה] ")) {
    throw new Error("כותרת הבקשה אינה מתאימה לבקשת הוספת מילה.");
  }

  const payload = core.parseIssueBody(event.issue?.body);
  const iconCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, "icon-catalog.json"), "utf8"));
  const allowedIcons = iconCatalog.map((item) => item.name);
  const { baseWords, customWords } = getExistingData();
  const existingWords = [...baseWords, ...customWords].map((item) => item.word);
  const errors = core.validateWordPayload(payload, { allowedIcons, existingWords });

  if (!/[\u0591-\u05c7]/u.test(payload.hebrewVocalized)) {
    errors.push("הפירוש שמוצג בתרגיל חייב לכלול ניקוד.");
  }
  const iconFile = path.join(ROOT, "assets", "icons", "library", `${payload.icon}.svg`);
  if (!fs.existsSync(iconFile)) errors.push("קובץ האייקון שנבחר אינו קיים.");
  if (errors.length) throw new Error([...new Set(errors)].join(" "));

  const wikitext = await fetchWiktionaryWikitext(payload.word);
  const candidates = core.extractHebrewTranslations(wikitext);
  if (!core.meaningIsListed(payload.hebrew, candidates)) {
    throw new Error("הפירוש העברי שנבחר אינו מופיע בין פירושי המילה ב־Wiktionary.");
  }

  const nextWord = {
    word: payload.word,
    hebrew: payload.hebrew,
    hebrewVocalized: payload.hebrewVocalized,
    icon: `library/${payload.icon}.svg`,
    color: payload.color,
    category: payload.category,
  };
  fs.writeFileSync(path.join(ROOT, "custom-words.js"), serializeCustomWords([...customWords, nextWord]), "utf8");
  const message = `המילה ${payload.word} נוספה למשחק ונבדקה שוב מול Wiktionary.`;
  fs.writeFileSync(SUCCESS_FILE, `${message}\n`, "utf8");
  return nextWord;
}

async function main() {
  for (const file of [ERROR_FILE, SUCCESS_FILE]) {
    try { fs.unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) throw new Error("לא נמצא קובץ אירוע של GitHub.");
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    await processEvent(event);
  } catch (error) {
    fs.writeFileSync(ERROR_FILE, `${error.message || "בקשת הוספת המילה נכשלה."}\n`, "utf8");
    throw error;
  }
}

module.exports = { assertOwner, fetchWiktionaryWikitext, getExistingData, processEvent, serializeCustomWords };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
