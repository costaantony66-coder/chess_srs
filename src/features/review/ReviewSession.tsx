import { useState } from 'react';
import { DeckHome } from './DeckHome';
import { StudySession } from './StudySession';

/** Onglet Réviser : navigation par paquets (clic = niveau suivant), puis étude du paquet choisi. */
export function ReviewSession() {
  const [level, setLevel] = useState<string | null>(null);
  const [study, setStudy] = useState<{ deck: string | null; title: string } | null>(null);
  return study ? (
    <StudySession deck={study.deck} title={study.title} onExit={() => setStudy(null)} />
  ) : (
    <DeckHome level={level} onLevel={setLevel} onStudy={(deck, title) => setStudy({ deck, title })} />
  );
}
