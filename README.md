# All in Grammars

Web học ngữ pháp tiếng Anh: 296 bài chia theo 24 chuyên đề, kèm flashcard và quiz.
Tiến độ học lưu trong `localStorage` của trình duyệt, không cần tài khoản.

**Dùng ngay:** https://grammars.hairbui76.id.vn/

## Tính năng

- Đọc bài theo chuyên đề, đánh dấu bài đã học, xem phần trăm hoàn thành
- Flashcard cho từng chuyên đề (công thức + ví dụ ở mặt sau)
- Quiz "câu nào đúng ngữ pháp" theo chuyên đề, quiz tổng hợp, và luyện lại các bài hay sai
- Tìm kiếm theo tên bài, tên tiếng Việt và toàn bộ nội dung
- Giao diện sáng/tối, dùng tốt trên điện thoại

Phím tắt: `/` tìm kiếm · `←` `→` bài trước/sau · trong flashcard: `Space` lật thẻ, `→` đã thuộc, `←` chưa thuộc · trong quiz: `1` `2` chọn đáp án.

## Chạy trên máy

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # ra thư mục dist/
```

## Nội dung

Bài học là các file Markdown (kiểu Obsidian) trong `Grammar/Concepts/`. Mỗi lần `dev` hoặc `build`,
`scripts/build-content.mjs` chuyển chúng thành JSON trong `src/generated/`:

- Mục `## Form` và `## Examples` thành mặt sau flashcard.
- Các dòng `- ❌ câu sai → ✅ câu đúng` trong `## Common mistakes` thành câu quiz.
- `[[Tên bài]]` thành liên kết giữa các bài.

`content/units.json` quy định thứ tự chuyên đề, tên tiếng Việt và bài nào thuộc chuyên đề nào.
Bài mới chưa có trong file này sẽ tự vào chuyên đề đầu tiên được liên kết ở mục `## Related`.

## Triển khai

Mỗi lần push lên `main`, GitHub Actions (`.github/workflows/deploy.yml`) build và đưa lên GitHub Pages.
