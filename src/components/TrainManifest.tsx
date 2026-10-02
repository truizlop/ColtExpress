import type { Observation, VisibleLoot } from '../game/types';
import { CHARACTER_INFO } from '../game/data';
import { carName } from './TurnControls';
function tokens(loot: VisibleLoot[]) {
  if (!loot.length) return 'No loot';
  const groups = new Map<
    string,
    { kind: VisibleLoot['kind']; value: number | null; count: number }
  >();
  for (const l of loot) {
    const key = l.kind + ':' + l.value,
      g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { kind: l.kind, value: l.value, count: 1 });
  }
  return [...groups.values()]
    .map(
      (g) =>
        `${g.count} ${g.kind === 'purse' ? (g.count === 1 ? 'purse' : 'purses') : g.kind === 'jewel' ? (g.count === 1 ? 'jewel' : 'jewels') : g.count === 1 ? 'strongbox' : 'strongboxes'} · ${g.value === null ? 'hidden value' : `$${g.value} each`}`,
    )
    .join('; ');
}
export function TrainManifest({ o }: { o: Observation }) {
  return (
    <div className="manifest">
      <p>Car 1 is nearest the locomotive. Roof and interior are separate spaces.</p>
      <table>
        <caption>Everyone’s position and the loot on the train</caption>
        <thead>
          <tr>
            <th scope="col">Car</th>
            <th scope="col">Interior</th>
            <th scope="col">Roof</th>
          </tr>
        </thead>
        <tbody>
          {o.cars.map((c, i) => (
            <tr key={i}>
              <th scope="row">{carName(o, i)}</th>
              {([0, 1] as const).map((f) => (
                <td key={f}>
                  <strong>
                    {[
                      ...(f === 0 && o.marshal === i ? ['Marshal'] : []),
                      ...o.bandits
                        .filter((b) => b.car === i && b.floor === f)
                        .map((b) => CHARACTER_INFO[b.character].name),
                    ].join(', ') || 'Unoccupied'}
                  </strong>
                  <span>{tokens(c.loot[f])}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
