import { Hammer } from 'lucide-react';
import { Card, PageHeader } from './ui';

export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-accent/10 text-accent-soft mb-4">
          <Hammer size={32} />
        </div>
        <h2 className="text-lg font-bold text-white">Em breve</h2>
        <p className="text-sm text-zinc-400 mt-2 max-w-md">{description}</p>
      </Card>
    </div>
  );
}
