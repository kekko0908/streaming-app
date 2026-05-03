import { useMemo, useState } from "react";
import { MediaType, SavedItem, WatchStatus } from "../types/types";

export function useMyListViewState(myList: SavedItem[]) {
  const [listSearch, setListSearch] = useState("");
  const [listTypeFilter, setListTypeFilter] = useState<"all" | MediaType>("all");
  const [listStatusFilter, setListStatusFilter] = useState<"all" | WatchStatus>("all");
  const [listSort, setListSort] = useState<"added" | "rating" | "year">("added");

  const filteredMyList = useMemo(() => {
    let items = [...myList];

    if (listSearch) {
      items = items.filter((item) => item.title.toLowerCase().includes(listSearch.toLowerCase()));
    }

    if (listTypeFilter !== "all") {
      items = items.filter((item) => item.type === listTypeFilter);
    }

    if (listStatusFilter !== "all") {
      items = items.filter((item) => item.status === listStatusFilter);
    }

    items.sort((a, b) => {
      if (listSort === "rating") return b.rating - a.rating;
      if (listSort === "year") return parseInt(b.year || "0") - parseInt(a.year || "0");
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    return items;
  }, [listSearch, listSort, listStatusFilter, listTypeFilter, myList]);

  return {
    listSearch,
    setListSearch,
    listTypeFilter,
    setListTypeFilter,
    listStatusFilter,
    setListStatusFilter,
    listSort,
    setListSort,
    filteredMyList,
  };
}
