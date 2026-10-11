# Bunker 115

A PS2-era survival horror shooter for the browser. Five nights, five ways out, alone or with up to three friends over your own server.

The dead are not omniscient: they hear gunshots, sprinting and hammering, and they see your flashlight. Some lie still until you turn your back, some kneel over a body feeding, some cling to the ceiling. They spread out to surround you, stumble, grab hold of you, and look around before they give up. Nothing you carry can kill the Matron, not until the last night. She is slower than you, but she carries a lantern through the dark, remembers where she lost you, and checks the lockers.

## The dead

- **Walkers** shamble and lurch, no two quite alike. They swipe, grab (you slow down while held) or bite.
- **Thin ones** are fast. Shine your light in their eyes and they shield their faces for a moment.
- **Bloaters** burst into a cloud of gas.
- **Screamers** do not fight: when one sees you it howls, and everything nearby comes. Then it runs.
- **Brutes** in straitjackets charge in a straight line, smash through barricades and stagger if they hit a wall.
- **Weepers** crouch in corners, crying. Leave them be: get close or put your light on one and she comes for you, once.
- **The Matron**, tall, masked, with her lantern. Shooting her only puts her down for a few seconds. Only on the last night, once the serum is gone, can she die.

## Run locally

```bash
npm install
npm start          # http://localhost:8115/
```

Without the server (for example from a static host) only single player works; the simulation then runs in the page.

## Maps

- **Wolf Hollow Sanatorium:** find three fuses, restore power in the boiler room, radio for help, survive until the truck arrives, then run for the courtyard gate.
- **Kessler Estate:** find two fuel cans and the car keys in the locked study, crank the engine in the garage while the noise brings everything in, then drive away.
- **The Bunker:** hold out until dawn, then leave through the east hatch.
- **Hollow Pit Mine:** two hundred metres down with the lift gone. Find three sticks of dynamite and the blasting machine, pack the charges into the blocked drift, fire them from the haulage way, wait out the dust, and climb out.
- **Wolf Hollow Waterworks (the last night):** the serum went into the valley's water here. Find a valve handwheel, drain the three serum tanks (the last one in the locked dosing laboratory), open the main sluice and survive while the works flush. Then the Matron can die: she has to fall three times, getting up weaker each time, and her lantern burns lower. Walk out through the yard gate to the epilogue and the credits.

Each map hides documents (8, 5, 3, 5 and 5) that tell what happened in Wolf Hollow. Reading all of them changes that night's ending; reading every document of every night, at any time, changes the epilogue after the last night.

## Combat

The dead are tough but not bullet sponges: about four pistol rounds at dusk, eight near dawn. Pistols and SMGs lose bite at range and shotguns are useless beyond a few metres; rifles and the MG42 go through bodies. A heavy hit staggers them and breaks off their swing; a shot in the leg makes them limp. Each gun kicks its own way and settles when you let go. A tactical reload is quicker and leaves a round in the chamber; the trench gun loads a shell at a time and you can fire mid-reload. Every blow is wound up first: step back or shove (V) in time and it never lands.

## Checkpoints

Each night has a checkpoint: when the power comes back in the sanatorium, when you have the car keys on the estate, half way through the night in the bunker, once the charges are set in the mine, and when the sluice opens at the waterworks. If everyone dies after it, you can return to it, twice a night (in co-op the host decides). The objective, the items and your health go back to how they were; what you paid for stays paid for: doors you opened stay open, and you keep your points and guns. An escape that needed a checkpoint does not set a record.

## Every night is different

Each night draws two conditions (three on Nightmare): thick fog, a failing generator, a storm whose thunder covers your noise, the Matron arriving early, scarce batteries, restless dead, more weepers, or part of the building collapsed. The opening card says what tonight is like. Weepers, extra bodies and the scraps of paper below move around from night to night.

## Secrets

Every map hides optional stashes with weapons, supplies and a secret document:

- **Combination locks.** The safe in the sanatorium reception, the study safe on the estate, the ammo locker in the bunker. The four-digit combination changes every night and is written on a scrap of paper lying somewhere on the map. Press F at the lock and type it in. A wrong number rattles the handle loudly.
- **Switches in order.** Three valves in the sanatorium boiler room open the tool cabinet; three books on the estate's library shelves move a bookcase. The order changes every night; a clue somewhere on the map gives it away. The wrong order makes a lot of noise.

Scraps and secret documents go into the journal (J). Secret documents do not count toward the endings.

## Features

- Three difficulty levels (Easy, Normal, Nightmare) that scale damage, healing, battery life, the director and the Matron.
- Hiding in lockers, a stalker that searches them, hallucinations that grow with fear, a flashlight with a battery.
- Journal of found documents (J), endings that depend on who escaped and what you found.
- Settings: volume, music, brightness, field of view, sensitivity, invert Y, picture resolution (or Auto, which follows the frame rate), hallucinations, hints, captions for important sounds, FPS counter, and a sound check.
- Gamepad support (standard Xbox / PlayStation layout).
- Achievements, best escape times per map and difficulty, and a shared hall of survivors on the server.

## Co-op

1. One player presses **Host co-op game** and gets a 4-character code.
2. The others enter the code and press **Join**.
3. The host picks the map and difficulty and presses **Start**.

If the connection drops the game reconnects on its own. The server keeps a player's seat for 60 seconds.

## Deploy to Proxmox

The game runs in its own LXC container. On your machine:

```bash
npm run pack
scp bunkier-115.tar.gz deploy/install.sh root@<proxmox host>:/root/
```

On the Proxmox host:

```bash
bash /root/install.sh
```

The first run asks for a free IP address for the container (with its prefix, e.g. `192.168.1.50/24`) and your router's address as the gateway. You can also pass them: `IP=192.168.1.50/24 GW=192.168.1.1 bash /root/install.sh`. The container gets the next free number and the hostname `bunkier`; later runs find it by that name (or pass `CTID=...`).

The script creates the container (Debian 13, 1 vCPU, 512 MB RAM, 4 GB), installs Node and runs the `bunkier` service on port 8115. Escape records are kept in `/var/lib/bunkier`, which survives updates. Running the script again only updates the game.

### Exposing it to the internet

The script prepares the container for that:

- **Server password.** A random one is generated and printed on the first install (or pass `PASSWORD=...`). It is stored in `/etc/bunkier/env` in the container. Without it the server shows only a login page: no game, no records, no co-op. After logging in, the browser stays logged in for 30 days; changing the password logs everybody out. Ten wrong attempts lock an address out for 15 minutes. `NO_PASSWORD=1` turns it off.
- **Limits.** 8 games at once, 40 connections, 6 per address, a message rate limit per connection, one record submission per address every 30 s. Adjust with `MAX_ROOMS`, `MAX_CONNECTIONS`, `MAX_PER_IP` in `/etc/bunkier/env`.
- **Container firewall** (`/etc/pve/firewall/<CTID>.fw`). Incoming traffic is allowed only on 8115. Outgoing traffic may go to the internet for updates but not to the home network (DNS on the router excepted). The rules only work when the datacenter firewall is on: the script warns if it is off, and `ENABLE_DC_FW=1` switches it on with an ACCEPT policy so nothing else changes.
- **Unattended security updates**, with the game restarted after package updates.
- **systemd sandboxing:** the service cannot write its own code and runs with no capabilities, limited memory and task count.

Then forward TCP port 8115 on the router to the container and give friends `http://<your public IP>:8115/` and the password.

## Controls

| Key | Gamepad | Action |
|---|---|---|
| WASD | left stick | move (walking is quieter) |
| Shift | L3 | sprint (loud) |
| Space | A | jump |
| LMB / RMB | RT / LT | fire / aim |
| R | | reload |
| F | X | use, pick up, hide; hold: board up a window, revive a teammate |
| L | LB | flashlight (drains the battery, makes you visible) |
| G / V | RB / B | grenade / shove and slash (breaks a grab, stops a blow; from behind, an unaware one dies quietly) |
| 1, 2, Q, wheel | Y | switch weapon |
| J | Back | journal |
| Tab | D-pad up | show which way to go |
| Esc, P | Start | pause |

## Layout

- `shared/`: the simulation (objectives, the director that paces the night, hearing and sight, hiding and searching, navigation, difficulty), shared by the server and single player. Maps live in `shared/maps/`, documents and endings in `shared/story.js`.
- `server/`: HTTP + WebSocket server, game rooms and the hall of survivors (`records.js`).
- `client/`: rendering (three.js 0.128, per-vertex lighting, vertex snapping, dithering), HUD, fear and hallucinations, settings, gamepad, achievements, and WebAudio sound with tension-driven music.
- `tools/`: `npm test` plays every map with bots and checks every mechanic; `node tools/browser-test.mjs solo|visual|story|over|coop|chaos|login|puzzle|checkpoint|combat|finale` drives the real client in headless Chrome (needs the server running); `node tools/gallery.mjs teammates|zombies|poses|matron|rooms` takes screenshots of characters and rooms; `node tools/perf.mjs` reports frame rate and draw calls per map.
- `v1-bunkier115.html`: the first prototype, a single self-contained page from before the server and the story existed. Open it directly in a browser.

## License

Public domain, see [LICENSE](LICENSE) ([The Unlicense](https://unlicense.org/)).
