import { useQuery } from '@tanstack/react-query';
import { fetchHealth, type HealthCheckData } from '../services/health.service';

export function useHealthCheck(refetchInterval = 15000) {
  return useQuery<HealthCheckData, Error>({
    queryKey: ['system-health'],
    queryFn: fetchHealth,
    refetchInterval,
    retry: 1,
  });
}
