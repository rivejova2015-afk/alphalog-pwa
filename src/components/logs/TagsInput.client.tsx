// src/components/logs/TagsInput.client.tsx
"use client";

import { useState, useEffect } from "react";

interface Tag {
  id: string;
  name: string;
}

interface TagsInputProps {
  value: string[]; // Array of tag names
  onChange: (tags: string[]) => void;
}

export default function TagsInput({ value, onChange }: TagsInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load all tags for suggestions
  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await fetch("/api/tags");
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.items || []);
        }
      } catch (error) {
        console.error("Error loading tags:", error);
      }
    };
    loadTags();
  }, []);

  const handleAddTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;

    // Check if already added (case-insensitive)
    const exists = value.some(
      (t) => t.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setInput("");
      return;
    }

    // Check max 25 tags
    if (value.length >= 25) {
      return;
    }

    onChange([...value, trimmed]);
    setInput("");
    setShowSuggestions(false);
  };

  const handleRemoveTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag(input);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const filteredSuggestions = suggestions.filter(
    (tag) =>
      tag.name.toLowerCase().includes(input.toLowerCase()) &&
      !value.some((t) => t.toLowerCase() === tag.name.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label style={{ fontSize: "14px", fontWeight: "500", color: "#1f2937" }}>
        Tags (máx 25)
      </label>

      {/* Selected tags */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        minHeight: "32px",
        padding: "4px",
        backgroundColor: "#f3f4f6",
        borderRadius: "4px",
      }}>
        {value.map((tag, index) => (
          <span
            key={index}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              backgroundColor: "#dbeafe",
              color: "#1e40af",
              borderRadius: "3px",
              fontSize: "12px",
            }}
          >
            {tag}
            <button
              onClick={() => handleRemoveTag(index)}
              style={{
                background: "none",
                border: "none",
                color: "#1e40af",
                cursor: "pointer",
                fontSize: "14px",
                padding: "0",
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Input + suggestions */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(e.target.value.length > 0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(input.length > 0)}
          placeholder="Escribe una etiqueta y presiona Enter o selecciona de la lista"
          disabled={value.length >= 25}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            backgroundColor: value.length >= 25 ? "#f3f4f6" : "#fff",
            cursor: value.length >= 25 ? "not-allowed" : "text",
          }}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              backgroundColor: "#fff",
              border: "1px solid #d1d5db",
              borderTop: "none",
              borderRadius: "0 0 4px 4px",
              maxHeight: "150px",
              overflowY: "auto",
              zIndex: 10,
            }}
          >
            {filteredSuggestions.slice(0, 10).map((tag) => (
              <div
                key={tag.id}
                onClick={() => handleAddTag(tag.name)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: "13px",
                  backgroundColor: "#fff",
                  borderBottom: "1px solid #f3f4f6",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
                }}
              >
                {tag.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {value.length >= 25 && (
        <p style={{ fontSize: "12px", color: "#dc2626" }}>
          Máximo 25 tags alcanzado
        </p>
      )}
    </div>
  );
}
