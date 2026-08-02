"use client";

import { useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Save, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CareerProfileInput } from "@/schemas/career-profile";
import { employmentTypes, evidenceTypes, skillCategories, skillLevels, targetStatuses } from "@/types/career-profile";

type TextItem = Record<string, unknown>;

export type CareerProfileFormValues = {
  userId: string;
  targetStatus: CareerProfileInput["targetStatus"];
  targetRolesText: string;
  targetCitiesText: string;
  expectedSalaryMin?: number | string | null;
  expectedSalaryMax?: number | string | null;
  personalSummary?: string;
  basicInfo: {
    realName: string;
    phone: string;
    email: string;
    location: string;
    githubUrl?: string;
    portfolioUrl?: string;
    linkedinUrl?: string;
    personalWebsite?: string;
  };
  educationItems: Array<TextItem>;
  skillItems: Array<TextItem>;
  projectItems: Array<TextItem>;
  experienceItems: Array<TextItem>;
  certificateItems: Array<TextItem>;
  awardItems: Array<TextItem>;
  evidenceItems: Array<TextItem>;
};

type Props = {
  mode: "create" | "edit";
  defaultValues: CareerProfileFormValues;
  onSubmit: (payload: CareerProfileInput) => Promise<void>;
};

function splitText(value: unknown) {
  return String(value ?? "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function nullableNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  return Number(value);
}

function normalize(values: CareerProfileFormValues): CareerProfileInput {
  return {
    userId: values.userId,
    targetStatus: values.targetStatus,
    targetRoles: splitText(values.targetRolesText),
    targetCities: splitText(values.targetCitiesText),
    expectedSalaryMin: nullableNumber(values.expectedSalaryMin),
    expectedSalaryMax: nullableNumber(values.expectedSalaryMax),
    personalSummary: values.personalSummary ?? "",
    basicInfo: {
      ...values.basicInfo,
      location: values.basicInfo.location ?? "",
    },
    educationItems: values.educationItems.map((item) => ({
      school: String(item.school ?? ""),
      major: String(item.major ?? ""),
      degree: String(item.degree ?? ""),
      startDate: new Date(String(item.startDate ?? "")),
      endDate: item.endDate ? new Date(String(item.endDate)) : null,
      gpa: String(item.gpa ?? ""),
      ranking: String(item.ranking ?? ""),
      courses: splitText(item.coursesText),
      honors: splitText(item.honorsText),
    })),
    skillItems: values.skillItems.map((item) => ({
      name: String(item.name ?? ""),
      category: String(item.category ?? "programming_language") as CareerProfileInput["skillItems"][number]["category"],
      level: String(item.level ?? "intermediate") as CareerProfileInput["skillItems"][number]["level"],
      evidence: String(item.evidence ?? ""),
      yearsOfExperience: nullableNumber(item.yearsOfExperience),
    })),
    projectItems: values.projectItems.map((item) => ({
      id: item.id ? String(item.id) : undefined,
      name: String(item.name ?? ""),
      projectType: String(item.projectType ?? ""),
      role: String(item.role ?? ""),
      startDate: item.startDate ? new Date(String(item.startDate)) : null,
      endDate: item.endDate ? new Date(String(item.endDate)) : null,
      background: String(item.background ?? ""),
      goal: String(item.goal ?? ""),
      fullDescription: String(item.fullDescription ?? ""),
      responsibilities: splitText(item.responsibilitiesText),
      techStack: splitText(item.techStackText),
      highlights: splitText(item.highlightsText),
      challenges: splitText(item.challengesText),
      solutions: splitText(item.solutionsText),
      engineeringPractices: splitText(item.engineeringPracticesText),
      results: String(item.results ?? ""),
      metrics: splitText(item.metricsText),
      links: splitText(item.linksText),
    })),
    experienceItems: values.experienceItems.map((item) => ({
      company: String(item.company ?? ""),
      department: String(item.department ?? ""),
      role: String(item.role ?? ""),
      employmentType: String(item.employmentType ?? "internship") as CareerProfileInput["experienceItems"][number]["employmentType"],
      startDate: new Date(String(item.startDate ?? "")),
      endDate: item.endDate ? new Date(String(item.endDate)) : null,
      responsibilities: splitText(item.responsibilitiesText),
      achievements: splitText(item.achievementsText),
      techStack: splitText(item.techStackText),
      businessImpact: String(item.businessImpact ?? ""),
      metrics: splitText(item.metricsText),
    })),
    certificateItems: values.certificateItems.map((item) => ({
      name: String(item.name ?? ""),
      issuer: String(item.issuer ?? ""),
      issuedAt: item.issuedAt ? new Date(String(item.issuedAt)) : null,
      expiresAt: item.expiresAt ? new Date(String(item.expiresAt)) : null,
      credentialUrl: String(item.credentialUrl ?? ""),
    })),
    awardItems: values.awardItems.map((item) => ({
      name: String(item.name ?? ""),
      issuer: String(item.issuer ?? ""),
      level: String(item.level ?? ""),
      awardedAt: item.awardedAt ? new Date(String(item.awardedAt)) : null,
      description: String(item.description ?? ""),
    })),
    evidenceItems: values.evidenceItems.map((item) => ({
      type: String(item.type ?? "url") as CareerProfileInput["evidenceItems"][number]["type"],
      title: String(item.title ?? ""),
      url: String(item.url ?? ""),
      description: String(item.description ?? ""),
      relatedEntityType: String(item.relatedEntityType ?? ""),
      relatedEntityId: String(item.relatedEntityId ?? ""),
    })),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Module({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-4" />
          新增
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function CareerProfileForm({ mode, defaultValues, onSubmit }: Props) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<CareerProfileFormValues>({ defaultValues });
  const education = useFieldArray({ control: form.control, name: "educationItems" });
  const skills = useFieldArray({ control: form.control, name: "skillItems" });
  const projects = useFieldArray({ control: form.control, name: "projectItems" });
  const experiences = useFieldArray({ control: form.control, name: "experienceItems" });
  const certificates = useFieldArray({ control: form.control, name: "certificateItems" });
  const awards = useFieldArray({ control: form.control, name: "awardItems" });
  const evidence = useFieldArray({ control: form.control, name: "evidenceItems" });
  const { register, handleSubmit } = form;

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit((values) =>
        startTransition(async () => {
          await onSubmit(normalize(values));
        }),
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>求职目标</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <input type="hidden" {...register("userId")} />
          <Field label="当前状态">
            <select className="h-9 w-full rounded-md border px-3 text-sm" {...register("targetStatus")}>
              {targetStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
          <Field label="目标岗位">
            <Input {...register("targetRolesText")} placeholder="Java 后端开发，软件开发工程师" />
          </Field>
          <Field label="目标城市">
            <Input {...register("targetCitiesText")} placeholder="杭州，上海，南京" />
          </Field>
          <Field label="期望薪资下限">
            <Input type="number" {...register("expectedSalaryMin")} />
          </Field>
          <Field label="期望薪资上限">
            <Input type="number" {...register("expectedSalaryMax")} />
          </Field>
          <div className="md:col-span-2">
            <Field label="个人总结">
              <Textarea {...register("personalSummary")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {(["realName", "phone", "email", "location", "githubUrl", "portfolioUrl", "linkedinUrl", "personalWebsite"] as const).map((name) => (
            <Field key={name} label={name}>
              <Input {...register(`basicInfo.${name}` as const)} />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Module title="教育经历" onAdd={() => education.append({ school: "", major: "", degree: "本科", startDate: "", endDate: "", coursesText: "", honorsText: "" })}>
        {education.fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 border-t pt-4 md:grid-cols-3">
            <Input placeholder="学校" {...register(`educationItems.${index}.school`)} />
            <Input placeholder="专业" {...register(`educationItems.${index}.major`)} />
            <Input placeholder="学历" {...register(`educationItems.${index}.degree`)} />
            <Input type="date" {...register(`educationItems.${index}.startDate`)} />
            <Input type="date" {...register(`educationItems.${index}.endDate`)} />
            <Input placeholder="GPA" {...register(`educationItems.${index}.gpa`)} />
            <Input placeholder="排名" {...register(`educationItems.${index}.ranking`)} />
            <Input placeholder="课程，逗号分隔" {...register(`educationItems.${index}.coursesText`)} />
            <Input placeholder="荣誉，逗号分隔" {...register(`educationItems.${index}.honorsText`)} />
            <Button type="button" variant="destructive" size="sm" onClick={() => education.remove(index)}>
              <Trash2 className="size-4" /> 删除
            </Button>
          </div>
        ))}
      </Module>

      <Module title="技能" onAdd={() => skills.append({ name: "", category: "programming_language", level: "intermediate", evidence: "", yearsOfExperience: "" })}>
        {skills.fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 border-t pt-4 md:grid-cols-5">
            <Input placeholder="技能" {...register(`skillItems.${index}.name`)} />
            <select className="h-9 rounded-md border px-3 text-sm" {...register(`skillItems.${index}.category`)}>
              {skillCategories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="h-9 rounded-md border px-3 text-sm" {...register(`skillItems.${index}.level`)}>
              {skillLevels.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input placeholder="证据" {...register(`skillItems.${index}.evidence`)} />
            <Input type="number" step="0.5" placeholder="年限" {...register(`skillItems.${index}.yearsOfExperience`)} />
            <Button type="button" variant="destructive" size="sm" onClick={() => skills.remove(index)}>
              <Trash2 className="size-4" /> 删除
            </Button>
          </div>
        ))}
      </Module>

      <Module title="项目经历" onAdd={() => projects.append({ name: "", projectType: "", role: "", startDate: "", endDate: "", background: "", goal: "", fullDescription: "", responsibilitiesText: "", techStackText: "", highlightsText: "", challengesText: "", solutionsText: "", engineeringPracticesText: "", results: "", metricsText: "", linksText: "" })}>
        {projects.fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 border-t pt-4 md:grid-cols-2">
            <input type="hidden" {...register(`projectItems.${index}.id`)} />
            <Input placeholder="项目名称" {...register(`projectItems.${index}.name`)} />
            <Input placeholder="项目类型，例如：课程项目" {...register(`projectItems.${index}.projectType`)} />
            <Input placeholder="角色" {...register(`projectItems.${index}.role`)} />
            <Input type="date" {...register(`projectItems.${index}.startDate`)} />
            <Input type="date" {...register(`projectItems.${index}.endDate`)} />
            <Textarea placeholder="背景" {...register(`projectItems.${index}.background`)} />
            <Textarea placeholder="目标" {...register(`projectItems.${index}.goal`)} />
            <Textarea className="md:col-span-2" placeholder="完整项目描述（原文会保留，不会被定制简历覆盖）" {...register(`projectItems.${index}.fullDescription`)} />
            <Input placeholder="职责，逗号分隔" {...register(`projectItems.${index}.responsibilitiesText`)} />
            <Input placeholder="技术栈，逗号分隔" {...register(`projectItems.${index}.techStackText`)} />
            <Input placeholder="亮点，逗号分隔" {...register(`projectItems.${index}.highlightsText`)} />
            <Input placeholder="技术难点，逗号或换行分隔" {...register(`projectItems.${index}.challengesText`)} />
            <Input placeholder="解决方案，逗号或换行分隔" {...register(`projectItems.${index}.solutionsText`)} />
            <Input placeholder="工程实践，逗号或换行分隔" {...register(`projectItems.${index}.engineeringPracticesText`)} />
            <Input placeholder="指标，逗号分隔" {...register(`projectItems.${index}.metricsText`)} />
            <Input placeholder="链接，逗号分隔" {...register(`projectItems.${index}.linksText`)} />
            <Textarea placeholder="结果" {...register(`projectItems.${index}.results`)} />
            <Button type="button" variant="destructive" size="sm" onClick={() => projects.remove(index)}>
              <Trash2 className="size-4" /> 删除
            </Button>
          </div>
        ))}
      </Module>

      <Module title="实习/工作经历" onAdd={() => experiences.append({ company: "", department: "", role: "", employmentType: "internship", startDate: "", endDate: "", responsibilitiesText: "", achievementsText: "", techStackText: "", businessImpact: "", metricsText: "" })}>
        {experiences.fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 border-t pt-4 md:grid-cols-2">
            <Input placeholder="公司" {...register(`experienceItems.${index}.company`)} />
            <Input placeholder="部门" {...register(`experienceItems.${index}.department`)} />
            <Input placeholder="职位" {...register(`experienceItems.${index}.role`)} />
            <select className="h-9 rounded-md border px-3 text-sm" {...register(`experienceItems.${index}.employmentType`)}>
              {employmentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input type="date" {...register(`experienceItems.${index}.startDate`)} />
            <Input type="date" {...register(`experienceItems.${index}.endDate`)} />
            <Input placeholder="职责，逗号分隔" {...register(`experienceItems.${index}.responsibilitiesText`)} />
            <Input placeholder="成果，逗号分隔" {...register(`experienceItems.${index}.achievementsText`)} />
            <Input placeholder="技术栈，逗号分隔" {...register(`experienceItems.${index}.techStackText`)} />
            <Input placeholder="指标，逗号分隔" {...register(`experienceItems.${index}.metricsText`)} />
            <Textarea placeholder="业务影响" {...register(`experienceItems.${index}.businessImpact`)} />
            <Button type="button" variant="destructive" size="sm" onClick={() => experiences.remove(index)}>
              <Trash2 className="size-4" /> 删除
            </Button>
          </div>
        ))}
      </Module>

      <Module title="证书" onAdd={() => certificates.append({ name: "", issuer: "", issuedAt: "", expiresAt: "", credentialUrl: "" })}>
        {certificates.fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 border-t pt-4 md:grid-cols-5">
            <Input placeholder="名称" {...register(`certificateItems.${index}.name`)} />
            <Input placeholder="机构" {...register(`certificateItems.${index}.issuer`)} />
            <Input type="date" {...register(`certificateItems.${index}.issuedAt`)} />
            <Input type="date" {...register(`certificateItems.${index}.expiresAt`)} />
            <Input placeholder="凭证 URL" {...register(`certificateItems.${index}.credentialUrl`)} />
            <Button type="button" variant="destructive" size="sm" onClick={() => certificates.remove(index)}>
              <Trash2 className="size-4" /> 删除
            </Button>
          </div>
        ))}
      </Module>

      <Module title="获奖" onAdd={() => awards.append({ name: "", issuer: "", level: "", awardedAt: "", description: "" })}>
        {awards.fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 border-t pt-4 md:grid-cols-5">
            <Input placeholder="名称" {...register(`awardItems.${index}.name`)} />
            <Input placeholder="机构" {...register(`awardItems.${index}.issuer`)} />
            <Input placeholder="级别" {...register(`awardItems.${index}.level`)} />
            <Input type="date" {...register(`awardItems.${index}.awardedAt`)} />
            <Input placeholder="描述" {...register(`awardItems.${index}.description`)} />
            <Button type="button" variant="destructive" size="sm" onClick={() => awards.remove(index)}>
              <Trash2 className="size-4" /> 删除
            </Button>
          </div>
        ))}
      </Module>

      <Module title="补充材料" onAdd={() => evidence.append({ type: "url", title: "", url: "", description: "", relatedEntityType: "", relatedEntityId: "" })}>
        {evidence.fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 border-t pt-4 md:grid-cols-3">
            <select className="h-9 rounded-md border px-3 text-sm" {...register(`evidenceItems.${index}.type`)}>
              {evidenceTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input placeholder="标题" {...register(`evidenceItems.${index}.title`)} />
            <Input placeholder="URL" {...register(`evidenceItems.${index}.url`)} />
            <Input placeholder="关联类型" {...register(`evidenceItems.${index}.relatedEntityType`)} />
            <Input placeholder="关联 ID" {...register(`evidenceItems.${index}.relatedEntityId`)} />
            <Input placeholder="描述" {...register(`evidenceItems.${index}.description`)} />
            <Button type="button" variant="destructive" size="sm" onClick={() => evidence.remove(index)}>
              <Trash2 className="size-4" /> 删除
            </Button>
          </div>
        ))}
      </Module>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? "保存中" : mode === "create" ? "创建档案" : "保存修改"}
        </Button>
      </div>
    </form>
  );
}
