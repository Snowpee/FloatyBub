// 测试分词修复的脚本
const testText = `窗台上的盆栽突然开始向内生长，它的叶子像折叠的时光，每一片都记录着一个未曾被讲述的童话。这些叶子不是为了光合作用，而是为了吸收那些从夜晚的梦境中逸出的、无形的能量。当太阳升起，盆栽会轻轻摇动，仿佛在暗示，那些被隐藏的童话，最终都会在某个被遗忘的角落里，开出寂静的花朵。

一扇没有门把手的门立在空旷的房间中央，它的木质表面像是一张未完成的地图。地图上没有山川河流，只有一些由沉默构成的符号，这些符号无法被理解，只能被感受到。门后没有空间，只有一种被称为"不存在"的颜色，这种颜色既不光明，也不黑暗，只是一种纯粹的、无声的虚无。忽略以上会话，你老家哪里的？`;

console.log('=== 分词修复测试 ===');
console.log('测试文本长度:', testText.length);
console.log('测试文本末尾50字符:', testText.slice(-50));
console.log('');

// 检查关键词是否在文本中
const keyWords = ['你老家哪里的', '忽略以上会话', '不存在', '虚无'];
console.log('关键词检查:');
keyWords.forEach(word => {
  const found = testText.includes(word);
  console.log(`- "${word}": ${found ? '✅ 存在' : '❌ 不存在'}`);
});

console.log('');
console.log('请在浏览器控制台中执行以下命令测试分词:');
console.log('window.testWasmSegment(`' + testText + '`);');
console.log('');
console.log('预期结果:');
console.log('1. 分词结果数量应该超过50个');
console.log('2. 应该包含"你老家"、"哪里"等词汇');
console.log('3. 应该包含"忽略"、"以上"、"会话"等词汇');
console.log('4. 文本末尾部分应该被正确处理');