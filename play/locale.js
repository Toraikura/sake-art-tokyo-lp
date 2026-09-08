// Presentation only. The match model keeps its original state and messages.
export const locale = new URLSearchParams(globalThis.location?.search || '').get('lang') === 'en' ? 'en' : 'ja';
export const sitePath = locale === 'en' ? '../en/' : '../';

const cardNames = {
  '徳利砲': 'Sake Cannon',
  '酵母隊': 'Yeast Squad',
  '麹のこま': 'Koji Spinner',
  '乳酸菌の拠点': 'Lactic Base',
  '泡の奔流': 'Bubble Rush',
  '櫂入れ': 'Paddle Stir',
};
const english = {
  ...cardNames,
  'SAKE CLASH、30秒のCPU体験': 'SAKE CLASH, a 30-second CPU battle',
  '● あなた': '● YOU',
  'あなたの陣地': 'Your territory',
  '多く塗った方が勝ち': 'Cover more ground to win',
  '陣取り盤面。手札を選び、緑の床に置きます。': 'Territory board. Select a card and place it on the green tiles.',
  'Canvasに対応するブラウザで開いてください。': 'Please use a browser that supports Canvas.',
  '補給': 'Supply',
  'カードの選択を解除': 'Deselect card',
  '一時停止': 'Pause',
  '手札': 'Your hand',
  'ひと休み。': 'Take a break.',
  'この日本酒と、つくり手を知る →': 'Meet the sake and its maker →',
  '対戦を再開 →': 'Resume battle →',
  'もう一回遊ぶ ↻': 'Play again ↻',
  'サイトへ戻る': 'Back to the site',
  '1から4で手札を選び、矢印キーで置く位置を動かし、Enterで配置。Pで一時停止。Escapeで選択解除または一時停止。': 'Press 1–4 to select a card, use the arrow keys to move, and press Enter to place it. P pauses. Escape deselects the card or pauses.',
  '手札を選ぶ ↓': 'Choose a card ↓',
  'カードを選び、緑の床へ配置': 'Choose a card and place it on green tiles',
  'プレイを開始・再開してください': 'Start or resume the battle',
  'カードを選んでください': 'Choose a card',
  '盤面の中を選んでください': 'Choose a spot inside the board',
  '次の配置まで少し待ってください': 'Wait a moment before placing again',
  '補給が足りません': 'Not enough supply',
  '自分の色の床に配置してください': 'Place on your own color',
  'ユニットから少し離して配置してください': 'Place farther from other units',
  'ユニット上限です。一撃カードで支援してください': 'Unit limit reached. Use a one-shot card',
  '生酛の守り、完成！ 被ダメージ35%軽減': 'Kimoto defense ready! 35% less damage',
  'あなたの勝ち！': 'You win!',
  'CPUの勝ち。': 'CPU wins.',
  'いい勝負。': 'A draw.',
  '時間と盤面は止まっています。': 'The timer and board are paused.',
  'あなたが広げた色。次は、日本酒の個性へ。': 'Your share of the board. Now discover the sake behind the game.',
  '離して配置 · 初動の予測': 'Release · preview',
  '× ここには置けません': '× Cannot place here',
};
for (const [ja, en] of Object.entries(cardNames)) english[`${ja}を配置`] = `${en} placed`;

export function translate(value) {
  return locale === 'en' ? english[value] ?? value : value;
}

export function localizeDocument() {
  if (locale !== 'en') return;
  document.documentElement.lang = 'en';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('script, style, noscript')) continue;
    const original = node.nodeValue, trimmed = original.trim();
    if (trimmed) node.nodeValue = original.replace(trimmed, translate(trimmed));
  }
  document.querySelectorAll('[aria-label], [title]').forEach(element => {
    for (const attribute of ['aria-label', 'title']) {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, translate(element.getAttribute(attribute)));
    }
  });
}
