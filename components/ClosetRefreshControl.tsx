import { useCallback, useState } from 'react';
import { Alert, RefreshControl } from 'react-native';
import { useCloset } from '@/lib/closet';
import { palette } from '@/components/StyleoutUI';

export function ClosetRefreshControl() {
  const { refreshCloset } = useCloset();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshCloset();
    } catch (error) {
      Alert.alert('Refresh failed', error instanceof Error ? error.message : 'Your Styleout data could not be refreshed.');
    } finally {
      setRefreshing(false);
    }
  }, [refreshCloset, refreshing]);

  return <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.ink} colors={[palette.ink]} progressBackgroundColor="#FFFFFF" />;
}
