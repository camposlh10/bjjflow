import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';
import * as L from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

/**
 * The app's one icon component: thin, even-weight line icons with rounded ends
 * (the minimal "wearable dashboard" look). Screens keep using the familiar
 * Material Design names; each maps to a Lucide line icon here. Names with no
 * line equivalent (brand logos, a few Paper internals) fall back to Material.
 */
export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  /** Line weight in px at any size. */
  strokeWidth?: number;
  /** Makes the icon tappable (with a comfortable touch area). */
  onPress?: () => void;
};

/** Default line weight: light, like a fitness wearable's UI. */
export const ICON_STROKE = 1.75;

const MAP: Partial<Record<IconName, LucideIcon>> = {
  // people
  account: L.User,
  'account-edit': L.UserPen,
  'account-group': L.Users,
  'account-heart': L.HeartHandshake,
  'clipboard-account': L.ClipboardList,
  'human-handsup': L.PersonStanding,
  robot: L.Bot,
  'robot-happy-outline': L.Bot,
  // training
  'arm-flex': L.BicepsFlexed,
  'boxing-glove': L.HandFist,
  karate: L.Swords,
  'mixed-martial-arts': L.Swords,
  dumbbell: L.Dumbbell,
  weight: L.Weight,
  'tshirt-crew': L.Shirt,
  target: L.Target,
  'circle-slice-8': L.CircleDot,
  fire: L.Flame,
  flash: L.Zap,
  'lightning-bolt': L.Zap,
  pulse: L.Activity,
  bandage: L.Bandage,
  'hand-back-right': L.Hand,
  trophy: L.Trophy,
  'certificate-outline': L.Award,
  'check-decagram': L.BadgeCheck,
  coffee: L.Coffee,
  'chart-line': L.ChartLine,
  'chart-box-outline': L.ChartColumn,
  // time
  calendar: L.Calendar,
  'calendar-blank-outline': L.Calendar,
  'calendar-check': L.CalendarCheck,
  'calendar-clock': L.CalendarClock,
  'calendar-plus': L.CalendarPlus,
  'clock-outline': L.Clock,
  'clock-check-outline': L.Clock,
  'timer-outline': L.Timer,
  // navigation
  'home-variant': L.House,
  'home-variant-outline': L.House,
  'arrow-left': L.ArrowLeft,
  'arrow-up': L.ArrowUp,
  'arrow-up-bold': L.ArrowUp,
  'chevron-down': L.ChevronDown,
  'chevron-left': L.ChevronLeft,
  'chevron-right': L.ChevronRight,
  'menu-down': L.ChevronDown,
  'menu-up': L.ChevronUp,
  'open-in-new': L.ExternalLink,
  'dots-horizontal': L.Ellipsis,
  'dots-vertical': L.EllipsisVertical,
  'dots-grid': L.LayoutGrid,
  'swap-horizontal': L.ArrowLeftRight,
  logout: L.LogOut,
  magnify: L.Search,
  menu: L.Menu,
  // actions
  check: L.Check,
  'check-all': L.CheckCheck,
  'check-circle': L.CircleCheck,
  close: L.X,
  'close-circle': L.CircleX,
  'close-circle-outline': L.CircleX,
  plus: L.Plus,
  'plus-circle': L.CirclePlus,
  minus: L.Minus,
  pencil: L.Pencil,
  'content-copy': L.Copy,
  'content-save': L.Save,
  'trash-can-outline': L.Trash2,
  'share-outline': L.Share,
  send: L.Send,
  refresh: L.RefreshCw,
  sync: L.RefreshCw,
  'tray-arrow-down': L.Download,
  pin: L.Pin,
  'bookmark-outline': L.Bookmark,
  heart: L.Heart,
  'heart-outline': L.Heart,
  star: L.Star,
  'star-outline': L.Star,
  eye: L.Eye,
  'eye-off': L.EyeOff,
  // media
  camera: L.Camera,
  'camera-plus': L.Camera,
  'camera-plus-outline': L.Camera,
  'image-outline': L.Image,
  'image-plus': L.ImagePlus,
  play: L.Play,
  'play-circle': L.CirclePlay,
  'video-outline': L.Video,
  'video-plus': L.Video,
  'video-off-outline': L.VideoOff,
  // communication
  'bell-outline': L.Bell,
  'comment-outline': L.MessageCircle,
  'message-outline': L.MessageCircle,
  'message-text': L.MessageSquareText,
  'message-text-outline': L.MessageSquareText,
  'message-alert-outline': L.MessageSquareWarning,
  'email-outline': L.Mail,
  'phone-outline': L.Phone,
  at: L.AtSign,
  // places & info
  'map-marker': L.MapPin,
  'map-marker-outline': L.MapPin,
  'town-hall': L.Landmark,
  earth: L.Earth,
  web: L.Globe,
  translate: L.Languages,
  information: L.Info,
  'help-circle-outline': L.CircleHelp,
  'note-text-outline': L.NotebookPen,
  'book-open-variant': L.BookOpen,
  'clipboard-check-outline': L.ClipboardCheck,
  // system
  'cog-outline': L.Settings,
  lock: L.Lock,
  'lock-outline': L.Lock,
  'shield-check': L.ShieldCheck,
  'shield-check-outline': L.ShieldCheck,
  'shield-plus-outline': L.ShieldPlus,
  'cellphone-key': L.Smartphone,
  'credit-card-outline': L.CreditCard,
  qrcode: L.QrCode,
  'cloud-off-outline': L.CloudOff,
  'signal-cellular-2': L.SignalMedium,
  hammer: L.Hammer,
  'theme-light-dark': L.SunMoon,
  'white-balance-sunny': L.Sun,
  'moon-waning-crescent': L.Moon,
  // Paper internals
  'checkbox-marked': L.SquareCheck,
  'checkbox-blank-outline': L.Square,
  'radiobox-marked': L.CircleDot,
  'radiobox-blank': L.Circle,
};

/** Filled variants: the line icon is drawn with its inside filled in (liked, starred…). */
const FILLED = new Set<IconName>(['heart', 'star', 'check-decagram', 'map-marker', 'pin']);

export function Icon({ onPress, ...props }: Props) {
  if (!onPress) return <Glyph {...props} />;
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button">
      <Glyph {...props} />
    </Pressable>
  );
}

function Glyph({ name, size = 24, color = '#fff', style, strokeWidth = ICON_STROKE }: Omit<Props, 'onPress'>) {
  const Line = MAP[name];
  if (!Line) {
    return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
  }
  const flat = StyleSheet.flatten(style) as Record<string, unknown> | undefined;
  return (
    <Line
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      fill={FILLED.has(name) ? color : 'none'}
      style={flat as ComponentProps<LucideIcon>['style']}
    />
  );
}

// Lets existing `keyof typeof Icon.glyphMap` types keep working.
Icon.glyphMap = MaterialCommunityIcons.glyphMap;

/** Paper's icon hook: every Paper button, chip and input uses the same line icons. */
export function PaperIcon(props: { name: string; color?: string; size: number }) {
  return <Icon name={props.name as IconName} color={props.color} size={props.size} />;
}

export default Icon;
