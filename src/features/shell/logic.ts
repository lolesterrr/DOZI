// The app's navigation shell: which tabs exist and what "+ Create" offers (PRODUCT_SPEC §2).
// Kept free of React so the order and contents can be unit-tested.

export const tabRoutes = ['index', 'learn', 'practice', 'library', 'me'] as const;
export type TabRoute = (typeof tabRoutes)[number];

/** Tabs that show the floating "+ Create" button. */
export const tabsWithCreateButton: readonly TabRoute[] = ['index', 'library'];

export const createActions = ['note', 'deck', 'card', 'quiz', 'scan'] as const;
export type CreateAction = (typeof createActions)[number];

export function showsCreateButton(tab: TabRoute): boolean {
  return tabsWithCreateButton.includes(tab);
}
