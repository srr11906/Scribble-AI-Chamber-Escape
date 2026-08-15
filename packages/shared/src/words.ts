import wordsJson from './words.json';

export const WORD_DATABASE: Record<string, string[]> = wordsJson;

export const WORD_CATEGORIES = Object.keys(WORD_DATABASE);

export function getRandomWords(category: string, count: number, customWords: string[] = []): string[] {
  let list: string[] = [];
  
  if (category === 'custom' && customWords.length > 0) {
    list = customWords;
  } else if (category === 'all' || !category) {
    // Filter out 'movies' from 'all' categories
    list = Object.entries(WORD_DATABASE)
      .filter(([cat]) => cat !== 'movies')
      .map(([_, words]) => words)
      .flat();
  } else {
    // Split comma-separated categories (multi-choice support)
    const selectedCategories = category.split(',').map(c => c.trim());
    selectedCategories.forEach(cat => {
      if (WORD_DATABASE[cat]) {
        list.push(...WORD_DATABASE[cat]);
      }
    });
  }

  if (list.length === 0) {
    // Fallback: flat list excluding 'movies'
    list = Object.entries(WORD_DATABASE)
      .filter(([cat]) => cat !== 'movies')
      .map(([_, words]) => words)
      .flat();
  }

  // Shuffle and pick unique words
  const shuffled = [...new Set(list)].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export function getAllWords(): string[] {
  // Exclude 'movies' from the full list of words
  return Object.entries(WORD_DATABASE)
    .filter(([cat]) => cat !== 'movies')
    .map(([_, words]) => words)
    .flat();
}
