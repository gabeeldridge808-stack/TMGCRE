"use client";

import { useState, type ReactNode } from "react";

export default function DealTabs({ tabs }: { tabs: { label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #ddd", marginBottom: 20 }}>
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: i === active ? "2px solid #111" : "2px solid transparent",
              background: "none",
              fontWeight: i === active ? 600 : 400,
              fontSize: 15,
              cursor: "pointer",
              color: i === active ? "#111" : "#666",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs[active].content}
    </div>
  );
}
