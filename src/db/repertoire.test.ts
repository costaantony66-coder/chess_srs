import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { applyReview } from './queue';
import { createRepertoire, deleteNode, deleteRepertoire, importPgn, loadNodes, syncCards } from './repertoire';

const PGN = `1. e4 e5 2. Nf3 Nc6 3. Bc4 (3. Bb5) 3... Bc5 (3... Nf6 4. Ng5) 4. c3`;

beforeEach(async () => {
  await db.cards.clear();
  await db.reviews.clear();
  await db.repertoires.clear();
  await db.repnodes.clear();
});

describe('répertoire', () => {
  it('importe un PGN et crée une carte par position où tu dois jouer', async () => {
    const rep = await createRepertoire('Italienne', 'white');
    const r = await importPgn(rep.id, PGN);
    expect(r.skipped).toBe(0);
    const cards = await db.cards.where('repId').equals(rep.id).toArray();
    // départ, après 1...e5, après 2...Nc6, après 3...Bc5, après 3...Nf6
    expect(cards).toHaveLength(5);
    expect(cards.every((c) => c.type === 'opening')).toBe(true);
    const c3 = cards.find((c) => c.line === '1.e4 e5 2.Nf3 Nc6')!;
    expect(c3.solution).toEqual(['f1c4']);
    expect(c3.alts).toEqual(['f1b5']);
    expect(c3.lastMove).toBe('b8c6');
  });

  it('côté noir : cartes sur les coups noirs, avec le coup adverse surligné', async () => {
    const rep = await createRepertoire('Défense', 'black');
    await importPgn(rep.id, '1. e4 e5 2. Nf3 Nc6');
    const cards = await db.cards.where('repId').equals(rep.id).toArray();
    expect(cards).toHaveLength(2);
    const first = cards.find((c) => c.line === '1.e4')!;
    expect(first.solution).toEqual(['e7e5']);
    expect(first.lastMove).toBe('e2e4');
  });

  it('réimporter ne duplique rien et sync garde la planification FSRS', async () => {
    const rep = await createRepertoire('Italienne', 'white');
    await importPgn(rep.id, PGN);
    const before = await db.cards.where('repId').equals(rep.id).toArray();
    await applyReview(before[0], 'good', { durationMs: 500, correct: true });
    const again = await importPgn(rep.id, PGN);
    expect(again.added).toBe(0);
    await syncCards(rep.id);
    const after = await db.cards.where('repId').equals(rep.id).toArray();
    expect(after).toHaveLength(5);
    expect(after.find((c) => c.id === before[0].id)!.fsrs.reps).toBe(1);
  });

  it('supprimer un coup supprime ses suites et ses cartes', async () => {
    const rep = await createRepertoire('Italienne', 'white');
    await importPgn(rep.id, PGN);
    const nf6 = (await loadNodes(rep.id)).find((n) => n.san === 'Nf6')!;
    await deleteNode(nf6.id);
    expect((await loadNodes(rep.id)).some((n) => n.san === 'Ng5')).toBe(false);
    expect(await db.cards.where('repId').equals(rep.id).count()).toBe(4);
  });

  it('ignore les coups illégaux et supprime un répertoire avec ses cartes', async () => {
    const rep = await createRepertoire('Test', 'white');
    const r = await importPgn(rep.id, '1. e4 e5 2. Ke4 Nc6');
    expect(r.skipped).toBe(1);
    await deleteRepertoire(rep.id);
    expect(await db.cards.count()).toBe(0);
    expect(await db.repnodes.count()).toBe(0);
  });
});

describe('entraînement', () => {
  it('une erreur compte (Again), une réussite compte une fois puis n’alourdit plus la carte', async () => {
    const { recordTraining } = await import('./repertoire');
    const rep = await createRepertoire('Italienne', 'white');
    await importPgn(rep.id, '1. e4 e5 2. Nf3');
    const nodes = await loadNodes(rep.id);
    const e4 = nodes.find((n) => n.san === 'e4')!;
    const id = `rep:${rep.id}:${e4.fenBefore.split(' ').slice(0, 4).join(' ')}`;

    await recordTraining(rep.id, e4, 'good');
    const afterGood = (await db.cards.get(id))!;
    expect(afterGood.fsrs.reps).toBe(1);

    await recordTraining(rep.id, e4, 'good'); // plus due aujourd'hui : ignoré
    expect((await db.cards.get(id))!.fsrs.reps).toBe(1);

    await recordTraining(rep.id, e4, 'wrong');
    const afterWrong = (await db.cards.get(id))!;
    expect(afterWrong.fsrs.reps).toBe(2);
    expect(afterWrong.fsrs.lapses).toBeGreaterThanOrEqual(0);
  });
});

describe('cartes-lignes', () => {
  it('une carte par ligne complète, rangée dans le paquet Lignes, sans doublon', async () => {
    const { createAllLineCards, createLineCard } = await import('./repertoire');
    const rep = await createRepertoire('Italienne', 'white');
    await importPgn(rep.id, '1. e4 e5 2. Nf3 Nc6 3. Bc4 (3. Bb5) 3... Bc5 4. c3');
    const r = await createAllLineCards(rep.id);
    expect(r.created).toBe(2); // ...Bc5 4.c3  et  ...Bb5
    const lines = (await db.cards.where('repId').equals(rep.id).toArray()).filter((c) => c.lineMode);
    expect(lines).toHaveLength(2);
    expect(lines.every((c) => c.deck === 'Ouvertures::Italienne::Lignes')).toBe(true);
    const long = lines.find((c) => c.solution.length === 7)!; // e4 e5 Nf3 Nc6 Bc4 Bc5 c3
    expect(long.fen).toContain('rnbqkbnr/pppppppp');
    expect((await createAllLineCards(rep.id)).created).toBe(0);

    const nodes = await loadNodes(rep.id);
    const nf3 = nodes.find((n) => n.san === 'Nf3')!;
    expect(await createLineCard(rep.id, nf3.id)).toBe('created'); // e4 … Cf3 : 2 de tes coups
    expect(await createLineCard(rep.id, nf3.id)).toBe('exists');
    const e4 = nodes.find((n) => n.san === 'e4')!;
    expect(await createLineCard(rep.id, e4.id)).toBe('short'); // un seul coup à toi
  });

  it('noirs : le premier coup blanc sert de départ ; supprimer un coup supprime la ligne ; renommer range sous le nouveau paquet', async () => {
    const { createAllLineCards, renameRepertoire } = await import('./repertoire');
    const rep = await createRepertoire('Caro', 'black');
    await importPgn(rep.id, '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4');
    expect((await createAllLineCards(rep.id)).created).toBe(1);
    const line = (await db.cards.where('repId').equals(rep.id).toArray()).find((c) => c.lineMode)!;
    expect(line.line).toBe('1.e4');
    expect(line.lastMove).toBe('e2e4');
    expect(line.solution[0]).toBe('c7c6');
    expect(line.fen.split(' ')[1]).toBe('b');

    await renameRepertoire(rep.id, 'Caro-Kann');
    const renamed = (await db.cards.where('repId').equals(rep.id).toArray()).filter((c) => c.lineMode);
    expect(renamed[0].deck).toBe('Ouvertures::Caro-Kann::Lignes');
    expect((await db.cards.where('repId').equals(rep.id).toArray()).find((c) => !c.lineMode)!.deck).toBe('Ouvertures::Caro-Kann');

    const d5 = (await loadNodes(rep.id)).find((n) => n.san === 'd5')!;
    await deleteNode(d5.id);
    expect((await db.cards.where('repId').equals(rep.id).toArray()).filter((c) => c.lineMode)).toHaveLength(0);
  });
});
