"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyAll() {
  listeners.forEach((fn) => fn());
}

export function useSyncStorage() {
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.startsWith("meu_horario_")) notifyAll();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return useCallback(notifyAll, []);
}

export function useStorageState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const sync = useSyncStorage();
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  const stableKey = useRef(key);
  stableKey.current = key;

  useEffect(() => {
    const onChange = () => {
      try {
        const raw = localStorage.getItem(stableKey.current);
        if (raw) setValue(JSON.parse(raw));
      } catch {
        // ignore
      }
    };
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
  }, []);

  const update = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
      try { localStorage.setItem(stableKey.current, JSON.stringify(next)); } catch { /* full */ }
      notifyAll();
      return next;
    });
  }, []);

  return [value, update];
}
