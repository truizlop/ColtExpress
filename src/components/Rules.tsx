import { CHARACTERS, CHARACTER_INFO, EVENT_INFO } from '../game/data';
export function Rules() {
  return (
    <div className="rules-content">
      <p>
        Become the richest bandit after five rounds. Collect purses, $500 jewels and $1,000
        strongboxes. The bandit who fires the most bullets earns a $1,000 Gunslinger bonus; everyone
        tied for most shots gets it.
      </p>
      <h3>1. Schemin’</h3>
      <p>
        On your turn, play one action from your hand or draw three cards. The whole table programs a
        shared queue. Choose the action now; choose its destination or target when it resolves.
      </p>
      <ul>
        <li>
          <strong>Standard:</strong> play face up.
        </li>
        <li>
          <strong>Tunnel:</strong> play face down. Others cannot see your action.
        </li>
        <li>
          <strong>Speeding up:</strong> take two turns in a row.
        </li>
        <li>
          <strong>Switching:</strong> play counterclockwise, starting with the first player.
        </li>
      </ul>
      <h3>2. Stealin’</h3>
      <p>
        Cards resolve in the exact order they were played. You must carry out an action if possible.
        If the situation has changed and there is no legal target, that card has no effect.
      </p>
      <dl>
        <dt>Move</dt>
        <dd>Inside: one adjacent car. On the roof: one to three cars. You must move.</dd>
        <dt>Climb</dt>
        <dd>Change between the roof and interior of your current car.</dd>
        <dt>Shoot</dt>
        <dd>
          Inside: shoot into an adjacent car. On a roof: shoot the nearest occupied roof in either
          direction. Give the target one bullet from your six-shot cylinder.
        </dd>
        <dt>Punch</dt>
        <dd>
          Choose a bandit in your space, make them drop one loot token, and push them into an
          adjacent car on the same floor.
        </dd>
        <dt>Loot</dt>
        <dd>
          Take one token from your space. Unknown purse values remain hidden until you take them.
        </dd>
        <dt>Marshal</dt>
        <dd>
          Move the Marshal into an adjacent car. Bandits there flee to the roof and receive a
          neutral bullet. The Marshal never goes onto a roof.
        </dd>
      </dl>
      <h3>Bullets & hidden information</h3>
      <p>
        Bullet cards clog your hand and cannot be played. You can fire six shots for the entire
        game. Purses are worth $250–$500. You know your own purse values, and remember any you
        previously owned; opponents’ unknown values stay hidden. Their remaining hands and future
        round cards also stay hidden.
      </p>
      <h3>Six different bandits</h3>
      {CHARACTERS.map((c) => (
        <p key={c}>
          <strong>{CHARACTER_INFO[c].name}.</strong> {CHARACTER_INFO[c].power}
        </p>
      ))}
      <details>
        <summary>Round events</summary>
        {Object.entries(EVENT_INFO)
          .filter(([k]) => k !== 'none')
          .map(([k, v]) => (
            <p key={k}>
              <strong>{v.name}.</strong> {v.description}
            </p>
          ))}
      </details>
      <details>
        <summary>Two-player duel</summary>
        <p>
          Each player controls two bandits with an 11-card shared deck. Choose one opening card,
          then draw six more (seven if your team includes Doc). When you play a Shoot card face up
          on a standard turn, you may immediately play one non-Marshal card belonging to your other
          bandit. This extra card does not trigger another cover action. Friendly shots are legal
          but do not count toward the team Gunslinger award. Your two bandits’ loot is added
          together.
        </p>
      </details>
      <details>
        <summary>Expert decks & ties</summary>
        <p>
          With expert rules, you may keep unplayed cards between rounds. Other cards enter your
          discard pile. Recycle that pile when your deck runs out. With standard rules, all your
          cards are shuffled together each round. At the end, tied wealth is broken by fewer
          received bullets; a further tie is a shared victory.
        </p>
      </details>
      <details>
        <summary>Controls</summary>
        <p>
          Drag the 3D train to rotate it. Scroll or pinch to zoom. Use the arrows to focus on a
          carriage and “Fit train” to see the whole board. You can select destinations using the
          train or the large action buttons. All game decisions are accessible with a keyboard. Your
          game saves in this browser.
        </p>
      </details>
      <p className="rules-credit">
        Fan implementation of the 2016 advanced base game. Game design by Christophe Raimbault,
        published by Ludonaute. Original illustrations for this app.{' '}
        <a
          href="https://www.ludonaute.fr/en/colt-express-downloads/"
          target="_blank"
          rel="noreferrer"
        >
          Official rules & resources
        </a>
        .
      </p>
    </div>
  );
}
