import { repaint } from './navigation.js';

// السبينر متتبّع هنا محلياً، مش من state.workspace.refreshing: الماين بيعمل
// بولينج كل دقيقة لوحده، ولو لفّينا الأيقونة مع كل قراية كانت هتلف في وش
// المستخدم من غير ما يطلب حاجة. اللمبة دي لطلبه هو بس.
let asked = false;

export function isRefreshing() {
  return asked;
}

export async function refreshTasks() {
  if (asked) return;
  asked = true;
  repaint();

  try {
    await window.tayf.refresh();
  } finally {
    asked = false;
    repaint();
  }
}
