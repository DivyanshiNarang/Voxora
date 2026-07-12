import { SupportedLanguage } from "@/constants/CourseData";
import { useAuth } from "@/ctx/AuthContext";
import { LanguageContext } from "@/ctx/LanguageContext";
import { supabase } from "@/utils/supabase";
import { PropsWithChildren, useEffect, useState } from "react";

const DEFAULT_LANGUAGE: SupportedLanguage = "french";

export default function LanguageProvider({ children }: PropsWithChildren) {
  const { profile, session } = useAuth();
  const [selectedLanguage, setSelectedLanguageState] =
    useState<SupportedLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const lang = profile?.active_languages?.[0] as SupportedLanguage | undefined;
    if (lang) setSelectedLanguageState(lang);
  }, [profile]);

  const setSelectedLanguage = (lang: SupportedLanguage) => {
    setSelectedLanguageState(lang);
    if (session?.user?.id) {
      supabase
        .from("profiles")
        .update({ active_languages: [lang] })
        .eq("id", session.user.id)
        .then(() => {})
        .catch(console.error);
    }
  };

  return (
    <LanguageContext.Provider value={{ selectedLanguage, setSelectedLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
