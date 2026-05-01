import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const useOrgSummary = () =>
  useQuery({ queryKey: ['org', 'summary'], queryFn: api.orgSummary });

export const useOrgIdleSeats = (product?: string) =>
  useQuery({
    queryKey: ['org', 'idle-seats', product],
    queryFn: () => api.orgIdleSeats(product),
  });

export const useOrgTrend = (months?: number, groupBy?: string) =>
  useQuery({
    queryKey: ['org', 'trend', months, groupBy],
    queryFn: () => api.orgTrend(months, groupBy),
  });

export const useDevelopers = (params: { month?: string; team?: string; sort?: string } = {}) =>
  useQuery({
    queryKey: ['developers', params],
    queryFn: () => api.developers(params),
  });

export const useDeveloper = (username: string, months?: number) =>
  useQuery({
    queryKey: ['developer', username, months],
    queryFn: () => api.developer(username, months),
    enabled: !!username,
  });

export const useTeams = (month?: string) =>
  useQuery({ queryKey: ['teams', month], queryFn: () => api.teams(month) });

export const useTeam = (teamName: string, months?: number) =>
  useQuery({
    queryKey: ['team', teamName, months],
    queryFn: () => api.team(teamName, months),
    enabled: !!teamName,
  });

export const useGithubModels = (month?: string) =>
  useQuery({
    queryKey: ['products', 'github', 'models', month],
    queryFn: () => api.githubModels(month),
  });

export const useAcceptanceVsCost = () =>
  useQuery({
    queryKey: ['products', 'github', 'acceptance-vs-cost'],
    queryFn: api.acceptanceVsCost,
  });

export const useM365Heatmap = () =>
  useQuery({ queryKey: ['products', 'm365', 'heatmap'], queryFn: api.m365Heatmap });

export const useM365Breadth = () =>
  useQuery({ queryKey: ['products', 'm365', 'breadth'], queryFn: api.m365Breadth });

export const usePipelineStatus = () =>
  useQuery({
    queryKey: ['meta', 'pipeline-status'],
    queryFn: api.pipelineStatus,
    refetchInterval: 10_000,
  });

export const useApiDrift = (since?: string) =>
  useQuery({
    queryKey: ['meta', 'api-drift', since],
    queryFn: () => api.apiDrift(since),
  });

export const useHashingStatus = () =>
  useQuery({ queryKey: ['meta', 'hashing-status'], queryFn: api.hashingStatus });

export const useTriggerPipeline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pipeline: string) => api.triggerPipeline(pipeline),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['meta', 'pipeline-status'] });
    },
  });
};
