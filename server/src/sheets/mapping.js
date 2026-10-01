// ‼️ ไฟล์นี้เป็น "ที่เดียวในโค้ดทั้งหมด" ที่ชื่อหัวคอลัมน์ของชีตปรากฏเป็น string
// หยก rename คอลัมน์ → เพิ่ม alias ตรงนี้บรรทัดเดียว ไม่ต้องแก้ที่อื่น
//
// 🔴 ยังไม่ครบ: ยังไม่เคยเห็นหัวตารางจริง — alias ที่มีตอนนี้มาจากการอ่าน app.js ของเว็บหยก
//    รัน `npm run sheets:headers` หลังตั้ง service account เสร็จ แล้วเติมให้ครบ
//    + เปลี่ยน headerRow จาก 'auto' เป็นเลขแถวจริง (0-based)

/** แท็บทั้งหมดที่ดึงในรอบเดียว */
export const YOK_TABS = Object.freeze([
  'Config',
  'Weekly_Update',
  'Milestone',
  'Executive_Action',
  'Pending_Kickoff',
  'Project_Billing',
  'MA_Tracking',
]);

export const SHEET_MAP = {
  Weekly_Update: {
    required: true,
    headerRow: 'auto',
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code', 'รหัสโครงการ'], required: true },
      projectName: { aliases: ['Project Name', 'ชื่อโครงการ'], required: false },
      week: { aliases: ['Week', 'สัปดาห์', 'Week Of'], required: false },
      weekStart: { aliases: ['Week Start', 'From', 'วันที่เริ่ม'], required: false },
      weekEnd: { aliases: ['Week End', 'To', 'ถึงวันที่'], required: false },
      summary: { aliases: ['Summary', 'Weekly Update', 'สรุป'], required: false },
      risk: { aliases: ['Risk', 'Risk Detail', 'ความเสี่ยง'], required: false },
    },
  },

  Milestone: {
    required: true,
    headerRow: 'auto',
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code', 'รหัสโครงการ'], required: true },
      name: { aliases: ['Milestone', 'Milestone Name', 'ชื่อ Milestone'], required: false },
      dueDate: { aliases: ['Due Date', 'Target Date', 'กำหนดส่ง'], required: false },
      status: { aliases: ['Status', 'สถานะ'], required: false },
    },
  },

  Executive_Action: {
    required: true,
    headerRow: 'auto',
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code', 'รหัสโครงการ'], required: true },
      topic: { aliases: ['Action', 'Topic', 'Issue', 'เรื่อง'], required: false },
      owner: { aliases: ['Owner', 'Decision Maker', 'ผู้ตัดสินใจ'], required: false },
      neededBy: { aliases: ['Needed By', 'Due Date', 'ต้องการภายใน'], required: false },
      status: { aliases: ['Status', 'สถานะ'], required: false },
    },
  },

  Pending_Kickoff: {
    required: false,
    headerRow: 'auto',
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code', 'รหัสโครงการ'], required: true },
      projectName: { aliases: ['Project Name', 'ชื่อโครงการ'], required: false },
      client: { aliases: ['Client', 'ลูกค้า'], required: false },
      value: { aliases: ['Value', 'Project Value', 'มูลค่างาน'], required: false },
      note: { aliases: ['Note', 'Remark', 'หมายเหตุ'], required: false },
    },
  },

  Project_Billing: {
    required: true,
    headerRow: 'auto',
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code', 'รหัสโครงการ'], required: true },
      projectName: { aliases: ['Project Name', 'ชื่อโครงการ'], required: false },
      installment: { aliases: ['Installment', 'Payment', 'งวด', 'Milestone'], required: false },
      amount: { aliases: ['Amount', 'Value', 'จำนวนเงิน'], required: false },
      dueDate: { aliases: ['Due Date', 'Payment Date', 'กำหนดชำระ'], required: false },
      status: { aliases: ['Status', 'Payment Status', 'สถานะ'], required: false },
    },
  },

  MA_Tracking: {
    required: true,
    headerRow: 'auto',
    fields: {
      projectId: { aliases: ['Project ID', 'Project Code', 'รหัสโครงการ'], required: true },
      projectName: { aliases: ['Project Name', 'ชื่อโครงการ'], required: false },
      client: { aliases: ['Client', 'ลูกค้า'], required: false },
      startDate: { aliases: ['Start Date', 'MA Start', 'วันเริ่ม'], required: false },
      endDate: { aliases: ['End Date', 'Expiry', 'MA End', 'วันหมดอายุ'], required: false },
      value: { aliases: ['Value', 'Amount', 'มูลค่า'], required: false },
    },
  },

  // Config: เว็บหยกอ่านแค่คอลัมน์ J — ยังไม่ยืนยันว่าคืออะไร (ถามหยก)
  Config: {
    required: false,
    headerRow: 'auto',
    fields: {},
  },
};
