import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { makeStyles } from '../theme/theme';

type Props = {
  /** cor da faixa */
  color: string;
  /** cor da ponteira (preta; vermelha na faixa preta) */
  rankBarColor?: string;
  /** quantidade de graus (fitas brancas na ponteira) */
  stripes: number;
  height?: number;
};

/**
 * Faixa de jiu-jitsu renderizada: barra na cor da graduação com a ponteira
 * à direita. Todas as medidas escalam com a altura, então o componente serve
 * do preview grande do onboarding (48px) às mini-faixas de listas (7–9px).
 * Os graus só são animados nos tamanhos grandes — nas listas a animação de
 * entrada/saída piscava ao trocar de aba.
 */
export default function BeltVisual({ color, rankBarColor = '#18181B', stripes, height = 36 }: Props) {
  const stripeWidth = Math.max(1.5, Math.round(height * 0.18));
  const radius = Math.max(2, Math.round(height / 6));
  const borderWidth = height >= 20 ? 1 : 0.5;
  const animated = height >= 20;

  const stripeStyle = { width: stripeWidth, backgroundColor: '#FFFFFF' };

  return (
    <View
      style={[
        styles.belt,
        { backgroundColor: color, height, borderRadius: radius, borderWidth },
      ]}>
      <View style={[styles.rankBar, { backgroundColor: rankBarColor }]}>
        {Array.from({ length: stripes }).map((_, i) =>
          animated ? (
            <Animated.View
              key={i}
              entering={ZoomIn.duration(200)}
              exiting={ZoomOut.duration(150)}
              style={stripeStyle}
            />
          ) : (
            <View key={i} style={stripeStyle} />
          ),
        )}
      </View>
    </View>
  );
}

export function formatStripes(stripes: number): string {
  if (stripes === 0) return 'sem graus';
  return stripes === 1 ? '1 grau' : `${stripes} graus`;
}

const styles = makeStyles(() => ({
  belt: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    // borda sutil para a faixa branca aparecer no fundo escuro
    borderColor: 'rgba(255,255,255,0.2)',
  },
  rankBar: {
    width: '32%',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-evenly',
  },
}));
