/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import {
  addExperienceItem,
  addProjectItem,
  createCareerProfile,
  deleteCareerProfile,
  getCareerProfileById,
  updateCareerProfile,
  updateExperienceItem,
  updateProjectItem,
} from "@/services/career-profile-service";
import { createMockGraduateProfile } from "@/services/mock-profile";

type Row = Record<string, any>;

class MockDb {
  profiles: Row[] = [];
  education: Row[] = [];
  skills: Row[] = [];
  projects: Row[] = [];
  experiences: Row[] = [];
  certificates: Row[] = [];
  awards: Row[] = [];
  evidence: Row[] = [];
  seq = 0;

  next(prefix: string) {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  include(profile: Row) {
    return {
      ...profile,
      basicInfo: profile.basicInfo ?? null,
      educationItems: this.education.filter((item) => item.profileId === profile.id),
      skillItems: this.skills.filter((item) => item.profileId === profile.id),
      projectItems: this.projects.filter((item) => item.profileId === profile.id),
      experienceItems: this.experiences.filter((item) => item.profileId === profile.id),
      certificateItems: this.certificates.filter((item) => item.profileId === profile.id),
      awardItems: this.awards.filter((item) => item.profileId === profile.id),
      evidenceItems: this.evidence.filter((item) => item.profileId === profile.id),
    };
  }

  careerProfile = {
    create: async ({ data }: Row) => {
      const id = this.next("profile");
      const profile = {
        id,
        userId: data.userId,
        targetStatus: data.targetStatus,
        targetRoles: data.targetRoles,
        targetCities: data.targetCities,
        expectedSalaryMin: data.expectedSalaryMin,
        expectedSalaryMax: data.expectedSalaryMax,
        personalSummary: data.personalSummary,
        profileCompletenessScore: 0,
        basicInfo: data.basicInfo?.create ? { id: this.next("basic"), ...data.basicInfo.create } : null,
      };
      this.profiles.push(profile);
      this.education.push(...(data.educationItems.create as Row[]).map((item) => ({ id: this.next("edu"), profileId: id, ...item })));
      this.skills.push(...(data.skillItems.create as Row[]).map((item) => ({ id: this.next("skill"), profileId: id, ...item })));
      this.projects.push(...(data.projectItems.create as Row[]).map((item) => ({ id: this.next("project"), profileId: id, ...item })));
      this.experiences.push(...(data.experienceItems.create as Row[]).map((item) => ({ id: this.next("exp"), profileId: id, ...item })));
      this.certificates.push(...(data.certificateItems.create as Row[]).map((item) => ({ id: this.next("cert"), profileId: id, ...item })));
      this.awards.push(...(data.awardItems.create as Row[]).map((item) => ({ id: this.next("award"), profileId: id, ...item })));
      this.evidence.push(...(data.evidenceItems.create as Row[]).map((item) => ({ id: this.next("evidence"), profileId: id, ...item })));
      return this.include(profile);
    },
    findUnique: async ({ where }: Row) => {
      const profile = this.profiles.find((item) => item.id === where.id);
      return profile ? this.include(profile) : null;
    },
    findUniqueOrThrow: async ({ where }: Row) => {
      const profile = this.profiles.find((item) => item.id === where.id);
      if (!profile) throw new Error("Profile not found");
      return this.include(profile);
    },
    update: async ({ where, data }: Row) => {
      const profile = this.profiles.find((item) => item.id === where.id);
      if (!profile) throw new Error("Profile not found");
      Object.assign(profile, data);
      if (data.basicInfo?.upsert) {
        profile.basicInfo = { id: profile.basicInfo?.id ?? this.next("basic"), ...data.basicInfo.upsert.update };
      }
      return this.include(profile);
    },
    delete: async ({ where }: Row) => {
      const index = this.profiles.findIndex((item) => item.id === where.id);
      const [deleted] = this.profiles.splice(index, 1);
      return deleted;
    },
  };

  projectItem = {
    count: async ({ where }: Row) => this.projects.filter(
      (item) => item.profileId === where.profileId &&
        String(item.name).toLocaleLowerCase("zh-CN") === String(where.name.equals).toLocaleLowerCase("zh-CN"),
    ).length,
    create: async ({ data }: Row) => {
      const item = { id: this.next("project"), ...data };
      this.projects.push(item);
      return item;
    },
    update: async ({ where, data }: Row) => {
      const item = this.projects.find((row) => row.id === where.id);
      Object.assign(item!, data);
      return item!;
    },
  };

  experienceItem = {
    create: async ({ data }: Row) => {
      const item = { id: this.next("exp"), ...data };
      this.experiences.push(item);
      return item;
    },
    update: async ({ where, data }: Row) => {
      const item = this.experiences.find((row) => row.id === where.id);
      Object.assign(item!, data);
      return item!;
    },
  };
}

describe("career profile service", () => {
  it("creates, reads, updates and deletes a career profile", async () => {
    const db = new MockDb() as never;
    const created = await createCareerProfile(createMockGraduateProfile("user_1"), db);

    expect(created.profileCompletenessScore).toBe(100);
    expect(await getCareerProfileById(created.id, db)).toMatchObject({ id: created.id });

    const updated = await updateCareerProfile(
      {
        id: created.id,
        targetRoles: ["后端开发工程师"],
        targetCities: ["上海"],
      },
      db,
    );
    expect(updated.targetRoles).toEqual(["后端开发工程师"]);

    await deleteCareerProfile(created.id, db);
    expect(await getCareerProfileById(created.id, db)).toBeNull();
  });

  it("adds and updates project and experience items", async () => {
    const db = new MockDb() as never;
    const created = await createCareerProfile(createMockGraduateProfile("user_1"), db);
    const project = await addProjectItem(
      created.id,
      {
        name: "招聘信息聚合系统",
        role: "后端开发",
        startDate: new Date("2025-11-01"),
        endDate: null,
        background: "",
        goal: "",
        responsibilities: ["接口设计"],
        techStack: ["Java"],
        highlights: ["去重"],
        results: "",
        metrics: [],
        links: [],
      },
      db,
    );

    const updatedProject = await updateProjectItem(
      project.id,
      {
        name: "岗位聚合系统",
        role: "后端开发",
        startDate: new Date("2025-11-01"),
        endDate: null,
        background: "",
        goal: "",
        responsibilities: ["接口设计"],
        techStack: ["Java"],
        highlights: ["去重"],
        results: "",
        metrics: [],
        links: [],
      },
      db,
    );
    expect(updatedProject.name).toBe("岗位聚合系统");

    const experience = await addExperienceItem(
      created.id,
      {
        company: "上海某科技公司",
        department: "平台部",
        role: "后端实习生",
        employmentType: "internship",
        startDate: new Date("2025-07-01"),
        endDate: null,
        responsibilities: ["需求开发"],
        achievements: ["上线接口"],
        techStack: ["Spring Boot"],
        businessImpact: "",
        metrics: [],
      },
      db,
    );
    const updatedExperience = await updateExperienceItem(
      experience.id,
      {
        company: "上海某科技公司",
        department: "平台部",
        role: "Java 后端实习生",
        employmentType: "internship",
        startDate: new Date("2025-07-01"),
        endDate: null,
        responsibilities: ["需求开发"],
        achievements: ["上线接口"],
        techStack: ["Spring Boot"],
        businessImpact: "",
        metrics: [],
      },
      db,
    );
    expect(updatedExperience.role).toBe("Java 后端实习生");
  });
});
