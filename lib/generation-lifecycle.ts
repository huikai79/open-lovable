export type GenerationPhase =
  | 'idle'
  | 'gathering'
  | 'planning'
  | 'generating'
  | 'applying'
  | 'complete'
  | 'failed'
  | 'cancelled';

const TRANSITIONS: Readonly<Record<GenerationPhase, readonly GenerationPhase[]>> = {
  idle: ['gathering'],
  gathering: ['planning', 'failed', 'cancelled'],
  planning: ['generating', 'failed', 'cancelled'],
  generating: ['applying', 'complete', 'failed', 'cancelled'],
  applying: ['complete', 'failed', 'cancelled'],
  complete: ['idle', 'gathering'],
  failed: ['idle', 'gathering'],
  cancelled: ['idle', 'gathering'],
};

export function canTransitionGeneration(
  from: GenerationPhase,
  to: GenerationPhase,
): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function assertGenerationTransition(
  from: GenerationPhase,
  to: GenerationPhase,
): GenerationPhase {
  if (!canTransitionGeneration(from, to)) {
    throw new Error(`Invalid generation transition: ${from} -> ${to}`);
  }
  return to;
}

export function isGenerationBusy(phase: GenerationPhase): boolean {
  return (
    phase === 'gathering' ||
    phase === 'planning' ||
    phase === 'generating' ||
    phase === 'applying'
  );
}

export function toLoadingStage(
  phase: GenerationPhase,
): 'gathering' | 'planning' | 'generating' | null {
  if (phase === 'gathering' || phase === 'planning' || phase === 'generating') {
    return phase;
  }
  return null;
}
