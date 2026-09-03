"use strict";

window.ENGLISH_GAME_DATA = Object.freeze({
  stages: [
    {
      id: "case-match",
      title: "אות גדולה וקטנה",
      shortTitle: "A עם a",
      icon: "alphabet-latin.svg",
      instruction: "איזו אות קטנה מתאימה לאות הגדולה?",
    },
    {
      id: "hear-letter",
      title: "שומעים אות",
      shortTitle: "שמעו אות",
      icon: "headphones.svg",
      instruction: "לחצו על הרמקול ובחרו את האות ששמעתם.",
    },
    {
      id: "first-letter",
      title: "אות פותחת",
      shortTitle: "אות ראשונה",
      icon: "sparkles.svg",
      instruction: "באיזו אות מתחילה המילה?",
    },
    {
      id: "picture-word",
      title: "מילה ותמונה",
      shortTitle: "בחרו מילה",
      icon: "book-2.svg",
      instruction: "איזו מילה באנגלית מתאימה לתמונה?",
    },
    {
      id: "listen-word",
      title: "שומעים מילה",
      shortTitle: "שמעו מילה",
      icon: "headphones.svg",
      instruction: "לחצו על הרמקול ובחרו את התמונה המתאימה.",
    },
    {
      id: "spell-word",
      title: "בונים מילה",
      shortTitle: "סדרו אותיות",
      icon: "pencil.svg",
      instruction: "לחצו על האותיות לפי הסדר הנכון.",
    },
  ],

  letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((upper) => ({
    upper,
    lower: upper.toLowerCase(),
  })),

  words: [
    { word: "apple", hebrew: "תפוח", icon: "apple.svg", color: "#ff6b6b" },
    { word: "ball", hebrew: "כדור", icon: "ball.svg", color: "#f59f00" },
    { word: "cat", hebrew: "חתול", icon: "cat.svg", color: "#845ef7" },
    { word: "dog", hebrew: "כלב", icon: "dog.svg", color: "#339af0" },
    { word: "egg", hebrew: "ביצה", icon: "egg.svg", color: "#f08c00" },
    { word: "fish", hebrew: "דג", icon: "fish.svg", color: "#15aabf" },
    { word: "sun", hebrew: "שמש", icon: "sun.svg", color: "#fab005" },
    { word: "book", hebrew: "ספר", icon: "book.svg", color: "#5f3dc4" },
    { word: "house", hebrew: "בית", icon: "house.svg", color: "#e64980" },
    { word: "car", hebrew: "מכונית", icon: "car.svg", color: "#1971c2" },
    { word: "tree", hebrew: "עץ", icon: "tree.svg", color: "#2f9e44" },
    { word: "star", hebrew: "כוכב", icon: "star.svg", color: "#f08c00" },
    { word: "heart", hebrew: "לב", icon: "heart.svg", color: "#f03e3e" },
    { word: "moon", hebrew: "ירח", icon: "moon.svg", color: "#5c7cfa" },
    { word: "milk", hebrew: "חלב", icon: "milk.svg", color: "#4c6ef5" },
    { word: "banana", hebrew: "בננה", icon: "banana.svg", color: "#e67700" },
    { word: "school", hebrew: "בית ספר", icon: "school.svg", color: "#6741d9" },
    { word: "pencil", hebrew: "עיפרון", icon: "pencil.svg", color: "#e8590c" },
    { word: "eye", hebrew: "עין", icon: "eye.svg", color: "#0b7285" },
    { word: "ear", hebrew: "אוזן", icon: "ear.svg", color: "#c2255c" },
    { word: "bed", hebrew: "מיטה", icon: "bed.svg", color: "#7048e8" },
    { word: "cup", hebrew: "כוס", icon: "cup.svg", color: "#1098ad" },
    { word: "cookie", hebrew: "עוגייה", icon: "cookie.svg", color: "#d9480f" },
  ],
});
