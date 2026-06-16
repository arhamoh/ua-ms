import AssistantChat from '@/components/AssistantChat';
import AssistantIcon from '@/components/AssistantIcon';

export const dynamic = 'force-dynamic';

export default function AssistantPage() {
  return (
    <div>
      <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
        <AssistantIcon size={24} className="text-brand" /> Analytics Assistant
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Ask about clients, projects, payments, commissions, and this month’s finances.
      </p>
      <div className="mt-5 flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <AssistantChat className="min-h-0 flex-1" />
      </div>
    </div>
  );
}
