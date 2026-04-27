export interface KnownCombo {
  id: string;
  cards: string[];
  description: string;
  type: "infinite" | "wincon" | "lock" | "value";
  /** Override assembly zone requirements for specific pieces (default: hand or battlefield). */
  zoneRequirements?: Record<string, string[]>;
}

export const KNOWN_COMBOS: KnownCombo[] = [
  // --- Win Conditions ---
  {
    id: "thassas-oracle-consultation",
    cards: ["Thassa's Oracle", "Demonic Consultation"],
    description: "Exile entire library with Consultation, then win with Oracle's ETB trigger",
    type: "wincon",
  },
  {
    id: "thassas-oracle-tainted-pact",
    cards: ["Thassa's Oracle", "Tainted Pact"],
    description: "Exile entire library with Tainted Pact (singleton deck), then win with Oracle's ETB trigger",
    type: "wincon",
  },
  {
    id: "lab-man-consultation",
    cards: ["Laboratory Maniac", "Demonic Consultation"],
    description: "Exile entire library with Consultation, then draw to win with Lab Man",
    type: "wincon",
  },

  // --- Infinite Combos ---
  {
    id: "dramatic-isochron",
    cards: ["Dramatic Reversal", "Isochron Scepter"],
    description: "Infinite mana and untaps with 3+ mana from nonland sources",
    type: "infinite",
  },
  {
    id: "mikaeus-triskelion",
    cards: ["Mikaeus, the Unhallowed", "Triskelion"],
    description: "Infinite damage: Triskelion removes counters to deal damage, undying returns it",
    type: "infinite",
  },
  {
    id: "mikaeus-ballista",
    cards: ["Mikaeus, the Unhallowed", "Walking Ballista"],
    description: "Infinite damage: Ballista enters with undying counter, removes it to deal damage, dies, returns",
    type: "infinite",
  },
  {
    id: "kiki-conscripts",
    cards: ["Kiki-Jiki, Mirror Breaker", "Zealous Conscripts"],
    description: "Infinite hasty token copies: Conscripts untaps Kiki-Jiki on ETB",
    type: "infinite",
  },
  {
    id: "kiki-felidar",
    cards: ["Kiki-Jiki, Mirror Breaker", "Felidar Guardian"],
    description: "Infinite hasty token copies: Guardian blinks Kiki-Jiki on ETB",
    type: "infinite",
  },
  {
    id: "splinter-twin-exarch",
    cards: ["Splinter Twin", "Deceiver Exarch"],
    description: "Infinite hasty token copies: Exarch untaps enchanted creature on ETB",
    type: "infinite",
  },
  {
    id: "exquisite-sanguine",
    cards: ["Exquisite Blood", "Sanguine Bond"],
    description: "Infinite life drain loop: each trigger causes the other to trigger",
    type: "infinite",
  },
  {
    id: "deadeye-peregrine",
    cards: ["Deadeye Navigator", "Peregrine Drake"],
    description: "Infinite mana: blink Drake to untap 5 lands, soulbond re-establishes",
    type: "infinite",
  },
  {
    id: "ghostly-archaeomancer-peregrine",
    cards: ["Ghostly Flicker", "Archaeomancer", "Peregrine Drake"],
    description: "Infinite mana: Flicker Drake and Archaeomancer, return Flicker, repeat",
    type: "infinite",
  },
  {
    id: "worldgorger-animate-dead",
    cards: ["Worldgorger Dragon", "Animate Dead"],
    description: "Infinite mana and ETB triggers: Dragon exiles all, Animate Dead returns Dragon in loop",
    type: "infinite",
    zoneRequirements: {
      "Worldgorger Dragon": ["graveyard"],
    },
  },
  {
    id: "heliod-ballista",
    cards: ["Heliod, Sun-Crowned", "Walking Ballista"],
    description: "Infinite damage: Heliod gives Ballista lifelink, life gain adds counter, remove to deal damage",
    type: "infinite",
  },
  {
    id: "sword-meek-thopter-foundry",
    cards: ["Sword of the Meek", "Thopter Foundry"],
    description: "Infinite thopters and life for each mana spent: sacrifice Sword, create thopter, Sword returns",
    type: "value",
  },

  // --- Secrets of Strixhaven (SOS) Combos ---
  {
    id: "pensive-professor-lyla",
    cards: ["Pensive Professor", "Lyla, Holographic Assistant"],
    description: "Infinite draw: cast a 2+ mana spell to put a +1/+1 counter on Pensive Professor (Increment), Pensive's draw trigger fires, Lyla puts another counter on Pensive when you draw, loop with any further draw or counter source",
    type: "infinite",
  },
  {
    id: "witherbloom-balancer-sprout-swarm",
    cards: ["Witherbloom, the Balancer", "Sprout Swarm"],
    description: "Infinite saproling tokens: Sprout Swarm's convoke pays for itself with the saproling tokens it creates; Witherbloom's affinity-for-creatures discount on instants/sorceries makes the loop net-positive",
    type: "infinite",
  },
  {
    id: "rootha-breath-of-fury",
    cards: ["Rootha, Mastering the Moment", "Breath of Fury"],
    description: "Infinite combats and damage: with a third creature, cast an instant/sorcery to make Rootha's flying Elemental token, attach Breath of Fury, deal damage and take additional combat steps repeatedly",
    type: "infinite",
  },

  // --- Artifact Combos ---
  {
    id: "basalt-rings",
    cards: ["Basalt Monolith", "Rings of Brighthearth"],
    description: "Infinite colorless mana: copy Monolith's untap ability with Rings for {2}, net +1 mana each loop",
    type: "infinite",
  },
  {
    id: "basalt-forsaken",
    cards: ["Basalt Monolith", "Forsaken Monument"],
    description: "Infinite colorless mana: Monument makes Monolith produce {C}{C}{C}{C}, untap for {3}, net +1",
    type: "infinite",
  },
  {
    id: "kci-deathmantle-breya",
    cards: ["Krark-Clan Ironworks", "Nim Deathmantle", "Breya, Etherium Shaper"],
    description: "Infinite damage/life: sac Breya + thopter to KCI for {C}{C}{C}{C}, pay {4} Deathmantle to return Breya, make 2 thopters, repeat with Breya's ability",
    type: "infinite",
  },
  {
    id: "kci-deathmantle-battlesphere",
    cards: ["Krark-Clan Ironworks", "Nim Deathmantle", "Myr Battlesphere"],
    description: "Infinite tokens and mana: sac Battlesphere + 3 Myr to KCI for {C}{C}{C}{C}{C}{C}{C}{C}, Deathmantle returns Battlesphere, makes 4 Myr",
    type: "infinite",
  },
  {
    id: "kci-deathmantle-wurmcoil",
    cards: ["Krark-Clan Ironworks", "Nim Deathmantle", "Wurmcoil Engine"],
    description: "Infinite tokens and mana: sac Wurmcoil to KCI, tokens created, sac one token, Deathmantle returns Wurmcoil",
    type: "infinite",
  },
  {
    id: "kci-trawler-retriever",
    cards: ["Krark-Clan Ironworks", "Scrap Trawler", "Myr Retriever"],
    description: "Infinite mana: sacrifice chain returns artifacts from graveyard, netting mana via KCI",
    type: "infinite",
  },
  {
    id: "dross-scorpion-kci",
    cards: ["Dross Scorpion", "Krark-Clan Ironworks"],
    description: "Untap engine: when artifact creature dies to KCI, Scorpion untaps another mana artifact for extra mana",
    type: "value",
  },
  {
    id: "clock-omens-kci",
    cards: ["Clock of Omens", "Krark-Clan Ironworks"],
    description: "Artifact untap engine: tap artifact tokens from KCI fodder to untap mana artifacts",
    type: "value",
  },
  {
    id: "grinding-station-sword-thopter",
    cards: ["Grinding Station", "Sword of the Meek", "Thopter Foundry"],
    description: "Infinite mill: sac Sword to Foundry for thopter + life, Sword returns, Station untaps on artifact ETB",
    type: "infinite",
  },
  {
    id: "grinding-station-breach",
    cards: ["Grinding Station", "Underworld Breach"],
    description: "Infinite mill: mill fuels escape costs, replay cheap artifacts to untap Station",
    type: "infinite",
  },
  {
    id: "voltaic-key-time-vault",
    cards: ["Voltaic Key", "Time Vault"],
    description: "Infinite turns: Key untaps Vault, take extra turn, repeat",
    type: "infinite",
  },
  {
    id: "unwinding-clock-winter-orb",
    cards: ["Unwinding Clock", "Winter Orb"],
    description: "Asymmetric lock: your artifacts untap normally, opponents' lands stay tapped",
    type: "lock",
  },
  {
    id: "clock-omens-unwinding",
    cards: ["Clock of Omens", "Unwinding Clock"],
    description: "Full artifact untap engine: continuous untapping enables repeated activations each turn cycle",
    type: "value",
  },
  {
    id: "panharmonicon-sharuum",
    cards: ["Panharmonicon", "Sharuum the Hegemon"],
    description: "Double ETB recursion: Sharuum returns an artifact, Panharmonicon doubles the trigger for a second return",
    type: "value",
  },
  {
    id: "sharuum-closet",
    cards: ["Sharuum the Hegemon", "Conjurer's Closet"],
    description: "Recurring artifact recursion: blink Sharuum each end step to return an artifact from graveyard",
    type: "value",
  },
  {
    id: "skullclamp-kci",
    cards: ["Skullclamp", "Krark-Clan Ironworks"],
    description: "Draw engine: equip Clamp to 1/1 artifact tokens, sac to KCI, draw 2 and gain mana",
    type: "value",
  },
  {
    id: "lithoform-rings",
    cards: ["Lithoform Engine", "Rings of Brighthearth"],
    description: "Ability copy engine: copy activated abilities twice for redundant doubling",
    type: "value",
  },
  {
    id: "forgemaster-kci",
    cards: ["Kuldotha Forgemaster", "Krark-Clan Ironworks"],
    description: "Artifact tutor engine: sac artifacts to Forgemaster to tutor, KCI refunds mana from sacrificed artifacts",
    type: "value",
  },
  {
    id: "transmuter-sharuum",
    cards: ["Master Transmuter", "Sharuum the Hegemon"],
    description: "Artifact recursion loop: bounce and replay Sharuum to return artifacts from graveyard repeatedly",
    type: "value",
  },
  {
    id: "prototype-sol-ring",
    cards: ["Prototype Portal", "Sol Ring"],
    description: "Repeatable Sol Ring tokens: imprint Sol Ring, create copies for {1} each",
    type: "value",
  },
  {
    id: "saheeli-lithoform",
    cards: ["Saheeli, the Gifted", "Lithoform Engine"],
    description: "Cost reduction + copy: Saheeli reduces artifact costs, Engine copies spells and abilities",
    type: "value",
  },

  // --- Locks ---
  {
    id: "knowledge-pool-magistrate",
    cards: ["Knowledge Pool", "Drannith Magistrate"],
    description: "Lock: opponents can't cast spells from hand (Pool exiles them) or from exile (Magistrate)",
    type: "lock",
  },
  {
    id: "possibility-storm-magistrate",
    cards: ["Possibility Storm", "Drannith Magistrate"],
    description: "Lock: opponents can't cast spells — Storm exiles originals, Magistrate blocks exiled copies",
    type: "lock",
  },
  {
    id: "winter-orb-stasis",
    cards: ["Winter Orb", "Stasis"],
    description: "Hard lock: no untap steps combined with restricted land untaps",
    type: "lock",
  },

  // --- Value Engines ---
  {
    id: "top-citadel",
    cards: ["Sensei's Divining Top", "Bolas's Citadel"],
    description: "Draw engine: play Top from library with Citadel, draw and reposition Top on top",
    type: "value",
  },
  {
    id: "top-citadel-reservoir",
    cards: ["Sensei's Divining Top", "Bolas's Citadel", "Aetherflux Reservoir"],
    description: "Win: cast Top from library with Citadel repeatedly, Reservoir gains enough life to kill",
    type: "wincon",
  },

  // --- Tribal Combos ---
  {
    id: "krenko-thornbite",
    cards: ["Krenko, Mob Boss", "Thornbite Staff"],
    description: "Infinite Goblins: Staff untaps Krenko whenever a Goblin dies, tap to double Goblins",
    type: "infinite",
  },
  {
    id: "krenko-skirk",
    cards: ["Krenko, Mob Boss", "Skirk Prospector"],
    description: "Massive mana and tokens: sacrifice Goblins for mana, tap Krenko to make more",
    type: "value",
  },
  {
    id: "conspiracy-turntimber",
    cards: ["Conspiracy", "Turntimber Ranger"],
    description: "Infinite tokens: Ranger creates Wolf Ally tokens, Conspiracy makes them Allies, re-triggering Ranger",
    type: "infinite",
  },
  {
    id: "arcane-adaptation-turntimber",
    cards: ["Arcane Adaptation", "Turntimber Ranger"],
    description: "Infinite tokens: Ranger creates Wolf tokens that are Allies via Adaptation, re-triggering Ranger",
    type: "infinite",
  },
  {
    id: "sliver-queen-basal",
    cards: ["Sliver Queen", "Basal Sliver"],
    description: "Infinite Slivers with a third piece: sacrifice Slivers for mana, create new ones with Queen",
    type: "value",
  },
  {
    id: "zombie-master-urborg",
    cards: ["Zombie Master", "Urborg, Tomb of Yawgmoth"],
    description: "All Zombies gain swampwalk and regeneration (all lands are Swamps)",
    type: "value",
  },

  // --- Legendary / Historic Combos ---
  {
    id: "kethis-mox-amber",
    cards: ["Kethis, the Hidden Hand", "Mox Amber"],
    description: "Legendary mana loop: Kethis lets you replay Mox Amber from graveyard for free mana",
    type: "value",
  },
  {
    id: "jhoira-reservoir",
    cards: ["Jhoira, Weatherlight Captain", "Aetherflux Reservoir"],
    description: "Historic storm: chain historic spells drawing cards with Jhoira, gain life with Reservoir to kill",
    type: "wincon",
  },
  {
    id: "jhoira-top",
    cards: ["Jhoira, Weatherlight Captain", "Sensei's Divining Top"],
    description: "Draw engine: Top is historic, draw with Jhoira, recast Top from library with cost reducer",
    type: "value",
  },
  {
    id: "teshar-mox-amber",
    cards: ["Teshar, Ancestor's Apostle", "Mox Amber"],
    description: "Historic recursion loop: cast Mox Amber (historic), Teshar returns a creature, sacrifice and repeat",
    type: "value",
  },
];

/**
 * Find all known combos present in a deck.
 * A combo is "found" when ALL of its card names appear in the deck's card list.
 */
export function findCombosInDeck(cardNames: string[]): KnownCombo[] {
  const nameSet = new Set(cardNames);
  return KNOWN_COMBOS.filter((combo) =>
    combo.cards.every((name) => nameSet.has(name))
  );
}
