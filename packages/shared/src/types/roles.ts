export enum Team {
  VILLAGER = 'VILLAGER',
  WEREWOLF = 'WEREWOLF',
}

export enum RoleName {
  WEREWOLF = 'WEREWOLF',
  VILLAGER = 'VILLAGER',
  SEER = 'SEER',
  GUARD = 'GUARD',
  WITCH = 'WITCH',
  HUNTER = 'HUNTER',
  CUPID = 'CUPID',
  WOLF_CUB = 'WOLF_CUB',
  FATHER_WOLF = 'FATHER_WOLF',
  ALPHA_WOLF = 'ALPHA_WOLF',
  WHITE_WOLF = 'WHITE_WOLF',
  LITTLE_GIRL = 'LITTLE_GIRL',
  FOX = 'FOX',
  BEAR_TAMER = 'BEAR_TAMER',
  ELDER = 'ELDER',
  RUSTY_KNIGHT = 'RUSTY_KNIGHT',
  SCAPEGOAT = 'SCAPEGOAT',
  IDIOT = 'IDIOT',
  CORRUPT_JUDGE = 'CORRUPT_JUDGE',
  TWIN_SISTERS = 'TWIN_SISTERS',
  THREE_BROTHERS = 'THREE_BROTHERS',
  WILD_CHILD = 'WILD_CHILD',
  ANGEL = 'ANGEL',
  FLUTIST = 'FLUTIST',
  CULT_LEADER = 'CULT_LEADER',
  THIEF = 'THIEF',
  MAID = 'MAID',
}

/**
 * Static metadata about a role. This is NOT per-player state (that lives in
 * Player.roleState on the server) — it's the fixed rulebook definition.
 */
export interface RoleDefinition {
  name: RoleName;
  team: Team;
  /** Vietnamese display name, shown in UI. */
  displayNameVi: string;
  /** Short rule description shown in the role-reveal modal. */
  descriptionVi: string;
  /** Whether this role takes an action during the NIGHT phase. */
  hasNightAction: boolean;
}

export const ROLE_DEFINITIONS: Record<RoleName, RoleDefinition> = {
  [RoleName.WEREWOLF]: {
    name: RoleName.WEREWOLF,
    team: Team.WEREWOLF,
    displayNameVi: 'Ma Sói',
    descriptionVi: 'Mỗi đêm, cùng các Sói khác chọn một người để cắn chết.',
    hasNightAction: true,
  },
  [RoleName.VILLAGER]: {
    name: RoleName.VILLAGER,
    team: Team.VILLAGER,
    displayNameVi: 'Dân thường',
    descriptionVi: 'Không có kỹ năng đặc biệt. Dùng lời nói và lá phiếu để tìm Sói.',
    hasNightAction: false,
  },
  [RoleName.SEER]: {
    name: RoleName.SEER,
    team: Team.VILLAGER,
    displayNameVi: 'Tiên tri',
    descriptionVi: 'Mỗi đêm, soi một người để biết họ thuộc phe Sói hay phe Dân.',
    hasNightAction: true,
  },
  [RoleName.GUARD]: {
    name: RoleName.GUARD,
    team: Team.VILLAGER,
    displayNameVi: 'Bảo vệ',
    descriptionVi:
      'Mỗi đêm, chọn một người để bảo vệ khỏi Sói. Không được bảo vệ cùng một người hai đêm liên tiếp.',
    hasNightAction: true,
  },
  [RoleName.WITCH]: {
    name: RoleName.WITCH,
    team: Team.VILLAGER,
    displayNameVi: 'Phù thủy',
    descriptionVi:
      'Có một bình thuốc cứu và một bình thuốc độc, mỗi loại dùng được một lần trong cả game. ' +
      'Chỉ được dùng một bình mỗi đêm.',
    hasNightAction: true,
  },
  [RoleName.HUNTER]: {
    name: RoleName.HUNTER,
    team: Team.VILLAGER,
    displayNameVi: 'Thợ săn',
    descriptionVi: 'Khi chết (vì bất kỳ lý do gì), được bắn chết ngay một người khác.',
    hasNightAction: false,
  },
  [RoleName.CUPID]: {
    name: RoleName.CUPID,
    team: Team.VILLAGER,
    displayNameVi: 'Cupid',
    descriptionVi:
      'Chỉ đêm đầu tiên, chọn hai người trở thành một cặp tình nhân. ' +
      'Nếu một người chết, người còn lại cũng chết theo.',
    hasNightAction: true,
  },
  [RoleName.WOLF_CUB]: {
    name: RoleName.WOLF_CUB,
    team: Team.WEREWOLF,
    displayNameVi: 'Sói Con',
    descriptionVi:
      'Cùng bầy Sói chọn nạn nhân mỗi đêm. Nếu Sói Con chết, đêm kế tiếp bầy Sói ' +
      'được cắn hai người thay vì một.',
    hasNightAction: false,
  },
  [RoleName.FATHER_WOLF]: {
    name: RoleName.FATHER_WOLF,
    team: Team.WEREWOLF,
    displayNameVi: 'Sói Cha',
    descriptionVi:
      'Một lần duy nhất trong ván, có thể biến nạn nhân bị bầy Sói cắn thành ' +
      'đồng đội Sói thay vì giết chết.',
    hasNightAction: true,
  },
  [RoleName.ALPHA_WOLF]: {
    name: RoleName.ALPHA_WOLF,
    team: Team.WEREWOLF,
    displayNameVi: 'Sói Đầu Đàn',
    descriptionVi:
      'Cắn thêm một người mỗi đêm. Ngay khi có một Sói khác chết, vĩnh viễn mất ' +
      'khả năng cắn thêm này.',
    hasNightAction: false,
  },
  [RoleName.WHITE_WOLF]: {
    name: RoleName.WHITE_WOLF,
    team: Team.WEREWOLF,
    displayNameVi: 'Sói Trắng',
    descriptionVi:
      'Thuộc phe Sói nhưng chỉ thắng khi là người sống sót cuối cùng. Mỗi hai ' +
      'đêm một lần, có thể tự mình giết một Sói khác.',
    hasNightAction: true,
  },
  [RoleName.LITTLE_GIRL]: {
    name: RoleName.LITTLE_GIRL,
    team: Team.VILLAGER,
    displayNameVi: 'Cô Bé',
    descriptionVi:
      'Mỗi đêm có thể chọn nhìn trộm lúc Sói họp bàn để biết ai là Sói, nhưng ' +
      'có rủi ro bị Sói phát hiện và cắn chết ngay đêm đó.',
    hasNightAction: true,
  },
  [RoleName.FOX]: {
    name: RoleName.FOX,
    team: Team.VILLAGER,
    displayNameVi: 'Cáo',
    descriptionVi:
      'Mỗi đêm chọn một người, soi luôn người đó và hai người ngồi cạnh để biết ' +
      'trong ba người có Sói hay không. Nếu soi trượt hoàn toàn, mất vĩnh viễn kỹ năng.',
    hasNightAction: true,
  },
  [RoleName.BEAR_TAMER]: {
    name: RoleName.BEAR_TAMER,
    team: Team.VILLAGER,
    displayNameVi: 'Người Nuôi Gấu',
    descriptionVi:
      'Không có hành động ban đêm. Mỗi sáng, nếu đang ngồi cạnh ít nhất một Sói ' +
      'còn sống, cả phòng sẽ nghe thấy tiếng gấu gầm gừ.',
    hasNightAction: false,
  },
  [RoleName.ELDER]: {
    name: RoleName.ELDER,
    team: Team.VILLAGER,
    displayNameVi: 'Già Làng',
    descriptionVi:
      'Chịu được một lần bị Sói cắn mà không chết, lần cắn thứ hai mới thực sự ' +
      'chết. Nếu chết vì bị treo cổ hoặc Phù Thủy đầu độc, toàn bộ vai trò phe Dân ' +
      'còn kỹ năng chủ động sẽ vĩnh viễn mất kỹ năng từ đêm kế tiếp.',
    hasNightAction: false,
  },
  [RoleName.RUSTY_KNIGHT]: {
    name: RoleName.RUSTY_KNIGHT,
    team: Team.VILLAGER,
    displayNameVi: 'Hiệp Sĩ Kiếm Rỉ',
    descriptionVi:
      'Nếu bị Sói cắn chết, đêm kế tiếp Sói ngồi ngay bên trái sẽ chết vì nhiễm ' +
      'độc kiếm rỉ.',
    hasNightAction: false,
  },
  [RoleName.SCAPEGOAT]: {
    name: RoleName.SCAPEGOAT,
    team: Team.VILLAGER,
    displayNameVi: 'Kẻ Thế Thân',
    descriptionVi:
      'Nếu kết quả bỏ phiếu treo cổ bị hòa, Kẻ Thế Thân chết thay cho những ' +
      'người bị hòa phiếu.',
    hasNightAction: false,
  },
  [RoleName.IDIOT]: {
    name: RoleName.IDIOT,
    team: Team.VILLAGER,
    displayNameVi: 'Thằng Ngốc',
    descriptionVi:
      'Lần đầu tiên bị dân làng bỏ phiếu treo cổ sẽ không chết, nhưng vai trò bị ' +
      'lộ công khai và mất vĩnh viễn quyền bỏ phiếu treo cổ những ngày sau.',
    hasNightAction: false,
  },
  [RoleName.CORRUPT_JUDGE]: {
    name: RoleName.CORRUPT_JUDGE,
    team: Team.VILLAGER,
    displayNameVi: 'Thẩm Phán Hoen Ố',
    descriptionVi:
      'Một lần duy nhất trong ván, có thể yêu cầu hủy toàn bộ phiếu đang bầu và ' +
      'bắt cả làng bỏ phiếu treo cổ lại từ đầu ngay trong ngày đó.',
    hasNightAction: false,
  },
  [RoleName.TWIN_SISTERS]: {
    name: RoleName.TWIN_SISTERS,
    team: Team.VILLAGER,
    displayNameVi: 'Chị Em Sinh Đôi',
    descriptionVi:
      'Ngay đêm đầu tiên, tự động biết danh tính của người chị/em còn lại. ' +
      'Thuần thông tin, không có hiệu ứng chiến đấu nào khác.',
    hasNightAction: false,
  },
  [RoleName.THREE_BROTHERS]: {
    name: RoleName.THREE_BROTHERS,
    team: Team.VILLAGER,
    displayNameVi: 'Ba Anh Em',
    descriptionVi:
      'Ngay đêm đầu tiên, cả ba anh em tự động biết danh tính của nhau. Thuần ' +
      'thông tin, không có hiệu ứng chiến đấu nào khác.',
    hasNightAction: false,
  },
  [RoleName.WILD_CHILD]: {
    name: RoleName.WILD_CHILD,
    team: Team.VILLAGER,
    displayNameVi: 'Kẻ Hoang Dã',
    descriptionVi:
      'Đêm đầu tiên, chọn một người chơi khác làm thần tượng. Nếu thần tượng đó ' +
      'chết vì bất kỳ lý do gì, Kẻ Hoang Dã lập tức đổi phe thành Sói.',
    hasNightAction: true,
  },
  [RoleName.ANGEL]: {
    name: RoleName.ANGEL,
    team: Team.VILLAGER,
    displayNameVi: 'Thiên Sứ',
    descriptionVi:
      'Nếu bị treo cổ ngay trong ngày đầu tiên, trước khi có bất kỳ ai khác chết, ' +
      'Thiên Sứ thắng một mình ngay lập tức. Nếu sống qua ngày 1, trở thành Dân ' +
      'làng bình thường cho phần còn lại của ván.',
    hasNightAction: false,
  },
  [RoleName.FLUTIST]: {
    name: RoleName.FLUTIST,
    team: Team.VILLAGER,
    displayNameVi: 'Người Thổi Sáo',
    descriptionVi:
      'Mỗi đêm, thôi miên thêm tối đa 2 người chơi. Khi tất cả người chơi còn ' +
      'sống đều bị thôi miên, Người Thổi Sáo thắng một mình.',
    hasNightAction: true,
  },
  [RoleName.CULT_LEADER]: {
    name: RoleName.CULT_LEADER,
    team: Team.VILLAGER,
    displayNameVi: 'Giáo Chủ',
    descriptionVi:
      'Mỗi đêm, chiêu mộ thêm 1 người vào giáo phái. Người bị chiêu mộ vẫn giữ ' +
      'vai trò gốc. Khi toàn bộ người chơi còn sống đều thuộc giáo phái, phe ' +
      'Giáo Chủ thắng.',
    hasNightAction: true,
  },
  [RoleName.THIEF]: {
    name: RoleName.THIEF,
    team: Team.VILLAGER,
    displayNameVi: 'Ăn Trộm',
    descriptionVi:
      'Trước khi đêm đầu tiên bắt đầu, được xem 2 lá bài dư và chọn lấy 1 lá ' +
      '(đổi thành vai trò đó) hoặc giữ nguyên vai Ăn Trộm.',
    hasNightAction: false,
  },
  [RoleName.MAID]: {
    name: RoleName.MAID,
    team: Team.VILLAGER,
    displayNameVi: 'Hầu Gái',
    descriptionVi:
      'Không có hành động ban đêm. Khi ai đó sắp bị treo cổ, Hầu Gái có thể ' +
      'chọn thế chỗ — Hầu Gái sẽ chết thay và người kia sống sót nhưng đổi ' +
      'thành vai trò Hầu Gái.',
    hasNightAction: false,
  },
};
