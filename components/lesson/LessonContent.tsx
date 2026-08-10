import { Question, SpeakingOption } from "@/constants/CourseData";
import { Colors } from "@/constants/theme";
import { useLanguage } from "@/ctx/LanguageContext";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { incrementLessonCompletion } from "@/lib/lessonProgress";
import {
  getOptionPhrase,
  getQuestionPhrase,
  TTS_LANGUAGE,
} from "@/lib/phraseUtils";
import {
  recordQuestionAnswered,
  recordQuestionListened,
} from "@/lib/speakingListeningStats";
import { supabase } from "@/utils/supabase";
import { Audio, InterruptionModeIOS } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import Toast from "react-native-toast-message";
import { compareTwoStrings } from "string-similarity";
import { ThemedText } from "../themed-text";
import ConfirmDialog from "../ui/ConfirmDialog";
import AudioPrompt from "./AudioPrompt";
import { FeedbackView } from "./FeedbackView";
import LessonCompleteScreen from "./LessonCompleteScreen";
import ListeningMultipleChoiceMode from "./ListeningMultipleChoiceMode";
import MultipleChoiceMode from "./MultipleChoiceMode";
import ProgressHeader from "./ProgressHeader";
import SentenceBreakdownCard from "./SentenceBreakdownCard";
import SingleResponseMode from "./SingleResponseMode";

interface WrongQuestion {
  english: string;
  primaryText: string;
  pronunciation: string;
  attempts: number;
}

export interface LessonStats {
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
  wrongQuestions?: WrongQuestion[];
}

const MAX_ATTEMPTS = 3;

export default function LessonContent({
  questions,
  lessonId,
}: {
  questions: Question[];
  lessonId: string;
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const [showMandarin, setShowMandarin] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [hasListenedToAudio, setHasListenedToAudio] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isMountedRef = useRef(true);
  const [transcription, setTranscription] = useState<{
    expected: string;
    said: string;
  } | null>(null);
  const currentQuestion = useMemo(
    () => questions[currentQuestionIndex],
    [questions, currentQuestionIndex],
  );
  const [isSpeechPlaying, setIsSpeechPlaying] = useState(false);
  const { selectedLanguage } = useLanguage();

  // Lesson completion
  const [showCompleteScreen, setShowCompleteScreen] = useState(false);
  const [lessonStats, setLessonStats] = useState<LessonStats | null>(null);
  const [questionAttempts, setQuestionAttempts] = useState<
    Record<number, number>
  >({});
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<Set<number>>(new Set());
  const [wrongQuestionSelections, setWrongQuestionSelections] = useState<
    Record<number, number>
  >({});

  const fadeAnim = useRef(new Animated.Value(0)).current; // Opacity pinyin/hanzi
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const optionsAnimValue = useRef(new Animated.Value(0)).current;
  const audioSectionAnimHeight = useRef(new Animated.Value(400)).current;
  const optionSelectionAnim = useRef(new Animated.Value(0)).current;
  const instructionOpacity = useRef(new Animated.Value(1)).current;
  const listeningOpacity = useRef(new Animated.Value(0)).current;
  const listeningScale = useRef(new Animated.Value(0.95)).current;
  const [hasStartedFirstPlay, setHasStartedFirstPlay] = useState(false);

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const selectedSentence = useMemo((): SpeakingOption | null => {
    if (currentQuestion.type === "listening_mc") {
      if (showResult) {
        const correctEnglish =
          currentQuestion.options.find(
            (opt) => opt.id === currentQuestion.correctOptionId,
          )?.english || "";
        // Build a minimal SpeakingOption carrying all language fields from the question
        return {
          id: currentQuestion.id,
          english: correctEnglish,
          mandarin: (currentQuestion as any).mandarin,
          french: (currentQuestion as any).french,
          spanish: (currentQuestion as any).spanish,
          japanese: (currentQuestion as any).japanese,
        } as SpeakingOption;
      }
      return null;
    }

    if (selectedOption == null) return null;
    return currentQuestion.options.find((opt) => opt.id === selectedOption)!;
  }, [selectedOption, currentQuestion, showResult]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      Speech.stop();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    Speech.stop();
    setIsSpeechPlaying(false);
  }, [currentQuestion]);

  useEffect(() => {
    if (showResult) {
      if (isCorrect) {
        if (
          attemptCount === 0 ||
          (attemptCount > 0 && wrongQuestions.has(currentQuestion.id))
        ) {
          setCorrectAnswersCount((prev) => prev + 1);
        }
      } else {
        setQuestionAttempts((prev) => ({
          ...prev,
          [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1,
        }));

        if (attemptCount === 0) {
          setWrongQuestions((prev) => new Set(prev).add(currentQuestion.id));
          if (selectedOption != null) {
            setWrongQuestionSelections((prev) => ({
              ...prev,
              [currentQuestion.id]: selectedOption,
            }));
          }
        }
      }
    }
  }, [showResult, isCorrect, attemptCount, currentQuestion.id, selectedOption]);

  useEffect(() => {
    if (isSpeechPlaying && !hasStartedFirstPlay && !hasListenedToAudio) {
      setHasStartedFirstPlay(true);
      Animated.parallel([
        Animated.timing(instructionOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(listeningOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(listeningScale, {
            toValue: 1.05,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(listeningScale, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [isSpeechPlaying, hasStartedFirstPlay, hasListenedToAudio]);

  useEffect(() => {
    if (
      currentQuestion.type === "single_response" &&
      currentQuestion.options.length > 0 &&
      hasListenedToAudio
    ) {
      setSelectedOption(currentQuestion.options[0].id);
      Animated.timing(optionSelectionAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [currentQuestion, hasListenedToAudio]);

  const finishListening = () => {
    if (hasListenedToAudio) return;
    setHasListenedToAudio(true);
    setIsSpeechPlaying(false);
    void recordQuestionListened();
    Animated.parallel([
      Animated.timing(audioSectionAnimHeight, {
        toValue: 200,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.timing(optionsAnimValue, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const playAudio = () => {
    const phrase = getQuestionPhrase(currentQuestion, selectedLanguage);
    const textToSpeak = phrase.primaryText || phrase.pronunciation;

    if (isSpeechPlaying) {
      Speech.stop();
      setIsSpeechPlaying(false);
      return;
    }

    setIsSpeechPlaying(true);
    Speech.speak(textToSpeak, {
      language: TTS_LANGUAGE[selectedLanguage],
      onDone: () => {
        setIsSpeechPlaying(false);
        finishListening();
      },
      onStopped: () => {
        setIsSpeechPlaying(false);
      },
      onError: () => {
        setIsSpeechPlaying(false);
      },
    });
  };

  const startRecording = async () => {
    if (isSpeechPlaying) {
      Speech.stop();
      setIsSpeechPlaying(false);
    }

    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Toast.show({
          type: 'success',
          text1: "Microphone Permission",
          text2: "Microphone access is required to practise speaking.",
        });
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        staysActiveInBackground: true,
      });

      const preset = Audio.RecordingOptionsPresets.HIGH_QUALITY;
      const { recording } = await Audio.Recording.createAsync({
        ...preset,
        ios: {
          ...preset.ios,
          extension: ".wav",
          audioQuality: Audio.IOSAudioQuality.MAX,
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        },
        android: {
          ...preset.android,
          extension: ".wav",
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        },
      });

      if (!isMountedRef.current) {
        recording.stopAndUnloadAsync();
        return;
      }

      recordingRef.current = recording;
      setIsRecognizing(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      recordingRef.current = null;
      if (isMountedRef.current) {
        setIsRecognizing(false);
        Toast.show({
          type: 'error',
          text1: 'Recording Error',
          text2: 'Could not start recording.'
        })
      }
    }
  };

  const processSpeechResult = (transcript: string) => {
    if (!isMountedRef.current) return;
    setIsLoading(false);
    setShowResult(true);

    const punctuationRegex = /[.,\/#!$%\^&\*;:{}=\-_`~()?]/g;

    const rawExpected = selectedSentence
      ? getOptionPhrase(selectedSentence, selectedLanguage).pronunciation
      : "";
    const expected = rawExpected
      .toLowerCase()
      .replace(punctuationRegex, "")
      .replace(/\s+/g, "")
      .trim();

    const said = transcript
      .toLowerCase()
      .replace(punctuationRegex, "")
      .replace(/\s+/g, "")
      .trim();

    setTranscription({ expected: rawExpected, said: transcript });

    if (!said || !expected) {
      setIsCorrect(false);
    } else {
      const similarity = compareTwoStrings(expected, said);
      const isSimilarEnough = similarity >= 0.8;

      setIsCorrect(isSimilarEnough);
      if (isSimilarEnough) {
        void recordQuestionAnswered();
      }
    }

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const stopRecording = async () => {
    if (isMountedRef.current) {
      setIsLoading(true);
      setIsRecognizing(false);
    }

    try {
      const recording = recordingRef.current;
      if (!recording) {
        if (isMountedRef.current) setIsLoading(false);
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        if (isMountedRef.current) {
          setIsLoading(false);
          Toast.show({
            type: 'error',
            text1: 'Recording Error',
            text2: 'No audio was recorded.'
          })
        }
        return;
      }

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!isMountedRef.current) return;

      const { data, error } = await supabase.functions.invoke(
        "transcribe-audio",
        {
          body: {
            inputAudio: {
              data: base64Audio,
              format: "wav",
            },
          },
        },
      );

      if (!isMountedRef.current) return;

      if (error) {
        throw new Error(await getEdgeFunctionErrorMessage(error));
      }

      if (data?.transcript) {
        processSpeechResult(data.transcript);
      } else {
        throw new Error("No transcript returned");
      }
    } catch (err) {
      console.error("Failed to start/stop recording:", err);
      if (isMountedRef.current) {
        setIsLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Transcription Error',
          text2: err instanceof Error ? err.message : 'Could not transcribe audio.'
        })
      }
    }
  };

  const handleRevealMandarin = () => {
    if (showMandarin) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setShowMandarin(false));
    } else {
      setShowMandarin(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleOptionPress = (id: number) => {
    if (currentQuestion.type === "listening_mc") {
      setSelectedOption(id);
      setIsCorrect(id === currentQuestion.correctOptionId);
      setShowResult(true);
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const isDeselecting = selectedOption === id;
    const newSelectedOption = isDeselecting ? null : id;
    setSelectedOption(newSelectedOption);
    Animated.timing(optionSelectionAnim, {
      toValue: isDeselecting ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const nextQuestion = () => {
    Animated.timing(audioSectionAnimHeight, {
      toValue: 400,
      duration: 500,
      useNativeDriver: false,
    }).start(() => {
      if (currentQuestionIndex < questions.length - 1) {
        resetState();
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        const accuracy = Math.round(
          (correctAnswersCount / questions.length) * 100,
        );

        const wrongQuestionsList = questions
          .filter((q) => wrongQuestions.has(q.id))
          .map((q) => {
            let english = "";
            let phrase = { primaryText: "", pronunciation: "" };

            if (q.type === "listening_mc") {
              english =
                q.options.find((opt) => opt.id === q.correctOptionId)
                  ?.english || "";
              phrase = getQuestionPhrase(q, selectedLanguage);
            } else {
              const selectedId = wrongQuestionSelections[q.id];
              const option =
                q.options.find((opt) => opt.id === selectedId) ??
                q.options[0];
              english = option.english;
              phrase = getOptionPhrase(option, selectedLanguage);
            }

            return {
              english,
              primaryText: phrase.primaryText,
              pronunciation: phrase.pronunciation,
              attempts: questionAttempts[q.id] || 1,
            };
          });

        const finalStats: LessonStats = {
          correctAnswers: correctAnswersCount,
          totalQuestions: questions.length,
          accuracy,
          wrongQuestions:
            wrongQuestionsList.length > 0 ? wrongQuestionsList : undefined,
        };

        setLessonStats(finalStats);
        setShowCompleteScreen(true);
      }
    });
  };

  const handleRetry = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowResult(false);
      setIsCorrect(null);
      setAttemptCount((prev) => prev + 1);

      if (currentQuestion.type === "listening_mc") {
        setSelectedOption(null);
      } else {
        setIsLoading(false);
        setHasListenedToAudio(true);

        if (currentQuestion.type === "multiple_choice") {
          optionSelectionAnim.setValue(0);
          setSelectedOption(null);
        } else {
          optionSelectionAnim.setValue(1);
        }

        audioSectionAnimHeight.setValue(200);
        optionsAnimValue.setValue(1);
        instructionOpacity.setValue(0);
        listeningOpacity.setValue(0);
      }

      scaleAnim.setValue(1);
    });
  };

  const resetState = () => {
    setShowMandarin(false);
    setSelectedOption(null);
    setShowResult(false);
    setHasListenedToAudio(false);
    setAttemptCount(0);
    setIsLoading(false);
    setTranscription(null);
    Speech.stop();
    setIsSpeechPlaying(false);
    fadeAnim.setValue(0);
    scaleAnim.setValue(1);
    optionsAnimValue.setValue(0);
    optionSelectionAnim.setValue(0);
    instructionOpacity.setValue(1);
    listeningOpacity.setValue(0);
    listeningScale.setValue(0.95);
    setHasStartedFirstPlay(false);
  };

  if (showCompleteScreen && lessonStats) {
    return (
      <LessonCompleteScreen
        lessonStats={lessonStats}
        onContinue={async () => {
          await incrementLessonCompletion(lessonId);
          router.push("/lessons");
        }}
        onReview={() => {
          setShowCompleteScreen(false);
          setLessonStats(null);
          setCurrentQuestionIndex(0);
          setQuestionAttempts({});
          setCorrectAnswersCount(0);
          setWrongQuestions(new Set());
          setWrongQuestionSelections({});
          resetState();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ConfirmDialog
        visible={exitConfirmVisible}
        title="Exit Practise"
        description="Are you sure you want to quit? Your progress will be lost."
        cancelLabel="Cancel"
        confirmLabel="Exit"
        destructive
        onConfirm={async () => {
          setExitConfirmVisible(false);
          Speech.stop();
          if (recordingRef.current) {
            await recordingRef.current.stopAndUnloadAsync();
          }
          router.push("/lessons");
        }}
        onCancel={() => setExitConfirmVisible(false)}
      />
      <ProgressHeader
        progress={progress}
        currentCount={currentQuestionIndex + 1}
        totalCount={questions.length}
        onClose={() => setExitConfirmVisible(true)}
      />

      {/* Main content */}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.audioSection,
            {
              backgroundColor: "#f9fafb",
              minHeight: audioSectionAnimHeight,
              flex: hasListenedToAudio ? 0 : 1,
              justifyContent: "center",
              opacity: isLoading || showResult ? 0.6 : 1,
            },
          ]}
          pointerEvents={isLoading || showResult ? "none" : "auto"}
        >
          <AudioPrompt
            isPlaying={isSpeechPlaying}
            isRecognizing={isRecognizing}
            hasListenedToAudio={hasListenedToAudio}
            onPlay={playAudio}
            onStartRecord={startRecording}
            onStopRecord={stopRecording}
            onRevealMandarin={handleRevealMandarin}
            currentQuestion={currentQuestion}
            showMandarin={showMandarin}
            selectedOption={selectedOption}
            scaleAnim={scaleAnim}
            instructionOpacity={instructionOpacity}
            listeningOpacity={listeningOpacity}
            listeningScale={listeningScale}
            fadeAnim={fadeAnim}
          />
        </Animated.View>

        {hasListenedToAudio && (
          <Animated.View
            style={[
              styles.optionsSection,
              {
                opacity: Animated.multiply(
                  optionsAnimValue,
                  isLoading || showResult ? 0.5 : 1,
                ),
                transform: [
                  {
                    translateY: optionsAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={isLoading || showResult ? "none" : "auto"}
          >
            {currentQuestion.type === "multiple_choice" && (
              <MultipleChoiceMode
                options={currentQuestion.options}
                selectedOption={selectedOption}
                handleOptionPress={handleOptionPress}
                optionsSelectionAnim={optionSelectionAnim}
                isLoading={isLoading}
                showResult={showResult}
              />
            )}
            {currentQuestion.type === "listening_mc" && (
              <ListeningMultipleChoiceMode
                options={currentQuestion.options}
                selectedOption={selectedOption}
                handleOptionPress={handleOptionPress}
                isLoading={isLoading}
                showResult={showResult}
              />
            )}
            {currentQuestion.type === "single_response" && (
              <SingleResponseMode
                option={currentQuestion.options[0]}
                optionSelectionAnim={optionSelectionAnim}
              />
            )}
          </Animated.View>
        )}

        {isLoading && (
          <View style={styles.bottomSection}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={Colors.primaryAccentColor}
              />
              <ThemedText
                style={[styles.loadingText, { color: Colors.subduedTextColor }]}
              >
                Analyzing your pronunciation...
              </ThemedText>
            </View>
          </View>
        )}

        {/* Feedback view */}
        {showResult && selectedSentence && (
          <Animated.View
            style={[
              styles.feedbackWrapper,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <FeedbackView
              correctOption={selectedSentence}
              isCorrect={isCorrect}
              onContinue={nextQuestion}
              onRetry={
                attemptCount < MAX_ATTEMPTS && !isCorrect
                  ? handleRetry
                  : undefined
              }
              attemptCount={isCorrect ? attemptCount : attemptCount + 1}
              maxAttempts={MAX_ATTEMPTS}
              transcription={
                transcription
                  ? {
                    expected: transcription.expected,
                    said: transcription.said,
                  }
                  : undefined
              }
            />
          </Animated.View>
        )}
      </View>

      {/* Sentence Breakdown Card */}
      {currentQuestion.type === "listening_mc" &&
        !isLoading &&
        hasListenedToAudio && (() => {
          const p = getQuestionPhrase(currentQuestion, selectedLanguage);
          return (
            <SentenceBreakdownCard
              sentence={{
                english:
                  currentQuestion.options.find(
                    (opt) => opt.id === currentQuestion.correctOptionId,
                  )?.english || "",
                primaryText: p.primaryText,
                pronunciation: p.pronunciation,
                words: p.words,
                breakdown: p.breakdown,
              }}
              disabled={showResult}
            />
          );
        })()}
      {currentQuestion.type !== "listening_mc" &&
        !isLoading &&
        selectedSentence && (() => {
          const p = getOptionPhrase(selectedSentence, selectedLanguage);
          return (
            <SentenceBreakdownCard
              sentence={{
                english: selectedSentence.english,
                primaryText: p.primaryText,
                pronunciation: p.pronunciation,
                words: p.words,
                breakdown: p.breakdown,
              }}
              disabled={showResult}
            />
          );
        })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  audioSection: {
    alignItems: "center",
    marginBottom: 40,
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
  },
  optionsSection: {
    flex: 1,
    marginBottom: 30,
  },
  bottomSection: {
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  feedbackWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 1000,
  },
});
