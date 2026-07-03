import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { fetchCities, fetchStates } from '../api/locations';
import SearchablePicker from './SearchablePicker';
import { BRAZIL_STATES, COUNTRIES, citiesForUf, countryEnName, isBrazil } from '../constants/locations';
import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

/** Country → State → City selectors. Brazil uses bundled data (offline, complete);
 *  other countries fetch states/cities from a geo API, falling back to free text. */
export default function LocationFields({
  country,
  setCountry,
  region,
  setRegion,
  city,
  setCity,
}: {
  country: string;
  setCountry: (code: string) => void;
  region: string;
  setRegion: (s: string) => void;
  city: string;
  setCity: (c: string) => void;
}) {
  const countryOptions = useMemo(() => COUNTRIES.map((c) => ({ key: c.code, label: c.name, left: c.flag })), []);
  const stateOptions = useMemo(() => BRAZIL_STATES.map((s) => ({ key: s.uf, label: `${s.name} (${s.uf})` })), []);
  const cityOptions = useMemo(() => citiesForUf(region).map((c) => ({ key: c, label: c })), [region]);

  const nonBr = !isBrazil(country);
  const countryEn = countryEnName(country);
  const statesQuery = useQuery({ queryKey: ['geoStates', country], queryFn: () => fetchStates(countryEn), enabled: nonBr });
  const apiStates = statesQuery.data ?? [];
  const citiesQuery = useQuery({
    queryKey: ['geoCities', country, region],
    queryFn: () => fetchCities(countryEn, region),
    enabled: nonBr && !!region && apiStates.includes(region),
  });
  const apiCities = citiesQuery.data ?? [];
  const apiStateOptions = useMemo(() => apiStates.map((s) => ({ key: s, label: s })), [apiStates]);
  const apiCityOptions = useMemo(() => apiCities.map((c) => ({ key: c, label: c })), [apiCities]);

  const onCountry = (code: string) => {
    setCountry(code);
    setRegion('');
    setCity('');
  };

  return (
    <View>
      <SearchablePicker
        label={t('onboarding.country')}
        placeholder={t('onboarding.country.ph')}
        searchPlaceholder={t('onboarding.country.search')}
        value={country}
        options={countryOptions}
        onSelect={onCountry}
      />

      {isBrazil(country) ? (
        <>
          <SearchablePicker
            label={t('onboarding.state')}
            placeholder={t('onboarding.state.ph')}
            searchPlaceholder={t('onboarding.state.search')}
            value={region || null}
            options={stateOptions}
            onSelect={(uf) => {
              setRegion(uf);
              setCity('');
            }}
          />
          <SearchablePicker
            label={t('onboarding.city')}
            placeholder={region ? t('onboarding.city.ph') : t('onboarding.city.select.state')}
            searchPlaceholder={t('onboarding.city.search')}
            value={city || null}
            options={cityOptions}
            onSelect={setCity}
            disabled={!region}
          />
        </>
      ) : (
        <>
          {statesQuery.isLoading ? (
            <SearchablePicker label={t('onboarding.state')} placeholder={t('picker.loading')} options={[]} onSelect={() => undefined} disabled />
          ) : apiStates.length > 0 ? (
            <SearchablePicker
              label={t('onboarding.state')}
              placeholder={t('onboarding.state.ph')}
              searchPlaceholder={t('onboarding.state.search')}
              value={region || null}
              options={apiStateOptions}
              onSelect={(s) => {
                setRegion(s);
                setCity('');
              }}
            />
          ) : (
            <TextInput mode="outlined" label={t('onboarding.state')} value={region} onChangeText={setRegion} autoCapitalize="words" style={styles.input} />
          )}

          {region && apiStates.includes(region) && (citiesQuery.isLoading || apiCities.length > 0) ? (
            citiesQuery.isLoading ? (
              <SearchablePicker label={t('onboarding.city')} placeholder={t('picker.loading')} options={[]} onSelect={() => undefined} disabled />
            ) : (
              <SearchablePicker
                label={t('onboarding.city')}
                placeholder={t('onboarding.city.ph')}
                searchPlaceholder={t('onboarding.city.search')}
                value={city || null}
                options={apiCityOptions}
                onSelect={setCity}
              />
            )
          ) : (
            <TextInput mode="outlined" label={t('onboarding.city')} value={city} onChangeText={setCity} autoCapitalize="words" style={styles.input} />
          )}
        </>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  input: { marginBottom: 12, backgroundColor: palette.surface },
}));
