import { createActions, showsCreateButton, tabRoutes } from '../logic';

describe('navigation shell', () => {
  it('has the five tabs in the order the spec lists them', () => {
    expect(tabRoutes).toEqual(['index', 'learn', 'practice', 'library', 'me']);
  });

  it('shows "+ Create" only on Today and Library', () => {
    expect(tabRoutes.filter(showsCreateButton)).toEqual(['index', 'library']);
  });

  it('offers the five create actions from the spec', () => {
    expect(createActions).toEqual(['note', 'deck', 'card', 'quiz', 'scan']);
  });
});
