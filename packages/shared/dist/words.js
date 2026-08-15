"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORD_CATEGORIES = exports.WORD_DATABASE = void 0;
exports.getRandomWords = getRandomWords;
exports.getAllWords = getAllWords;
const words_json_1 = __importDefault(require("./words.json"));
exports.WORD_DATABASE = words_json_1.default;
exports.WORD_CATEGORIES = Object.keys(exports.WORD_DATABASE);
function getRandomWords(category, count, customWords = []) {
    let list = [];
    if (category === 'custom' && customWords.length > 0) {
        list = customWords;
    }
    else if (category === 'all' || !category) {
        // Filter out 'movies' from 'all' categories
        list = Object.entries(exports.WORD_DATABASE)
            .filter(([cat]) => cat !== 'movies')
            .map(([_, words]) => words)
            .flat();
    }
    else {
        // Split comma-separated categories (multi-choice support)
        const selectedCategories = category.split(',').map(c => c.trim());
        selectedCategories.forEach(cat => {
            if (exports.WORD_DATABASE[cat]) {
                list.push(...exports.WORD_DATABASE[cat]);
            }
        });
    }
    if (list.length === 0) {
        // Fallback: flat list excluding 'movies'
        list = Object.entries(exports.WORD_DATABASE)
            .filter(([cat]) => cat !== 'movies')
            .map(([_, words]) => words)
            .flat();
    }
    // Shuffle and pick unique words
    const shuffled = [...new Set(list)].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
function getAllWords() {
    // Exclude 'movies' from the full list of words
    return Object.entries(exports.WORD_DATABASE)
        .filter(([cat]) => cat !== 'movies')
        .map(([_, words]) => words)
        .flat();
}
//# sourceMappingURL=words.js.map