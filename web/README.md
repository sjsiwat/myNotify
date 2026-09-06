# myDashboard — frontend

React + Tailwind SPA สำหรับแดชบอร์ด (คุยกับ `server/` ผ่าน `/api/*` และ `/auth/*`) ดูภาพรวมโปรเจกต์ทั้งหมดที่ [README.md](../README.md) ของ root

## พัฒนา

รันคู่กับ backend สองเทอร์มินัล:

```bash
npm start        # backend — ที่ root, พอร์ต 3000
npm run dev:web  # frontend — ที่ root เช่นกัน, พอร์ต 5174 (proxy /api และ /auth ไป 3000)
```

หรือรันจากในโฟลเดอร์นี้ตรง ๆ ด้วย `npm run dev`

## Build

```bash
npm run build   # ที่ root — สั่ง build ที่นี่ให้ ผลลัพธ์ลง web/dist
```

`server/index.js` serve `web/dist` เป็นไฟล์ static ตอน `npm start` ต้อง build ก่อนทุกครั้งที่แก้โค้ดฝั่งนี้แล้วจะรันแบบ production

## โครงสร้าง

```
src/
├── components/   UI primitives ที่ใช้ร่วมกันหลายแท็บ (Button, Card, Kpi, Modal, ...)
├── tabs/         เนื้อหาแต่ละแท็บ (Overview, Mail, Calendar, Slack, Discord, Github, Connect)
├── state/        DashboardContext — โหลดข้อมูลจาก /api/* ครั้งเดียวตอน mount แชร์ให้ทุกแท็บ
├── lib/          ฟังก์ชันล้วน ๆ ไม่มี state (api client, date/calendar helpers, formatters)
└── hooks/        custom hooks (useCountUp)
```

ดีไซน์โทเค็น (สี/ฟอนต์/เงา) อยู่ใน `src/index.css` ใต้ `@theme` — ผสมระหว่างธีมเดิมของแอป (ครีม/แดง) กับสไตล์ปุ่มแบบแผ่นสีซ้อน (อ้างอิงจาก Figma ref ที่ผู้ใช้ส่งมา)
