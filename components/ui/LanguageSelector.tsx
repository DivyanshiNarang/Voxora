import { ThemedText } from "@/components/themed-text";
import { AVAILABLE_LANGUAGES, SupportedLanguage } from "@/constants/CourseData";
import { Colors } from "@/constants/theme";
import { useLanguage } from "@/ctx/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function LanguageSelector() {
  const { selectedLanguage, setSelectedLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const current = AVAILABLE_LANGUAGES.find((l) => l.id === selectedLanguage);

  return (
    <>
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.flag}>{current?.flag}</Text>
        <ThemedText style={styles.name}>{current?.name}</ThemedText>
        <Ionicons name="chevron-down" size={14} color={Colors.subduedTextColor} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View
            style={styles.sheet}
            onStartShouldSetResponder={() => true}
          >
            <ThemedText style={styles.sheetTitle}>Language</ThemedText>
            {AVAILABLE_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.id}
                style={[
                  styles.option,
                  lang.id === selectedLanguage && styles.optionActive,
                ]}
                onPress={() => {
                  setSelectedLanguage(lang.id as SupportedLanguage);
                  setOpen(false);
                }}
              >
                <Text style={styles.optionFlag}>{lang.flag}</Text>
                <ThemedText style={styles.optionName}>{lang.name}</ThemedText>
                {lang.id === selectedLanguage && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={Colors.primaryAccentColor}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.light.background,
  },
  flag: {
    fontSize: 18,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  optionActive: {
    backgroundColor: Colors.primaryAccentColor + "15",
  },
  optionFlag: {
    fontSize: 28,
  },
  optionName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
});
