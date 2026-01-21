// src/components/logs/TrashToggle.client.tsx
"use client";

interface TrashToggleProps {
  isTrash: boolean;
  onChange: (isTrash: boolean) => void;
}

export default function TrashToggle({ isTrash, onChange }: TrashToggleProps) {
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      cursor: "pointer",
      fontSize: "14px",
      color: "#374151"
    }}>
      <input
        type="checkbox"
        checked={isTrash}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: "pointer" }}
      />
      <span>Ver papelera (eliminados)</span>
    </label>
  );
}
