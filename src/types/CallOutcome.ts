export interface CallOutcome {
  id: number;
  contactId: number;
  signalId: number | null;
  disposition: string;
  notes: string | null;
  createdAt: string;
}

export type NewCallOutcome = {
  contactId: number;
  signalId?: number | null;
  disposition: string;
  notes?: string | null;
};
