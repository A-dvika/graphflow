"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Dashboard } from "@/components/dashboard";
import { getConsoleSectionMeta, type ConsoleSection } from "@/lib/console-sections";

export default function Home() {
  const [activeSection, setActiveSection] = useState<ConsoleSection>("overview");
  const section = getConsoleSectionMeta(activeSection);

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader activeSection={activeSection} onSectionChange={setActiveSection} title={section.title} />

        <div className="flex-1 overflow-auto">
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[var(--foreground)]">{section.title}</h1>
              <p className="text-[var(--foreground-secondary)] mt-2">{section.subtitle}</p>
            </div>
            <Dashboard section={activeSection} />
          </div>
        </div>
      </div>
    </div>
  );
}
