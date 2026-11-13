import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Starea panoului lateral (desktop și tabletă): extins sau restrâns la 72 px.
const PanelCtx = createContext({ collapsed: false, toggle: () => {}, setCollapsed: () => {} });

export function PanelProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  const value = useMemo(() => ({ collapsed, toggle, setCollapsed }), [collapsed, toggle]);
  return <PanelCtx.Provider value={value}>{children}</PanelCtx.Provider>;
}

export const usePanel = () => useContext(PanelCtx);
