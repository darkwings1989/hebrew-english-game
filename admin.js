"use strict";

const CORE = window.ENGLISH_GAME_ADMIN_CORE;
const baseWords = window.ENGLISH_GAME_DATA?.words || [];
const customWords = Array.isArray(window.ENGLISH_GAME_CUSTOM_WORDS) ? window.ENGLISH_GAME_CUSTOM_WORDS : [];
const existingWords = [...baseWords, ...customWords].map((item) => item.word);

const elements = {
  form: document.querySelector("#word-form"),
  englishWord: document.querySelector("#english-word"),
  checkWord: document.querySelector("#check-word"),
  dictionaryStatus: document.querySelector("#dictionary-status"),
  meaningSection: document.querySelector("#meaning-section"),
  meaningOptions: document.querySelector("#meaning-options"),
  vocalizedMeaning: document.querySelector("#vocalized-meaning"),
  detailsSection: document.querySelector("#details-section"),
  category: document.querySelector("#category"),
  wordColor: document.querySelector("#word-color"),
  iconSearch: document.querySelector("#icon-search"),
  iconGrid: document.querySelector("#icon-grid"),
  selectedIconLabel: document.querySelector("#selected-icon-label"),
  githubSection: document.querySelector("#github-section"),
  repoOwner: document.querySelector("#repo-owner"),
  repoName: document.querySelector("#repo-name"),
  submitRequest: document.querySelector("#submit-request"),
  formError: document.querySelector("#form-error"),
};

const state = {
  checkedWord: "",
  meanings: [],
  selectedMeaning: "",
  selectedIcon: "",
  icons: [],
  checking: false,
};

function setStatus(message, type = "") {
  elements.dictionaryStatus.textContent = message;
  elements.dictionaryStatus.className = `form-status${type ? ` ${type}` : ""}`;
}

function showError(messages) {
  const list = Array.isArray(messages) ? messages : [messages];
  elements.formError.innerHTML = list.map((message) => `• ${escapeHtml(message)}`).join("<br>");
  elements.formError.hidden = false;
}

function clearError() {
  elements.formError.hidden = true;
  elements.formError.textContent = "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetCheckedResult() {
  state.checkedWord = "";
  state.meanings = [];
  state.selectedMeaning = "";
  elements.meaningSection.hidden = true;
  elements.detailsSection.hidden = true;
  elements.githubSection.hidden = true;
  elements.meaningOptions.replaceChildren();
  elements.vocalizedMeaning.value = "";
  elements.submitRequest.disabled = true;
  clearError();
}

async function fetchWiktionaryWikitext(word) {
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
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("שירות המילון לא זמין כרגע. נסו שוב מאוחר יותר.");
  const result = await response.json();
  if (result.error || !result.parse?.wikitext) throw new Error("המילה לא נמצאה במילון האנגלי.");
  return result.parse.wikitext;
}

function renderMeanings() {
  elements.meaningOptions.replaceChildren();
  state.meanings.forEach((meaning, index) => {
    const label = document.createElement("label");
    label.className = "meaning-option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "meaning";
    radio.value = meaning;
    radio.required = true;
    radio.checked = index === 0;
    const text = document.createElement("span");
    text.textContent = meaning;
    label.append(radio, text);
    radio.addEventListener("change", () => {
      state.selectedMeaning = meaning;
      elements.vocalizedMeaning.value = meaning;
      clearError();
    });
    elements.meaningOptions.append(label);
  });
  state.selectedMeaning = state.meanings[0] || "";
  elements.vocalizedMeaning.value = state.selectedMeaning;
}

async function checkWord() {
  if (state.checking) return;
  resetCheckedResult();
  const word = CORE.normalizeEnglish(elements.englishWord.value);
  elements.englishWord.value = word;

  if (!CORE.isValidEnglishWord(word)) {
    setStatus("הקלידו מילה או ביטוי קצר באנגלית, באותיות אנגליות בלבד.", "error");
    return;
  }
  if (existingWords.some((item) => CORE.normalizeEnglish(item) === word)) {
    setStatus("המילה כבר קיימת במשחק ואין צורך להוסיף אותה שוב.", "error");
    return;
  }

  state.checking = true;
  elements.checkWord.disabled = true;
  setStatus("בודק את המילה ואת הפירושים שלה במילון...");
  try {
    const wikitext = await fetchWiktionaryWikitext(word);
    const meanings = CORE.extractHebrewTranslations(wikitext);
    if (!meanings.length) {
      throw new Error("המילה נמצאה, אבל לא נמצא לה פירוש עברי מאומת. היא לא תתווסף אוטומטית.");
    }
    state.checkedWord = word;
    state.meanings = meanings;
    renderMeanings();
    elements.meaningSection.hidden = false;
    elements.detailsSection.hidden = false;
    elements.githubSection.hidden = false;
    elements.submitRequest.disabled = false;
    setStatus(`המילה נמצאה. נמצאו ${meanings.length} פירושים אפשריים.`, "success");
    elements.meaningSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    const offline = !navigator.onLine;
    setStatus(offline ? "אין כרגע חיבור לאינטרנט. התחברו ונסו שוב." : error.message, "error");
  } finally {
    state.checking = false;
    elements.checkWord.disabled = false;
  }
}

function populateCategories() {
  elements.category.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "בחרו קטגוריה";
  elements.category.append(placeholder);
  CORE.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.label;
    elements.category.append(option);
  });
}

function iconMatches(icon, query) {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  return icon.name.includes(normalized) || icon.label.includes(normalized);
}

function renderIcons() {
  const query = elements.iconSearch.value;
  elements.iconGrid.replaceChildren();
  state.icons.filter((icon) => iconMatches(icon, query)).forEach((icon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-choice${state.selectedIcon === icon.name ? " selected" : ""}`;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(state.selectedIcon === icon.name));
    button.innerHTML = `<img src="./assets/icons/library/${encodeURIComponent(icon.name)}.svg" alt=""><span>${escapeHtml(icon.label)}</span>`;
    button.addEventListener("click", () => {
      state.selectedIcon = icon.name;
      elements.selectedIconLabel.textContent = `האייקון שנבחר: ${icon.label}`;
      renderIcons();
      clearError();
    });
    elements.iconGrid.append(button);
  });
}

async function loadIcons() {
  try {
    const response = await fetch("./icon-catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error();
    state.icons = await response.json();
    renderIcons();
  } catch {
    elements.selectedIconLabel.textContent = "לא ניתן לטעון את ספריית האייקונים. רעננו את הדף.";
  }
}

function detectRepository() {
  const hostMatch = window.location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  if (!hostMatch) {
    try {
      elements.repoOwner.value = localStorage.getItem("english-game-repo-owner") || "";
      elements.repoName.value = localStorage.getItem("english-game-repo-name") || "";
    } catch {
      // Local storage is optional.
    }
    return;
  }
  const owner = hostMatch[1];
  const firstPathPart = window.location.pathname.split("/").filter(Boolean)[0];
  elements.repoOwner.value = owner;
  elements.repoName.value = firstPathPart || `${owner}.github.io`;
}

function validRepoPart(value) {
  return /^[a-z0-9_.-]+$/i.test(value) && value.length <= 100;
}

function currentPayload() {
  return CORE.sanitizePayload({
    word: state.checkedWord,
    hebrew: state.selectedMeaning,
    hebrewVocalized: elements.vocalizedMeaning.value,
    icon: state.selectedIcon,
    color: elements.wordColor.value,
    category: elements.category.value,
  });
}

function submitRequest(event) {
  event.preventDefault();
  clearError();
  const payload = currentPayload();
  const errors = CORE.validateWordPayload(payload, {
    allowedIcons: state.icons.map((icon) => icon.name),
    existingWords,
  });
  if (!CORE.meaningIsListed(payload.hebrew, state.meanings)) errors.push("הפירוש שנבחר אינו תואם לתוצאת המילון.");
  if (!/[\u0591-\u05c7]/u.test(payload.hebrewVocalized)) errors.push("יש להוסיף ניקוד לפירוש שיוצג בתרגיל.");

  const owner = elements.repoOwner.value.trim();
  const repository = elements.repoName.value.trim();
  if (!validRepoPart(owner) || !validRepoPart(repository)) errors.push("שם המשתמש או שם המאגר אינם תקינים.");
  if (errors.length) {
    showError([...new Set(errors)]);
    return;
  }

  try {
    localStorage.setItem("english-game-repo-owner", owner);
    localStorage.setItem("english-game-repo-name", repository);
  } catch {
    // The request can still be opened without local storage.
  }

  const title = `[הוספת מילה] ${payload.word}`;
  const body = CORE.buildIssueBody(payload);
  const url = new URL(`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/issues/new`);
  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  window.location.href = url.toString();
}

elements.englishWord.addEventListener("input", () => {
  if (state.checkedWord && CORE.normalizeEnglish(elements.englishWord.value) !== state.checkedWord) {
    resetCheckedResult();
    setStatus("המילה השתנתה. לחצו שוב על בדיקת מילה.");
  }
});
elements.englishWord.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    checkWord();
  }
});
elements.checkWord.addEventListener("click", checkWord);
elements.iconSearch.addEventListener("input", renderIcons);
elements.form.addEventListener("submit", submitRequest);

populateCategories();
detectRepository();
loadIcons();
