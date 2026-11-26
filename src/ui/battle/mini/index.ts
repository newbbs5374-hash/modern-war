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
import { M3AirFlare, M3AirIntercept, M3ArtyLead, M3SeaSonar, M3SeaTorpedo, M3ShootMoving, M3ShootPopup, M3SneakLight } from './three';

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
};
