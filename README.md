# VocaMate

VocaMate là extension cho Chrome giúp tra nghĩa tiếng Việt, xem phiên âm, nghe phát âm và lưu từ tiếng Anh ngay khi đọc trang web. Dự án được xây dựng bằng Plasmo, React và TypeScript.

## Cài đặt để dùng thử

1. Cài [Node.js](https://nodejs.org/) phiên bản 22 trở lên và npm.
2. Mở terminal **tại thư mục chứa `package.json` này**, rồi chạy:

   ```bash
   npm ci
   npm run build
   ```

3. Mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển** (Developer mode), chọn **Tải tiện ích đã giải nén** (Load unpacked).
4. Chọn thư mục **`build/chrome-mv3-prod`** vừa tạo. Thư mục được chọn phải chứa file `manifest.json`; không chọn thư mục mã nguồn hoặc file ZIP.
5. Tải lại các trang web đã mở trước khi thử bôi đen từ.

Nếu đã cài bản cũ, sau khi chạy `npm run build`, bấm **Tải lại** (Reload) trên thẻ VocaMate tại `chrome://extensions`, rồi tải lại trang web đang đọc. Bản ZIP để lưu hoặc phân phối có thể tạo bằng `npm run package` và nằm tại `build/chrome-mv3-prod.zip`.

## Cách sử dụng

- **Tra ngay trên trang:** Bôi đen một từ hoặc cụm từ tiếng Anh, bấm **Tra nghĩa**. Thẻ kết quả hiện nghĩa, phiên âm và ví dụ khi có dữ liệu. Bấm **Nghe** để phát âm hoặc **Lưu từ** để đưa vào danh sách.
- **Dịch đoạn:** Bôi đen đoạn văn dài hơn 50 ký tự, bấm **Dịch đoạn**. Giới hạn mỗi lần dịch là 2.000 ký tự.
- **Tra trong popup:** Bấm biểu tượng VocaMate trên thanh công cụ, nhập từ hoặc cụm từ tối đa 50 ký tự và bấm **Tra**. Tại đây có thể nghe, lưu, tìm kiếm và xóa từ đã lưu.
- **Tùy chỉnh:** Trong popup có công tắc bật/tắt VocaMate trên mọi trang hoặc riêng website hiện tại.

Nút **Nghe** dùng giọng tiếng Anh có sẵn trong trình duyệt/máy, ưu tiên giọng Anh-Mỹ và đọc chậm hơn mặc định. Chất giọng thực tế phụ thuộc vào các giọng đã cài trên máy. Bấm nghe từ khác sẽ dừng âm đang phát.

## Nguồn dữ liệu và quyền riêng tư

- Nghĩa và ví dụ được lấy từ yêu cầu dịch tới Google Translate. Một số phiên âm đã được đối chiếu với [Cambridge Dictionary](https://dictionary.cambridge.org/pronunciation/) để sửa các mục sai trong CMU. Với các từ khác, extension ưu tiên phiên âm Anh-Mỹ từ [FreeDictionaryAPI.com](https://freedictionaryapi.com/) và Wiktionary, rồi dùng [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) đóng gói sẵn nếu dịch vụ không trả kịp hoặc không có từ. Khi dùng dữ liệu FreeDictionaryAPI, thẻ kết quả hiển thị liên kết ghi nguồn.
- Văn bản bạn chủ động tra được gửi tới các dịch vụ trên để lấy kết quả. Danh sách từ và cài đặt lưu trong `chrome.storage.local` trên trình duyệt, không tự đồng bộ. Danh sách giữ tối đa 500 từ; lưu lại cùng một từ sẽ cập nhật mục cũ.
- Extension chỉ yêu cầu quyền `storage`, `activeTab` và truy cập tới các máy chủ dịch/từ điển được khai báo trong `package.json`.

## Giới hạn hiện tại

- Cần kết nối mạng để tra nghĩa. Endpoint Google Translate hiện dùng là endpoint công khai, nên tra cứu có thể lỗi nếu dịch vụ thay đổi hoặc giới hạn yêu cầu.
- Một số từ mới, tên riêng hoặc thuật ngữ hiếm có thể chưa có phiên âm hay ví dụ. Phiên âm CMU được chuyển sang IPA theo giọng Anh-Mỹ gần đúng; các giọng đọc khác có thể khác.
- Phạm vi kiểm tra và các mục đã sửa theo Cambridge được ghi trong [báo cáo rà soát phiên âm](vocaMate-extension-main/PRONUNCIATION-AUDIT.md).
- Nút tra trên trang chỉ hoạt động ở trang HTTP/HTTPS cho phép content script. Các trang hệ thống của Chrome, Chrome Web Store và một số PDF/iframe không hỗ trợ.

## Phát triển và kiểm tra

```bash
npm ci
npm run dev        # tạo bản phát triển trong build/chrome-mv3-dev
npm run typecheck
npm test
npm run build      # tạo bản dùng thử trong build/chrome-mv3-prod
npm run package    # đóng gói bản production thành ZIP
```

Mã nguồn chính: `src/content.tsx` hiển thị nút/thẻ trên trang, `src/popup.tsx` là cửa sổ tra từ, `src/background.ts` xử lý yêu cầu và cache tạm. Các hàm tra cứu, phiên âm, phát âm và lưu dữ liệu nằm trong `src/lib/`; các bài kiểm tra nằm trong `tests/`.

Giấy phép và ghi nhận dữ liệu/thư viện CMU nằm trong [`NOTICE.txt`](NOTICE.txt), cũng được chép vào bản build. Nếu phát hành rộng rãi, cần xem lại điều khoản và hạn mức của các dịch vụ dữ liệu đang dùng.
