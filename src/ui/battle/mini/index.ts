// 미니게임 id → 화면(목록·켜고 끄기는 battle/minigames.ts)
import type { ComponentType } from 'react';
import type { MiniProps } from './kit';
import { SneakLight, SneakLock, SneakPath } from './sneak';
import { FitMarch, FitPushup, FitRun } from './fitness';
import { TacCover, TacPuzzle, TacRoute } from './tactics';
import { ShootMoving, ShootPopup, ShootSniper } from './shoot';
import { ArtyAdjust, ArtyLead, ArtyPull } from './arty';
import { IntelCipher, IntelDiff, IntelLink } from './intel';
import { LeadLine, LeadMorale, LeadOrder } from './lead';
import { SupRation, SupRoad, SupTruck } from './supply';
import { HackCode, HackFirewall, HackFlow } from './hack';
import { RecInterview, RecPoster, RecSpeech } from './recruit';
import { AirFlare, AirIntercept, AirLanding } from './air';
import { SeaFormation, SeaSonar, SeaTorpedo } from './sea';
import { FAirCockpit, FArtyObserve, FFitRun, FSeaBridge, FShootScope, FSneakFP } from './freshA';
import { FHackNet, FTacWego } from './freshB';
import { FInterro } from './freshC';
import { FLeadRadio, FRecAds, FSupBase } from './freshD';
import { M3AirFlare, M3AirIntercept, M3ArtyLead, M3SeaSonar, M3SeaTorpedo, M3ShootMoving, M3ShootPopup, M3SneakLight } from './three';
import { EAmbush, EBreath, ECarrier, EConvoy, EHoldRun, EMarch, EParade, ERally, ERunner, ESand, ESling, ETorpedo, EWall } from './easyA';
import { ELiar, EPack, ERings, ESatDiff } from './easyB';
import { EAirdrop, EBomb, EFilm, EFlare, EHill, EIntercept, ELeadShot, ERefuel, ETakedown, ETide, ETot, EWaves } from './easyC';
import { EAirFuel, EBombSet, EClimb, ECover, EFront, ELowFly, ERadio, ERepair, EScoot, ESeaFuel, ETrace, EWheel } from './easyD';
import { ECold, EDepot, EDisguise, EJudge, EMind, EMole, EPredict, EReview, ESchool, ESpeech } from './easyE';
import { EASY } from '../../../battle/easy';

/** 한 손가락 미니 훈련 화면(easy.ts 의 view 이름) */
const EASY_VIEWS: Record<string, ComponentType<MiniProps>> = {
  'e:holdrun': EHoldRun, 'e:wall': EWall, 'e:runner': ERunner, 'e:march': EMarch, 'e:sand': ESand, 'e:ambush': EAmbush,
  'e:breath': EBreath, 'e:sling': ESling, 'e:satdiff': ESatDiff, 'e:liar': ELiar, 'e:parade': EParade, 'e:rally': ERally,
  'e:convoy': EConvoy, 'e:pack': EPack, 'e:rings': ERings, 'e:carrier': ECarrier, 'e:torpedo': ETorpedo,
  'e:takedown': ETakedown, 'e:leadshot': ELeadShot, 'e:airdrop': EAirdrop, 'e:refuel': ERefuel, 'e:flare': EFlare, 'e:bomb': EBomb,
  'e:intercept': EIntercept, 'e:film': EFilm, 'e:tide': ETide, 'e:waves': EWaves, 'e:hill': EHill, 'e:tot': ETot,
  'e:airfuel': EAirFuel, 'e:seafuel': ESeaFuel, 'e:lowfly': ELowFly, 'e:bombset': EBombSet, 'e:cover': ECover, 'e:radio': ERadio,
  'e:wheel': EWheel, 'e:trace': ETrace, 'e:front': EFront, 'e:repair': ERepair, 'e:scoot': EScoot, 'e:climb': EClimb,
  'e:disguise': EDisguise, 'e:predict': EPredict, 'e:review': EReview, 'e:mole': EMole, 'e:mind': EMind, 'e:speech': ESpeech,
  'e:judge': EJudge, 'e:school': ESchool, 'e:cold': ECold, 'e:depot': EDepot,
};

export const MINI_VIEWS: Record<string, ComponentType<MiniProps>> = {
  'sneak-path': SneakPath,
  'sneak-light': SneakLight,
  'sneak-lock': SneakLock,
  'fit-run': FitRun,
  'fit-march': FitMarch,
  'fit-pushup': FitPushup,
  'tac-puzzle': TacPuzzle,
  'tac-cover': TacCover,
  'tac-route': TacRoute,
  'shoot-popup': ShootPopup,
  'shoot-sniper': ShootSniper,
  'shoot-moving': ShootMoving,
  'arty-pull': ArtyPull,
  'arty-adjust': ArtyAdjust,
  'arty-lead': ArtyLead,
  'intel-diff': IntelDiff,
  'intel-cipher': IntelCipher,
  'intel-link': IntelLink,
  'lead-line': LeadLine,
  'lead-morale': LeadMorale,
  'lead-order': LeadOrder,
  'sup-road': SupRoad,
  'sup-truck': SupTruck,
  'sup-ration': SupRation,
  'hack-flow': HackFlow,
  'hack-code': HackCode,
  'hack-firewall': HackFirewall,
  'rec-interview': RecInterview,
  'rec-speech': RecSpeech,
  'rec-poster': RecPoster,
  'air-intercept': AirIntercept,
  'air-landing': AirLanding,
  'air-flare': AirFlare,
  'sea-sonar': SeaSonar,
  'sea-torpedo': SeaTorpedo,
  'sea-formation': SeaFormation,
  'm3-shoot-popup': M3ShootPopup,
  'm3-shoot-moving': M3ShootMoving,
  'm3-arty-lead': M3ArtyLead,
  'm3-sea-torpedo': M3SeaTorpedo,
  'm3-sea-sonar': M3SeaSonar,
  'm3-air-intercept': M3AirIntercept,
  'm3-air-flare': M3AirFlare,
  'm3-sneak-light': M3SneakLight,
  'n-shoot-scope': FShootScope,
  'n-air-cockpit': FAirCockpit,
  'n-sneak-fp': FSneakFP,
  'n-arty-observe': FArtyObserve,
  'n-sea-bridge': FSeaBridge,
  'n-fit-run3d': FFitRun,
  'n-tac-wego': FTacWego,
  'n-hack-net': FHackNet,
  'n-intel-interro': FInterro,
  'n-sup-base': FSupBase,
  'n-lead-radio': FLeadRadio,
  'n-rec-ads': FRecAds,
};
// 한 손가락 미니 훈련: 새 화면이거나, 이미 있는 화면을 그대로 씀
for (const e of EASY) {
  const v = e.view && (EASY_VIEWS[e.view] ?? MINI_VIEWS[e.view]);
  if (v) MINI_VIEWS[e.id] = v;
}
