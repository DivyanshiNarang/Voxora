import { supabase } from "@/utils/supabase";
import Entypo from "@expo/vector-icons/Entypo";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import Toast from "react-native-toast-message";

type Mode = "signin" | "signup";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 6;

export default function PasswordAuth({
  onBack,
  menuContentAnimatedStyle,
}: {
  onBack: () => void;
  menuContentAnimatedStyle: any;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const validate = () => {
    if (!EMAIL_REGEX.test(email.trim())) {
      Toast.show({ type: "error", text1: "Please enter a valid email address" });
      return false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      Toast.show({
        type: "error",
        text1: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return false;
    }

    if (isSignup && password !== confirmPassword) {
      Toast.show({ type: "error", text1: "Passwords do not match" });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          Toast.show({ type: "error", text1: error.message });
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          Toast.show({ type: "error", text1: error.message });
        }
      }
    } catch {
      Toast.show({
        type: "error",
        text1: "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isSignup ? "signin" : "signup");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <Animated.View style={[styles.viewContainer, menuContentAnimatedStyle]}>
      <View style={styles.emailHeader}>
        <Pressable onPress={onBack}>
          <Entypo name="chevron-thin-left" size={18} color="white" />
        </Pressable>
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.emailMainTitle}>
          {isSignup ? "Create your account." : "Welcome back."}
        </Text>
        <Text style={styles.emailSubtitle}>
          {isSignup
            ? "Sign up with your email and a password."
            : "Sign in with your email and password."}
        </Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.emailTextInput}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.emailTextInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignup ? "new-password" : "password"}
          />
        </View>

        {isSignup && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.emailTextInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </View>
        )}

        <Pressable
          style={[styles.verificationButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.verificationButtonText}>
            {loading ? "Please wait..." : isSignup ? "Sign up" : "Log in"}
          </Text>
        </Pressable>

        <Pressable onPress={switchMode} style={styles.switchModeButton}>
          <Text style={styles.switchModeText}>
            {isSignup
              ? "Already have an account? Log in"
              : "Don't have an account? Sign up"}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewContainer: {
    flex: 1,
  },
  emailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 20,
  },
  titleContainer: {
    marginBottom: 20,
  },
  emailMainTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
    lineHeight: 34,
  },
  emailSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "400",
  },
  formContainer: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  emailTextInput: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "white",
    minHeight: 52,
  },
  verificationButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginTop: 6,
  },
  verificationButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchModeButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  switchModeText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "500",
  },
});
