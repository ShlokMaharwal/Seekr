import { useEffect, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "./api";
export function SearchBox({
  initial = "",
  onSearch,
  compact = false,
}: {
  initial?: string;
  onSearch: (q: string) => void;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setValue(initial);
  }, [initial]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (value.trim())
        api
          .autocomplete(value)
          .then((data) => {
            if (active) {
              setSuggestions(data.suggestions);
              setSelected(-1);
            }
          })
          .catch(() => {
            if (active) setSuggestions([]);
          });
      else setSuggestions([]);
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value]);
  const submit = (q: string) => {
    if (!q.trim()) return;
    setValue(q);
    setOpen(false);
    onSearch(q.trim());
    input.current?.blur();
  };
  return (
    <div className={compact ? "search-box-wrap compact" : "search-box-wrap"}>
      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault();
          submit(selected >= 0 && open ? (suggestions[selected] ?? value) : value);
        }}
      >
        <Search className="search-symbol" size={22} />
        <input
          ref={input}
          aria-label="Search the web"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="search-suggestions"
          aria-activedescendant={selected >= 0 ? `suggestion-${selected}` : undefined}
          value={value}
          placeholder="What are you looking for?"
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setSelected(-1);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setSelected((i) => Math.min(i + 1, suggestions.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((i) => Math.max(i - 1, 0));
            }
          }}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              input.current?.focus();
            }}
          >
            <X />
          </Button>
        )}
        <Button type="submit" size="icon" className="search-submit" aria-label="Submit search">
          <ArrowRight size={20} />
        </Button>
      </form>
      {open && suggestions.length > 0 && (
        <ul id="search-suggestions" className="suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={selected === i}
              className={selected === i ? "selected" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(s)}
            >
              <Search size={16} />
              {s}
              <ArrowRight size={14} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function Highlight({ text, q }: { text: string; q: string }) {
  const terms = q.replaceAll('"', "").split(/\s+/).filter(Boolean);
  if (!terms.length) return <>{text}</>;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  return (
    <>
      {text
        .split(regex)
        .map((part, i) =>
          terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
            <strong key={i}>{part}</strong>
          ) : (
            part
          ),
        )}
    </>
  );
}
