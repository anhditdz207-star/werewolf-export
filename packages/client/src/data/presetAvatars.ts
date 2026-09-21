export interface PresetAvatar {
  id: string;
  label: string;
  src: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'mystery', label: 'Ẩn danh', src: '/ui/avatars/mystery.jpg' },
  { id: 'soi', label: 'Sói', src: '/ui/avatars/soi.jpg' },
  { id: 'soidaudan', label: 'Sói đầu đàn', src: '/ui/avatars/soidaudan.jpg' },
  { id: 'soicon', label: 'Sói con', src: '/ui/avatars/soicon.jpg' },
  { id: 'danlang', label: 'Dân làng', src: '/ui/avatars/danlang.jpg' },
  { id: 'gialang', label: 'Già làng', src: '/ui/avatars/gialang.jpg' },
  { id: 'tientri', label: 'Tiên tri', src: '/ui/avatars/tientri.jpg' },
  { id: 'phuthuy', label: 'Phù thủy', src: '/ui/avatars/phuthuy.jpg' },
  { id: 'baove', label: 'Bảo vệ', src: '/ui/avatars/baove.jpg' },
  { id: 'thosan', label: 'Thợ săn', src: '/ui/avatars/thosan.jpg' },
  { id: 'cupis', label: 'Cupid', src: '/ui/avatars/cupis.jpg' },
];
