import {
  CircleUser,
  Layers,
  FolderOpen,
  House,
  ListChecks,
  Map,
  NotebookPen,
  ScanLine,
  SquarePlus,
  Target,
  type LucideIcon,
} from 'lucide-react-native';

import type { CreateAction, TabRoute } from './logic';

export const tabIcons: Record<TabRoute, LucideIcon> = {
  index: House,
  learn: Map,
  practice: Target,
  library: FolderOpen,
  me: CircleUser,
};

export const createActionIcons: Record<CreateAction, LucideIcon> = {
  note: NotebookPen,
  deck: Layers,
  card: SquarePlus,
  quiz: ListChecks,
  scan: ScanLine,
};
