# Resume Template Engine

## 架构

- `types/resume.ts` 定义 `ResumeTemplateKey` 和默认键 `minimal`。
- `services/resume-templates/registry.ts` 是模板名称、说明、文件名和照片能力的唯一注册表。
- `services/resume-templates/renderer.ts` 是唯一 Markdown 渲染入口。
- `template/*.md` 保存模板骨架，不包含业务数据或可执行代码。
- `Resume.templateKey` 保存用户选择；无效、废弃或缺失的键统一回退到 `minimal`。

简历正文仍保存在 `Resume.contentMarkdown`。详情预览、Markdown 下载和打印/PDF 页面读取同一条 Resume 记录，并调用 `renderResumeMarkdown`，因此三种输出不会各自拼接简历内容。

## 占位符

模板只支持以下白名单占位符：

| 占位符 | 内容 |
| --- | --- |
| `{{title}}` | 简历标题 |
| `{{name}}` | 职业档案姓名，缺失时回退到简历标题 |
| `{{headline}}` | 目标岗位和目标城市 |
| `{{contactLine}}` | 已填写的电话、邮箱、所在地和公开链接 |
| `{{photo}}` | 证件照区域；当前没有照片数据源，因此输出为空 |
| `{{body}}` | `Resume.contentMarkdown` 正文 |

渲染器只读取注册表中预先声明的文件名，以单次白名单插值完成渲染，不执行 JavaScript、Shell、表达式或用户提供的文件路径。HTML 预览继续使用项目现有的转义渲染器。

## 新增第五个模板

1. 在 `template` 下新增一个 UTF-8 Markdown 文件，只使用上述占位符。
2. 在 `resumeTemplateKeys` 中增加稳定的模板键。
3. 在 `resumeTemplateRegistry` 增加一条元数据定义。
4. 如需新的视觉风格，在 `app/globals.css` 中添加对应的 `data-resume-template` 样式和打印覆盖。
5. 更新注册表与渲染测试。

不需要为每个页面增加新的模板条件分支。

## 证件照行为

当前 Career Profile 没有头像、证件照或图片 URL 字段，本次没有引入上传或图片存储。`photo` 模板在 `{{photo}}` 为空时自动压缩空白并采用无照片页头，不生成图片标签，因此不会出现损坏图片。未来若增加可信照片 URL，可只扩展统一渲染输入和该占位符，不需要改动预览、下载或打印调用链。
