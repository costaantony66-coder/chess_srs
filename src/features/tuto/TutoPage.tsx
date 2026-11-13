import type { ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CLASS_META, CLASS_ORDER } from '../../lib/analysis';
import type { TabId } from '../../lib/tabs';
import { About } from '../about/About';

function Section({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-border bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-display text-lg">
        {title}
        <span className="text-muted transition group-open:rotate-90">›</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border px-4 py-4 text-[15px] leading-relaxed">{children}</div>
    </details>
  );
}

const Ul = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
const Term = ({ children }: { children: ReactNode }) => <strong className="font-semibold">{children}</strong>;

function Go({ tab, onGo, children }: { tab: TabId; onGo: (t: TabId) => void; children: ReactNode }) {
  return (
    <Button className="self-start" onClick={() => onGo(tab)}>
      {children} →
    </Button>
  );
}

/** Rubrique « Tuto » : explique simplement chaque partie du site. */
export function TutoPage({ onGo }: { onGo: (t: TabId) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <Card>
        <div className="flex items-center gap-2">
          <BookOpen className="text-accent" size={22} />
          <h2 className="font-display text-2xl">Bienvenue sur Chess SRS</h2>
        </div>
        <p className="mt-3 leading-relaxed">
          Chess SRS t’aide à <Term>retenir durablement</Term> tes tactiques, tes ouvertures et tes erreurs de parties. Le principe, c’est la{' '}
          <Term>répétition espacée</Term> : on te repose une question juste avant que tu l’oublies. Ce que tu sais bien revient rarement, ce qui te
          résiste revient souvent. Quelques minutes par jour suffisent.
        </p>
        <p className="mt-2 text-sm text-muted">Touche un titre ci-dessous pour déplier la section.</p>
      </Card>

      <Section title="Par où commencer ? (5 minutes)" open>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <Term>Essaie une carte.</Term> Onglet <Term>Réviser</Term> → « Charger le jeu de démo » (9 cartes pour t’entraîner). Joue le bon coup, puis note ta difficulté.
          </li>
          <li>
            <Term>Ajoute des puzzles.</Term> Onglet <Term>Puzzles</Term> : choisis un thème (fourchette, clouage, mat en 2…), un niveau et un nombre, puis « Ajouter ».
          </li>
          <li>
            <Term>Crée ton répertoire d’ouvertures.</Term> Onglet <Term>Ouvertures</Term> → « Nouveau répertoire », puis joue tes coups sur l’échiquier ou colle un PGN.
          </li>
          <li>
            <Term>Importe tes parties.</Term> Onglet <Term>Parties</Term> : Lichess, Chess.com ou PGN, puis lance l’analyse Stockfish pour transformer tes erreurs en cartes.
          </li>
          <li>
            <Term>Reviens chaque jour</Term> dans <Term>Réviser</Term> : l’app te propose les cartes à revoir aujourd’hui.
          </li>
        </ol>
        <Go tab="review" onGo={onGo}>Aller à Réviser</Go>
      </Section>

      <Section title="Comment fonctionne une carte ?">
        <p>Une carte, c’est une position d’échecs avec un coup (ou une suite de coups) à retrouver.</p>
        <Ul>
          <li>Tu vois la position et tu joues le coup que tu penses juste.</li>
          <li><Term>Vert</Term> : bon coup. <Term>Rouge</Term> : mauvais coup, et une flèche verte te montre le bon.</li>
          <li>
            Tu notes ensuite la difficulté, et chaque bouton indique quand la carte reviendra :
            <Ul>
              <li><Term>Again</Term> : tu t’es trompé ou tu ne savais pas. Elle revient très vite.</li>
              <li><Term>Hard</Term> : tu as trouvé avec difficulté. Elle revient assez tôt.</li>
              <li><Term>Good</Term> : tu as trouvé normalement. C’est le choix habituel.</li>
              <li><Term>Easy</Term> : c’était trop facile. Elle revient bien plus tard.</li>
            </Ul>
          </li>
          <li>« Indice » entoure la pièce à jouer, mais bloque alors « Easy ». Après une erreur, seul « Again » est possible.</li>
          <li>Un mat est accepté même s’il diffère du coup prévu.</li>
        </Ul>
        <p><Term>Au clavier (ordinateur)</Term> :</p>
        <Ul>
          <li><Term>1, 2, 3, 4</Term> : noter Again, Hard, Good, Easy. <Term>Espace</Term> ou <Term>Entrée</Term> : « Good » (ou « Continuer la ligne »).</li>
          <li><Term>H</Term> : indice. <Term>U</Term> ou <Term>Ctrl+Z</Term> : annuler la dernière note. <Term>Échap</Term> : quitter la révision.</li>
        </Ul>
        <p><Term>Sons</Term> : un son accompagne chaque coup, chaque erreur et chaque réussite. Le bouton haut-parleur en haut de l’écran les coupe (et coupe aussi les vibrations sur mobile).</p>
        <p>
          Pendant une révision, tu peux aussi <Term>annuler la note</Term> que tu viens de donner, <Term>suspendre</Term> une carte (elle n’est plus proposée) ou la <Term>supprimer</Term>.
        </p>
        <p>
          Le calcul des dates est fait par l’algorithme <Term>FSRS</Term>, l’un des plus fiables : il s’adapte à ta mémoire, carte par carte.
        </p>
      </Section>

      <Section title="Réviser : les paquets">
        <p>Tes cartes sont rangées en <Term>paquets</Term> et <Term>sous-paquets</Term>, comme dans Anki :</p>
        <Ul>
          <li><Term>Ouvertures</Term> › une ouverture › « Coups seuls » (un coup par carte) et « Lignes » (une suite de coups par carte).</li>
          <li><Term>Puzzles</Term> › un sous-paquet par thème.</li>
          <li><Term>Parties</Term> › Lichess, Chess.com, PGN, Contre le bot ou corrections manuelles (tes erreurs de parties).</li>
          <li><Term>Finales</Term> et <Term>Démo</Term>.</li>
        </Ul>
        <Ul>
          <li>Touche un paquet : s’il contient des sous-paquets, tu descends d’un niveau (le fil d’Ariane en haut permet de remonter). Sinon, la révision démarre.</li>
          <li>« Tout réviser » (ou « Réviser tout … ») lance toutes les cartes du niveau affiché.</li>
          <li>Trois chiffres par paquet : <Term>Nouvelles</Term> (jamais vues), <Term>Apprentissage</Term> (en cours de mémorisation, à revoir dans quelques minutes) et <Term>À revoir</Term> (à réviser aujourd’hui).</li>
          <li>Les chiffres sont les vrais nombres de cartes : un paquet affiche la somme de ses sous-paquets (par exemple 10 + 10 + 5 + 10 + 2 = 37 nouvelles dans Puzzles).</li>
          <li>Pour ne pas te noyer, un <Term>objectif de nouvelles cartes par jour</Term> (réglable en bas de l’écran) te donne un repère pour chaque catégorie : l’app te félicite quand tu l’atteins, mais ne te bloque jamais.</li>
        </Ul>
        <Ul>
          <li>
            <Term>Parcourir les cartes</Term> : recherche et filtres (nouvelles, en apprentissage, à revoir, suspendues). Tu peux sélectionner plusieurs cartes pour les suspendre, les réactiver, les déplacer vers un autre paquet ou les supprimer. Les cartes d’un répertoire se gèrent dans l’éditeur du répertoire : ici, tu peux seulement les suspendre.
          </li>
        </Ul>
        <Go tab="review" onGo={onGo}>Ouvrir Réviser</Go>
      </Section>

      <Section title="Plateau : jouer, affronter un bot, retrouver les cases">
        <Ul>
          <li><Term>Deux côtés</Term> : tu joues les blancs et les noirs. Boutons Retourner, Annuler et Reset.</li>
          <li>
            <Term>Contre un bot</Term> : choisis ta couleur (ou « au hasard ») et la force du bot, de 400 à 2800 Elo. Les niveaux sont{' '}
            <Term>approximatifs</Term> : le bot est Stockfish avec une force réduite.
          </li>
          <li>Pendant la partie : « Annuler mon coup » et « Abandonner ». À la fin, « Enregistrer dans mes parties » te permet de l’analyser ensuite comme les autres.</li>
          <li>
            <Term>Positions</Term> : un entraînement pour connaître l’échiquier par cœur. Un nom de case s’affiche (par exemple <Term>F7</Term>) et tu touches la bonne case sur un échiquier vierge.
            Choisis la durée (30 s, 1, 2 ou 3 minutes), le point de vue (blancs, noirs, au hasard) et, si tu veux, l’aide des coordonnées ou « Insister sur mes cases difficiles ».
            Chaque <Term>erreur coûte 3 secondes</Term> et tu dois retrouver la même case. À la fin : ton score, ta précision, ton temps moyen et les cases à retravailler. Sur ordinateur, tu peux taper la case (« f » puis « 7 »).
          </li>
        </Ul>
        <Go tab="board" onGo={onGo}>Ouvrir le Plateau</Go>
      </Section>

      <Section title="Puzzles">
        <Ul>
          <li>Choisis un <Term>thème</Term>, un <Term>niveau</Term> (Débutant à Expert, ou tes propres bornes d’Elo) et un <Term>nombre</Term>.</li>
          <li>« Ajouter » tire au hasard des puzzles de la base Lichess et les transforme en cartes. Les doublons sont évités.</li>
          <li>Un puzzle peut demander plusieurs coups : l’adversaire joue sa réponse tout seul.</li>
          <li>Il faut une connexion pour <em>ajouter</em> des puzzles ; ensuite ils sont dans ton paquet.</li>
        </Ul>
        <Go tab="puzzles" onGo={onGo}>Ouvrir Puzzles</Go>
      </Section>

      <Section title="Ouvertures : ton répertoire">
        <Ul>
          <li>Un <Term>répertoire</Term> = une ouverture et une couleur (ex. « Système de Londres », blancs).</li>
          <li>Pour le remplir, <Term>joue tes coups</Term> sur l’échiquier (y compris les réponses adverses à connaître) ou <Term>importe un PGN</Term> (variantes et commentaires acceptés).</li>
          <li>L’arbre affiche tes coups en gras. Les boutons ◀ ▶ (ou les flèches du clavier) te déplacent, et tu peux ajouter un commentaire à chaque coup.</li>
          <li><Term>Cartes</Term> : une carte est créée pour chaque position où c’est à toi de jouer. Si tu as prévu plusieurs coups au même endroit, tous sont acceptés.</li>
          <li><Term>Cartes-lignes</Term> : « Jusqu’ici » ou « Toutes les lignes » créent des cartes qui te font rejouer toute une suite de coups, avec les réponses adverses automatiques.</li>
          <li><Term>S’entraîner</Term> (bouton ▶) : tu joues l’ouverture contre un adversaire qui choisit au hasard parmi les réponses de ton arbre. Plus ton arbre contient de réponses adverses, plus l’entraînement varie.</li>
        </Ul>
        <Go tab="openings" onGo={onGo}>Ouvrir Ouvertures</Go>
      </Section>

      <Section title="Parties : importer, analyser, comprendre">
        <Ul>
          <li><Term>Importer</Term> : pseudo Lichess, pseudo Chess.com (1 à 3 derniers mois) ou PGN collé / fichier. L’import ne crée pas de cartes.</li>
          <li>
            <Term>Analyse Stockfish</Term> : choisis combien de parties analyser (1 à Toutes, les plus récentes d’abord), quelles erreurs deviennent des cartes, et la précision. Compte environ 40 secondes par partie ; tout se passe dans ton navigateur, garde l’écran allumé.
          </li>
          <li><Term>Mes parties</Term> : ⭐ pour mettre en favori ; « Sélectionner » pour supprimer plusieurs parties ou n’analyser que celles que tu coches.</li>
          <li>
            <Term>Visionneuse</Term> (touche une partie) : barre d’évaluation, courbe de la partie, catégorie de chaque coup, précision des deux camps. Sur un mauvais coup, une flèche montre le meilleur coup. « Corriger ce coup » crée une carte à la main.
          </li>
        </Ul>
        <Go tab="games" onGo={onGo}>Ouvrir Parties</Go>
      </Section>

      <Section title="Les catégories de coups">
        <p>Chaque coup est comparé au meilleur coup de Stockfish. Ces critères approchent ceux de Chess.com, sans les reproduire exactement.</p>
        <div className="flex flex-col gap-2">
          {CLASS_ORDER.map((c) => (
            <div key={c} className="flex items-start gap-3">
              <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: CLASS_META[c].color }} />
              <p>
                <Term>
                  {CLASS_META[c].label}
                  {CLASS_META[c].symbol && ` ${CLASS_META[c].symbol}`}
                </Term>{' '}
                : {CLASS_META[c].hint.charAt(0).toLowerCase() + CLASS_META[c].hint.slice(1)}.
              </p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">La précision est une moyenne sur 100 : plus tu t’approches des meilleurs coups, plus elle est haute.</p>
      </Section>

      <Section title="Stats">
        <Ul>
          <li><Term>Série</Term> : le nombre de jours de suite où tu as révisé (elle reste vivante tant que tu n’as pas raté un jour entier).</li>
          <li><Term>Heatmap</Term> : une case par jour sur 18 semaines ; plus elle est foncée, plus tu as révisé.</li>
          <li><Term>Rétention</Term> : la part des cartes « à revoir » que tu réussis. Viser environ 90 % est idéal.</li>
          <li><Term>Vision de l’échiquier</Term> : les résultats de l’entraînement « Positions » (records par durée, précision, progression, cases les plus ratées). Ils sont séparés des révisions de cartes pour ne pas fausser ta rétention ni ta série.</li>
        </Ul>
        <Go tab="stats" onGo={onGo}>Ouvrir Stats</Go>
      </Section>

      <Section title="Questions fréquentes">
        <p><Term>Où sont mes données ?</Term> Uniquement sur cet appareil, dans ton navigateur. Rien n’est envoyé sur un serveur (sauf quand tu télécharges des parties depuis Lichess ou Chess.com).</p>
        <p>
          <Term>Comment ne pas les perdre ?</Term> Dans Réviser, en bas de page, la carte « Mes données » rassemble tout :
        </p>
        <Ul>
          <li><Term>Protéger mes données</Term> demande au navigateur de ne pas les effacer quand l’espace manque (sur iPhone, un site non installé peut être purgé après environ une semaine sans visite : installe l’app).</li>
          <li><Term>Exporter</Term> crée un fichier de sauvegarde (sur téléphone, il arrive dans « Fichiers » ou « Téléchargements ») ; <Term>Importer</Term> le restaure.</li>
          <li><Term>Sauvegarde automatique</Term> (Chrome ou Edge sur ordinateur) : choisis un dossier, de préférence synchronisé (OneDrive, Dropbox, Drive) ; l’app y écrit une sauvegarde par jour et garde les 7 dernières.</li>
          <li>Un <Term>rappel</Term> s’affiche si tu n’as pas sauvegardé depuis une semaine.</li>
        </Ul>
        <p>Effacer les données du navigateur ou utiliser la navigation privée supprime tout : garde une sauvegarde récente.</p>
        <p><Term>Téléphone et ordinateur ?</Term> Chaque appareil a ses propres données. Pour passer de l’un à l’autre : Exporter sur le premier, Importer sur le second.</p>
        <p>
          <Term>Installer l’application ?</Term> Clique sur « Installer » en haut quand il apparaît, ou, sur iPhone, Partager → « Sur l’écran d’accueil ».
        </p>
        <p>
          <Term>Hors ligne ?</Term> Oui, après une première visite. Il faut une connexion pour ajouter des puzzles, importer des parties et pour la toute première analyse (le moteur de 2 Mo est ensuite gardé).
        </p>
        <p><Term>Pourquoi une carte revient dans 10 minutes ?</Term> Une carte nouvelle ou ratée passe par une phase d’apprentissage avec des rappels rapprochés.</p>
        <p>
          <Term>« Terminé pour ce paquet » alors que j’ai ajouté des cartes ?</Term> Vérifie que tu regardes le bon paquet et que les cartes ne sont pas suspendues (« Parcourir les cartes »). Une carte revue il y a peu peut aussi n’être due que plus tard.
        </p>
        <p><Term>« Packs de puzzles absents » ?</Term> Les packs sont générés quand le site est publié ; ils ne sont pas disponibles si cette étape a échoué.</p>
      </Section>

      <Section title="À propos, licences et diagnostic">
        <About />
      </Section>
    </div>
  );
}
