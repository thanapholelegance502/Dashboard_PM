// ‼️ ไฟล์นี้เป็น "ที่เดียวในโค้ดทั้งหมด" ที่ชื่อหัวคอลัมน์ของชีตปรากฏเป็น string
// หยก rename คอลัมน์ → เพิ่ม alias ตรงนี้บรรทัดเดียว ไม่ต้องแก้ที่อื่น
//
// `col: N` = ตรึง index เพราะคอลัมน์นั้น "หัวตารางว่าง" (merged cell ในชีต gviz ไม่คืน label)
// ทุกตัวที่ใช้ col ต้องมีหลักฐานกำกับว่ารู้ได้ยังไง — ห้ามเดา โดยเฉพาะคอลัมน์เงิน
// 🔴 ถ้าหยกแทรก/ลบคอลัมน์ col จะเพี้ยนเงียบ ๆ → ขอให้หยกใส่หัวตารางให้ครบ แล้วย้ายมาใช้ alias

export const YOK_TABS = Object.freeze([
  'Config',
  'Weekly_Update',
  'Milestone',
  'Executive_Action',
  'Pending_Kickoff',
  'Project_Billing',
  'MA_Tracking',
]);

/** แท็บเสมือน — ตารางที่สองในแท็บเดียวกัน (key = ชื่อใน SHEET_MAP, value = แท็บจริง) */
export const VIRTUAL_TABS = Object.freeze({ Billing_Schedule: 'Project_Billing' });

export const SHEET_MAP = {
  // สรุปรายสัปดาห์ระดับ portfolio — ‼️ ไม่มี Project ID (หนึ่งแถวต่อสัปดาห์ ไม่ใช่ต่อโครงการ)
  Weekly_Update: {
    required: true,
    headerRow: 2,
    fields: {
      weekStart: { aliases: ['Week Start', 'สัปดาห์'], required: true },
      summary: { aliases: ['สรุปสำหรับทีมบริหาร', 'Summary'], required: false },
    },
  },

  Milestone: {
    required: true,
    headerRow: 0,
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code'], required: true },
      projectName: { aliases: ['ชื่อโครงการ', 'Project Name'], required: false },
      name: { aliases: ['Milestone'], required: false },
      // หัว "วันที่คาดว่าจะเสร็จ" อยู่ index 4 แต่ข้อมูลอยู่ index 3 (หัวถูก merge เลื่อน)
      dueDate: { col: 3, required: false },
      doneDate: { aliases: ['วันที่เสร็จจริง'], required: false },
      status: { aliases: ['สถานะ', 'Status'], required: false },
      owner: { aliases: ['ผู้รับผิดชอบ', 'Owner'], required: false },
      note: { aliases: ['หมายเหตุ', 'Remark'], required: false },
    },
  },

  Executive_Action: {
    required: true,
    headerRow: 0,
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code'], required: true },
      topic: { aliases: ['เรื่องที่ต้องตัดสินใจ', 'Action'], required: false },
      options: { aliases: ['ทางเลือก / ข้อเสนอแนะ', 'ทางเลือก'], required: false },
      owner: { aliases: ['ผู้ตัดสินใจ', 'Decision Maker'], required: false },
      neededBy: { col: 4, required: false }, // หัวว่าง · เป็นวันที่ อยู่ก่อนคอลัมน์ "ผลกระทบหากล่าช้า"
      impact: { aliases: ['ผลกระทบหากล่าช้า'], required: false },
      status: { aliases: ['สถานะ', 'Status'], required: false },
      decidedAt: { col: 7, required: false }, // หัวว่าง · วันที่ อยู่หลังคอลัมน์ "สถานะ"
      note: { aliases: ['หมายเหตุ', 'Remark'], required: false },
    },
  },

  // ‼️ ไม่มี Project ID — เป็นดีลที่ยังไม่เปิดโครงการ
  Pending_Kickoff: {
    required: false,
    headerRow: 0,
    fields: {
      projectName: { aliases: ['ชื่อโครงการ', 'Project Name'], required: true },
      client: { aliases: ['บริษัทลูกค้า', 'Client'], required: false },
      note: { aliases: ['Remark', 'หมายเหตุ'], required: false },
    },
  },

  // ‼️ แท็บนี้มี 2 ตารางซ้อนกัน — ตารางที่ 1 สรุปรายโครงการ หยุดก่อน banner
  Project_Billing: {
    required: true,
    headerRow: 2,
    stopWhen: /PROJECT PAYMENT SCHEDULE/i,
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code'], required: true },
      projectName: { aliases: ['Project Name', 'ชื่อโครงการ'], required: false },
      systemCount: { aliases: ['จำนวนระบบ'], required: false },
      client: { aliases: ['Client', 'ลูกค้า'], required: false },
      // หัวว่างทั้ง 4 ตัว — ยืนยันด้วยเลขคณิตข้ามหลายแถว ไม่ใช่เดา:
      //   [4] × 1.07 = [5]           → ก่อน VAT / รวม VAT
      //   [7] + [8]  = [5]           → เก็บแล้ว / ค้างเก็บ
      amountExVat: { col: 4, required: false },
      amountIncVat: { col: 5, required: false },
      installments: { col: 6, required: false },
      billed: { col: 7, required: false },
      outstanding: { col: 8, required: false },
      quotationNo: { aliases: ['Remark'], required: false },
    },
  },

  MA_Tracking: {
    required: true,
    headerRow: 2,
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code'], required: true },
      projectName: { aliases: ['Project Name', 'ชื่อโครงการ'], required: false },
      // หัวว่าง — ยืนยันจากค่า: [2] วันเริ่ม < [4] วันสิ้นสุด · [5] = [4]+1 วัน (เริ่มปีถัดไป)
      //   [6] = มูลค่าโครงการ (ตรงกับ Project_Billing[4] ของ project เดียวกัน)
      //   [8] = ค่า MA ต่อปี (= [6] × 12% ตรงกับหมายเหตุในชีต)
      startDate: { col: 2, required: false },
      duration: { aliases: ['ระยะเวลา MA'], required: false },
      endDate: { col: 4, required: false },
      nextStartDate: { col: 5, required: false },
      projectValue: { col: 6, required: false },
      maType: { aliases: ['ประเภท MA'], required: false },
      value: { col: 8, required: false },
      payStatus: { aliases: ['สถานะการชำระ'], required: false },
      note: { aliases: ['หมายเหตุ', 'Remark'], required: false },
    },
  },

  // ตารางที่ 2 ของแท็บ Project_Billing — งวดชำระรายงวด (1 แถว = 1 งวด)
  // คอลัมน์หัวว่างทั้งหมด ยืนยันจากค่า: [6] + [7] = [8] ทุกแถว (ก่อน VAT + VAT = รวม VAT)
  Billing_Schedule: {
    required: false,
    startAfter: /PROJECT PAYMENT SCHEDULE/i,
    headerRow: 'auto',
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code'], required: true },
      installmentNo: { col: 4, required: false },
      paid: { col: 5, required: false }, // 1 = จ่ายแล้ว · 0 = ยังไม่จ่าย
      amountExVat: { col: 6, required: false },
      vat: { col: 7, required: false },
      amountIncVat: { col: 8, required: false },
      dueDate: { col: 11, required: false },
      invoiceDate: { col: 12, required: false },
      paidDate: { col: 13, required: false },
    },
  },

  // Config!J = ทะเบียนชื่อแท็บโครงการ (PJ01…PJ18) — แต่ละโครงการมีแท็บของตัวเอง
  Config: {
    required: false,
    headerRow: 1,
    fields: {
      projectTab: { aliases: ['ชื่อแท็บโครงการ'], required: true },
    },
  },
};
