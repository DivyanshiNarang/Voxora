import { SupportedLanguage } from "@/constants/CourseData";
import { createContext, useContext } from "react";

type LanguageContextType = {
  selectedLanguage: SupportedLanguage;
  setSelectedLanguage: (lang: SupportedLanguage) => void;
};

export const LanguageContext = createContext<LanguageContextType>({
  selectedLanguage: "french",
  setSelectedLanguage: () => {},
});

export const useLanguage = () => useContext(LanguageContext);
