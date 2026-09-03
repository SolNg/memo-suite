export const AUTHOR_QA_MARKER = '【VVV HỎI ĐÁP NGOÀI LỀ VỚI TÁC GIẢ｜TẠM DỪNG NHẬP VAI LƯỢT NÀY】';
export const AUTHOR_QA_PROMPT_ID = 'vvv-author-out-of-character-qa';

export const AUTHOR_QA_PROMPT = Object.freeze({
  identifier: AUTHOR_QA_PROMPT_ID,
  name: '0-09 · Hỏi đáp ngoài lề với tác giả (bật một lượt theo dấu hiệu)',
  role: 'system',
  system_prompt: false,
  marker: false,
  content: `【CHẾ ĐỘ HỎI ĐÁP NGOÀI LỀ VỚI TÁC GIẢ｜LƯỢT NÀY GHI ĐÈ QUY TRÌNH CHÍNH VĂN THÔNG THƯỜNG】
Chỉ thực thi chế độ này khi tin nhắn user mới nhất bắt đầu bằng “${AUTHOR_QA_MARKER}”; nếu không thì bỏ qua hoàn toàn mục này.
Khi thực thi, hãy tạm dừng nhập vai và chính văn tiểu thuyết, chỉ trả lời trực tiếp câu hỏi của người đồng sáng tác ngoài đời với tư cách tác giả “Nhà văn sa cơ”.
- Chế độ này được ưu tiên hơn ECoT, neo văn phong, thanh trạng thái và định dạng chính văn của mạch truyện thông thường. Không chạy khuôn mẫu chuỗi suy luận của chính văn thường.
- Bắt buộc trả lời dựa trên những gì thực sự nhìn thấy trong ngữ cảnh lượt này: thẻ nhân vật, Persona của user, sách thế giới đang bật, lời mở đầu và lịch sử trò chuyện.
- Ưu tiên làm rõ: người đồng sáng tác đang vào vai ai, char/NPC là ai, thân phận của từng nhân vật, quan hệ và xung đột, tình thế mở màn, những tình tiết đã xảy ra, và nhập vai thế nào để tiếp nối cho mượt.
- Phân biệt rạch ròi “tư liệu ghi rõ”, “suy ra từ mạch truyện” và “tư liệu không ghi / không thấy trong ngữ cảnh hiện tại”; không biết thì nói thẳng, cấm bịa ra cho có vẻ am hiểu.
- Không nói thay nhân vật, không đẩy mạch truyện, không xuất chính văn, thanh trạng thái, chuỗi suy luận, thẻ tác giả cà khịa, ý tưởng cho bản thảo kế tiếp, điện thoại nhỏ hay Bảy điều hậu trường.
- Chỉ xuất câu trả lời cuối cùng bằng tiếng Việt; ký tự hiển thị đầu tiên bắt buộc phải là “Tác giả trả lời:”. Không được lấy phần lập kế hoạch, phần suy nghĩ hay phân tích tiếng Anh làm câu trả lời.
- Câu trả lời cuối cùng không được để trống, cũng không được kết thúc sinh nội dung ngay ở giai đoạn suy nghĩ. Khi có nhiều thông tin thì trình bày theo từng ý.
Chế độ này chỉ kéo dài một lượt; tin nhắn user thông thường kế tiếp không mang dấu hiệu này sẽ tự động khôi phục nhập vai.`,
});

function messageText(message) {
  return String(message?.mes ?? message?.message ?? message?.text ?? '');
}

export function latestAuthorQaExchange(chat) {
  const rows = Array.isArray(chat) ? chat : [];
  let assistantIndex = -1;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const message = rows[index];
    if (!message || message.is_system) continue;
    if (message.is_user) return null;
    assistantIndex = index;
    break;
  }
  if (assistantIndex < 0) return null;

  let userIndex = -1;
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const message = rows[index];
    if (!message || message.is_system) continue;
    if (!message.is_user) continue;
    if (!messageText(message).trimStart().startsWith(AUTHOR_QA_MARKER)) return null;
    userIndex = index;
    break;
  }
  if (userIndex < 0) return null;

  const user = rows[userIndex];
  const fingerprint = String(user?.send_date ?? user?.sendDate ?? messageText(user).length);
  return {
    userIndex,
    assistantIndex,
    userKey: `${userIndex}:${fingerprint}:${messageText(user).slice(0, 80)}`,
  };
}

export function hasVisibleAuthorQaAnswer(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, '')
    .length > 0;
}
