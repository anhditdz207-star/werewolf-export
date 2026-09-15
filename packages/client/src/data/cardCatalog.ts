export interface CardInfo {
  id: string;
  title: string;
  description: string;
}

export const CARD_CATALOG: CardInfo[] = [
  { id: 'danthuong', title: 'Dân Thường', description: 'Không có chức năng đặc biệt vào ban đêm, nhiệm vụ duy nhất là suy luận và biểu quyết treo cổ Sói vào ban ngày.' },
  { id: 'masoi', title: 'Ma Sói Thường', description: 'Đêm thức giấc cùng nhau để chọn một nạn nhân để cắn.' },
  { id: 'soicon', title: 'Sói Con', description: 'Nếu Sói Con bị treo cổ hoặc bị giết, đêm tiếp theo phe Sói sẽ được cắn liên tiếp 2 người.' },
  { id: 'soicha', title: 'Sói Cha', description: 'Có khả năng đặc biệt (dùng 1 lần/game): Biến nạn nhân bị cắn đêm đó thành Ma Sói thay vì giết họ.' },
  { id: 'soiking', title: 'Sói Đầu Đàn (Sói Tàn Bạo)', description: 'Thức dậy cắn người cùng đàn Sói, sau đó được thức riêng cắn thêm 1 người nữa (chức năng này mất đi khi có một con Sói khác trong đàn chết).' },
  { id: 'tientri', title: 'Tiên Tri', description: 'Mỗi đêm được chỉ định 1 người để biết họ là phe Sói hay phe Dân.' },
  { id: 'phuthuy', title: 'Phù Thủy', description: 'Sở hữu 2 bình thuốc (1 bình cứu người chết, 1 bình giết người), mỗi bình chỉ dùng 1 lần trong suốt game.' },
  { id: 'thosan', title: 'Thợ Săn', description: 'Khi chết (vì bất kỳ lý do gì), được quyền chỉ định và kéo theo một người khác chết chung ngay lập tức.' },
  { id: 'baove', title: 'Bảo Vệ', description: 'Mỗi đêm chọn bảo vệ 1 người khỏi sự tấn công của Sói (không được bảo vệ 1 người 2 đêm liên tiếp).' },
  { id: 'gialang', title: 'Già Làng', description: 'Có 2 mạng trước sự tấn công của Sói. Tuy nhiên, nếu Già Làng bị Dân Làng treo cổ hoặc bị Phù Thủy đầu độc, tất cả Dân Làng chức năng sẽ mất hết năng lực.' },
  { id: 'cupis', title: 'Thần Tình Yêu (Cupid)', description: "Vào đêm đầu tiên, ghép đôi 2 người bất kỳ thành một cặp 'sống chết có nhau'." },
  { id: 'tihi', title: 'Cô Bé', description: 'Được phép hé mắt nhìn trộm lúc phe Sói đang thức giấc (nhưng nếu bị Sói phát hiện thì cực kỳ nguy hiểm).' },
  { id: 'antrom', title: 'Ăn Trộm', description: 'Đầu game được chọn vai trò từ 2 lá bài thừa được đặt riêng ra ngoài.' },
  { id: 'thangngoc', title: 'Thằng Ngốc', description: 'Nếu bị cả làng bỏ phiếu treo cổ, Thằng Ngốc sẽ lộ vai trò, được tha chết nhưng mất quyền bỏ phiếu từ đó về sau.' },
  { id: 'kethethan', title: 'Kẻ Thế Thân', description: 'Nếu lượt bỏ phiếu ban ngày kết thúc với kết quả hòa, Kẻ Thế Thân sẽ là người phải chết thay.' },
  { id: 'sinhdoi', title: 'Chị Em Sinh Đôi', description: 'Thức dậy đêm đầu tiên để nhận diện nhau, biết chắc chắn người kia là phe Dân.' },
  { id: 'baae', title: 'Ba Anh Em', description: 'Tương tự như Chị Em Sinh Đôi nhưng gồm 3 người.' },
  { id: 'hiepsikr', title: 'Hiệp Sĩ Kiếm Rỉ', description: 'Nếu bị Sói cắn chết, con Sói nằm ngay bên trái Hiệp Sĩ sẽ bị lây nhiễm độc và chết vào đêm tiếp theo.' },
  { id: 'thamphan', title: 'Thẩm Phán Hoen Ố', description: 'Có quyền yêu cầu Quản trò tổ chức một cuộc bỏ phiếu thứ hai ngay trong ngày nếu cuộc bỏ phiếu đầu tiên không như ý.' },
  { id: 'Nnuoigau', title: 'Người Nuôi Gấu', description: 'Vào buổi sáng, nếu có ít nhất một con Sói nằm cạnh Người Nuôi Gấu, Quản trò sẽ giả tiếng gấu gầm để cảnh báo cả làng.' },
  { id: 'haugai', title: 'Hầu Gái', description: 'Trước khi một người bị treo cổ lộ vai trò, Hầu Gái có thể chọn thế chỗ và lấy luôn chức năng của người đó.' },
  { id: 'cao', title: 'Cáo', description: 'Mỗi đêm chọn một nhóm 3 người cạnh nhau. Nếu có Sói, Quản trò gật đầu.' },
  { id: 'soitrang', title: 'Sói Trắng', description: 'Thức dậy cùng đàn Sói, nhưng mỗi 2 đêm lại được thức riêng để chọn cắn chết một con Sói khác. Sói Trắng thắng đơn độc khi là người cuối cùng sống sót.' },
  { id: 'Nthoisao', title: 'Người Thổi Sáo', description: 'Mỗi đêm thôi miên 2 người. Người Thổi Sáo thắng khi tất cả những người còn sống trong làng đều đã bị thôi miên.' },
  { id: 'thiensu', title: 'Thiên Sứ', description: 'Thắng cuộc ngay lập tức nếu dụ được cả làng bỏ phiếu treo cổ mình ngay trong ngày đầu tiên.' },
  { id: 'giaochu', title: 'Giáo Chủ', description: 'Mỗi đêm thu nạp 1 người vào giáo phái của mình. Giáo Chủ thắng khi tất cả những người còn sống đều thuộc giáo phái.' },
  { id: 'kehoangda', title: 'Kẻ Hoang Dã', description: "Đêm đầu tiên chọn một 'thần tượng'. Nếu thần tượng còn sống, Kẻ Hoang Dã là phe Dân. Nếu thần tượng chết, Kẻ Hoang Dã biến thành Sói." },
  { id: 'cstruong', title: 'Trưởng Làng', description: 'Được cả làng bỏ phiếu bầu chọn vào ban ngày đầu tiên. Phiếu biểu quyết của Trưởng Làng được tính là 2 phiếu. Khi chết, người giữ chức danh này có quyền chỉ định người kế nhiệm.' },
];
