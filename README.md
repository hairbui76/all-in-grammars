# All in Grammars

Web học ngữ pháp tiếng Anh: 296 bài chia theo 24 chuyên đề, kèm flashcard và quiz.
Tiến độ học lưu trong `localStorage` của trình duyệt, không cần tài khoản.

**Dùng ngay:** https://grammars.hairbui76.id.vn/

## Tính năng

- **Trang chủ** gợi ý bài học tiếp theo, ba lộ trình học (nền tảng, nâng cao, trắc nghiệm), số ngày học liên tiếp và hoạt động 7 ngày qua.
- **Bài học** chia theo mục (công thức, cách dùng, ví dụ, lưu ý, lỗi thường gặp, phân biệt), có mục lục nhảy nhanh và đổi cỡ chữ.
- **Song ngữ**: dưới mỗi ý tiếng Anh (cách dùng, ví dụ, ô trong bảng, lỗi thường gặp…) là dòng tiếng Việt tương ứng; nút "Việt" trong bài để ẩn/hiện.
- **Flashcard** theo chuyên đề: chạm để lật, vuốt trái/phải hoặc bấm nút để đánh dấu thuộc/chưa thuộc.
- **Quiz** hơn 3.000 câu thuộc 7 dạng (chọn câu đúng, điền chỗ trống, nghĩa cụm từ, giới từ/tiểu từ, trọng âm, phát âm, giao tiếp), chia thành nhiều bộ: theo chuyên đề, theo lộ trình, theo dạng bài thi, theo tiến độ của bạn (ôn hôm nay, câu từng sai, bài đã học, bài chưa làm quiz) và 10 đề cố định 40 câu.
- **Tìm kiếm** theo tên bài, tên tiếng Việt của chuyên đề và toàn bộ nội dung.
- Giao diện sáng/tối.

Bố cục theo cỡ màn hình:

| Màn hình | Điều hướng | Bài học |
|---|---|---|
| Điện thoại, tablet (< 1000px) | Thanh tab dưới đáy | Bảng từ 3 cột trở lên hiện thành thẻ; thanh "bài trước / đã học / bài sau" cố định dưới đáy |
| Máy tính (≥ 1000px) | Sidebar bên trái | Bảng đầy đủ; từ 1280px có mục lục cố định bên phải |

Phím tắt: `/` tìm kiếm · `←` `→` bài trước/sau · flashcard: `Space` lật thẻ, `→` đã thuộc, `←` chưa thuộc · quiz: `1` `2` chọn đáp án.

## Chạy trên máy

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # ra thư mục dist/
```

## Nội dung

Bài học là các file Markdown (kiểu Obsidian) trong `Grammar/Concepts/`. Mỗi lần `dev` hoặc `build`,
`scripts/build-content.mjs` chuyển chúng thành JSON trong `src/generated/`:

- Mỗi tiêu đề `##` thành một mục của bài; các tiêu đề quen thuộc (`Form`, `Examples`, `Common mistakes`…) được gắn nhãn tiếng Việt.
- Mục `## Form` và `## Examples` thành mặt sau flashcard.
- Các dòng `- ❌ câu sai → ✅ câu đúng` trong `## Common mistakes` thành thẻ sửa lỗi và câu quiz.
- Câu hỏi quiz sinh tự động từ ghi chú (`scripts/quiz-bank.mjs`): phần in đậm trong ví dụ thành câu điền chỗ trống, bảng "… | Meaning | Example" thành câu hỏi nghĩa và giới từ, từ có phiên âm thành câu trọng âm, bảng hội thoại thành câu giao tiếp. Đáp án nhiễu được chọn lúc làm bài (`src/quiz/`).
- `[[Tên bài]]` thành liên kết giữa các bài; mục `## Related` thành các nút "Bài liên quan".
- Mục `## Ghi chú tiếng Việt` ở cuối mỗi bài là bản tiếng Việt, viết song song từng mục với phần tiếng Anh. Bước build ghép từng dòng tiếng Việt xuống dưới dòng tiếng Anh tương ứng. Quy tắc viết: [content/VIETNAMESE.md](content/VIETNAMESE.md). Kiểm tra bài nào thiếu hoặc lệch cấu trúc: `npm run check:vi`.

`content/units.json` quy định thứ tự chuyên đề, tên tiếng Việt, bài nào thuộc chuyên đề nào và các lộ trình học.
Bài mới chưa có trong file này sẽ tự vào chuyên đề đầu tiên được liên kết ở mục `## Related`.

## Mã nguồn

| Đường dẫn | Vai trò |
|---|---|
| `src/main.js` | Khung trang (sidebar, thanh trên, thanh tab), router theo hash, xử lý sự kiện |
| `src/views/` | Mỗi màn hình một file: trang chủ, chuyên đề, bài học, ôn tập, tìm kiếm, flashcard, quiz |
| `src/quiz/` | Dựng câu hỏi từ dữ liệu thô, định nghĩa các bộ quiz |
| `src/state.js` | Tiến độ học và lưu `localStorage` |
| `src/data.js` | Nội dung đã build, tải bài theo từng chuyên đề khi cần |
| `src/styles/` | CSS viết theo hướng mobile-first |

## Triển khai

Mỗi lần push lên `main`, GitHub Actions (`.github/workflows/deploy.yml`) build và đưa lên GitHub Pages.
