import { Component, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

type Props = { children: ReactNode };
type State = { error: Error | null; stack: string | null };

/** Catches render errors and surfaces the message + component stack (Metro + on-screen). */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // eslint-disable-next-line no-console
    console.log('--- ErrorBoundary caught ---\n' + error.message + '\n' + (info.componentStack ?? '(no stack)'));
    this.setState({ stack: info.componentStack ?? null });
  }

  // Clear the error so the tree re-mounts (navigation resets to its root) — lets a
  // one-off screen crash recover instead of leaving the whole app stuck/blank.
  reset = () => this.setState({ error: null, stack: null });

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.title}>App error</Text>
          <Text style={styles.msg}>{this.state.error.message}</Text>
          <Pressable style={styles.retry} onPress={this.reset}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
          <Text style={styles.stack}>{this.state.stack ?? this.state.error.stack ?? ''}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, paddingTop: 80 },
  title: { color: palette.primary, fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  msg: { color: palette.textPrimary, fontSize: 14, marginBottom: 16 },
  retry: { alignSelf: 'flex-start', backgroundColor: palette.primary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 20 },
  retryText: { color: '#fff', fontWeight: '700' },
  stack: { color: palette.textSecondary, fontSize: 11, lineHeight: 16 },
}));
