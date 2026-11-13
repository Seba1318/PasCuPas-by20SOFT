import { useMemo } from 'react';
import { useMapContext } from './MapContext.jsx';
import MarkersLayer from './MarkersLayer.jsx';

// Punctul albastru „Poziția ta”, după ce utilizatorul a apăsat „Poziția mea”.
export default function UserMarker() {
  const { userPosition } = useMapContext();
  const items = useMemo(
    () => (userPosition ? [{ id: 'user', type: 'user', point: userPosition.point, label: 'Poziția ta' }] : []),
    [userPosition],
  );
  return <MarkersLayer items={items} cluster={false} />;
}
