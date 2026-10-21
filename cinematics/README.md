# cinematics

用 Remotion 製作遊戲過場影片，輸出預先 render 好的 mp4 給 web/ 播放。

> 授權提醒：Remotion 對個人與 3 人以下公司免費，商業使用前要確認授權（https://www.remotion.dev/license）。

## 指令

- `npm install`
- `npm run studio`：開啟預覽
- `npm run render`：輸出 `../assets/video/opening.mp4`

圖片素材透過 `scripts/link-assets.mjs` 在 `public/` 建立 symlink 指向根目錄 `assets/`，不重複放進 git。

## 已知狀況

- 本機若 Remotion 自動下載的 Chrome 啟動失敗（`icudtl.dat not found`），可改用 Playwright 的 headless shell：`npm run render -- --browser-executable=<chrome-headless-shell 路徑>`
