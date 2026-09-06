// قاعدة حلقة "تقدم النهاردة" لوحدها، من غير DOM، عشان تتجرّب.
//
// الاستعلام الأساسي بيجيب المفتوح بس (statusCategory != Done)، يعني التاسك
// أول ما تتقفل بتختفي من items خالص. عشان كده لازم قايمة تانية جنبها لللي
// اتقفل النهاردة، وإلا البسط يفضل صفر مهما قفلت.
//
// اللي اتقفل بس لسه محسوب في items — دي اللحظة التفاؤلية بين ما تنقل التاسك
// وما القراية ترجع — بتتعدّ برضه، عشان الحلقة تتحرك على طول مش بعد ثانية.

function dueBy(today) {
  return (item) => !!item.due && item.due <= today;
}

function keysOf(items) {
  return new Set(items.map((item) => item.key));
}

export function todayProgress(items, closedToday, today) {
  const onPlate = dueBy(today);
  const open = (items || []).filter(onPlate);
  const closed = (closedToday || []).filter(onPlate);

  const done = keysOf([...closed, ...open.filter((item) => item.category === 'done')]);
  const total = keysOf([...open, ...closed]);

  return { done: done.size, total: total.size };
}
