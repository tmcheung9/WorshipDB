import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "搜尋詩歌名稱、作曲家...",
}: SearchBarProps) {
  return (
    <div className="relative w-full group">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 h-11 text-base bg-card shadow-sm border-border/60 transition-all focus:shadow-md focus:border-primary/40"
        data-testid="input-search"
      />
    </div>
  );
}
