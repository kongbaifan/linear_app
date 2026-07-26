// Virtual codebase the agent works against. Lives in the store so that
// approved changes persist and later tasks see the updated code.

export const initialCodebase: Record<string, string> = {
  'client/src/views/RideHistory/useRideHistory.ts': `import { useComputed } from '@ride/reactive'
import { ridesAwaitingPickup, ridesInProgress, completedRides } from './rideStore'

export interface RideSection {
  title: string
  rideIds: string[]
}

// Build sections from ride history state
export function useRideHistory() {
  const waitingStatusById: Map<string, string> = useComputed(() => {
    const map = new Map<string, string>()
    for (const ride of ridesAwaitingPickup) {
      map.set(ride.id, 'Driver en route')
    }
    for (const ride of ridesInProgress) {
      map.set(ride.id, 'Trip in progress')
    }
    return map
  })

  const sections: RideSection[] = useComputed(() => [
    { title: 'Active', rideIds: [...waitingStatusById.keys()] },
    { title: 'Past', rideIds: completedRides.map((r) => r.id) },
  ])

  return { sections, waitingStatusById }
}
`,
  'client/src/views/RideHistory/RideHistoryPage.tsx': `import styled from 'styled-components'
import { useRideHistory } from './useRideHistory'
import { RideCard } from './RideCard'

const Card = styled.div\`
  border-radius: 10px;
  padding: 14px 16px;
  background-color: \${(props) => props.theme.color.bgBase};
  box-shadow: none;
  opacity: 1;
\`

export function RideHistoryPage() {
  const { sections, waitingStatusById } = useRideHistory()

  return (
    <main>
      {sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.rideIds.map((id) => (
            <Card key={id}>
              <RideCard rideId={id} byline={waitingStatusById.get(id)} />
            </Card>
          ))}
        </section>
      ))}
    </main>
  )
}
`,
  'client/src/startup/AppBoot.swift': `import UIKit

final class AppBoot {
    static let shared = AppBoot()

    func launch(window: UIWindow) {
        let store = RideStore.shared

        // Block until the full vehicle_state payload has been refreshed.
        store.refreshVehicleState(mode: .full)
        store.waitUntilSynced()

        window.rootViewController = HomeViewController(store: store)
        window.makeKeyAndVisible()
    }

    func warmCaches() {
        MapTileCache.shared.preload(region: .lastKnown)
        ReceiptCache.shared.trim(olderThanDays: 30)
    }
}
`,
}
