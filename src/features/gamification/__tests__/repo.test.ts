import { eq } from 'drizzle-orm';

import { profiles, xpEvents } from '@/db/schema';
import { createTestDatabase } from '@/test-utils/db';

import { awardXp, getDayXp, getTotalXp } from '../repo';

// Study days roll over at 03:00 Kampala time (UTC+3), so 10:00 UTC is 13:00 on the same day.
const at = (iso: string) => ({ now: () => iso });
const D1 = '2026-10-29T10:00:00.000Z';
const D2 = '2026-10-30T10:00:00.000Z';
const owner = 'owner-1';

let ids = 0;
const newId = () => `xp-${++ids}`;
const deps = (iso: string) => ({ ...at(iso), newId });

async function setup(goal = 50, timezone = 'Africa/Kampala') {
  const db = createTestDatabase();
  await db.insert(profiles).values({
    id: owner,
    dailyGoalXp: goal,
    timezone,
    createdAt: D1,
    updatedAt: D1,
  });
  return db;
}

describe('awardXp', () => {
  it('saves an event with the study day, source and amount', async () => {
    const db = await setup();
    const result = await awardXp(
      db,
      { ownerId: owner, source: 'review_card', sourceId: 'i1' },
      deps(D1),
    );
    expect(result).toMatchObject({ xp: 1, goalReached: false, levelUp: null });
    expect(result.events[0]).toMatchObject({
      ownerId: owner,
      studyDay: '2026-10-29',
      source: 'review_card',
      sourceId: 'i1',
      amount: 1,
      deletedAt: null,
      dirty: true,
    });
    expect(await getTotalXp(db, owner)).toBe(1);
  });

  it('pays a card once per study day, but again the next day', async () => {
    const db = await setup();
    const give = (iso: string) =>
      awardXp(db, { ownerId: owner, source: 'review_card', sourceId: 'i1' }, deps(iso));
    expect((await give(D1)).xp).toBe(1);
    expect((await give(D1)).xp).toBe(0);
    expect((await give(D2)).xp).toBe(1);
    expect(await getTotalXp(db, owner)).toBe(2);
  });

  it('counts late-night study in the day before (03:00 rollover)', async () => {
    const db = await setup();
    // 23:30 UTC is 02:30 the next day in Kampala: still the study day of the 29th.
    await awardXp(
      db,
      { ownerId: owner, source: 'review_card', sourceId: 'i1' },
      deps('2026-10-29T23:30:00.000Z'),
    );
    expect((await getDayXp(db, owner, '2026-10-29')).total).toBe(1);
    expect((await getDayXp(db, owner, '2026-10-30')).total).toBe(0);
  });

  it('uses the profile timezone for the study day', async () => {
    const db = await setup(50, 'America/New_York');
    // 10:00 UTC is 06:00 in New York on the 29th.
    await awardXp(db, { ownerId: owner, source: 'review_card', sourceId: 'i1' }, deps(D1));
    expect((await getDayXp(db, owner, '2026-10-29')).total).toBe(1);
    await awardXp(
      db,
      { ownerId: owner, source: 'review_card', sourceId: 'i2' },
      deps('2026-10-29T05:00:00.000Z'),
    );
    // 05:00 UTC is 01:00 in New York: before the rollover, so the 28th.
    expect((await getDayXp(db, owner, '2026-10-28')).total).toBe(1);
  });

  it('pays a note once ever, and stops note XP at 10 a day', async () => {
    const db = await setup();
    const note = (id: string) =>
      awardXp(db, { ownerId: owner, source: 'note_created', sourceId: id }, deps(D1));
    expect((await note('n1')).xp).toBe(2);
    expect((await note('n1')).xp).toBe(0);
    for (const id of ['n2', 'n3', 'n4', 'n5']) expect((await note(id)).xp).toBe(2);
    expect((await note('n6')).xp).toBe(0); // 10 XP already today
    expect((await getDayXp(db, owner, '2026-10-29')).total).toBe(10);
    // The cap is per day: tomorrow another note counts.
    expect(
      (await awardXp(db, { ownerId: owner, source: 'note_created', sourceId: 'n6' }, deps(D2))).xp,
    ).toBe(2);
  });

  it('stops creating-a-card XP at 20 a day', async () => {
    const db = await setup(500);
    let total = 0;
    for (let i = 0; i < 25; i++) {
      total += (
        await awardXp(db, { ownerId: owner, source: 'card_created', sourceId: `c${i}` }, deps(D1))
      ).xp;
    }
    expect(total).toBe(20);
  });

  it('pays correct quiz answers by the count, once per attempt', async () => {
    const db = await setup();
    const quiz = (count: number) =>
      awardXp(db, { ownerId: owner, source: 'quiz_correct_own', sourceId: 'a1', count }, deps(D1));
    expect((await quiz(6)).xp).toBe(6);
    expect((await quiz(6)).xp).toBe(0);
  });

  it('gives the goal bonus the moment the goal is reached, once a day', async () => {
    const db = await setup(10);
    const result = await awardXp(
      db,
      { ownerId: owner, source: 'lesson_complete', sourceId: 'l1' },
      deps(D1),
    );
    expect(result).toMatchObject({ xp: 15, goalReached: true });
    expect(result.events.map((e) => [e.source, e.amount])).toEqual([
      ['lesson_complete', 10],
      ['daily_goal_bonus', 5],
    ]);
    const more = await awardXp(
      db,
      { ownerId: owner, source: 'lesson_complete', sourceId: 'l2' },
      deps(D1),
    );
    expect(more).toMatchObject({ xp: 10, goalReached: false });
    const day = await getDayXp(db, owner, '2026-10-29');
    expect(day.total).toBe(25);
    expect(day.forGoal).toBe(20); // the bonus doesn't count towards the goal
    // Next day: a new goal bonus is possible.
    expect(
      (await awardXp(db, { ownerId: owner, source: 'lesson_complete', sourceId: 'l3' }, deps(D2)))
        .goalReached,
    ).toBe(true);
  });

  it('reports a level up when the total crosses a level threshold', async () => {
    const db = await setup(500);
    const first = await awardXp(
      db,
      { ownerId: owner, source: 'mock_exam', sourceId: 'm1' },
      deps(D1),
    );
    // 50 XP crosses level 2 (at 40).
    expect(first.levelUp).toEqual({ from: 1, to: 2 });
    const second = await awardXp(
      db,
      { ownerId: owner, source: 'review_card', sourceId: 'i1' },
      deps(D1),
    );
    expect(second.levelUp).toBeNull();
  });

  it('works without a profile row (default goal and timezone)', async () => {
    const db = createTestDatabase();
    const result = await awardXp(
      db,
      { ownerId: 'nobody', source: 'review_card', sourceId: 'i1' },
      deps(D1),
    );
    expect(result.xp).toBe(1);
  });

  it('keeps one student’s XP apart from another’s', async () => {
    const db = await setup();
    await awardXp(db, { ownerId: owner, source: 'note_created', sourceId: 'n1' }, deps(D1));
    expect(await getTotalXp(db, 'someone-else')).toBe(0);
    const theirs = await awardXp(
      db,
      { ownerId: 'someone-else', source: 'note_created', sourceId: 'n1' },
      deps(D1),
    );
    expect(theirs.xp).toBe(2);
  });

  it('ignores soft-deleted events when counting', async () => {
    const db = await setup();
    const { events } = await awardXp(
      db,
      { ownerId: owner, source: 'review_card', sourceId: 'i1' },
      deps(D1),
    );
    await db.update(xpEvents).set({ deletedAt: D1 }).where(eq(xpEvents.id, events[0].id));
    expect(await getTotalXp(db, owner)).toBe(0);
  });
});
