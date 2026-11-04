import { Folder, Layers, ListChecks, NotebookPen, type LucideIcon } from 'lucide-react-native';

import type { DoodleTint } from '@/components/ui';
import type { LibraryItemType } from '@/db/schema';

// One colour and one icon per kind of thing, used everywhere (Today, Library, search…), so
// students learn to spot a deck by its coral tile. Colour is never alone: the icon and the
// kind's name always go with it.
export const kindIcons: Record<LibraryItemType, LucideIcon> = {
  note: NotebookPen,
  deck: Layers,
  quiz: ListChecks,
};

export const kindTints: Record<LibraryItemType, DoodleTint> = {
  note: 'teal',
  deck: 'coral',
  quiz: 'violet',
};

export const folderIcon = Folder;
export const folderTint: DoodleTint = 'amber';
