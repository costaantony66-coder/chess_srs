import { useState } from 'react';
import { CardBrowser } from './CardBrowser';
import { DeckHome } from './DeckHome';
import { StudySession } from './StudySession';

/** Onglet Réviser : navigation par paquets (clic = niveau suivant), étude du paquet choisi, explorateur de cartes. */
export function ReviewSession() {
  const [level, setLevel] = useState<string | null>(null);
  const [study, setStudy] = useState<{ deck: string | null; title: string } | null>(null);
  const [browse, setBrowse] = useState<{ deck: string | null } | null>(null);

  if (study) return <StudySession deck={study.deck} title={study.title} onExit={() => setStudy(null)} />;
  if (browse) return <CardBrowser deck={browse.deck} onBack={() => setBrowse(null)} />;
  return <DeckHome level={level} onLevel={setLevel} onStudy={(deck, title) => setStudy({ deck, title })} onBrowse={(deck) => setBrowse({ deck })} />;
}
