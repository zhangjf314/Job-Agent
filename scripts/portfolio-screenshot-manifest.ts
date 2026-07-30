export const PORTFOLIO_SCREENSHOTS = [
  { filename: "01-dashboard.png", path: "/dashboard" },
  { filename: "02-resume-center.png", path: "/resume" },
  { filename: "03-resume-detail.png", path: "/resume/portfolio-demo-base-resume-v1" },
  { filename: "04-jd-analysis.png", path: "/jd/portfolio-demo-jd-analysis-v1" },
  {
    filename: "05-tailored-resume.png",
    path: "/resume/portfolio-demo-tailored-resume-v1",
    selector: "[data-portfolio-tailored-resume-content]",
  },
  {
    filename: "06-application-materials.png",
    path: "/resume/portfolio-demo-tailored-resume-v1",
    selector: "[data-portfolio-application-materials]",
  },
  { filename: "07-career-strategy.png", path: "/strategy/portfolio-demo-strategy-v1" },
  { filename: "08-application-workbench.png", path: "/applications/pipeline" },
  { filename: "09-ai-settings.png", path: "/settings/ai" },
  {
    filename: "10-evaluation.png",
    path: "/evaluation",
    selector: "[data-portfolio-evaluation-calls]",
  },
] as const;
