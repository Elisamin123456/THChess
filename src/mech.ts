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
        "Persuasion Needle",
        "Spend N spirit to fire N needles in a line. The first hit unit in each needle path takes 1 damage.",
        true,
      ),
      role2: makeSkill(
        "role2",
        "Homing Amulet",
        "Spend 1 spirit to deal piercing 1 damage to all units on the path. Refund 1 spirit if enemy unit is hit.",
        true,
      ),
      role3: makeSkill(
        "role3",
        "Yin-Yang Orb",
        "Spend N spirit to gain vision radius N for N turns.",
        true,
      ),
      role4: makeSkill(
        "role4",
        "G Free",
        "Spend N spirit to blink to an empty tile within range N. This is not a move action.",
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
    roleSkills: buildEmptyRoleSkills(),
  },
  aya: {
    id: "aya",
    name: "Aya",
    avatarSrc: "./assets/char/aya.png",
    roleSkills: buildEmptyRoleSkills(),
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
