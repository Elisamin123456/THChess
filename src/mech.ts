import { BpBanOptionId, MechId, RoleSkillId } from "./protocol";

export interface RoleSkillDefinition {
  id: RoleSkillId;
  name: string;
  description: string;
  implemented: boolean;
}

export interface MechDefinition {
  id: MechId;
  name: string;
  avatarSrc: string;
  roleSkills: Record<RoleSkillId, RoleSkillDefinition>;
}

export const DEFAULT_MECH_ID: MechId = "reimu";
export const MECH_IDS: MechId[] = ["reimu", "marisa", "koishi", "aya"];
export const NO_BAN_OPTION_ID: BpBanOptionId = "none";

// 所有技能介绍文本不可更改。

function makeSkill(id: RoleSkillId, name: string, description: string, implemented: boolean): RoleSkillDefinition {
  return {
    id,
    name,
    description,
    implemented,
  };
}

function buildEmptyRoleSkills(): Record<RoleSkillId, RoleSkillDefinition> {
  return {
    role1: makeSkill("role1", "", "", false),
    role2: makeSkill("role2", "", "", false),
    role3: makeSkill("role3", "", "", false),
    role4: makeSkill("role4", "", "", false),
  };
}

const EMPTY_ROLE_SKILLS = buildEmptyRoleSkills();

export const MECH_DEFINITIONS: Record<MechId, MechDefinition> = {
  reimu: {
    id: "reimu",
    name: "Reimu",
    avatarSrc: "./assets/char/reimu.png",
    roleSkills: {
      role1: makeSkill(
        "role1",
        "弾幕「Persuasion Needle」",
        "消费N点灵力，发射N枚封魔针对路径上的第一个单位造成1点伤害。",
        true,
      ),
      role2: makeSkill(
        "role2",
        "霊撃「Homing Amulet」",
        "消费1点灵力，发射1枚符札对路径上的所有单位造成1点伤害。若对敌方机体造成伤害，恢复1点灵力。",
        true,
      ),
      role3: makeSkill(
        "role3",
        "視界「陰陽宝玉」",
        "消费N灵力，获取半径N的视野，持续N回合。",
        true,
      ),
      role4: makeSkill(
        "role4",
        "奥義「G Free」",
        "消费N灵力，闪现到半径N内任意一格。",
        true,
      ),
    },
  },
  marisa: {
    id: "marisa",
    name: "Marisa",
    avatarSrc: "./assets/char/marisa.png",
    roleSkills: buildEmptyRoleSkills(),
  },
  koishi: {
    id: "koishi",
    name: "Koishi",
    avatarSrc: "./assets/char/koishi.png",
    roleSkills: {
      role1: makeSkill(
        "role1",
        "弾幕：「無意識の遺伝子」",
        "消费N灵力,在1格范围内闪现，并使你完全隐形N回合。 隐形期间隐身时在对方视野范围内仅无法看见你的位置。恋隐身后，无法被普通攻击选定。 你在进入草丛时即使效果结束也不会解除隐形，恋被攻击或恋进行普通攻击后会立刻解除隐形。",
        true,
      ),
      role2: makeSkill(
        "role2",
        "霊撃：「イドの解放」",
        "该技能开启或关闭不被视为行动。开关技能，开启后每回合消费1灵力，关闭后不消耗灵力，灵力扣除在敌方回合开始时进行结算，若灵力不足则自动关闭。 敌方回合开始对恋周围半径1格的单位造成1点持续伤害。该伤害无法使恋解除隐形。",
        true,
      ),
      role3: makeSkill(
        "role3",
        "視界:「妖怪ポリグラフ」",
        "消费N灵力。使得当敌方机体在敌方回合只要执行正交移动后, 对该机体立刻造成1点持续伤害。 斜向移动或没有进行移动不会造成伤害，持续N回合。",
        true,
      ),
      role4: makeSkill(
        "role4",
        "奥義:「嫌われ者のフィロソフィ」",
        "消费5灵力。强化恋的下一次普通攻击额外对敌方机体造成100%已损失敌方生命值的额外伤害。该技能使用后在使用强化普通攻击前被视为一直生效。",
        true,
      ),
    },
  },
  aya: {
    id: "aya",
    name: "Aya",
    avatarSrc: "./assets/char/aya.png",
    roleSkills: {
      role1: makeSkill(
        "role1",
        "弾幕：「鳥居つむじ風」",
        "被动：射命丸文执行移动后立刻进行一次额外普通攻击；执行普通攻击后立刻进行一次额外移动。被动产生的普通攻击或行动不会再次触发被动。消费2点灵力，发射2个旋风，每个对路径上的第一个单位造成1点伤害，并对造成伤害的目标标记「鴉の闇」。",
        true,
      ),
      role2: makeSkill(
        "role2",
        "霊撃：「風神一扇」",
        "消费1点灵力：立刻进行一次可触发被动的移动，并使下一次普通攻击的视野、距离和攻击力+1；或立刻进行一次可触发被动的普通攻击，并使下一次移动距离+2且无视墙体。",
        true,
      ),
      role3: makeSkill(
        "role3",
        "視界:「風神木の葉隠れ」",
        "消费1点灵力，下一次普通攻击或移动后进入2回合隐身（可被侦察）。隐身时在对方视野内不会显示位置，且普通公告会被随机内容替换。",
        true,
      ),
      role4: makeSkill(
        "role4",
        "奥義:「幻想風靡」",
        "消费N点灵力，从当前位置位移到N格范围内，对路径上单位造成等同攻击力的伤害。若命中敌方机体，返还N点灵力。该技能不属于移动。",
        true,
      ),
    },
  },
};

export interface BpOption {
  id: BpBanOptionId;
  name: string;
  avatarSrc: string | null;
  isEmptyBan: boolean;
}

export const BP_OPTIONS: BpOption[] = [
  ...MECH_IDS.map((id) => {
    const mech = MECH_DEFINITIONS[id];
    return {
      id,
      name: mech.name,
      avatarSrc: mech.avatarSrc,
      isEmptyBan: false,
    };
  }),
  {
    id: NO_BAN_OPTION_ID,
    name: "Empty Ban",
    avatarSrc: null,
    isEmptyBan: true,
  },
];

export function getMechDefinition(mechId: MechId): MechDefinition {
  return MECH_DEFINITIONS[mechId];
}

export function getMechName(mechId: MechId): string {
  return getMechDefinition(mechId).name;
}

export function isRoleSkillImplemented(mechId: MechId, skill: RoleSkillId): boolean {
  return Boolean(MECH_DEFINITIONS[mechId].roleSkills[skill]?.implemented);
}

export function getRoleSkillDefinition(mechId: MechId, skill: RoleSkillId): RoleSkillDefinition {
  return MECH_DEFINITIONS[mechId].roleSkills[skill] ?? EMPTY_ROLE_SKILLS[skill];
}
