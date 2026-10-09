import { CircleCheck, CircleX, Info, type LucideIcon } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type ToastTone = 'info' | 'success' | 'error';

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  /** e.g. "Undo" after a delete. */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds before it hides. Default 4000. */
  duration?: number;
};

type ToastState = ToastOptions & { id: number };

type ToastContextValue = { show: (options: ToastOptions) => void; hide: () => void };

const ToastContext = createContext<ToastContextValue | null>(null);

// Each tone has its own icon so the meaning never depends on colour alone.
const toneIcons: Record<ToastTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  error: CircleX,
};

/** Wrap the app once (in app/_layout.tsx); then call useToast().show({ message }). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  const hide = useCallback(() => setToast(null), []);
  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
    AccessibilityInfo.announceForAccessibility(options.message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hide, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onHide={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onHide }: { toast: ToastState; onHide: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const Icon = toneIcons[toast.tone ?? 'info'];

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 24 }}
    >
      <View
        accessibilityLiveRegion="polite"
        className="min-h-touch flex-row items-center gap-3 rounded-md bg-inverse py-2 pl-4 pr-2"
      >
        <Icon color={colors['on-inverse']} size={20} />
        <Text variant="small" tone="inherit" className="flex-1 py-1.5 text-on-inverse">
          {toast.message}
        </Text>
        {toast.actionLabel && toast.onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
            onPress={() => {
              toast.onAction?.();
              onHide();
            }}
            className="min-h-touch justify-center rounded-sm px-3 active:opacity-70"
          >
            <Text variant="bodyStrong" tone="inherit" className="text-on-inverse underline">
              {toast.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return value;
}
