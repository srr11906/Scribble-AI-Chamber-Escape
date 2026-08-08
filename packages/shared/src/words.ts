import wordsJson from './words.json';

export const WORD_DATABASE: Record<string, string[]> = wordsJson;

export const WORD_CATEGORIES = Object.keys(WORD_DATABASE);

export function getRandomWords(category: string, count: number, customWords: string[] = []): string[] {
  let list: string[] = [];
  
  if (category === 'custom' && customWords.length > 0) {
    list = customWords;
  } else if (category === 'all' || !WORD_DATABASE[category]) {
    list = Object.values(WORD_DATABASE).flat();
  } else {
    list = WORD_DATABASE[category];
  }

  if (list.length === 0) {
    list = Object.values(WORD_DATABASE).flat(); // Final fallback
  }

  // Shuffle and pick unique words
  const shuffled = [...new Set(list)].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export function getAllWords(): string[] {
  return Object.values(WORD_DATABASE).flat();
}
