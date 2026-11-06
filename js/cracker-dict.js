/**
 * Chaoxing Auto Sign - 签到码与手势高频破解字典
 */

// 常见 4 位签到码高频字典 (按高校教师设置习惯降序排列)
const COMMON_SIGN_CODES = [
  // 连号与简单数字
  '1234', '0000', '1111', '6666', '8888', '9999', '2222', '3333', '4444', '5555', '7777',
  '4321', '2345', '3456', '5678', '6789', '9876', '8765', '0123',
  // 年份与月份
  '2026', '2025', '2024', '2023', '2022', '2021', '2020',
  '0101', '0102', '0202', '0303', '0404', '0505', '0606', '0707', '0808', '0909', '1010', '1111', '1212',
  '0520', '1314', '0001', '1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000', '9000',
  // 教室与楼栋常见编号
  '0101', '0201', '0301', '0401', '0501', '0601', '0102', '0202', '0302', '0402', '0502',
  '1122', '2233', '3344', '4455', '5566', '6677', '7788', '8899', '9900',
  '1212', '1313', '1414', '1515', '1616', '1717', '1818', '1919', '2020', '2121', '2323',
  '1688', '8866', '6688', '1230', '1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800',
  '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009',
  '1235', '1236', '1256', '1452', '1478', '2580', '1472', '3698'
];

// 常见 3x3 九宫格手势连线高频字典 (数字对应 1~9 九宫格位置)
// 1 2 3
// 4 5 6
// 7 8 9
const COMMON_GESTURES = [
  // 经典 L 型与倒 L 型
  '14789',   // L 型
  '12369',   // 倒 L 型
  '74123',   // 反倒 L 型
  '78963',   // 镜像 L 型
  '98741',   // 逆向反 L 型
  '32147',   // 顶部向左下 L 型
  '96321',   // 逆向倒 L 型
  '36987',   // 底部向左 L 型

  // 经典 Z 型与反 Z 型
  '1235789', // Z 字形
  '3215987', // 反 Z 字形
  '7895123', // 倒 Z 字形
  '9875321', // 逆向 Z 字形
  '12357',   // 短 Z 型
  '32159',

  // 经典对角线与折线
  '159',     // 主对角线
  '357',     // 副对角线
  '15987',   // 对角折线
  '35741',
  '75321',
  '95123',

  // 常见单横线与单竖线
  '123', '456', '789',
  '147', '258', '369',
  '321', '654', '987',
  '741', '852', '963',

  // 矩形 / U 型 / C 型
  '12369874', // 正方形外圈顺时针
  '14789632', // 正方形外圈逆时针
  '1478963',  // U 型
  '3698741',  // 反 U 型
  '1236987',  // C 型
  '3214789',  // 反 C 型

  // 其他常见连线
  '12589',   // 斜阶梯
  '32587',
  '14569',
  '74563',
  '12587',
  '32589',
  '14785',
  '36985',
  '123654',
  '456321',
  '74159',
  '96357',
  '15963',
  '75369',
  '123456789',
  '987654321'
];

/**
 * 并发破解工具类
 */
class SignCracker {
  /**
   * 并发爆破验证签到码或手势码
   * @param {string|number} activeId 活动ID
   * @param {string[]} candidates 待测试的候选序列
   * @param {function} testFn 单个测试异步函数 (code) => Promise<boolean>
   * @param {number} concurrency 并发数，默认 8
   * @param {function} onProgress 进度回调 (tested, total, currentCode) => void
   */
  static async crackWithCandidates(candidates, testFn, concurrency = 8, onProgress = null) {
    let found = null;
    let testedCount = 0;
    const total = candidates.length;

    let index = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (index < candidates.length && !found) {
        const curIdx = index++;
        const code = candidates[curIdx];

        try {
          const isCorrect = await testFn(code);
          testedCount++;
          if (onProgress) onProgress(testedCount, total, code);

          if (isCorrect) {
            found = code;
            break;
          }
        } catch (e) {
          testedCount++;
          if (onProgress) onProgress(testedCount, total, code);
        }
      }
    });

    await Promise.all(workers);
    return found;
  }
}

if (typeof window !== 'undefined') {
  window.COMMON_SIGN_CODES = COMMON_SIGN_CODES;
  window.COMMON_GESTURES = COMMON_GESTURES;
  window.SignCracker = SignCracker;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COMMON_SIGN_CODES, COMMON_GESTURES, SignCracker };
}
