const thToEnMap: Record<string, string> = {
  // Thai Kedmanee keyboard, unshifted number row.
  "\u0E45": "1",
  "/": "2",
  "-": "3",
  "\u0E20": "4",
  "\u0E16": "5",
  "\u0E38": "6",
  "\u0E36": "7",
  "\u0E04": "8",
  "\u0E15": "9",
  "\u0E08": "0",
  "\u0E02": "-",

  // Thai Kedmanee keyboard, shifted number row.
  "\u0E51": "2",
  "\u0E52": "3",
  "\u0E53": "4",
  "\u0E54": "5",
  "\u0E39": "6",
  "\u0E55": "8",
  "\u0E56": "9",
  "\u0E57": "0",
  "\u0E58": "-",

  // Thai Kedmanee keyboard, unshifted letters.
  "\u0E46": "q",
  "\u0E44": "w",
  "\u0E33": "e",
  "\u0E1E": "r",
  "\u0E30": "t",
  "\u0E31": "y",
  "\u0E35": "u",
  "\u0E23": "i",
  "\u0E19": "o",
  "\u0E22": "p",
  "\u0E1A": "[",
  "\u0E25": "]",
  "\u0E03": "\\",
  "\u0E1F": "a",
  "\u0E2B": "s",
  "\u0E01": "d",
  "\u0E14": "f",
  "\u0E40": "g",
  "\u0E49": "h",
  "\u0E48": "j",
  "\u0E32": "k",
  "\u0E2A": "l",
  "\u0E27": ";",
  "\u0E07": "'",
  "\u0E1C": "z",
  "\u0E1B": "x",
  "\u0E41": "c",
  "\u0E2D": "v",
  "\u0E34": "b",
  "\u0E37": "n",
  "\u0E17": "m",
  "\u0E21": ",",
  "\u0E43": ".",
  "\u0E1D": "/",

  // Thai Kedmanee keyboard, shifted letters.
  "\u0E50": "Q",
  '"': "W",
  "\u0E0E": "E",
  "\u0E11": "R",
  "\u0E18": "T",
  "\u0E4D": "Y",
  "\u0E4A": "U",
  "\u0E13": "I",
  "\u0E2F": "O",
  "\u0E0D": "P",
  "\u0E10": "{",
  ",": "}",
  "\u0E05": "|",
  "\u0E24": "A",
  "\u0E06": "S",
  "\u0E0F": "D",
  "\u0E42": "F",
  "\u0E0C": "G",
  "\u0E47": "H",
  "\u0E4B": "J",
  "\u0E29": "K",
  "\u0E28": "L",
  "\u0E0B": ":",
  ".": '"',
  "(": "Z",
  ")": "X",
  "\u0E09": "C",
  "\u0E2E": "V",
  "\u0E3A": "B",
  "\u0E4C": "N",
  "?": "M",
  "\u0E12": "<",
  "\u0E2C": ">",
  "\u0E26": "?",
};

// ช่วงยูนิโค้ดของอักขระไทย (รวมวรรณยุกต์/สระ) ใช้เช็คว่าข้อความมีตัวไทยปนอยู่จริงหรือไม่
const THAI_CHAR_PATTERN = /[\u0E00-\u0E7F]/;

export function normalizeBarcode(input: string): string {
  const trimmed = input.trim();

  // ถ้าข้อความที่ได้รับมาไม่มีตัวอักษรไทยปนอยู่เลย แปลว่ามันเป็นบาร์โค้ดที่ถูกต้อง
  // (เป็นเลข/อังกฤษ) อยู่แล้ว หรือเป็นผลลัพธ์ที่ผ่านการ normalize มาแล้วครั้งหนึ่ง
  // ห้าม map ซ้ำอีก เพราะ thToEnMap มีคีย์ที่เป็นอักขระอังกฤษล้วน เช่น "-", "/", ".", ","
  // ถ้าเผลอ normalize ซ้ำสอง (เช่น ตอนคิวสแกนซ้อนกันแล้วเอาค่าที่ normalize แล้วมา
  // normalize อีกรอบ) อักขระพวกนี้ในบาร์โค้ดจริงจะถูกแปลงเป็นตัวเลขผิดๆ ทันที
  // เช่น "-" จะกลายเป็น "3" ทำให้บาร์โค้ดที่ยิงซ้ำหาไม่เจอในระบบ
  if (!THAI_CHAR_PATTERN.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return trimmed
    .split("")
    .map((ch) => thToEnMap[ch] ?? ch)
    .join("")
    .toUpperCase();
}

export function isLikelyBarcode(input: string): boolean {
  const barcode = normalizeBarcode(input);
  return /^[A-Z0-9\-]+$/.test(barcode);
}