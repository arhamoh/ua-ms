'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
import AnimatedButton from './AnimatedButton';

export type WizardStep = { id: string; label: string; content: ReactNode };

/**
 * Multi-step form wrapper. All steps stay mounted (inactive ones are `hidden`)
 * so the surrounding <form> still submits every field at once — the wizard only
 * controls which step is visible. Each step's required fields are validated
 * before advancing.
 */
export default function OnboardWizard({
  steps,
  submitLabel = 'Submit',
  cancelHref = '/',
}: {
  steps: WizardStep[];
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const last = steps.length - 1;

  const validateCurrent = () => {
    const el = refs.current[step];
    if (!el) return true;
    const controls = Array.from(
      el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'),
    );
    for (const c of controls) {
      if (!c.checkValidity()) {
        c.reportValidity();
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (validateCurrent()) setStep((s) => Math.min(s + 1, last));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  // Only allow jumping to already-visited steps (forward must go through Next so
  // validation runs).
  const goTo = (i: number) => {
    if (i <= step) setStep(i);
  };

  return (
    <div>
      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                onClick={() => goTo(i)}
                className={`flex items-center gap-2 ${i <= step ? 'cursor-pointer' : 'cursor-default'}`}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition ${
                    active ? 'bg-brand text-white' : done ? 'bg-brand/15 text-brand' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className={`hidden text-sm font-medium sm:inline ${
                    active ? 'text-slate-900' : done ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {i < last && <span className={`hidden h-px flex-1 sm:block ${done ? 'bg-brand/30' : 'bg-slate-200'}`} />}
            </li>
          );
        })}
      </ol>

      {/* Mobile: current step + counter */}
      <div className="mb-4 flex items-center justify-between sm:hidden">
        <span className="text-sm font-semibold">{steps[step].label}</span>
        <span className="text-xs text-slate-400">
          Step {step + 1} of {steps.length}
        </span>
      </div>

      {/* Panels — all mounted, inactive ones hidden (so they still submit) */}
      {steps.map((s, i) => (
        <div
          key={s.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          hidden={i !== step}
          className="space-y-6"
        >
          {s.content}
        </div>
      ))}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        {step === 0 ? (
          <Link href={cancelHref} className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </Link>
        ) : (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <ArrowLeft size={15} /> Back
          </button>
        )}

        {step < last ? (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            Next <ArrowRight size={15} />
          </button>
        ) : (
          <AnimatedButton
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
          >
            {submitLabel}
          </AnimatedButton>
        )}
      </div>
    </div>
  );
}
