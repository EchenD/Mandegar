export type IntelligencePersonPoint = { id: string; x: number; y: number };

type IntelligenceSnapshot = {
  available: boolean;
  people: readonly IntelligencePersonPoint[];
  hovered: string | null;
  pinned: string | null;
};

const emptySnapshot: IntelligenceSnapshot = { available: false, people: [], hovered: null, pinned: null };
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
    available: true,
    people,
    hovered: snapshot.hovered,
    pinned: snapshot.pinned,
  });
}

export function hoverIntelligencePerson(id: string | null) {
  if (!snapshot.available || snapshot.hovered === id) return;
  publish({ ...snapshot, hovered: id });
}

export function pinIntelligencePerson(id: string) {
  if (!snapshot.available) return;
  publish({ ...snapshot, hovered: null, pinned: snapshot.pinned === id ? null : id });
}

export function clearIntelligenceSelection() {
  if (!snapshot.hovered && !snapshot.pinned) return;
  publish({ ...snapshot, hovered: null, pinned: null });
}

export function cycleIntelligencePerson(direction: -1 | 1) {
  if (!snapshot.available || snapshot.people.length === 0) return;
  const index = snapshot.people.findIndex((person) => person.id === getFocusedIntelligencePerson());
  const next = index < 0 ? 0 : (index + direction + snapshot.people.length) % snapshot.people.length;
  publish({ ...snapshot, hovered: null, pinned: snapshot.people[next].id });
}
