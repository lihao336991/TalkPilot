import React, { createContext, useCallback, useContext, useState } from "react";

import {
  AppAlert,
  type AlertButton,
  type AppAlertProps,
} from "./AppAlert";

type AlertOptions = Omit<AppAlertProps, "visible">;

type AlertContextValue = {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alert, setAlert] = useState<AlertOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = useCallback((options: AlertOptions) => {
    setAlert(options);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
    setAlert(null);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <AppAlert
        visible={visible}
        title={alert?.title ?? ""}
        message={alert?.message}
        buttons={alert?.buttons}
        onDismiss={hideAlert}
      />
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return ctx;
}

export type { AlertButton };
