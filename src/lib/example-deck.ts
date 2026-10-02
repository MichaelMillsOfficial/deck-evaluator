/**
 * The decklist populated by the "Load Example" button on the import form.
 *
 * This is a complete, format-legal 100-card Commander deck: Atraxa, Praetors'
 * Voice (a +1/+1 counters / superfriends proliferate shell) as the commander
 * plus a 99-card singleton mainboard. Keeping it a legal deck means loading the
 * example walks the user through the full journey (import → ritual → reading)
 * with real validation, meta, and synergy output rather than a truncated stub.
 *
 * The `MAINBOARD:` header is required: the parser does not reset the active
 * zone on blank lines, so without it every card would fall into the commander
 * zone. See tests/unit/example-deck.spec.ts for the legality guardrails.
 */
export const EXAMPLE_DECKLIST = `COMMANDER:
1 Atraxa, Praetors' Voice

MAINBOARD:
1 Sol Ring
1 Arcane Signet
1 Fellwar Stone
1 Chromatic Lantern
1 Birds of Paradise
1 Sakura-Tribe Elder
1 Cultivate
1 Kodama's Reach
1 Farseek
1 Nature's Lore
1 Solemn Simulacrum
1 Deepglow Skate
1 Evolution Sage
1 Flux Channeler
1 Inexorable Tide
1 Doubling Season
1 Tezzeret's Gambit
1 Contentious Plan
1 Karn's Bastion
1 Teferi, Hero of Dominaria
1 Nissa, Voice of Zendikar
1 Vraska, Golgari Queen
1 Kaya, Orzhov Usurper
1 Sorin, Lord of Innistrad
1 Ajani, Mentor of Heroes
1 Elspeth, Sun's Champion
1 Garruk Wildspeaker
1 Vraska, Relic Seeker
1 Kiora, the Crashing Wave
1 Karn, Scion of Urza
1 Swords to Plowshares
1 Path to Exile
1 Counterspell
1 Beast Within
1 Anguished Unmaking
1 Assassin's Trophy
1 Despark
1 Generous Gift
1 Cyclonic Rift
1 Damnation
1 Supreme Verdict
1 Toxic Deluge
1 Vraska's Contempt
1 Return to Dust
1 Sign in Blood
1 Night's Whisper
1 Painful Truths
1 Read the Bones
1 Eternal Witness
1 Oracle of Mul Daya
1 Grand Abolisher
1 Karmic Guide
1 Reveillark
1 Merciless Eviction
1 Migration Path
1 Bloom Tender
1 Plains
1 Plains
1 Plains
1 Island
1 Island
1 Island
1 Swamp
1 Swamp
1 Swamp
1 Forest
1 Forest
1 Forest
1 Command Tower
1 Exotic Orchard
1 Path of Ancestry
1 Arcane Sanctum
1 Sandsteppe Citadel
1 Seaside Citadel
1 Opulent Palace
1 Llanowar Wastes
1 Yavimaya Coast
1 Underground River
1 Caves of Koilos
1 Adarkar Wastes
1 Sunpetal Grove
1 Woodland Cemetery
1 Isolated Chapel
1 Drowned Catacomb
1 Glacial Fortress
1 Hinterland Harbor
1 Godless Shrine
1 Breeding Pool
1 Watery Grave
1 Temple Garden
1 Hallowed Fountain
1 Overgrown Tomb
1 Reflecting Pool
1 Bojuka Bog
1 Reliquary Tower
1 Myriad Landscape
1 Krosan Verge
1 Terramorphic Expanse
1 Evolving Wilds`;
