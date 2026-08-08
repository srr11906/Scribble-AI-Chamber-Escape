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
    else if (category === 'all' || !exports.WORD_DATABASE[category]) {
        list = Object.values(exports.WORD_DATABASE).flat();
    }
    else {
        list = exports.WORD_DATABASE[category];
    }
    if (list.length === 0) {
        list = Object.values(exports.WORD_DATABASE).flat(); // Final fallback
    }
    // Shuffle and pick unique words
    const shuffled = [...new Set(list)].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
function getAllWords() {
    return Object.values(exports.WORD_DATABASE).flat();
}
//# sourceMappingURL=words.js.map