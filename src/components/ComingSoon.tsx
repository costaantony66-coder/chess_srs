import { Card } from './ui/Card';

export function ComingSoon({ title, phase, text }: { title: string; phase: number; text: string }) {
  return (
    <Card className="mx-auto mt-6 max-w-md text-center">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-muted">{text}</p>
      <p className="mt-4 text-xs text-muted">Prévu en phase {phase}</p>
    </Card>
  );
}
