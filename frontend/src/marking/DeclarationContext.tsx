import { createContext, useContext } from 'react';
import type { Declaration } from '../types';
export const MarkingDeclarationContext = createContext<Declaration | null>(null);
export const useMarkingDeclaration = () => useContext(MarkingDeclarationContext);
