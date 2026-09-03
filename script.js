"use strict";

const DATA = window.ENGLISH_GAME_DATA;
const ICON_PATH = "./assets/icons/";
const STORAGE_KEY = "english-first-quest-progress-v1";
const VOICE_WAIT_MS = 3000;
const SPEECH_START_DELAY_MS = 220;
const LETTER_SPEECH_RATE = 0.5;
const WORD_SPEECH_RATE = 0.72;

const elements = {
  score: document.querySelector("#score"),
  streak: document.querySelector("#streak"),
  stars: document.querySelector("#stars"),
  reset: document.querySelector("#reset-button"),
  stagePicker: document.querySelector("#stage-picker"),
  stageName: document.querySelector("#stage-name"),
  questionNumber: document.querySelector("#question-number"),
  progressLabel: document.querySelector("#progress-label"),
  progressTrack: document.querySelector(".progress-track"),
  progressBar: document.querySelector("#progress-bar"),
  instruction: document.querySelector("#instruction"),
  prompt: document.querySelector("#prompt"),
  sound: document.querySelector("#sound-button"),
  soundLabel: document.querySelector("#sound-label"),
  speechStatus: document.querySelector("#speech-status"),
  answers: document.querySelector("#answers"),
  spellingArea: document.querySelector("#spelling-area"),
  builtWord: document.querySelector("#built-word"),
  letterBank: document.querySelector("#letter-bank"),
  eraseLetter: document.querySelector("#erase-letter"),
  feedback: document.querySelector("#feedback"),
  explanation: document.querySelector("#explanation"),
  next: document.querySelector("#next-button"),
};

const savedProgress = loadProgress();
const state = {
  stageId: DATA.stages.some((stage) => stage.id === savedProgress.stageId) ? savedProgress.stageId : DATA.stages[0].id,
  score: savedProgress.score,
  streak: savedProgress.streak,
  correctCount: savedProgress.correctCount,
  questionNumber: 1,
  question: null,
  wrongAnswers: new Set(),
  attempts: 0,
  complete: false,
  builtLetters: [],
  usedLetterIndexes: new Set(),
};

let availableVoices = [];
let speechRequestId = 0;

function loadProgress() {
  const fallback = { stageId: DATA.stages[0].id, score: 0, streak: 0, correctCount: 0 };
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!value || typeof value !== "object") return fallback;
    return {
      stageId: typeof value.stageId === "string" ? value.stageId : fallback.stageId,
      score: Number.isFinite(value.score) && value.score >= 0 ? value.score : 0,
      streak: Number.isFinite(value.streak) && value.streak >= 0 ? value.streak : 0,
      correctCount: Number.isFinite(value.correctCount) && value.correctCount >= 0 ? value.correctCount : 0,
    };
  } catch {
    return fallback;
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      stageId: state.stageId,
      score: state.score,
      streak: state.streak,
      correctCount: state.correctCount,
    }));
  } catch {
    // The game still works when storage is disabled.
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function pick(items) {
  return items[randomInt(0, items.length - 1)];
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function uniqueChoices(correct, pool, total = 4) {
  const values = [correct, ...shuffled(pool.filter((value) => value !== correct))];
  return shuffled([...new Set(values)].slice(0, total));
}

function createLetterMatchQuestion() {
  const letter = pick(DATA.letters);
  return {
    kind: "standard",
    promptType: "letter",
    promptText: letter.upper,
    speechText: letter.upper,
    speechType: "letter",
    correct: letter.lower,
    choices: uniqueChoices(letter.lower, DATA.letters.map((item) => item.lower)),
    explanation: `${letter.upper} ו-${letter.lower} הן אותה אות.`,
  };
}

function createHearLetterQuestion() {
  const letter = pick(DATA.letters);
  return {
    kind: "standard",
    promptType: "listen",
    speechText: letter.upper,
    speechType: "letter",
    correct: letter.upper,
    choices: uniqueChoices(letter.upper, DATA.letters.map((item) => item.upper)),
    explanation: `שמעתם את האות ${letter.upper}.`,
  };
}

function createFirstLetterQuestion() {
  const item = pick(DATA.words);
  const firstLetter = item.word.charAt(0).toUpperCase();
  return {
    kind: "standard",
    promptType: "picture",
    item,
    revealEnglish: false,
    speechText: item.word,
    correct: firstLetter,
    choices: uniqueChoices(firstLetter, DATA.letters.map((letter) => letter.upper)),
    explanation: `${capitalize(item.word)} מתחילה באות ${firstLetter}. פירוש המילה: ${item.hebrew}.`,
  };
}

function createPictureWordQuestion() {
  const item = pick(DATA.words);
  return {
    kind: "standard",
    promptType: "picture",
    item,
    revealEnglish: false,
    speechText: item.word,
    correct: item.word,
    choices: uniqueChoices(item.word, DATA.words.map((word) => word.word)),
    explanation: `${capitalize(item.word)} פירושה ${item.hebrew}.`,
  };
}

function createListenWordQuestion() {
  const item = pick(DATA.words);
  const choices = uniqueChoices(item.word, DATA.words.map((word) => word.word))
    .map((word) => DATA.words.find((candidate) => candidate.word === word));
  return {
    kind: "image-choices",
    promptType: "listen",
    item,
    speechText: item.word,
    correct: item.word,
    choices,
    explanation: `שמעתם את המילה ${capitalize(item.word)}, שפירושה ${item.hebrew}.`,
  };
}

function createSpellingQuestion() {
  const item = pick(DATA.words.filter((word) => word.word.length <= 6));
  return {
    kind: "spelling",
    promptType: "picture",
    item,
    revealEnglish: false,
    speechText: item.word,
    correct: item.word,
    letters: shuffled(item.word.split("")),
    explanation: `${capitalize(item.word)} נכתבת כך: ${item.word.toUpperCase()}. פירוש המילה: ${item.hebrew}.`,
  };
}

function createQuestion() {
  const creators = {
    "case-match": createLetterMatchQuestion,
    "hear-letter": createHearLetterQuestion,
    "first-letter": createFirstLetterQuestion,
    "picture-word": createPictureWordQuestion,
    "listen-word": createListenWordQuestion,
    "spell-word": createSpellingQuestion,
  };
  return creators[state.stageId]();
}

function resetQuestionState() {
  speechRequestId += 1;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  state.wrongAnswers = new Set();
  state.attempts = 0;
  state.complete = false;
  state.builtLetters = [];
  state.usedLetterIndexes = new Set();
  elements.speechStatus.hidden = true;
}

function startQuestion() {
  resetQuestionState();
  state.question = createQuestion();
  render();
}

function nextQuestion() {
  state.questionNumber += 1;
  startQuestion();
}

function finishCorrect() {
  state.complete = true;
  state.score += state.attempts === 0 ? 10 : 5;
  state.streak += 1;
  state.correctCount += 1;
  saveProgress();
}

function finishWrong() {
  state.complete = true;
  state.streak = 0;
  saveProgress();
}

function chooseAnswer(value) {
  if (state.complete || state.wrongAnswers.has(value)) return;

  if (value === state.question.correct) {
    finishCorrect();
  } else {
    state.attempts += 1;
    state.wrongAnswers.add(value);
    state.streak = 0;
    if (state.attempts >= 2) finishWrong();
  }
  render();
}

function chooseLetter(letter, index) {
  if (state.complete || state.usedLetterIndexes.has(index)) return;
  state.builtLetters.push({ letter, index });
  state.usedLetterIndexes.add(index);

  if (state.builtLetters.length === state.question.correct.length) {
    const answer = state.builtLetters.map((item) => item.letter).join("");
    if (answer === state.question.correct) {
      finishCorrect();
    } else {
      state.attempts += 1;
      state.streak = 0;
      if (state.attempts >= 2) {
        finishWrong();
      } else {
        state.builtLetters = [];
        state.usedLetterIndexes = new Set();
      }
    }
  }
  render();
}

function eraseLastLetter() {
  if (state.complete || state.builtLetters.length === 0) return;
  const removed = state.builtLetters.pop();
  state.usedLetterIndexes.delete(removed.index);
  renderSpelling();
}

function renderStages() {
  elements.stagePicker.replaceChildren();
  DATA.stages.forEach((stage) => {
    const button = document.createElement("button");
    const selected = stage.id === state.stageId;
    button.type = "button";
    button.className = `stage-button${selected ? " selected" : ""}`;
    button.dataset.stage = stage.id;
    button.setAttribute("aria-pressed", String(selected));
    button.innerHTML = `<img src="${ICON_PATH}${stage.icon}" alt="" aria-hidden="true"><span>${stage.shortTitle}</span>`;
    button.addEventListener("click", () => {
      if (state.stageId === stage.id) return;
      state.stageId = stage.id;
      state.questionNumber = 1;
      saveProgress();
      startQuestion();
    });
    elements.stagePicker.append(button);
  });
}

function renderPrompt() {
  const question = state.question;
  elements.prompt.className = "prompt";

  if (question.promptType === "letter") {
    elements.prompt.innerHTML = `<div class="letter-prompt" dir="ltr">${question.promptText}</div>`;
    return;
  }

  if (question.promptType === "listen") {
    elements.prompt.innerHTML = `<div class="listen-prompt"><img src="${ICON_PATH}headphones.svg" alt="אוזניות"></div>`;
    return;
  }

  const item = question.item;
  const showEnglish = question.revealEnglish || state.complete;
  elements.prompt.innerHTML = `
    <div class="picture-prompt">
      <div class="picture-frame" style="color:${item.color}">
        <img src="${ICON_PATH}${item.icon}" alt="${item.hebrew}">
      </div>
      <div class="picture-copy">
        ${showEnglish ? `<strong dir="ltr">${capitalize(item.word)}</strong>` : ""}
        <span>${item.hebrew}</span>
      </div>
    </div>`;
}

function renderAnswers() {
  elements.answers.replaceChildren();
  elements.answers.hidden = state.question.kind === "spelling";
  if (state.question.kind === "spelling") return;

  state.question.choices.forEach((choice) => {
    const value = typeof choice === "string" ? choice : choice.word;
    const isWrong = state.wrongAnswers.has(value);
    const isCorrect = state.complete && value === state.question.correct;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `answer-button${state.question.kind === "image-choices" ? " image-answer" : ""}${isWrong ? " wrong" : ""}${isCorrect ? " correct" : ""}`;
    button.disabled = state.complete || isWrong;
    button.setAttribute("aria-label", `תשובה ${value}`);

    if (state.question.kind === "image-choices") {
      button.innerHTML = `<img src="${ICON_PATH}${choice.icon}" alt=""><span>${choice.hebrew}</span>`;
    } else {
      button.textContent = value;
      button.dir = "ltr";
    }

    if (isWrong || isCorrect) {
      const mark = document.createElement("span");
      mark.className = "answer-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = isCorrect ? "✓" : "×";
      button.append(mark);
    }

    button.addEventListener("click", () => chooseAnswer(value));
    elements.answers.append(button);
  });
}

function renderSpelling() {
  const isSpelling = state.question.kind === "spelling";
  elements.spellingArea.hidden = !isSpelling;
  if (!isSpelling) return;

  elements.builtWord.replaceChildren();
  const shownLetters = state.complete
    ? state.question.correct.split("")
    : state.builtLetters.map((item) => item.letter);

  for (let index = 0; index < state.question.correct.length; index += 1) {
    const slot = document.createElement("span");
    slot.className = "built-slot";
    slot.textContent = shownLetters[index] || "";
    elements.builtWord.append(slot);
  }

  elements.letterBank.replaceChildren();
  state.question.letters.forEach((letter, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "letter-tile";
    button.textContent = letter;
    button.disabled = state.complete || state.usedLetterIndexes.has(index);
    button.setAttribute("aria-label", `האות ${letter.toUpperCase()}`);
    button.addEventListener("click", () => chooseLetter(letter, index));
    elements.letterBank.append(button);
  });

  elements.eraseLetter.disabled = state.complete || state.builtLetters.length === 0;
}

function renderFeedback() {
  elements.feedback.className = "";
  elements.explanation.hidden = !state.complete;
  elements.explanation.textContent = state.complete ? state.question.explanation : "";
  elements.next.hidden = !state.complete;

  if (state.complete && state.question.kind === "spelling") {
    const answer = state.builtLetters.map((item) => item.letter).join("");
    const correct = answer === state.question.correct;
    elements.feedback.textContent = correct ? "נכון מאוד!" : `המילה הנכונה היא ${state.question.correct.toUpperCase()}`;
    elements.feedback.className = correct ? "correct-feedback" : "try-feedback";
  } else if (state.complete && state.wrongAnswers.size < 2) {
    elements.feedback.textContent = "נכון מאוד!";
    elements.feedback.className = "correct-feedback";
  } else if (state.complete) {
    elements.feedback.textContent = `התשובה הנכונה היא ${state.question.correct}`;
    elements.feedback.className = "try-feedback";
  } else if (state.attempts === 1) {
    elements.feedback.textContent = "לא נכון, נסו שוב";
    elements.feedback.className = "try-feedback";
  } else {
    elements.feedback.textContent = state.question.kind === "spelling" ? "בנו את המילה" : "בחרו תשובה";
  }
}

function render() {
  const stage = DATA.stages.find((item) => item.id === state.stageId);
  const progress = (state.correctCount % 10) * 10;

  elements.score.textContent = String(state.score);
  elements.streak.textContent = String(state.streak);
  elements.stars.textContent = String(Math.floor(state.correctCount / 10));
  elements.stageName.textContent = stage.title;
  elements.questionNumber.textContent = `שאלה ${state.questionNumber}`;
  elements.progressLabel.textContent = `עוד ${10 - (state.correctCount % 10)} תשובות לכוכב הבא`;
  elements.progressBar.style.width = `${progress}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(progress));
  elements.instruction.textContent = stage.instruction;
  const listenFirst = state.stageId === "first-letter";
  elements.soundLabel.textContent = listenFirst ? "שלב 1: לחצו ושמעו את המילה" : "לשמוע באנגלית";
  elements.sound.setAttribute("aria-label", listenFirst ? "שלב 1: שמיעת המילה באנגלית" : "השמעה באנגלית");

  renderStages();
  renderPrompt();
  renderAnswers();
  renderSpelling();
  renderFeedback();
}

function refreshVoices() {
  if (!("speechSynthesis" in window)) return [];
  availableVoices = window.speechSynthesis.getVoices();
  return availableVoices;
}

function findEnglishVoice(voices = availableVoices) {
  return voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("en-us"))
    || voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("en-gb"))
    || voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("en"))
    || null;
}

function waitForEnglishVoice(synth) {
  const existing = findEnglishVoice(refreshVoices());
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let finished = false;
    let timeoutId;
    let pollId;

    const finish = (voice) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      clearInterval(pollId);
      synth.removeEventListener("voiceschanged", check);
      resolve(voice);
    };

    const check = () => {
      const voice = findEnglishVoice(refreshVoices());
      if (voice) finish(voice);
    };

    synth.addEventListener("voiceschanged", check);
    pollId = setInterval(check, 200);
    timeoutId = setTimeout(() => finish(findEnglishVoice(refreshVoices())), VOICE_WAIT_MS);
  });
}

async function speakEnglish() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    elements.speechStatus.textContent = "הקראה באנגלית אינה זמינה בדפדפן הזה";
    elements.speechStatus.hidden = false;
    return;
  }

  const synth = window.speechSynthesis;
  const requestId = ++speechRequestId;
  synth.cancel();
  elements.speechStatus.textContent = "מחפש קול אנגלי...";
  elements.speechStatus.hidden = false;

  const voice = findEnglishVoice(refreshVoices()) || await waitForEnglishVoice(synth);
  if (requestId !== speechRequestId) return;
  if (!voice) {
    elements.speechStatus.textContent = "לא נמצא קול אנגלי זמין בדפדפן הזה";
    return;
  }

  const utterance = new SpeechSynthesisUtterance(state.question.speechText);
  let started = false;
  let finished = false;
  let watchdogId;
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = state.question.speechType === "letter" ? LETTER_SPEECH_RATE : WORD_SPEECH_RATE;
  utterance.pitch = 1;

  utterance.onstart = () => {
    started = true;
    clearTimeout(watchdogId);
    elements.speechStatus.hidden = true;
  };
  utterance.onend = () => {
    finished = true;
    clearTimeout(watchdogId);
  };
  utterance.onerror = (event) => {
    finished = true;
    clearTimeout(watchdogId);
    if (event.error === "canceled" || event.error === "interrupted") return;
    elements.speechStatus.textContent = "לא ניתן להפעיל כרגע את ההקראה באנגלית";
    elements.speechStatus.hidden = false;
  };

  await new Promise((resolve) => setTimeout(resolve, SPEECH_START_DELAY_MS));
  if (requestId !== speechRequestId) return;

  watchdogId = setTimeout(() => {
    if (started || finished || requestId !== speechRequestId) return;
    synth.cancel();
    elements.speechStatus.textContent = "מנוע ההקראה לא הגיב";
    elements.speechStatus.hidden = false;
  }, 5000);

  synth.speak(utterance);
}

elements.sound.addEventListener("click", speakEnglish);
elements.next.addEventListener("click", nextQuestion);
elements.eraseLetter.addEventListener("click", eraseLastLetter);
elements.reset.addEventListener("click", () => {
  state.score = 0;
  state.streak = 0;
  state.correctCount = 0;
  state.questionNumber = 1;
  saveProgress();
  startQuestion();
});

if ("speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}

startQuestion();
