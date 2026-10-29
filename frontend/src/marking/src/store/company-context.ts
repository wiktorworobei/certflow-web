import { store } from '../../../store';

export interface SelectedCompany { id: string; title: string }

// Read the host workspace directly: the imported client must not choose a second company independently.
export const useCompanyContextStore = {
  getState: (): { selectedCompany: SelectedCompany | null } => {
    const session = store.getState().session;
    const firm = session.user?.firms.find(item => item.id === session.firmId);
    return { selectedCompany: firm ? { id: firm.id, title: firm.name } : null };
  },
};
