# Rà soát và kế hoạch hoàn thiện VocaMate

## Cập nhật triển khai

Đã thực hiện các giai đoạn nền tảng, tra từ và MVP trong `src/`. Quyết định triển khai đã thay đổi so với đề xuất ban đầu: extension gọi hai dịch vụ qua background worker và hoạt động không cần backend riêng; mã Next.js mẫu đã được loại bỏ. Lý do: không có thông tin hosting/API key, và mục tiêu là một extension cài vào dùng được ngay. Khi cần dịch vụ có cam kết vận hành, thay adapter trong worker bằng API do dự án quản lý.

Các phần đã làm: cấu trúc Plasmo thống nhất dưới `src`, popup thật, worker với timeout/cache, giao diện chọn chữ, lưu/tìm/xóa từ, bật/tắt toàn cục/theo site, audio khi có, test adapter, README. Các bước xác nhận môi trường production vẫn cần nhà cung cấp dịch ổn định và thử trên trình duyệt/profile người dùng thực tế. Bảng dưới đây giữ nguyên như biên bản rà soát ban đầu; mục "hướng xử lý" là đề xuất tại thời điểm rà soát, không còn là trạng thái hiện hành.

Ngày: 28/09/2026. Phạm vi: toàn bộ mã nguồn, cấu hình, README và dependency khai báo/lockfile trong folder hiện tại. Chỉ bổ sung tài liệu này, chưa sửa mã ứng dụng.

## 1. Kết luận và giới hạn kiểm chứng

Đây là prototype tra từ trên trang web: bôi đen tối đa 50 ký tự, bấm tra, nhận nghĩa Việt, phiên âm và tối đa 3 câu ví dụ. Có cache trong bộ nhớ từng trang. Chưa có lưu từ, phát âm, ôn tập hay cài đặt thực tế.

Đã đọc toàn bộ file mã nguồn và cấu hình, đối chiếu dependency trực tiếp trong lockfile. Node/npm có sẵn, nhưng chưa có node_modules; chưa cài dependency, chạy build/typecheck, gọi dịch vụ thật hoặc kiểm tra trên trình duyệt. Vì vậy các lỗi tương tác và kết quả build cần được tái hiện ở bước đầu triển khai. Đây không phải kiểm toán lỗ hổng dependency.

## 2. Các phát hiện

P0 = nền tảng cần xử lý trước; P1 = độ đúng và ổn định; P2 = hoàn thiện trải nghiệm.

| Mức | Vị trí | Phát hiện và tác động | Hướng xử lý |
|---|---|---|---|
| P0 | popup.tsx, src/content.tsx | Entry đặt lẫn root và src, không theo cấu trúc src của Plasmo; có nguy cơ bỏ sót entry khi build. | Đưa các entry vào src, sửa alias; kiểm tra manifest sinh ra có popup và content script. |
| P0 | src/app, package.json | Có code Next.js nhưng không khai báo Next.js, Tailwind hoặc script chạy server. Plasmo dev không khởi chạy API này. | Tách backend thành package riêng, có dependency, cấu hình và script độc lập; bỏ trang mẫu không phục vụ sản phẩm. |
| P0 | tsconfig.json | TypeScript được khóa ở 5.3.3 nhưng ignoreDeprecations đặt 6.0; include còn gom cả mã Next.js và LayoutProps chưa được sinh. | Căn chỉnh cấu hình theo compiler được chọn, tách phạm vi typecheck extension/backend; xác nhận bằng tsc. |
| P0 | src/content.tsx | API bị hardcode localhost:3000; người dùng cài extension chưa có backend sẽ không tra được. | Tách môi trường dev/prod; bản phân phối dùng API HTTPS đã triển khai. |
| P1 | src/content.tsx | Không kiểm tra res.ok/schema; HTTP 500 trả JSON vẫn vào nhánh thành công và được cache. | Chuẩn hóa kết quả thành công/lỗi; chỉ cache dữ liệu hợp lệ. |
| P1 | src/content.tsx | Không chặn phản hồi cũ: tra A rồi B, A trả sau có thể thay dữ liệu của B; finally của A cũng có thể tắt loading của B. | Request ID cho toàn bộ state updates; hủy request khi phù hợp; bỏ phản hồi lỗi thời. |
| P1 | src/content.tsx | Listener mouseup toàn document không loại trừ UI của extension; thao tác trên nút/thẻ có thể reset selection hoặc đóng thẻ. | Kiểm tra composedPath/host Shadow DOM; lưu selection trước tương tác; kiểm chứng bằng trình duyệt. |
| P1 | src/content.tsx | Floating UI chưa khai báo strategy fixed nhưng style ép fixed; rect chỉ chụp một lần, thiếu cập nhật khi cuộn/resize. | Đồng bộ strategy; cập nhật từ Range sống hoặc đóng thẻ khi selection mất hiệu lực. |
| P1 | src/content.tsx | Cache không TTL/giới hạn; key lowercase có thể gộp các trường hợp phân biệt hoa thường như US/us. | Chuẩn hóa Unicode/khoảng trắng, giữ thông tin cần phân biệt; TTL, giới hạn và cache version. |
| P1 | src/content.tsx | Fetch chạy trực tiếp từ content script; host_permissions không tự bỏ qua CORS của trang. | Chuyển request sang background service worker qua message có schema và endpoint cố định. |
| P1 | src/app/api/xray/route.ts | Không validate kiểu, độ dài, giá trị rỗng của word; giới hạn UI không bảo vệ API. | Validate phía server và worker, giới hạn kích thước request; lỗi 400 rõ ràng. |
| P1 | src/app/api/xray/route.ts | Không timeout, không kiểm tra HTTP của dịch, hai dịch vụ gọi tuần tự; lỗi mạng ở từ điển làm mất cả nghĩa đã dịch. | Timeout riêng, gọi độc lập/song song, xử lý kết quả từng phần và mã lỗi upstream. |
| P1 | src/app/api/xray/route.ts | Chỉ lấy transData[0][0][0], có thể mất các đoạn dịch tiếp theo. | Adapter parse toàn bộ các đoạn cần thiết, test với dữ liệu nhiều đoạn. |
| P1 | API và UI | contextual_meaning chỉ là bản dịch đoạn được chọn; collocations thực chất là câu ví dụ, chưa có phân tích ngữ cảnh/collocation. | Đổi tên thành translation/examples, mô tả đúng chức năng. |
| P1 | API, package.json | CORS wildcard, chưa có giới hạn lưu lượng; quyền HTTPS mọi host rộng hơn nhu cầu gọi API. | Cấu hình origin theo môi trường, rate limit khi public; CORS không thay thế xác thực/chống lạm dụng. Tách quyền chạy trên trang và quyền gọi API. |
| P2 | popup.tsx | Popup vẫn là mẫu Plasmo, input không tra từ hay lưu dữ liệu. | Thay bằng tra từ thủ công, bật/tắt và truy cập danh sách từ. |
| P2 | UI | Thiếu Escape, thao tác bàn phím cho selection, trạng thái rỗng/thử lại, nhãn nút đóng và thông báo trợ năng. | Bổ sung hành vi và accessibility, giữ focus trang nếu người dùng đang đọc. |
| P2 | README, metadata | VocaMate/VocaHabit/Vocahabit không thống nhất; README mẫu có đoạn cuối lỗi encoding; chưa có hướng dẫn backend. | Dùng VocaMate làm tên đề xuất, viết lại README UTF-8 và hướng dẫn thực tế. |
| P2 | toàn repo | Chưa có test, CI, hướng dẫn môi trường hoặc quy trình phát hành. | Thêm kiểm tra đúng các lỗi trọng yếu, CI build/typecheck/test và checklist cài bản đóng gói. |

## 3. Phạm vi sản phẩm đề xuất

MVP ổn định: tra Anh–Việt từ/cụm từ trên trang; tra thủ công trong popup; nghĩa, phiên âm, câu ví dụ và nguồn dữ liệu; thông báo lỗi dễ hiểu; bật/tắt theo website; lưu và xóa từ ở máy; nghe phát âm khi có nguồn âm thanh phù hợp.

Tạm để sau MVP: tài khoản, đồng bộ đám mây, AI giải nghĩa theo câu, flashcard có lịch ôn tập, OCR/PDF và dịch cả trang. Đây là các tính năng mới, không phải điều kiện sửa xong prototype hiện tại.

Kiến trúc đề xuất: content UI/popup -> message tra từ -> background service worker -> backend HTTPS -> adapter dịch và từ điển. Cài đặt/từ đã lưu dùng chrome.storage.local, tách khỏi cache tạm. Worker không nhận URL tùy ý từ content script. Không giữ API key bí mật trong extension.

Giữ backend nhưng tách khỏi source extension để tận dụng code hiện có và quản lý provider. Trước khi phát hành phải chọn nguồn dịch với giới hạn sử dụng và vận hành phù hợp; endpoint Google hiện tại chưa được xác minh về cam kết dịch vụ. Không dựa vào nó như một dịch vụ có bảo đảm. Việc chọn hosting/provider trả phí và triển khai thực tế nằm ngoài bước lập kế hoạch này.

## 4. Trình tự triển khai

### Giai đoạn 1 — Cấu trúc và build

- Ghi lại lỗi baseline bằng cài dependency theo lockfile, typecheck và build.
- Chuẩn hóa entry Plasmo dưới src; tách backend, tsconfig và dependency riêng.
- Thêm script dev/build/typecheck cho từng phần, file mẫu biến môi trường và gitignore.
- Bỏ code/trang mẫu không còn dùng; thống nhất tên hiển thị.
- Nghiệm thu: build sạch từ checkout mới; manifest có đúng content script, popup, worker và quyền dự kiến; nạp unpacked thành công; API chạy bằng lệnh được ghi trong README.

### Giai đoạn 2 — Luồng tra từ đáng tin cậy

- Định nghĩa LookupRequest, LookupResult và LookupError; bỏ any ở ranh giới dữ liệu.
- Tách phần gọi provider, parse kết quả và kiểm tra schema khỏi UI.
- Chuyển giao tiếp mạng qua worker; validate message, giữ endpoint cố định; phân biệt cấu hình dev/prod.
- Sửa lỗi HTTP, dữ liệu sai, race condition và timeout; giữ kết quả từng phần khi một nguồn thất bại.
- Cache chỉ thành công, có TTL/giới hạn và cơ chế tránh yêu cầu trùng.
- Nghiệm thu: không hiện nghĩa của A dưới tiêu đề B; lỗi 429/500/JSON sai không được cache; thiếu phiên âm/ví dụ vẫn hiện nghĩa; yêu cầu hết thời gian thoát loading.

### Giai đoạn 3 — Tinh chỉnh tương tác

- Sửa selection, loại trừ thao tác bên trong extension và vùng nhập liệu nhạy cảm.
- Sửa định vị, cuộn, resize, sát mép màn hình và văn bản nhiều dòng; giới hạn chiều cao thẻ.
- Cho phép chọn bằng bàn phím, đóng bằng Escape, bấm ngoài, thử lại; nút có accessible name và trạng thái loading có thông báo.
- Đổi lỗi kỹ thuật kiểu “kiểm tra Backend Next.js” thành thông báo người dùng hiểu được.
- Nghiệm thu: bấm tra/đóng/chép nội dung không tự mở lại hoặc mất thẻ ngoài ý muốn; thẻ không tràn viewport; thao tác bàn phím hoàn thành được luồng tra.

### Giai đoạn 4 — Hoàn thiện MVP

- Popup thật: ô tra thủ công, bật/tắt toàn cục và theo website, mở danh sách từ đã lưu.
- Lưu từ gồm văn bản, nghĩa, phiên âm/ví dụ nếu có, thời điểm; lưu URL nguồn khi người dùng chủ động chọn. Có chống trùng, tìm kiếm và xóa.
- Phát âm khi có audio hợp lệ, báo rõ khi không có; không tự phát tiếng.
- Thêm cài đặt và giải thích dữ liệu gửi tới bên thứ ba, nút xóa dữ liệu cục bộ.
- Nghiệm thu: cài đặt và từ đã lưu tồn tại sau restart, đồng bộ trạng thái giữa popup/tab, trang bị tắt không hiện nút tra; xử lý lỗi ghi storage.

### Giai đoạn 5 — Kiểm chứng và đóng gói

- Unit test các adapter và quy tắc cache/schema; integration test timeout, lỗi một nguồn và phản hồi đảo thứ tự.
- Test trình duyệt trên trang HTTP/HTTPS, trang dài, SPA, vùng cuộn lồng nhau, selection nhiều dòng và UI trong Shadow DOM.
- Xác định rõ phạm vi iframe, trang trình duyệt nội bộ và PDF; không hứa hỗ trợ trước khi kiểm chứng.
- Kiểm tra bản production không còn localhost, quyền đúng, không lộ secret, không ghi log nội dung tra không cần thiết.
- CI: cài theo lockfile, typecheck, test và build; kiểm tra dependency khi triển khai, tránh nâng major hàng loạt không liên quan.
- Nghiệm thu: cài artifact cuối trên profile Chrome sạch, dùng API production không cần server local; README đủ để người khác dựng lại; đóng gói sẵn sàng để người dùng quyết định phát hành.

## 5. Ma trận kiểm tra trọng yếu

| Tình huống | Kết quả mong muốn |
|---|---|
| Từ hợp lệ, cụm từ, từ không tồn tại | Hiện kết quả hoặc trạng thái không tìm thấy đúng, không crash |
| Rỗng, hơn 50 ký tự, body sai kiểu | UI bỏ qua hoặc API trả lỗi validation rõ ràng |
| Tra A rồi B, A trả sau | Chỉ B được phép cập nhật thẻ đang mở |
| Đóng thẻ/chọn nội dung khác lúc loading | Phản hồi cũ không mở lại hoặc ghi đè thẻ |
| Một provider lỗi hoặc không có từ | Phần dữ liệu còn dùng được vẫn hiển thị |
| Mất mạng, timeout, 429, 500, JSON sai | Thoát loading, có thông báo/thử lại, không cache lỗi |
| Cuộn/zoom/resize, selection sát mép | Thẻ bám vị trí hợp lệ hoặc đóng có chủ đích |
| Bấm trong thẻ, Shadow DOM, chọn bằng bàn phím | Không reset selection sai; điều khiển truy cập được |
| Restart trình duyệt/worker | Từ đã lưu và cài đặt còn; không phụ thuộc biến bộ nhớ để bảo toàn dữ liệu |
| Website bị tắt và vùng nhập liệu | Không xuất hiện UI hoặc gửi nội dung ngoài ý muốn |

## 6. Tài liệu đối chiếu

- Plasmo src layout: https://docs.plasmo.com/framework/customization/src
- Chrome cross-origin requests và giới hạn content script: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- Floating UI positioning: https://floating-ui.com/docs/useFloating

Ưu tiên thực hiện: giai đoạn 1 → 2 → 3, xác nhận luồng tra ổn định, rồi làm 4 → 5. Chưa cần đổi framework hoặc bổ sung AI để giải quyết các vấn đề hiện tại.
