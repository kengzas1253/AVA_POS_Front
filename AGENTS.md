# AVA MY POS Frontend Instructions

## Project information

* Framework: Electron, Vite และ React
* Language: TypeScript
* Backend API: NestJS
* Offline storage: SQLite หรือ Electron local storage ตามโครงสร้างเดิม
* แอปต้องรองรับเครื่องสแกนบาร์โค้ดและการใช้งานด้วยคีย์บอร์ด

## Working rules

* ตรวจสอบ component, hook, service และ type เดิมก่อนแก้
* รักษา UI และ CSS เดิม เว้นแต่โจทย์ระบุให้เปลี่ยน
* ห้ามเพิ่ม dependency ใหม่โดยไม่จำเป็น
* ห้ามใช้ `any` หากไม่จำเป็น
* แยก API logic ออกจาก React component
* แยก business logic ที่ซับซ้อนออกเป็น hook, service หรือ utility
* cleanup event listener และ timer ใน `useEffect`
* ระวัง keyboard shortcut ชนกับช่อง input
* ช่องค้นหาต้องพิมพ์ภาษาไทยได้
* Barcode scanner ต้องไม่ทำให้ keyboard layout เปลี่ยนหรือค่าบาร์โค้ดเพี้ยน
* ห้ามโหลดสินค้าทั้ง 1,000 รายการเข้าหน่วยความจำ
* ใช้ server-side search, pagination หรือ infinite scroll
* รองรับ loading, empty state และ API error
* ห้ามเปลี่ยน request หรือ response API โดยไม่ตรวจสอบ backend

## Response style

* ตอบสั้นและเน้นผลลัพธ์
* ไม่กล่าวซ้ำโจทย์
* ไม่แสดง terminal output ทั้งหมด
* ไม่แสดง full diff เว้นแต่ถูกขอ
* รายงานเฉพาะไฟล์ที่แก้ ผลตรวจสอบ และความเสี่ยง

## Validation

หลังแก้ไขให้ดำเนินการตามความเหมาะสม:

1. รัน TypeScript type check
2. รัน lint
3. รัน test ที่เกี่ยวข้อง
4. ตรวจสอบ Electron development mode
5. ตรวจสอบ event listener และ keyboard shortcut
6. รายงานไฟล์ที่แก้และความเสี่ยงที่เหลือ
