"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { IconButton } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, cycle } = useTheme();
  const label = theme === "system" ? "Theme: system" : theme === "dark" ? "Theme: dark" : "Theme: light";
  return (
    <IconButton label={`${label} (click to change)`} onClick={cycle}>
      {theme === "system" ? <Monitor className="size-4" /> : theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </IconButton>
  );
}
