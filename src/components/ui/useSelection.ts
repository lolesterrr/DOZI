import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';

import { haptic } from '@/lib/haptics';

import { allSelected, keepVisible, toggleSelected } from './logic';

export type Selection = {
  /** True while at least one row is picked: taps then pick rows instead of opening them. */
  selecting: boolean;
  /** The picked ids that are still on screen, in the order they were picked. */
  ids: string[];
  count: number;
  isSelected: (id: string) => boolean;
  /** For a row's long press: starts selecting with this row, or toggles it when already on. */
  begin: (id: string) => void;
  /** For a row's tap while selecting. Taking out the last row ends selecting. */
  toggle: (id: string) => void;
  /** Picks every visible row, or (when they all are) none. */
  toggleAll: () => void;
  everything: boolean;
  clear: () => void;
};

/**
 * Long-press multi-select for a list. `visibleIds` are the rows on screen now: a picked row that
 * leaves the list (deleted, filtered out) drops out of the selection. Android's back button ends
 * selecting before it leaves the screen.
 */
export function useSelection(visibleIds: readonly string[]): Selection {
  const [picked, setPicked] = useState<string[]>([]);
  const ids = useMemo(() => keepVisible(picked, visibleIds), [picked, visibleIds]);
  const selecting = ids.length > 0;

  const clear = useCallback(() => setPicked([]), []);
  const toggle = useCallback(
    (id: string) => setPicked((current) => toggleSelected(keepVisible(current, visibleIds), id)),
    [visibleIds],
  );
  const begin = useCallback(
    (id: string) => {
      haptic('tap');
      toggle(id);
    },
    [toggle],
  );
  const everything = allSelected(ids, visibleIds);
  const toggleAll = useCallback(
    () => setPicked(everything ? [] : [...visibleIds]),
    [everything, visibleIds],
  );

  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPicked([]);
      return true;
    });
    return () => sub.remove();
  }, [selecting]);

  const isSelected = useCallback((id: string) => ids.includes(id), [ids]);

  return {
    selecting,
    ids,
    count: ids.length,
    isSelected,
    begin,
    toggle,
    toggleAll,
    everything,
    clear,
  };
}
