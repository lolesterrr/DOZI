import {
  CircleUser,
  Layers,
  Library,
  ListChecks,
  Map,
  NotebookPen,
  ScanLine,
  SquarePlus,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react-native';

import type { CreateAction, TabRoute } from './logic';

export const tabIcons: Record<TabRoute, LucideIcon> = {
  index: Sun,
  learn: Map,
  practice: Target,
  library: Library,
  me: CircleUser,
};

export const createActionIcons: Record<CreateAction, LucideIcon> = {
  note: NotebookPen,
  deck: Layers,
  card: SquarePlus,
  quiz: ListChecks,
  scan: ScanLine,
};
