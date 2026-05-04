import { useState } from "react";
import { TmdbItem } from "../types/types";
import { buildMediaPath } from "../utils/helper";

export function useSelectedMedia({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const [selected, setSelected] = useState<TmdbItem | null>(null);

  const selectItem = async (item: TmdbItem) => {
    navigate(buildMediaPath(item));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetSelection = () => {
    setSelected(null);
  };

  return {
    selected,
    setSelected,
    selectItem,
    resetSelection,
  };
}
