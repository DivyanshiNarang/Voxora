import { Question, SpeakingOption, SupportedLanguage } from "@/constants/CourseData";

export interface NormalizedWord {
  primaryText: string;
  pronunciation: string;
  english: string;
}

export interface NormalizedPhrase {
  primaryText: string;
  pronunciation: string;
  words?: NormalizedWord[];
  breakdown?: string;
}

export const TTS_LANGUAGE: Record<SupportedLanguage, string> = {
  mandarin: "zh-CN",
  french: "fr-FR",
  spanish: "es-ES",
  japanese: "ja-JP",
};

export const PRONUNCIATION_LABEL: Record<SupportedLanguage, string> = {
  mandarin: "Pinyin",
  french: "Pronunciation",
  spanish: "Pronunciation",
  japanese: "Romaji",
};

export const SCRIPT_LABEL: Record<SupportedLanguage, string> = {
  mandarin: "Hanzi",
  french: "Text",
  spanish: "Text",
  japanese: "Kanji",
};

export const LANGUAGE_NAME: Record<SupportedLanguage, string> = {
  mandarin: "Mandarin",
  french: "French",
  spanish: "Spanish",
  japanese: "Japanese",
};

function normalizeRaw(data: any, lang: SupportedLanguage): NormalizedPhrase {
  if (!data) return { primaryText: "", pronunciation: "" };

  if (lang === "mandarin") {
    return {
      primaryText: data.hanzi ?? "",
      pronunciation: data.pinyin ?? "",
      words: data.words?.map(
        (w: any): NormalizedWord => ({
          primaryText: w.hanzi ?? "",
          pronunciation: w.pinyin ?? "",
          english: w.english ?? "",
        }),
      ),
      breakdown: data.breakdown,
    };
  }

  if (lang === "french" || lang === "spanish") {
    return {
      primaryText: data.text ?? "",
      pronunciation: data.ipa ?? data.text ?? "",
      words: data.words?.map(
        (w: any): NormalizedWord => ({
          primaryText: w.word ?? "",
          pronunciation: w.word ?? "",
          english: w.english ?? "",
        }),
      ),
      breakdown: data.breakdown,
    };
  }

  // japanese
  return {
    primaryText: data.kanji ?? data.kana ?? "",
    pronunciation: data.romaji ?? data.kana ?? "",
    words: data.words?.map(
      (w: any): NormalizedWord => ({
        primaryText: w.kanji ?? w.kana ?? "",
        pronunciation: w.romaji ?? w.kana ?? "",
        english: w.english ?? "",
      }),
    ),
    breakdown: data.breakdown,
  };
}

export function getQuestionPhrase(
  question: Question,
  lang: SupportedLanguage,
): NormalizedPhrase {
  return normalizeRaw((question as any)[lang], lang);
}

export function getOptionPhrase(
  option: SpeakingOption,
  lang: SupportedLanguage,
): NormalizedPhrase {
  return normalizeRaw((option as any)[lang], lang);
}
