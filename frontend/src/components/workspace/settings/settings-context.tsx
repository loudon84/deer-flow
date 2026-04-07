"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type SettingsSection =
  | "appearance"
  | "memory"
  | "tools"
  | "skills"
  | "notification"
  | "publish"
  | "about";

interface SettingsContextValue {
  open: boolean;
  defaultSection: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultSection, setDefaultSection] = useState<SettingsSection>("appearance");

  const openSettings = useCallback((section?: SettingsSection) => {
    if (section) {
      setDefaultSection(section);
    }
    setOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        open,
        defaultSection,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export { SettingsContext };
