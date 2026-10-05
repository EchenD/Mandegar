export type IntelligencePersonPoint = { id: string; x: number; y: number };
export type IntelligenceStationId = "photo" | "touch" | "stage" | "game" | "draw";
export type IntelligenceStationPoint = { id: IntelligenceStationId; x: number; y: number };

type IntelligenceSnapshot = {
  available: boolean;
  people: readonly IntelligencePersonPoint[];
  hovered: string | null;
  pinned: string | null;
  stations: readonly IntelligenceStationPoint[];
  hoveredStation: IntelligenceStationId | null;
  pinnedStation: IntelligenceStationId | null;
};

const emptySnapshot: IntelligenceSnapshot = {
  available: false, people: [], hovered: null, pinned: null,
  stations: [], hoveredStation: null, pinnedStation: null,
};
let snapshot = emptySnapshot;
const listeners = new Set<() => void>();

function publish(next: IntelligenceSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function subscribeIntelligenceInspector(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getIntelligenceSnapshot() { return snapshot; }
export function getEmptyIntelligenceSnapshot() { return emptySnapshot; }
export function getFocusedIntelligencePerson() { return snapshot.pinned ?? snapshot.hovered; }
export function getFocusedIntelligenceStation() { return snapshot.pinnedStation ?? snapshot.hoveredStation; }

export function updateIntelligencePeople(people: readonly IntelligencePersonPoint[] | null) {
  if (!people) {
    if (snapshot !== emptySnapshot) publish(emptySnapshot);
    return;
  }
  const changed = !snapshot.available || people.length !== snapshot.people.length
    || people.some((person, index) => {
      const previous = snapshot.people[index];
      return !previous || person.id !== previous.id || Math.abs(person.x - previous.x) >= 2 || Math.abs(person.y - previous.y) >= 2;
    });
  if (!changed) return;
  publish({
    ...snapshot,
    available: true,
    people,
    hovered: snapshot.hovered,
    pinned: snapshot.pinned,
  });
}

export function hoverIntelligencePerson(id: string | null) {
  if (!snapshot.available || snapshot.hovered === id) return;
  if (id && snapshot.pinnedStation) return;
  publish({ ...snapshot, hovered: id, ...(id ? { hoveredStation: null } : {}) });
}

export function pinIntelligencePerson(id: string) {
  if (!snapshot.available) return;
  publish({ ...snapshot, hovered: null, pinned: snapshot.pinned === id ? null : id, hoveredStation: null, pinnedStation: null });
}

export function clearIntelligenceSelection() {
  if (!snapshot.hovered && !snapshot.pinned && !snapshot.hoveredStation && !snapshot.pinnedStation) return;
  publish({ ...snapshot, hovered: null, pinned: null, hoveredStation: null, pinnedStation: null });
}

export function cycleIntelligencePerson(direction: -1 | 1) {
  if (!snapshot.available || snapshot.people.length === 0) return;
  const index = snapshot.people.findIndex((person) => person.id === getFocusedIntelligencePerson());
  const next = index < 0 ? 0 : (index + direction + snapshot.people.length) % snapshot.people.length;
  publish({ ...snapshot, hovered: null, pinned: snapshot.people[next].id, hoveredStation: null, pinnedStation: null });
}

export function updateIntelligenceStations(stations: readonly IntelligenceStationPoint[]) {
  const changed = stations.length !== snapshot.stations.length || stations.some((station, index) => {
    const previous = snapshot.stations[index];
    return !previous || station.id !== previous.id || Math.abs(station.x - previous.x) >= 2 || Math.abs(station.y - previous.y) >= 2;
  });
  if (!changed) return;
  const present = (id: IntelligenceStationId | null) => id && stations.some((station) => station.id === id) ? id : null;
  publish({ ...snapshot, stations, hoveredStation: present(snapshot.hoveredStation), pinnedStation: present(snapshot.pinnedStation) });
}

export function hoverIntelligenceStation(id: IntelligenceStationId | null) {
  if (!snapshot.available || snapshot.hoveredStation === id) return;
  if (id && snapshot.pinned) return;
  publish({ ...snapshot, hoveredStation: id, ...(id ? { hovered: null } : {}) });
}

export function pinIntelligenceStation(id: IntelligenceStationId) {
  if (!snapshot.available || !snapshot.stations.some((station) => station.id === id)) return;
  publish({ ...snapshot, hovered: null, pinned: null, hoveredStation: null, pinnedStation: snapshot.pinnedStation === id ? null : id });
}

export function cycleIntelligenceStation(direction: -1 | 1) {
  if (!snapshot.available || snapshot.stations.length === 0) return;
  const index = snapshot.stations.findIndex((station) => station.id === getFocusedIntelligenceStation());
  const next = index < 0 ? 0 : (index + direction + snapshot.stations.length) % snapshot.stations.length;
  publish({ ...snapshot, hovered: null, pinned: null, hoveredStation: null, pinnedStation: snapshot.stations[next].id });
}
