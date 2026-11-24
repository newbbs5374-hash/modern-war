// 연구 성좌판 가지 순서(선이 겹치지 않게 미리 골라 둔 값). scripts/gen-tech-sky.ts가 만듦 — 손으로 고치지 말 것.
export const SKY_ORDER: Record<string, Record<string, string[]>> = {
 "mil": {
  "": [
   "m-drone",
   "m-rifle",
   "m-mech",
   "m-cyber",
   "m-arty",
   "m-supply",
   "m-coast",
   "m-comms",
   "m-logi",
   "m-aegis"
  ],
  "m-mech": [
   "m-armor"
  ],
  "m-cyber": [
   "m-ew",
   "m-radar"
  ],
  "m-drone": [
   "m-heli",
   "m-recon"
  ],
  "m-heli": [
   "m-jet"
  ],
  "m-jet": [
   "m-bomber",
   "m-carrier",
   "m-stealth",
   "m-awacs"
  ],
  "m-aegis": [
   "m-silent",
   "m-vls"
  ],
  "m-arty": [
   "m-guided"
  ],
  "m-radar": [
   "m-sat"
  ],
  "m-armor": [
   "m-active",
   "m-secret"
  ],
  "m-silent": [
   "m-crystal"
  ],
  "m-sat": [
   "m-net",
   "m-space"
  ],
  "m-carrier": [
   "m-fleet"
  ],
  "m-rifle": [
   "m-nightvis"
  ],
  "m-coast": [
   "m-sonar"
  ],
  "m-recon": [
   "m-tanker"
  ],
  "m-logi": [
   "m-depot"
  ],
  "m-ew": [
   "m-ai"
  ],
  "m-depot": [
   "m-sealift"
  ],
  "m-guided": [
   "m-hyper"
  ],
  "m-ai": [
   "m-swarm"
  ],
  "m-vls": [
   "m-laser"
  ],
  "m-active": [
   "m-exo"
  ],
  "@m-guided": [
   "m-arty"
  ]
 },
 "soc": {
  "": [
   "s-charter",
   "s-press",
   "s-envoy",
   "s-school",
   "s-census",
   "s-tax",
   "s-guild",
   "s-urban"
  ],
  "s-urban": [
   "s-mining",
   "s-aviation",
   "s-transport",
   "s-welfare",
   "s-harbor",
   "s-academy"
  ],
  "s-envoy": [
   "s-intel",
   "s-council",
   "s-nonagg"
  ],
  "s-nonagg": [
   "s-defense",
   "s-alliance"
  ],
  "s-charter": [
   "s-draft",
   "s-reserve"
  ],
  "s-welfare": [
   "s-media",
   "s-federal"
  ],
  "s-council": [
   "s-peace"
  ],
  "s-guild": [
   "s-customs"
  ],
  "s-mining": [
   "s-industry"
  ],
  "s-reserve": [
   "s-veterans"
  ],
  "s-school": [
   "s-digital"
  ],
  "s-alliance": [
   "s-aid"
  ],
  "s-veterans": [
   "s-unify"
  ],
  "@s-federal": [
   "s-welfare"
  ],
  "@s-unify": [
   "s-veterans"
  ]
 }
};
