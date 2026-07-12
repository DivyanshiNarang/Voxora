import courseData from "@/assets/data/course_content.json";
import Ionicons from "@expo/vector-icons/Ionicons";

// ─── Shared ─────────────────────────────────────────────────────────────────

export type SupportedLanguage = "mandarin" | "french" | "spanish" | "japanese";

export interface LanguageMeta {
  id: SupportedLanguage;
  name: string;
  flag: string;
}

// ─── Mandarin ────────────────────────────────────────────────────────────────

export interface MandarinWord {
  hanzi: string;
  pinyin: string;
  english: string;
}

export interface MandarinPhrase {
  hanzi: string;
  pinyin: string;
  words?: MandarinWord[];
  breakdown?: string;
}

export interface MandarinPrompt {
  hanzi: string;
  pinyin: string;
}

// ─── French / Spanish ────────────────────────────────────────────────────────

export interface RomanWord {
  word: string;
  english: string;
}

export interface RomanPhrase {
  text: string;
  ipa?: string;
  words?: RomanWord[];
  breakdown?: string;
}

export interface RomanPrompt {
  text: string;
  ipa?: string;
}

// ─── Japanese ────────────────────────────────────────────────────────────────

export interface JapaneseWord {
  kanji: string;
  kana: string;
  romaji: string;
  english: string;
}

export interface JapanesePhrase {
  kanji: string;
  kana: string;
  romaji: string;
  words?: JapaneseWord[];
  breakdown?: string;
}

export interface JapanesePrompt {
  kanji: string;
  kana: string;
  romaji: string;
}

// ─── Question Options ────────────────────────────────────────────────────────

export interface SpeakingOption {
  id: number;
  english: string;
  mandarin?: MandarinPhrase;
  french?: RomanPhrase;
  spanish?: RomanPhrase;
  japanese?: JapanesePhrase;
}

export interface ListeningOption {
  id: number;
  english: string;
}

// ─── Question Types ──────────────────────────────────────────────────────────

interface BaseQuestion {
  id: number;
}

interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  mandarin?: MandarinPrompt;
  french?: RomanPrompt;
  spanish?: RomanPrompt;
  japanese?: JapanesePrompt;
  options: SpeakingOption[];
  correctOptionId: number;
}

interface SingleResponseQuestion extends BaseQuestion {
  type: "single_response";
  mandarin?: MandarinPrompt;
  french?: RomanPrompt;
  spanish?: RomanPrompt;
  japanese?: JapanesePrompt;
  options: [SpeakingOption];
}

interface ListeningMCQuestion extends BaseQuestion {
  type: "listening_mc";
  mandarin?: MandarinPhrase;
  french?: RomanPhrase;
  spanish?: RomanPhrase;
  japanese?: JapanesePhrase;
  options: ListeningOption[];
  correctOptionId: number;
}

export type Question =
  | MultipleChoiceQuestion
  | SingleResponseQuestion
  | ListeningMCQuestion;

// ─── Lesson / Chapter ────────────────────────────────────────────────────────

export interface Lesson {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  completionCount: number;
  questions: Question[];
}

export interface Chapter {
  id: number;
  title: string;
  lessons: Lesson[];
  review?: Lesson;
}

// ─── Conversation Scenarios ──────────────────────────────────────────────────

export interface MandarinPhrasebookEntry {
  hanzi: string;
  pinyin: string;
  english: string;
}

export interface RomanPhrasebookEntry {
  text: string;
  ipa?: string;
  english: string;
}

export interface JapanesePhrasebookEntry {
  kanji: string;
  kana: string;
  romaji: string;
  english: string;
}

export type PhrasebookEntry =
  | MandarinPhrasebookEntry
  | RomanPhrasebookEntry
  | JapanesePhrasebookEntry;

export interface ConversationScenario {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  isFree: boolean;
  description: string;
  goal: string;
  tasks: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  phrasebook?: PhrasebookEntry[];
}

// ─── Language Dataset ────────────────────────────────────────────────────────

export interface LanguageData extends LanguageMeta {
  chapters: Chapter[];
  scenarios: ConversationScenario[];
}

export interface CourseData {
  languages: Record<SupportedLanguage, LanguageData>;
}

// ─── Normalized Word (language-agnostic, used by lesson UI components) ───────

export interface Word {
  primaryText: string;
  pronunciation: string;
  english: string;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const COURSE_DATA = courseData as unknown as CourseData;

/** Returns the data for a given language, defaulting to mandarin. */
export function getLanguageData(lang: SupportedLanguage = "mandarin"): LanguageData {
  return COURSE_DATA.languages[lang];
}

/** Returns all available languages as a sorted metadata list. */
export const AVAILABLE_LANGUAGES: LanguageMeta[] = [
  { id: "mandarin", name: "Mandarin Chinese", flag: "🇨🇳" },
  { id: "french",   name: "French",           flag: "🇫🇷" },
  { id: "spanish",  name: "Spanish",          flag: "🇪🇸" },
  { id: "japanese", name: "Japanese",         flag: "🇯🇵" },
];

// Legacy export — returns mandarin data for backwards compatibility
export const LEGACY_COURSE_DATA = {
  get chapters() { return COURSE_DATA.languages.mandarin.chapters },
  get scenarios() { return COURSE_DATA.languages.mandarin.scenarios },
}
