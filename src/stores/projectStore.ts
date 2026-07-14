/**
 * Project store — list, create, select projects.
 */

import { create } from 'zustand';
import type { Project, SurveyType, SurveyOrder } from '@/types';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
} from '@/lib/db/queries';
import { useAuthStore } from './authStore';

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;

  load: () => Promise<void>;
  create: (input: {
    name: string;
    surveyType: SurveyType;
    surveyOrder?: SurveyOrder;
    county?: string;
    subCounty?: string;
    lrNumber?: string;
    clientName?: string;
    clientContact?: string;
  }) => Promise<Project>;
  select: (project: Project) => void;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_CRS = Number(process.env.EXPO_PUBLIC_DEFAULT_CRS_EPSG) || 21037;
const DEFAULT_COUNTRY = process.env.EXPO_PUBLIC_DEFAULT_COUNTRY_PACK || 'KEN';

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await getProjects();
      set({ projects, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  create: async (input) => {
    const auth = useAuthStore.getState();
    if (!auth.profile) throw new Error('Not authenticated');

    const project = await createProject({
      name: input.name,
      surveyType: input.surveyType,
      surveyOrder: input.surveyOrder ?? 'third',
      status: 'draft',
      country: DEFAULT_COUNTRY,
      county: input.county,
      subCounty: input.subCounty,
      lrNumber: input.lrNumber,
      datum: 'ARC1960',
      projection: 'UTM37S',
      crsEpsg: DEFAULT_CRS,
      zone: 37,
      surveyorName: auth.profile.fullName,
      surveyorLicense: auth.profile.iskNumber,
      clientName: input.clientName,
      clientContact: input.clientContact,
    });

    set({ projects: [project, ...get().projects], selectedProject: project });
    return project;
  },

  select: (project) => set({ selectedProject: project }),

  remove: async (id) => {
    await deleteProject(id);
    set({
      projects: get().projects.filter((p) => p.id !== id),
      selectedProject: get().selectedProject?.id === id ? null : get().selectedProject,
    });
  },

  refresh: async () => {
    const projects = await getProjects();
    set({ projects });
  },
}));
