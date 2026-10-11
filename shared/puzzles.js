// Optional puzzles: a safe or locker with a combination written on a scrap of paper somewhere,
// or switches (valves, books) that must be used in an order given by a clue. Solving one opens a
// stash with supplies and a secret document. The answers are drawn fresh every night.

// size of each kind of stash (along the wall, depth from the wall, height)
export const STASH_SIZE = { safe: [.7, .6, 1.0], cabinet: [.9, .55, 1.9], shelf: [1.4, .45, 2.4], footlocker: [1.0, .5, .55] };

export function stashFootprint(s) {
  const [along, depth] = STASH_SIZE[s.kind] || STASH_SIZE.safe;
  const hx = Math.abs(s.nx) > .5 ? depth / 2 : along / 2, hz = Math.abs(s.nx) > .5 ? along / 2 : depth / 2;
  return { minX: s.x - hx, maxX: s.x + hx, minZ: s.z - hz, maxZ: s.z + hz };
}
// where you stand to use it
export const front = (o, d = .75) => ({ x: o.x + o.nx * d, z: o.z + o.nz * d });

export function makeAnswer(pz, rnd = Math.random) {
  if (pz.type === 'code') { let c = ''; for (let i = 0; i < 4; i++) c += String(Math.floor(rnd() * 10)); return c; }
  const order = pz.switches.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}

// The scrap of paper that gives the answer away.
const CLUES = {
  dutylog: code => ({
    title: 'A torn page from the duty log',
    text: `Night desk, 11 November.

Whoever takes the keys from me tonight: the safe in reception was reset after the inspection. The new combination is ${code}.

The Matron does not know it. Keep it that way, and burn this page.

— Fischer`
  }),
  pressure: (order, pz) => ({
    title: 'Pressure log, boiler room',
    text: `Bleed the system by hand if the gauges climb past the red line. The order matters, or the pipes go again like they did on the 3rd:

${order.map((i, k) => `${k + 1}. the ${pz.switches[i].label}`).join('\n')}

The tool cabinet will not open while the pressure is up. Do not force it.`
  }),
  poem: (order, pz) => ({
    title: 'A poem in a child\'s hand',
    text: `Papa keeps his secrets behind the words.
He showed me once, and made me promise.

First ${pz.switches[order[0]].hint},
then ${pz.switches[order[1]].hint},
and last of all ${pz.switches[order[2]].hint}.

— M.`
  }),
  birthday: code => ({
    title: 'A card tucked into a book',
    text: `For my dear Margarete on her birthday.

I have set the study safe to the day you were born, so I will never forget it: ${code.slice(0, 2)}.${code.slice(2)}.

Your loving father`
  }),
  payroll: code => ({
    title: 'A payroll slip',
    text: `HOLLOW PIT — WEEKLY WAGES, SHIFT C

Paid in full: 0 men. Withheld: 31 men ("transferred to the East Wing").

(On the back, in the foreman's pencil:) Safe ${code}. If they come down here for the books, burn them first.`
  }),
  warning: (order, pz) => ({
    title: 'Enamel warning plate',
    text: `PUMP START-UP. LEVERS IN THIS ORDER ONLY:

${order.map((i, k) => `${k + 1}. ${pz.switches[i].label.toUpperCase()}`).join('\n')}

Wrong order floods the lower level. — Mine Inspectorate`
  }),
  chlorine: code => ({
    title: 'Chlorination log, torn out',
    text: `Chlorine dose, 11 Nov: none. By order of Dr Kessler. "The water is to be left exactly as it is."

(Below, pressed hard into the paper:) The superintendent changed the safe in the gatehouse to ${code} before he went into the filter beds and did not come out. If you find this, take what is in it and open the sluice.`
  }),
  margin: code => ({
    title: 'A map with a scribble in the margin',
    text: `(A field map of the valley, stained with coffee. Someone has written along the edge in pencil:)

Ammo locker, back room — ${code}.
Do not tell the captain. If he finds out we kept back rations he will shoot us himself.`
  })
};
export function clueText(pz, answer) { return CLUES[pz.clue](answer, pz); }

// Documents found only in the stashes. They are kept apart from the regular notes.
export const SECRETS = {
  's-safe': {
    title: 'Sealed envelope: "Serum 115, final"',
    text: `To the Reich Ministry, by courier only.

Serum 115 cannot be recalled once it has entered the water supply. The subjects do not die and do not tire, and they answer to sound and light alone.

Recommendation: the valley is to be closed. The staff are not to be told.

The Matron has volunteered to remain and "keep order". I have no further use for her and have agreed.

— E. K.`
  },
  's-valves': {
    title: 'Behind the tool cabinet',
    text: `(Scratched into the back of the cabinet with a nail:)

she counts us at night
she knows how many beds
if you are reading this you are not in a bed

DON'T LET HER COUNT YOU`
  },
  'e-books': {
    title: 'The doctor\'s confession',
    text: `I brought the serum home in my bag like a box of chocolates.

Margarete had the fever for nine days. On the tenth I gave her one ampoule. She sat up and asked for her doll and I wept like a child.

She has not eaten since. She does not sleep. She stands at the window of her room at night and listens to the garden.

I have locked her door from the outside. God help me, I would do it again.`
  },
  'e-safe': {
    title: 'Deed to the estate',
    text: `The Kessler estate and all grounds, transferred to the Ministry in exchange for "continued research privileges".

In the margin, in a woman's hand: "He sold the house with us still inside it."`
  },
  'm-safe': {
    title: "The foreman's real ledger",
    text: `Barrels received from the sanatorium: 14. Stored in the magazine behind the dynamite, as ordered.

Men sent down from the East Wing: 31. They do not need lamps. They do not need food. They dig until the rock stops them and then they stand very still, facing the wall, until the next shift.

I asked the Doctor what happens when the barrels run out. He said: then we close the mine with them inside.`
  },
  'm-levers': {
    title: 'Under the tool chest',
    text: `(A child's drawing, folded small. A woman in a white cap holding a lantern, walking down a tunnel. Below her, in careful letters:)

THE NURSE COMES DOWN THE SHAFT WHEN THE BELL RINGS
DO NOT RING THE BELL`
  },
  'w-safe': {
    title: 'Her service record',
    text: `MATRON, WOLF HOLLOW SANATORIUM. Thirty-one years' service. Commended twice.

Volunteered for the first trial of Serum 115 so that "no nurse of mine will ask a patient to take what I would not".

Remarks, in Dr Kessler's hand: The subject no longer sleeps. She walks her rounds every night with the lamp, counting beds, though the beds are empty. She does not seem to know she is dead. She will last exactly as long as the serum lasts.`
  },
  'b-locker': {
    title: 'Last orders, unsent',
    text: `To command.

We have held the bunker eleven nights. The dead do not storm it; they wait for us to make a sound. Two men shot themselves rather than listen to the scratching.

There is a woman with a lantern on the road from the sanatorium. She walks past every night at the same hour.

Tonight she stopped and looked at the hatch.`
  }
};
