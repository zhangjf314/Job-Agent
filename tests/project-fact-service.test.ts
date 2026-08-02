import { describe, expect, it } from "vitest";
import {
  createProjectFactAtom,
  deleteProjectFactAtom,
  moveProjectFactAtom,
  updateProjectFactAtom,
} from "@/services/project-facts/project-fact-service";

type Atom = {
  id: string;
  projectId: string;
  stableKey: string;
  category: string;
  canonicalText: string;
  sourceField: string | null;
  sourceOrder: number | null;
  displayOrder: number;
  assertionStrength: string;
  renderable: boolean;
};

function memoryDb() {
  const atoms: Atom[] = [];
  const matches = (atom: Atom, where: Record<string, unknown>) => {
    if (where.id && typeof where.id === "string" && atom.id !== where.id) return false;
    if (where.projectId && atom.projectId !== where.projectId) return false;
    const idFilter = where.id as { not?: string } | undefined;
    if (idFilter?.not && atom.id === idFilter.not) return false;
    const text = where.canonicalText as { equals?: string } | undefined;
    if (text?.equals && atom.canonicalText.toLowerCase() !== text.equals.toLowerCase()) return false;
    const order = where.displayOrder as { lt?: number; gt?: number } | undefined;
    if (order?.lt !== undefined && atom.displayOrder >= order.lt) return false;
    if (order?.gt !== undefined && atom.displayOrder <= order.gt) return false;
    return true;
  };
  const projectFactAtom = {
    findFirst: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: { displayOrder: "asc" | "desc" } }) => {
      const rows = atoms.filter((atom) => matches(atom, where));
      rows.sort((a, b) => orderBy?.displayOrder === "desc" ? b.displayOrder - a.displayOrder : a.displayOrder - b.displayOrder);
      return rows[0] ?? null;
    },
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const atom = atoms.find((item) => item.id === where.id);
      if (!atom) throw new Error("not found");
      return atom;
    },
    aggregate: async ({ where }: { where: { projectId: string } }) => ({
      _max: { displayOrder: Math.max(-1, ...atoms.filter((atom) => atom.projectId === where.projectId).map((atom) => atom.displayOrder)) },
    }),
    create: async ({ data }: { data: Omit<Atom, "id"> }) => {
      const atom = { id: `atom_${atoms.length + 1}`, ...data };
      atoms.push(atom);
      return atom;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Atom> }) => {
      const atom = atoms.find((item) => item.id === where.id)!;
      Object.assign(atom, data);
      return atom;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const index = atoms.findIndex((item) => item.id === where.id);
      return atoms.splice(index, 1)[0];
    },
  };
  return {
    atoms,
    db: {
      projectFactAtom,
      $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    },
  };
}

describe("project fact service", () => {
  it("creates, edits, reorders and deletes manually confirmed facts", async () => {
    const memory = memoryDb();
    const first = await createProjectFactAtom("project_1", {
      category: "responsibility", canonicalText: "开发任务模块", assertionStrength: "implemented", renderable: true,
    }, memory.db as never);
    const second = await createProjectFactAtom("project_1", {
      category: "technology", canonicalText: "TypeScript", assertionStrength: "used", renderable: true,
    }, memory.db as never);
    expect(memory.atoms.map((atom) => atom.displayOrder)).toEqual([0, 1]);

    await updateProjectFactAtom(first.id, {
      category: "responsibility", canonicalText: "开发任务筛选模块", assertionStrength: "implemented", renderable: true,
    }, memory.db as never);
    expect(memory.atoms[0].canonicalText).toBe("开发任务筛选模块");

    await moveProjectFactAtom(second.id, "up", memory.db as never);
    expect(memory.atoms.find((atom) => atom.id === second.id)?.displayOrder).toBe(0);

    await deleteProjectFactAtom(first.id, memory.db as never);
    expect(memory.atoms.map((atom) => atom.id)).toEqual([second.id]);
  });

  it("rejects duplicate manual facts", async () => {
    const memory = memoryDb();
    const input = {
      category: "technology" as const, canonicalText: "TypeScript", assertionStrength: "used" as const, renderable: true,
    };
    await createProjectFactAtom("project_1", input, memory.db as never);
    await expect(createProjectFactAtom("project_1", input, memory.db as never))
      .rejects.toThrow("PROJECT_FACT_DUPLICATE");
  });
});
