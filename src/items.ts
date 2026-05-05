import type { Item } from "./types/item.ts";

export default function createItemsRepo() {
  const map = new Map<string, Item>();

  return {
    list(): Item[] {
      return Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "ru"),
      );
    },
    get(id: string): Item | null {
      return map.get(id) ?? null;
    },
    create(name: string, price: number): Item {
      const item = { id: randomId(), name, price };
      map.set(item.id, item);
      return item;
    },
  };
}

function randomId(): string {
  return (
    Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
  );
}
