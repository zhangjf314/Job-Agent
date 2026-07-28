import { listResumeTemplates, resolveResumeTemplateKey } from "@/services/resume-templates/registry";

export function ResumeTemplateSelector({
  defaultValue,
  name = "templateKey",
}: {
  defaultValue?: string | null;
  name?: string;
}) {
  const selected = resolveResumeTemplateKey(defaultValue);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">选择简历模板</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {listResumeTemplates().map((template) => (
          <label
            key={template.key}
            className="relative flex cursor-pointer gap-3 rounded-lg border border-border p-4 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary"
          >
            <input
              type="radio"
              name={name}
              value={template.key}
              defaultChecked={template.key === selected}
              className="mt-1"
            />
            <span className="space-y-1">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {template.name}
                {template.supportsPhoto ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    支持证件照
                  </span>
                ) : null}
              </span>
              <span className="block text-xs leading-5 text-muted-foreground">{template.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
