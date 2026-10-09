import { fireEvent, screen } from '@testing-library/react-native';

import { TagManager } from '../components/TagManager';
import { TagPicker } from '../components/TagPicker';
import type { Tag } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

const s = strings.library;

const tag = (id: string, name: string, colour: Tag['colour'] = 'teal'): Tag => ({
  id,
  name,
  colour,
  ownerId: 'o',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  dirty: true,
  syncedAt: null,
});

describe('<TagManager>', () => {
  it('creates a tag with a chosen colour', async () => {
    const onCreate = jest.fn(async () => {});
    await renderWithProviders(
      <TagManager tags={[]} onCreate={onCreate} onUpdate={jest.fn()} onDelete={jest.fn()} />,
    );
    expect(screen.getByText(s.noTags)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: s.newTag }));
    await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'Exam');
    await fireEvent.press(screen.getByRole('radio', { name: s.colours.gold }));
    await fireEvent.press(screen.getByRole('button', { name: s.create }));
    expect(onCreate).toHaveBeenCalledWith('Exam', 'gold');
  });

  it('edits and deletes a tag, refusing a name that is taken', async () => {
    const onUpdate = jest.fn(async () => {});
    const onDelete = jest.fn();
    const exam = tag('t1', 'Exam', 'red');
    await renderWithProviders(
      <TagManager
        tags={[exam, tag('t2', 'ANS')]}
        onCreate={jest.fn()}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: s.editTag('Exam') }));
    await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'ans');
    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(screen.getByText(s.nameProblems.duplicateTag)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'Exam 1');
    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(onUpdate).toHaveBeenCalledWith('t1', { name: 'Exam 1', colour: 'red' });

    await fireEvent.press(screen.getByRole('button', { name: s.editTag('Exam') }));
    await fireEvent.press(screen.getByRole('button', { name: s.deleteTag }));
    expect(onDelete).toHaveBeenCalledWith(exam);
  });
});

describe('<TagPicker>', () => {
  it('toggles tags and adds a new one from what was typed', async () => {
    const onChange = jest.fn();
    const onCreate = jest.fn(async (name: string) => tag('new', name));
    await renderWithProviders(
      <TagPicker
        tags={[tag('t1', 'Exam'), tag('t2', 'ANS')]}
        selected={['t1']}
        onChange={onChange}
        onCreate={onCreate}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'ANS' }));
    expect(onChange).toHaveBeenLastCalledWith(['t1', 't2']);
    await fireEvent.press(screen.getByRole('button', { name: 'Exam' }));
    expect(onChange).toHaveBeenLastCalledWith([]);

    await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'exam');
    expect(screen.queryByRole('button', { name: s.addTag('exam') })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText(s.nameLabel), 'CNS');
    await fireEvent.press(screen.getByRole('button', { name: s.addTag('CNS') }));
    expect(onCreate).toHaveBeenCalledWith('CNS');
    expect(onChange).toHaveBeenLastCalledWith(['t1', 'new']);
  });
});
