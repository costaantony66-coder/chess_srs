import { useState } from 'react';
import { DeckHome } from './DeckHome';
import { StudySession } from './StudySession';

/** Onglet Réviser : liste des paquets, puis session d'étude du paquet choisi. */
export function ReviewSession() {
  const [study, setStudy] = useState<{ deck: string | null; title: string } | null>(null);
  return study ? (
    <StudySession deck={study.deck} title={study.title} onExit={() => setStudy(null)} />
  ) : (
    <DeckHome onStudy={(deck, title) => setStudy({ deck, title })} />
  );
}
