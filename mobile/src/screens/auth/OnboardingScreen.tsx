import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, IconButton, Text, TextInput } from 'react-native-paper';
import Animated, {
  FadeInRight,
  FadeOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BeltVisual, { formatStripes } from '../../components/BeltVisual';
import LocationFields from '../../components/LocationFields';
import SearchablePicker from '../../components/SearchablePicker';
import { beltBySlug, beltOptionsForAge, rankBarColorFor } from '../../constants/belts';
import { countryName } from '../../constants/locations';
import { GENDERS, MARTIAL_ARTS, genderLabel, martialArtLabel } from '../../constants/profile';
import { t } from '../../i18n';
import { AuthStackParamList } from '../../navigation/RootNavigator';
import { useAuthStore } from '../../store/authStore';
import { makeStyles, palette } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const STEPS = ['about', 'belt', 'stripes', 'experience', 'body'] as const;
type Step = (typeof STEPS)[number];
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const CURRENT_YEAR = new Date().getFullYear();

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setOnboarding = useAuthStore((s) => s.setOnboarding);

  const [step, setStep] = useState<Step>('about');
  // About you
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [ageText, setAgeText] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [country, setCountry] = useState('BR');
  const [region, setRegion] = useState(''); // UF sigla for Brazil, free text otherwise
  const [city, setCity] = useState('');
  // BJJ
  const [beltSlug, setBeltSlug] = useState<string | null>(null);
  const [stripes, setStripes] = useState(0);
  // Experience
  const [favoriteArt, setFavoriteArt] = useState<string>('BJJ');
  const [trainingYearText, setTrainingYearText] = useState('');
  // Body
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const progress = useSharedValue(1 / STEPS.length);
  useEffect(() => {
    progress.value = withTiming((STEPS.indexOf(step) + 1) / STEPS.length, { duration: 300 });
  }, [step, progress]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const age = parseInt(ageText, 10);
  const ageValid = !Number.isNaN(age) && age >= 4 && age <= 100;
  const locationValid = country.length > 0 && region.trim().length > 0 && city.trim().length > 0;
  const aboutValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    USERNAME_RE.test(username) &&
    ageValid &&
    locationValid;

  const yearOptions = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    for (let y = CURRENT_YEAR; y >= 1960; y--) out.push({ key: String(y), label: String(y) });
    return out;
  }, []);

  const goBack = () => {
    setError(null);
    if (step === 'about') {
      navigation.goBack();
    } else {
      setStep(STEPS[STEPS.indexOf(step) - 1]);
    }
  };

  const submitAbout = () => {
    if (!aboutValid) {
      setError(t('onboarding.about.error'));
      return;
    }
    setError(null);
    setOnboarding({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      age,
      gender: gender ?? undefined,
      city: city.trim(),
      country: countryName(country),
      state: region.trim(),
    });
    setStep('belt');
  };

  const selectBelt = (slug: string) => {
    setBeltSlug(slug);
    setStripes(0);
    setOnboarding({ beltSlug: slug, stripes: 0 });
    setTimeout(() => setStep('stripes'), 250);
  };

  const changeStripes = (value: number) => {
    if (value !== stripes) Haptics.selectionAsync();
    setStripes(value);
  };

  const submitStripes = () => {
    setOnboarding({ stripes });
    setStep('experience');
  };

  const submitExperience = () => {
    const year = trainingYearText ? parseInt(trainingYearText, 10) : undefined;
    if (year !== undefined && (Number.isNaN(year) || year < 1900 || year > CURRENT_YEAR)) {
      setError(t('onboarding.body.error'));
      return;
    }
    setError(null);
    setOnboarding({ favoriteArt, trainingStartYear: year });
    setStep('body');
  };

  const submitBody = () => {
    const weight = weightText ? Number(weightText.replace(',', '.')) : undefined;
    const height = heightText ? parseInt(heightText, 10) : undefined;
    const weightValid = weight === undefined || (!Number.isNaN(weight) && weight >= 20 && weight <= 250);
    const heightValid = height === undefined || (!Number.isNaN(height) && height >= 80 && height <= 230);
    if (!weightValid || !heightValid) {
      setError(t('onboarding.body.error'));
      return;
    }
    setError(null);
    setOnboarding({ weightKg: weight, heightCm: height });
    navigation.navigate('SignUp');
  };

  const skipBody = () => {
    setError(null);
    setOnboarding({ weightKg: undefined, heightCm: undefined });
    navigation.navigate('SignUp');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" iconColor={palette.textPrimary} onPress={goBack} accessibilityLabel={t('a11y.back')} />
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
      </View>

      {step === 'about' && (
        <Animated.View key="about" entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)} style={styles.step}>
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text variant="headlineMedium" style={styles.title}>{t('onboarding.about.title')}</Text>
            <Text variant="bodyLarge" style={styles.subtitle}>{t('onboarding.about.subtitle')}</Text>

            <View style={styles.nameRow}>
              <TextInput mode="outlined" label={t('onboarding.firstName')} value={firstName} onChangeText={setFirstName} autoCapitalize="words" style={[styles.input, styles.nameInput]} />
              <TextInput mode="outlined" label={t('onboarding.lastName')} value={lastName} onChangeText={setLastName} autoCapitalize="words" style={[styles.input, styles.nameInput]} />
            </View>
            <TextInput
              mode="outlined"
              label={t('onboarding.username')}
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              left={<TextInput.Affix text="@" />}
              maxLength={30}
              style={styles.input}
            />
            <Text variant="bodySmall" style={styles.fieldHint}>{t('onboarding.username.hint')}</Text>

            <TextInput
              mode="outlined"
              label={t('onboarding.age')}
              value={ageText}
              onChangeText={(v) => setAgeText(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.input}
            />

            <Text style={styles.label}>{t('onboarding.gender')}</Text>
            <View style={styles.chips}>
              {GENDERS.map((g) => {
                const on = gender === g;
                return (
                  <Pressable key={g} style={[styles.chip, on && styles.chipOn]} onPress={() => setGender(on ? null : g)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{genderLabel(g)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 12 }}>
              <LocationFields
                country={country}
                setCountry={setCountry}
                region={region}
                setRegion={setRegion}
                city={city}
                setCity={setCity}
              />
            </View>

            {error && <Text variant="bodyMedium" style={styles.error}>{error}</Text>}
            <Button mode="contained" onPress={submitAbout} disabled={!aboutValid} contentStyle={styles.buttonContent} style={styles.continueButton}>
              {t('common.continue')}
            </Button>
          </ScrollView>
        </Animated.View>
      )}

      {step === 'belt' && (
        <Animated.View key="belt" entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)} style={styles.step}>
          <Text variant="headlineMedium" style={styles.title}>{t('onboarding.belt.title')}</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>{t('onboarding.belt.subtitle')}</Text>
          <ScrollView contentContainerStyle={styles.beltList}>
            {beltOptionsForAge(ageValid ? age : 18).map((belt) => (
              <TouchableOpacity
                key={belt.slug}
                onPress={() => selectBelt(belt.slug)}
                style={[styles.beltRow, beltSlug === belt.slug && styles.beltRowSelected]}>
                <View style={[styles.beltSwatch, { backgroundColor: belt.color }]}>
                  <View style={[styles.beltTip, belt.slug === 'adult-black' && { backgroundColor: '#B91C1C' }]} />
                </View>
                <Text variant="titleMedium" style={styles.beltName}>{belt.namePt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {step === 'stripes' && beltSlug && (
        <Animated.View key="stripes" entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)} style={styles.step}>
          <Text variant="headlineMedium" style={styles.title}>{t('onboarding.stripes.title')}</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>{t('onboarding.stripes.subtitle')}</Text>
          <View style={styles.beltPreview}>
            <BeltVisual color={beltBySlug(beltSlug)?.color ?? '#FFFFFF'} rankBarColor={rankBarColorFor(beltSlug)} stripes={stripes} height={48} />
            <Text variant="titleLarge" style={styles.stripesLabel}>{formatStripes(stripes)}</Text>
          </View>
          <Slider minimumValue={0} maximumValue={4} step={1} value={stripes} onValueChange={changeStripes} minimumTrackTintColor={palette.primary} maximumTrackTintColor={palette.surfaceVariant} thumbTintColor={palette.primary} style={styles.slider} />
          <Button mode="contained" onPress={submitStripes} contentStyle={styles.buttonContent} style={styles.continueButton}>
            {t('common.continue')}
          </Button>
        </Animated.View>
      )}

      {step === 'experience' && (
        <Animated.View key="experience" entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)} style={styles.step}>
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text variant="headlineMedium" style={styles.title}>{t('onboarding.experience.title')}</Text>
            <Text variant="bodyLarge" style={styles.subtitle}>{t('onboarding.experience.subtitle')}</Text>

            <Text style={styles.label}>{t('onboarding.art')}</Text>
            <View style={styles.chips}>
              {MARTIAL_ARTS.map((a) => {
                const on = favoriteArt === a.key;
                return (
                  <Pressable key={a.key} style={[styles.artChip, on && styles.chipOn]} onPress={() => setFavoriteArt(a.key)}>
                    <MaterialCommunityIcons name={a.icon} size={16} color={on ? '#fff' : palette.textSecondary} />
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{martialArtLabel(a.key)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <SearchablePicker
              label={t('onboarding.trainingSince')}
              placeholder={t('onboarding.trainingSince.select')}
              searchPlaceholder={t('onboarding.trainingSince.select')}
              value={trainingYearText || null}
              options={yearOptions}
              onSelect={setTrainingYearText}
            />

            {error && <Text variant="bodyMedium" style={styles.error}>{error}</Text>}
            <Button mode="contained" onPress={submitExperience} contentStyle={styles.buttonContent} style={styles.continueButton}>
              {t('common.continue')}
            </Button>
          </ScrollView>
        </Animated.View>
      )}

      {step === 'body' && (
        <Animated.View key="body" entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)} style={styles.step}>
          <Text variant="headlineMedium" style={styles.title}>{t('onboarding.body.title')}</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>{t('onboarding.body.subtitle')}</Text>
          <TextInput mode="outlined" label={t('onboarding.body.weight')} value={weightText} onChangeText={(v) => setWeightText(v.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" maxLength={6} style={styles.input} />
          <TextInput mode="outlined" label={t('onboarding.body.height')} value={heightText} onChangeText={(v) => setHeightText(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={3} style={styles.input} />
          {error && <Text variant="bodyMedium" style={styles.error}>{error}</Text>}
          <Button mode="contained" onPress={submitBody} contentStyle={styles.buttonContent} style={styles.continueButton}>
            {t('common.continue')}
          </Button>
          <Button mode="text" textColor={palette.textSecondary} onPress={skipBody}>
            {t('common.skip')}
          </Button>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingRight: 24 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: palette.surfaceVariant, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: palette.primary },
  step: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  formScroll: { paddingBottom: 40 },
  title: { color: palette.textPrimary, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: palette.textSecondary, marginBottom: 24 },
  input: { marginBottom: 12 },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameInput: { flex: 1 },
  fieldHint: { color: palette.textSecondary, marginTop: -4, marginBottom: 8 },
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.surfaceVariant },
  artChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.surfaceVariant },
  chipOn: { backgroundColor: palette.primary },
  chipText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  bigInput: { marginTop: 16, fontSize: 24, textAlign: 'center' },
  beltList: { gap: 12, paddingBottom: 24 },
  beltRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', padding: 16, gap: 16 },
  beltRowSelected: { borderColor: palette.primary },
  beltSwatch: { width: 72, height: 24, borderRadius: 4, flexDirection: 'row', justifyContent: 'flex-end', overflow: 'hidden' },
  beltTip: { width: 20, height: '100%', backgroundColor: '#18181B' },
  beltName: { color: palette.textPrimary },
  beltPreview: { marginTop: 24, alignItems: 'center', gap: 16 },
  stripesLabel: { color: palette.textPrimary, fontWeight: 'bold', textTransform: 'capitalize' },
  slider: { marginTop: 24, alignSelf: 'stretch', height: 40 },
  error: { color: palette.primary, marginTop: 12 },
  continueButton: { marginTop: 24 },
  buttonContent: { paddingVertical: 6 },
}));
