# Rà soát phiên âm (28/09/2026)

## Phạm vi

Đã sàng lọc 49 từ tiếng Anh thường gặp trong nội dung kỹ thuật bằng cách so phiên âm cục bộ của extension với dữ liệu FreeDictionaryAPI/Wiktionary. Các trường hợp nghi ngờ được đối chiếu trực tiếp với **phiên âm US** trên Cambridge Dictionary. Đây là một mẫu có chủ đích, **không phải kiểm tra toàn bộ từ trong CMU**.

Khi so sánh, bỏ qua khác biệt thuần ký hiệu như dấu tách âm tiết `.`, độ dài `ː`, `/r/` so với `/ɹ/`, và âm bật lưỡi `/t̬/`. Chỉ sửa khác biệt về nguyên âm, trọng âm hoặc vùng giọng ảnh hưởng đến cách đọc.

## Những mục đã xác nhận và sửa

| Từ | Trước khi sửa | Hiện tại | Đối chiếu Cambridge |
| --- | --- | --- | --- |
| stochastic | `/stoʊˈkæstɪk/` | `/stəˈkæstɪk/` | [stochastic](https://dictionary.cambridge.org/pronunciation/english/stochastic) |
| algorithm | `/ˈælɡɚˌɪðəm/` | `/ˈælɡɚɪðəm/` | [algorithm](https://dictionary.cambridge.org/pronunciation/english/algorithm) |
| analysis | `/əˈnæləsəs/` | `/əˈnæləsɪs/` | [analysis](https://dictionary.cambridge.org/pronunciation/english/analysis) |
| asynchronous | `/ˈeɪˈsɪŋkɹənəs/` | `/eɪˈsɪŋkɹənəs/` | [asynchronous](https://dictionary.cambridge.org/pronunciation/english/asynchronous) |
| classification | API có thể trả `/ˌklæsɪfɪˈkeɪʃən/` | `/ˌklæsəfəˈkeɪʃən/` | [classification](https://dictionary.cambridge.org/pronunciation/english/classification) |
| convolution | `/ˈkɑnvəˌluʃən/` | `/ˌkɑnvəˈluʃən/` | [convolution](https://dictionary.cambridge.org/pronunciation/english/convolution) |
| matrices | `/ˈmeɪtɹɪsɪz/` | `/ˈmeɪtɹəˌsiz/` | [matrices](https://dictionary.cambridge.org/pronunciation/english/matrices) |
| network | `/ˈnɛˌtwɝk/` | `/ˈnɛtwɝk/` | [network](https://dictionary.cambridge.org/pronunciation/english/network) |
| optimization | `/ɑptəməˈzeɪʃən/` | `/ˌɑptəməˈzeɪʃən/` | [optimization](https://dictionary.cambridge.org/pronunciation/english/optimization) |
| optimize | `/ˈɑptəˌmaɪz/` | `/ˈɑptəmaɪz/` | [optimize](https://dictionary.cambridge.org/pronunciation/english/optimize) |
| parameter | `/pɚˈæmətɚ/` | `/pəˈɹæmətɚ/` | [parameter](https://dictionary.cambridge.org/pronunciation/english/parameter) |
| probabilistic | `/ˌpɹɑbəbɪˈlɪstək/` | `/ˌpɹɑbəbəlˈɪstɪk/` | [probabilistic](https://dictionary.cambridge.org/pronunciation/english/probabilistic) |
| process | `/ˈpɹɑˌsɛs/` | `/ˈpɹɑsɛs/` | [process](https://dictionary.cambridge.org/pronunciation/english/process) (nghĩa “quá trình/xử lý”) |
| query | `/ˈkwiɹi/` | `/ˈkwɪɹi/` | [query](https://dictionary.cambridge.org/pronunciation/english/query) |

Các dạng `algorithms`, `networks`, `optimized`, `parameters`, `stochastics` và `stochastically` cũng được chỉnh theo từ gốc; riêng `stochastically` được kiểm tra thêm trên [Wiktionary](https://en.wiktionary.org/wiki/stochastically).

## Thay đổi cách chọn phiên âm

1. Dùng mục đã đối chiếu Cambridge nếu có.
2. Với từ còn lại, thử phiên âm từ FreeDictionaryAPI trong tối đa 1,2 giây khi đã có dữ liệu CMU; ưu tiên mục ghi `General American` hoặc `US` thay vì `UK`.
3. Nếu từ điển không trả kịp hoặc không có IPA, dùng phiên âm CMU cục bộ. Nghĩa vẫn hiện trước khi quá trình bổ sung phiên âm hoàn tất.

Cách này giảm khả năng dữ liệu CMU sai ghi đè một mục từ điển tốt hơn, đồng thời giữ đường dự phòng khi mạng chậm. Một số từ ngoài mẫu vẫn có thể sai hoặc khác Cambridge vì khác biệt từ điển và biến thể phát âm; không có API Cambridge được tích hợp vào extension.
