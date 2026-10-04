import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3, // 3 minutes - renders cached data instantaneously on tab/page switches
      gcTime: 1000 * 60 * 15, // 15 minutes garbage collection time
      retry: 1, // Quick failover without stalling UI
      refetchOnWindowFocus: false, // Prevent jarring loading flickers on window switch
      refetchOnReconnect: true,
    },
  },
});
