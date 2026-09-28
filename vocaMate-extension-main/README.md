# VocaMate

Extension Chrome giúp tra và lưu từ tiếng Anh trong lúc đọc web.

## Tính năng

- Bôi đen từ hoặc cụm từ (tối đa 50 ký tự), bấm **Tra nghĩa** để xem nghĩa tiếng Việt, cách đọc và ví dụ. Nút **Nghe** ưu tiên audio từ điển nếu có; khi dùng giọng của trình duyệt, extension chọn giọng tiếng Anh phù hợp và đọc chậm hơn để dễ nghe.
- Khi chọn đoạn dài hơn 50 ký tự, nút **Dịch đoạn** xuất hiện và hiển thị bản dịch. Dịch tối đa 2.000 ký tự mỗi lần; đoạn dài hơn vẫn hiện nút và báo giới hạn khi bấm.
- Tra thủ công trong popup; lưu, tìm, xóa từng từ hoặc xóa toàn bộ từ trên máy.
- Bật/tắt extension toàn cục hoặc cho website hiện tại trong popup.
- Nghĩa và ví dụ hiện từ yêu cầu dịch. Phiên âm còn thiếu được bổ sung nhanh từ [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) lưu trong extension, hoặc từ [FreeDictionaryAPI.com](https://freedictionaryapi.com/) và Wiktionary. Từ đã lưu dùng `chrome.storage.local` và không tự đồng bộ.

## Yêu cầu và chạy thử

- Node.js 22+ và npm (test dùng khả năng chạy TypeScript của Node).
- `npm ci`
- `npm run dev` để phát triển, hoặc `npm run build` để tạo bản dùng thử.
- Mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và trỏ tới `build/chrome-mv3-dev` hoặc `build/chrome-mv3-prod` tương ứng.
- Kiểm tra: `npm run typecheck`, `npm test`, `npm run build`.

Trong bản này, extension cần mạng để tra nghĩa. Google Translate endpoint đang dùng là endpoint công khai không có cam kết vận hành; khi dịch vụ đổi hoặc giới hạn request, tra nghĩa có thể lỗi. Phiên âm cục bộ lấy từ dữ liệu tiếng Anh Mỹ của CMU; cách chuyển ARPAbet sang IPA có thể chưa phản ánh mọi giọng đọc. Từ mới, tên riêng hoặc thuật ngữ hiếm vẫn có thể không có phiên âm. Nguồn FreeDictionaryAPI.com có [yêu cầu ghi nguồn và giới hạn request](https://freedictionaryapi.com/); thông tin nguồn được hiển thị khi dữ liệu của họ được dùng. Giấy phép thư viện và ghi nhận CMU nằm trong `NOTICE.txt` và bản đóng gói. Muốn phát hành ở quy mô lớn cần chọn nhà cung cấp dịch có điều khoản/giới hạn phù hợp, và nếu có API key bí mật thì đặt ở backend riêng. Không nhúng key vào extension.

## Cấu trúc

- `src/content.tsx`: nút và thẻ tra từ trên website.
- `src/popup.tsx`: tra thủ công, cài đặt và danh sách từ.
- `src/background.ts`: gọi dịch vụ, timeout và cache tạm.
- `src/lib/lookup.ts`: chuẩn hóa và đọc kết quả API.
- `src/lib/dictionary.ts`, `src/lib/pronunciation.ts`: bổ sung IPA từ nguồn từ điển và dữ liệu cục bộ.
- `src/lib/storage.ts`: cài đặt và từ đã lưu.
- `tests/`: test dữ liệu trả về và lỗi upstream.

Extension chỉ chạy trên trang HTTP/HTTPS thông thường. Các trang hệ thống của trình duyệt, Chrome Web Store và một số PDF/iframe không hỗ trợ content script theo giới hạn của trình duyệt. Dữ liệu từ đã lưu tối đa 500 mục, từ mới sẽ thay mục cũ cùng chữ.
