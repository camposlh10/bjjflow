import { ReactNode } from 'react';
import { Text, TextStyle } from 'react-native';

// Split keeping the hashtags; then re-test each chunk.
const SPLIT = /(#[\p{L}\p{N}_]+)/gu;
const IS_TAG = /^#[\p{L}\p{N}_]+$/u;

export const HASHTAG_COLOR = '#4A9EED';

/**
 * Renders text with #hashtags highlighted in blue. Returns an array of <Text>
 * spans to embed inside a parent <Text> (used in posts, replies, and the
 * compose field for live highlighting).
 */
export function renderRichText(content: string, baseStyle?: TextStyle): ReactNode {
  return content.split(SPLIT).map((part, i) =>
    IS_TAG.test(part) ? (
      <Text key={i} style={{ color: HASHTAG_COLOR }}>
        {part}
      </Text>
    ) : (
      <Text key={i} style={baseStyle}>
        {part}
      </Text>
    ),
  );
}
