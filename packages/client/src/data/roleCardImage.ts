import { RoleName } from '@werewolf/shared';

/**
 * Maps each role to the id used for its card art under /public/cards
 * (both /cards/thumb/{id}.jpg and /cards/full/{id}.jpg exist for every
 * entry here). These ids are historical Vietnamese shorthand baked into
 * the image filenames — kept as a single lookup table here so nothing
 * else in the app needs to know that mapping.
 */
export const ROLE_CARD_ID: Record<RoleName, string> = {
  [RoleName.WEREWOLF]: 'masoi',
  [RoleName.VILLAGER]: 'danthuong',
  [RoleName.SEER]: 'tientri',
  [RoleName.GUARD]: 'baove',
  [RoleName.WITCH]: 'phuthuy',
  [RoleName.HUNTER]: 'thosan',
  [RoleName.CUPID]: 'cupis',
  [RoleName.WOLF_CUB]: 'soicon',
  [RoleName.FATHER_WOLF]: 'soicha',
  [RoleName.ALPHA_WOLF]: 'soiking',
  [RoleName.WHITE_WOLF]: 'soitrang',
  [RoleName.LITTLE_GIRL]: 'tihi',
  [RoleName.FOX]: 'cao',
  [RoleName.BEAR_TAMER]: 'Nnuoigau',
  [RoleName.ELDER]: 'gialang',
  [RoleName.RUSTY_KNIGHT]: 'hiepsikr',
  [RoleName.SCAPEGOAT]: 'kethethan',
  [RoleName.IDIOT]: 'thangngoc',
  [RoleName.CORRUPT_JUDGE]: 'thamphan',
  [RoleName.TWIN_SISTERS]: 'sinhdoi',
  [RoleName.THREE_BROTHERS]: 'baae',
  [RoleName.WILD_CHILD]: 'kehoangda',
  [RoleName.ANGEL]: 'thiensu',
  [RoleName.FLUTIST]: 'Nthoisao',
  [RoleName.CULT_LEADER]: 'giaochu',
  [RoleName.THIEF]: 'antrom',
  [RoleName.MAID]: 'haugai',
};

export function roleCardImageUrl(role: RoleName, size: 'thumb' | 'full' = 'full'): string {
  return `/cards/${size}/${ROLE_CARD_ID[role]}.jpg`;
}
