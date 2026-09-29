# Kiểm tra VocaMate trên Chrome

Chạy `npm run package`, rồi tải thư mục `build/chrome-mv3-prod` bằng **Load unpacked** trên một profile Chrome thử nghiệm.

## Luồng cần xác nhận

1. Bôi đen một từ trên trang HTTPS và bấm **Tra nghĩa**. Kết quả phải hiện trong viewport; cuộn trang hoặc đổi kích thước cửa sổ không làm thẻ tràn ra ngoài.
2. Chọn từ sát cạnh phải và gần cuối màn hình. Thẻ phải chuyển lên trên khi bên dưới không đủ chỗ. Cuộn vùng chọn ra khỏi màn hình thì thẻ đóng.
3. Chọn chữ bằng bàn phím, tra từ, bấm **Nghe**, **Lưu từ**, rồi nhấn Escape. Nút trong thẻ không làm mất kết quả tra ngoài ý muốn.
4. Mở hai tab, lưu hai từ khác nhau gần như cùng lúc. Popup phải giữ cả hai; thử xóa một từ và xóa toàn bộ.
5. Tắt VocaMate theo website trong popup. Trang đó không còn hiện nút tra sau khi cài đặt cập nhật; website khác vẫn hoạt động.
6. Ngắt mạng hoặc chặn dịch vụ dịch để kiểm tra thông báo lỗi và nút thử lại. Kết nối lại phải tra được cùng từ; lỗi không được cache.
7. Tra một từ có phiên âm CMU dự phòng như `datasets`. Phiên âm phải hiện sau kết quả nghĩa và không có lỗi đọc `cmu-pronunciations.json` trong service worker.
8. Đóng và mở lại Chrome. Từ đã lưu và cài đặt phải còn.

Kiểm tra thêm trên trang dài, trang SPA, vùng cuộn lồng nhau và trang có nội dung Shadow DOM. Phạm vi PDF/iframe và trang nội bộ Chrome vẫn theo giới hạn ghi trong README.
