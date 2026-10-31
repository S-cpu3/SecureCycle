const WORD_LIST = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  "action", "actor", "actual", "adapt", "add", "address", "adjust", "admit", "adult", "advance",
  "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent", "agree", "ahead",
  "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert", "alien", "all",
  "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter", "always", "amaze",
  "amber", "ambition", "amount", "amuse", "analyst", "anchor", "ancient", "anger", "angle", "angry",
  "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique", "anxiety", "any"
];

export function generateRecoveryPhrase(length = 12): string[] {
  const phrase: string[] = [];
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * WORD_LIST.length);
    phrase.push(WORD_LIST[randomIndex]);
  }
  return phrase;
}

export function phraseToString(phrase: string[]): string {
  return phrase.join(" ");
}
