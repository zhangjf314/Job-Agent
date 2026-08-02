import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectAssertionStrengths, projectFactCategories } from "@/types/project-facts";
import {
  createProjectFactAtomAction,
  deleteProjectFactAtomAction,
  moveProjectFactAtomAction,
  syncProjectFactAtomsAction,
  updateProjectFactAtomAction,
} from "@/app/profile/actions";

type Atom = {
  id: string;
  category: string;
  canonicalText: string;
  assertionStrength: string;
  renderable: boolean;
  displayOrder: number;
};

type Project = {
  id: string;
  name: string;
  factAtoms: Atom[];
};

const categoryLabels: Record<string, string> = {
  background: "背景",
  goal: "目标",
  role: "角色",
  technology: "技术",
  feature: "功能",
  responsibility: "职责",
  challenge: "难点",
  solution: "方案",
  engineering: "工程实践",
  result: "结果",
  metric: "量化指标",
};

function CompletenessHint({ atoms }: { atoms: Atom[] }) {
  const counts = new Map<string, number>();
  atoms.forEach((atom) => counts.set(atom.category, (counts.get(atom.category) ?? 0) + 1));
  const missing: string[] = [];
  if (!counts.get("technology")) missing.push("技术");
  if (!counts.get("responsibility")) missing.push("职责");
  if (!counts.get("feature")) missing.push("功能");
  if (!counts.get("challenge") || !counts.get("solution")) missing.push("技术难点/方案");
  if (!counts.get("result") && !counts.get("metric")) missing.push("结果");
  return (
    <div className="rounded-md bg-muted p-3 text-sm" data-project-fact-completeness>
      <div className="font-medium">项目事实完整度</div>
      <div className="mt-1 text-muted-foreground">
        技术 {counts.get("technology") ?? 0} · 职责 {counts.get("responsibility") ?? 0} ·
        功能 {counts.get("feature") ?? 0} · 难点/方案 {(counts.get("challenge") ?? 0) + (counts.get("solution") ?? 0)} ·
        结果 {counts.get("result") ?? 0} · 可定制 {atoms.filter((atom) => atom.renderable).length}
      </div>
      {missing.length > 0 ? (
        <p className="mt-2 text-amber-700">
          该项目缺少“{missing.join("、")}”事实，生成的岗位定制描述可能更偏向已有信息。
        </p>
      ) : null}
    </div>
  );
}

function FactFields({ atom }: { atom?: Atom }) {
  return (
    <>
      <select name="category" defaultValue={atom?.category ?? "responsibility"} className="h-9 rounded-md border px-3 text-sm">
        {projectFactCategories.map((category) => (
          <option key={category} value={category}>{categoryLabels[category]}</option>
        ))}
      </select>
      <Input name="canonicalText" defaultValue={atom?.canonicalText ?? ""} maxLength={240} placeholder="一条能够独立解释和验证的真实事实" required />
      <select name="assertionStrength" defaultValue={atom?.assertionStrength ?? "implemented"} className="h-9 rounded-md border px-3 text-sm">
        {projectAssertionStrengths.map((strength) => (
          <option key={strength} value={strength}>{strength}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="renderable" defaultChecked={atom?.renderable ?? true} />
        可用于定制简历
      </label>
    </>
  );
}

export function ProjectFactAtomEditor({ profileId, projects }: { profileId: string; projects: Project[] }) {
  return (
    <section className="space-y-4" data-project-fact-editor>
      <div>
        <h2 className="text-xl font-semibold">项目事实</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          项目事实用于根据岗位 JD 选择和组合项目描述。请只填写自己真实完成、能够在面试中解释的内容。
        </p>
      </div>
      {projects.map((project) => (
        <article key={project.id} className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">{project.name}</h3>
            <form action={syncProjectFactAtomsAction.bind(null, profileId, project.id)}>
              <Button type="submit" size="sm" variant="outline">
                <RefreshCw className="size-4" /> 从结构化字段导入/同步
              </Button>
            </form>
          </div>
          <CompletenessHint atoms={project.factAtoms} />
          <div className="space-y-2">
            {project.factAtoms.map((atom, index) => (
              <details key={atom.id} className="rounded-md border p-3" data-project-fact-row>
                <summary className="cursor-pointer text-sm">
                  <span className="font-medium">{categoryLabels[atom.category]}</span>
                  <span className="ml-2">{atom.canonicalText}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{atom.assertionStrength} · {atom.renderable ? "可定制" : "仅保留"}</span>
                </summary>
                <div className="mt-3 space-y-3">
                  <form action={updateProjectFactAtomAction.bind(null, profileId, atom.id)} className="grid gap-3 md:grid-cols-[140px_1fr_140px_auto_auto]">
                    <FactFields atom={atom} />
                    <Button type="submit" size="sm">保存</Button>
                  </form>
                  <div className="flex gap-2">
                    <form action={moveProjectFactAtomAction.bind(null, profileId, atom.id, "up")}><Button type="submit" size="sm" variant="outline" disabled={index === 0}><ArrowUp className="size-4" />上移</Button></form>
                    <form action={moveProjectFactAtomAction.bind(null, profileId, atom.id, "down")}><Button type="submit" size="sm" variant="outline" disabled={index === project.factAtoms.length - 1}><ArrowDown className="size-4" />下移</Button></form>
                    <form action={deleteProjectFactAtomAction.bind(null, profileId, atom.id)}><Button type="submit" size="sm" variant="destructive"><Trash2 className="size-4" />删除</Button></form>
                  </div>
                </div>
              </details>
            ))}
          </div>
          <form action={createProjectFactAtomAction.bind(null, profileId, project.id)} className="grid gap-3 rounded-md border border-dashed p-3 md:grid-cols-[140px_1fr_140px_auto_auto]">
            <FactFields />
            <Button type="submit" size="sm"><Plus className="size-4" />新增事实</Button>
          </form>
        </article>
      ))}
      {projects.length === 0 ? <p className="text-sm text-muted-foreground">请先在下方添加并保存项目经历。</p> : null}
    </section>
  );
}
