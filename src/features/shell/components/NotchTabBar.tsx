import type { Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Path } from 'react-native-svg';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { circleCentreY, notchedBarPath, tabBarGeometry as geo, tabCentre } from '../logic';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** What Expo Router hands a custom tab bar. */
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** How long the dip takes to slide to a new tab. */
const SLIDE_MS = 380;
/** How long the old tab's circle takes to sink back into the bar. */
const SINK_MS = 140;

export type NotchTabBarProps = BottomTabBarProps & {
  /** The icon for each route, by route name. */
  icons: Record<string, LucideIcon>;
  /** The visible name of each route, by route name. */
  labels: Record<string, string>;
};

/**
 * The bottom tab bar: a teal bar with a dip in its top edge under the current tab, whose icon
 * floats in an orange circle with its name underneath. Tapping another tab sinks the old circle,
 * slides the dip across, and pops the new circle up out of the bar.
 */
export function NotchTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  icons,
  labels,
}: NotchTabBarProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Dark mode keeps big areas quiet: a muted teal bar with light icons instead of bright teal.
  const barColour = scheme === 'dark' ? colors['layer-primary'] : colors.primary;
  const iconColour = scheme === 'dark' ? colors.fg : colors['on-primary'];

  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const notchX = useSharedValue(0);
  const depthScale = useSharedValue(1);
  // The width the dip was last placed for; a new width (first layout, rotation) jumps, no slide.
  const placedWidth = useRef(0);

  useEffect(() => {
    if (width === 0) return;
    const target = tabCentre(width, count, state.index);
    const newWidth = placedWidth.current !== width;
    placedWidth.current = width;
    if (newWidth || reduceMotion) {
      notchX.set(target);
      depthScale.set(1);
      return;
    }
    notchX.set(
      withTiming(target, {
        duration: SLIDE_MS,
        easing: Easing.inOut(Easing.cubic),
      }),
    );
    // The dip goes shallow while it travels, then settles back to full depth.
    depthScale.set(
      withSequence(
        withTiming(0.35, { duration: SLIDE_MS * 0.4 }),
        withTiming(1, { duration: SLIDE_MS * 0.6, easing: Easing.out(Easing.back(2)) }),
      ),
    );
  }, [width, count, state.index, reduceMotion, notchX, depthScale]);

  const barProps = useAnimatedProps(
    () => ({ d: notchedBarPath({ width, notchX: notchX.value, depthScale: depthScale.value }) }),
    [width],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    // Place the dip before the first draw so it never flashes at the left edge.
    if (placedWidth.current === 0) notchX.set(tabCentre(next, count, state.index));
    setWidth(next);
  };
  const drawHeight = geo.top + geo.height + geo.layer;

  return (
    <View
      style={{
        backgroundColor: colors.background,
        paddingHorizontal: 12,
        paddingBottom: insets.bottom + 10,
      }}
    >
      <View onLayout={onLayout} style={{ height: drawHeight }}>
        {width > 0 ? (
          <Svg width={width} height={drawHeight} style={{ position: 'absolute' }}>
            {/* The ink layer under the bar, like the doodle cards. */}
            <G transform={`translate(0 ${geo.layer})`}>
              <AnimatedPath animatedProps={barProps} fill={colors.outline} />
            </G>
            <AnimatedPath
              animatedProps={barProps}
              fill={barColour}
              stroke={colors.outline}
              strokeWidth={2}
            />
          </Svg>
        ) : null}
        <View
          role="tablist"
          style={{
            position: 'absolute',
            top: 0,
            bottom: geo.layer,
            left: geo.padding,
            right: geo.padding,
            flexDirection: 'row',
          }}
        >
          {state.routes.map((route, index) => {
            const focused = index === state.index;
            const options = descriptors[route.key]?.options;
            const label = labels[route.name] ?? route.name;
            const onPress = () => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            };
            const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });
            return (
              <TabSlot
                key={route.key}
                Icon={icons[route.name]}
                label={label}
                accessibilityLabel={options?.tabBarAccessibilityLabel ?? label}
                focused={focused}
                reduceMotion={reduceMotion}
                iconColour={iconColour}
                onPress={onPress}
                onLongPress={onLongPress}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

type TabSlotProps = {
  Icon: LucideIcon | undefined;
  label: string;
  accessibilityLabel: string;
  focused: boolean;
  reduceMotion: boolean;
  iconColour: string;
  onPress: () => void;
  onLongPress: () => void;
};

/** One tab: its plain icon in the bar, and the raised circle and name shown while it's current. */
function TabSlot({
  Icon,
  label,
  accessibilityLabel,
  focused,
  reduceMotion,
  iconColour,
  onPress,
  onLongPress,
}: TabSlotProps) {
  const { colors } = useTheme();
  // 0 = resting in the bar, 1 = raised in the circle.
  const raised = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      raised.set(focused ? 1 : 0);
      return;
    }
    raised.set(
      focused
        ? // Wait for the old circle to sink, then pop up with a little overshoot.
          withDelay(
            SINK_MS,
            withTiming(1, {
              duration: SLIDE_MS - SINK_MS + 60,
              easing: Easing.out(Easing.back(1.8)),
            }),
          )
        : withTiming(0, { duration: SINK_MS, easing: Easing.in(Easing.quad) }),
    );
  }, [focused, reduceMotion, raised]);

  const restingStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(raised.value, 1),
    transform: [{ translateY: raised.value * 8 }],
  }));
  const circleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(raised.value * 2, 1),
    transform: [{ translateY: (1 - raised.value) * 34 }, { scale: 0.5 + 0.5 * raised.value }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(raised.value, 0), 1) }));

  const size = geo.circle;
  return (
    <Pressable
      role="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ flex: 1, alignItems: 'center' }}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: geo.top + geo.height / 2 - 12, height: 24 },
          restingStyle,
        ]}
      >
        {Icon ? <Icon color={iconColour} size={22} /> : null}
      </Animated.View>
      <Animated.View
        className="items-center justify-center rounded-full border-2 border-outline bg-accent"
        style={[
          {
            position: 'absolute',
            top: circleCentreY() - size / 2,
            width: size,
            height: size,
          },
          circleStyle,
        ]}
      >
        {Icon ? <Icon color={colors['on-accent']} size={22} /> : null}
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: geo.top + geo.notchDepth + 2,
            bottom: 4,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          labelStyle,
        ]}
      >
        <Text
          variant="caption"
          tone="inherit"
          style={{ color: iconColour }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
