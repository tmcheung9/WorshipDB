import { useState } from "react";
import { FilterPanel } from "../FilterPanel";

const mockCategories = ["敬拜讚美", "福音詩歌", "聖誕詩歌", "復活節詩歌"];

export default function FilterPanelExample() {
  const [category, setCategory] = useState<string>("all");
  const [tempo, setTempo] = useState<string>();
  const [tags, setTags] = useState<string[]>([]);

  const handleTagToggle = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleClear = () => {
    setCategory("all");
    setTempo(undefined);
    setTags([]);
  };

  return (
    <div className="p-4 max-w-4xl">
      <FilterPanel
        selectedCategory={category}
        selectedTempo={tempo}
        selectedTags={tags}
        categories={mockCategories}
        onCategoryChange={setCategory}
        onTempoChange={setTempo}
        onTagToggle={handleTagToggle}
        onClearFilters={handleClear}
      />
    </div>
  );
}
